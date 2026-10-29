-- Fase F: firma remota de documentos en el proyecto de pruebas.
-- No contiene datos ni correos reales. NO se ha aplicado: revisar y ejecutar una sola vez.
-- Requiere las migraciones de Fase C y Fase D.
--
-- Cambios:
-- 1. Las familias ya no pueden insertar filas en signature_records directamente.
--    La unica via es la RPC family_sign_document, que deriva familia y firmante de auth.uid().
-- 2. Evidencias de firma: nombre escrito, imagen de la firma y su huella, decision de imagen.
-- 3. Una sola firma valida por inscripcion y version documental.
-- 4. Las familias pueden subir, sin sobrescribir, el PDF firmado a su carpeta de tk-signed-documents.
-- 5. Huellas SHA-256 de los PDF originales sembrados en Fase C.
--
-- Limite conocido: la huella del PDF la calcula el navegador. La RPC comprueba que el archivo
-- existe en la ruta declarada, pero no puede leer su contenido. Verificarla en servidor requiere
-- una edge function (pendiente de una fase posterior).

-- 1. Columnas de evidencia ----------------------------------------------------------------
alter table public.signature_records add column if not exists signer_name text;
alter table public.signature_records add column if not exists evidence_storage_path text;
alter table public.signature_records add column if not exists evidence_sha256 text;
alter table public.signature_records add column if not exists image_decision text;

do $$ begin
  alter table public.signature_records add constraint signature_records_image_decision_allowed
    check (image_decision is null or image_decision in ('authorize', 'deny'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.signature_records add constraint signature_records_sha256_format
    check (
      (final_sha256 is null or final_sha256 ~ '^[0-9a-f]{64}$')
      and (evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$')
    ) not valid;
exception when duplicate_object then null;
end $$;

-- 2. Una sola firma valida por inscripcion y version ---------------------------------------
do $$ begin
  if exists (
    select 1 from public.signature_records
    where status = 'signed' and enrollment_id is not null
    group by enrollment_id, document_version_id having count(*) > 1
  ) then
    raise exception 'Hay firmas duplicadas para una misma inscripcion y version. Revisarlas antes de aplicar la Fase F.';
  end if;
end $$;

create unique index if not exists signature_records_one_signed_per_version
  on public.signature_records (enrollment_id, document_version_id)
  where status = 'signed';

create index if not exists idx_signatures_enrollment on public.signature_records (enrollment_id);

-- 3. Huellas de los originales sembrados ----------------------------------------------------
update public.document_versions set sha256 = 'f9851555bc7a1273b37cc00147be6ebe6bde0b0124d589f81745dc61d8094cc4'
where storage_path = 'originals/training-kids/CONTRATO_ACTIVIDAD_TRAINING_KIDS.pdf' and sha256 is null;
update public.document_versions set sha256 = '3738e20a958719ea70b3d1fd2f1b2b332aefb2a3773067e248df993609c47960'
where storage_path = 'originals/training-kids/AUTORIZACION_PUBLICACION_DE_IMAGENES_TRAINING_KIDS.pdf' and sha256 is null;
update public.document_versions set sha256 = '4f18b1e148879c779786dbb01f1e77ce0fbc772739a42e00d25f9fb27ac10939'
where storage_path = 'originals/training-kids/Normativa_y_Garantias_Training_Kids.pdf' and sha256 is null;
update public.document_versions set sha256 = 'a065b6c46805d8950102f304e5c070a7c38003c406cb5cfb298120ccefddc7cd'
where storage_path = 'originals/football-academy/Calendario_Training_Kids_Football_Academy_2026_2027.pdf' and sha256 is null;

-- 4. RPC de firma ----------------------------------------------------------------------------
create or replace function public.family_sign_document(
  p_enrollment_id uuid,
  p_document_version_id uuid,
  p_signer_name text,
  p_completed_data jsonb,
  p_accepted_consents jsonb,
  p_evidence_storage_path text,
  p_evidence_sha256 text,
  p_final_storage_path text default null,
  p_final_sha256 text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_enrollment public.enrollments;
  v_document public.service_documents;
  v_version public.document_versions;
  v_existing public.signature_records;
  v_prefix text;
  v_image_decision text;
  v_consent text;
  v_required_consents text[];
  v_signature_id uuid;
begin
  if v_family_id is null then raise exception 'family_access_denied'; end if;

  if not exists (
    select 1 from public.family_members
    where user_id = auth.uid() and family_id = v_family_id and status = 'active' and can_sign
  ) then raise exception 'signer_not_allowed'; end if;

  select * into v_enrollment from public.enrollments
  where id = p_enrollment_id and family_id = v_family_id
  for update;
  if v_enrollment.id is null then raise exception 'enrollment_not_found'; end if;
  if v_enrollment.status = 'withdrawn' or v_enrollment.review_status = 'rejected' then
    raise exception 'enrollment_not_signable';
  end if;

  select * into v_version from public.document_versions where id = p_document_version_id;
  if v_version.id is null or v_version.status <> 'pending_signature' then
    raise exception 'document_version_not_signable';
  end if;
  select * into v_document from public.service_documents where id = v_version.service_document_id;
  if v_document.id is null or not v_document.active or v_document.scope <> 'enrollment'
     or v_document.service_id is distinct from v_enrollment.service_id then
    raise exception 'document_version_not_signable';
  end if;

  if nullif(btrim(p_signer_name), '') is null or length(btrim(p_signer_name)) > 160 then
    raise exception 'signer_name_required';
  end if;
  if jsonb_typeof(p_completed_data) is distinct from 'object' or p_completed_data = '{}'::jsonb
     or pg_column_size(p_completed_data) > 65536 then
    raise exception 'completed_data_invalid';
  end if;
  if jsonb_typeof(p_accepted_consents) is distinct from 'object' then
    raise exception 'consents_missing';
  end if;

  v_required_consents := array['lectura_completa', 'version_aceptada', 'firma_simulada'];
  if v_document.code = 'activity_contract' then
    v_required_consents := v_required_consents || array['contrato_actividad', 'anexo_1_riesgos', 'anexo_2_parq'];
  end if;
  foreach v_consent in array v_required_consents loop
    if (p_accepted_consents -> v_consent) is distinct from 'true'::jsonb then
      raise exception 'consents_missing';
    end if;
  end loop;

  if v_document.code = 'image_authorization' then
    v_image_decision := p_completed_data -> 'imageAuthorization' ->> 'value';
    if v_image_decision is null or v_image_decision not in ('authorize', 'deny') then
      raise exception 'image_decision_required';
    end if;
  end if;

  if coalesce(p_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or (p_final_sha256 is not null and p_final_sha256 !~ '^[0-9a-f]{64}$') then
    raise exception 'signature_hash_invalid';
  end if;
  if v_document.code = 'activity_contract' and (p_final_storage_path is null or p_final_sha256 is null) then
    raise exception 'signed_pdf_required';
  end if;

  v_prefix := 'families/' || v_family_id || '/enrollments/' || v_enrollment.id || '/' || v_version.id || '/';
  if p_evidence_storage_path is null or left(p_evidence_storage_path, length(v_prefix)) <> v_prefix
     or p_evidence_storage_path like '%..%'
     or not exists (select 1 from storage.objects where bucket_id = 'tk-signature-evidence' and name = p_evidence_storage_path) then
    raise exception 'signature_file_missing';
  end if;
  if p_final_storage_path is not null and (
       left(p_final_storage_path, length(v_prefix)) <> v_prefix
       or p_final_storage_path like '%..%'
       or not exists (select 1 from storage.objects where bucket_id = 'tk-signed-documents' and name = p_final_storage_path)
     ) then
    raise exception 'signature_file_missing';
  end if;

  -- Reintento idempotente: misma firma ya registrada devuelve el mismo identificador.
  select * into v_existing from public.signature_records
  where enrollment_id = v_enrollment.id and document_version_id = v_version.id and status = 'signed';
  if v_existing.id is not null then
    if v_existing.evidence_sha256 = p_evidence_sha256
       and v_existing.final_sha256 is not distinct from p_final_sha256 then
      return v_existing.id;
    end if;
    raise exception 'document_already_signed';
  end if;

  insert into public.signature_records (
    family_id, player_id, enrollment_id, document_version_id, signer_user_id, status,
    signed_at, completed_data, accepted_consents, final_storage_path, final_sha256, locked_at,
    signer_name, evidence_storage_path, evidence_sha256, image_decision
  ) values (
    v_family_id, v_enrollment.player_id, v_enrollment.id, v_version.id, auth.uid(), 'signed',
    now(), p_completed_data, p_accepted_consents, p_final_storage_path, p_final_sha256, now(),
    btrim(p_signer_name), p_evidence_storage_path, p_evidence_sha256, v_image_decision
  ) returning id into v_signature_id;

  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id, metadata)
  values (
    v_family_id, auth.uid(), 'Familia', 'Documento firmado: ' || v_document.title,
    'signature_records', v_signature_id, v_enrollment.service_id,
    jsonb_strip_nulls(jsonb_build_object(
      'document_code', v_document.code,
      'version', v_version.version,
      'enrollment_id', v_enrollment.id,
      'image_decision', v_image_decision,
      'final_sha256', p_final_sha256
    ))
  );
  return v_signature_id;
end;
$$;

-- 5. Permisos ---------------------------------------------------------------------------------
drop policy if exists signatures_family_insert on public.signature_records;
revoke insert, update, delete on public.signature_records from authenticated;

revoke all on function public.family_sign_document(uuid, uuid, text, jsonb, jsonb, text, text, text, text) from public;
grant execute on function public.family_sign_document(uuid, uuid, text, jsonb, jsonb, text, text, text, text) to authenticated;

-- El PDF firmado se sube una sola vez a la carpeta de la familia. Sin politica de update ni delete:
-- un archivo subido no puede sobrescribirse ni borrarse desde el navegador.
drop policy if exists storage_family_signed_insert on storage.objects;
create policy storage_family_signed_insert on storage.objects
for insert
with check (
  bucket_id = 'tk-signed-documents'
  and (storage.foldername(name))[1] = 'families'
  and (storage.foldername(name))[3] = 'enrollments'
  and public.can_access_family(((storage.foldername(name))[2])::uuid)
);
