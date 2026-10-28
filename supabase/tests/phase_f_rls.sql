-- Pruebas manuales de Fase F (firma remota).
-- Ejecutar solo tras aplicar 202610280001_phase_f_remote_signature.sql en el proyecto de pruebas.
-- Todo ocurre dentro de una transaccion que termina en rollback: no deja datos.
-- Usa los usuarios y registros ficticios de las migraciones de Fase C ya aplicadas:
--   tutor ficticio a87bb54e-..., administrador ficticio 8266239d-...,
--   familia demo 99999999-..., familia de aislamiento aaaaaaaa-...-000000000002,
--   inscripcion ficticia 77777777-...-771 (no se modifica: todo acaba en rollback).
-- La inscripcion aaaaaaaa-...-0000000000e1 no existe a proposito: representa una ajena.
-- Si todo va bien, el editor termina sin errores. Un fallo aparece en rojo con "Fallo".

begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'a87bb54e-9143-4290-92a4-6e919e77002e';

-- 1. Una familia ya no puede insertar firmas directamente.
do $$ begin
  begin
    insert into public.signature_records (family_id, enrollment_id, document_version_id, status, signed_at)
    values ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777771', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 'signed', now());
    raise exception 'RLS fallo: familia pudo insertar una firma directa';
  exception when insufficient_privilege then null;
  when others then
    if sqlerrm = 'RLS fallo: familia pudo insertar una firma directa' then raise; end if;
  end;
end $$;

-- 2. Una familia no puede firmar la inscripcion de otra familia.
do $$ begin
  begin
    perform public.family_sign_document(
      'aaaaaaaa-0000-0000-0000-0000000000e1', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 'Intento cruzado',
      '{"x":{"value":"1"}}'::jsonb,
      '{"lectura_completa":true,"version_aceptada":true,"firma_simulada":true,"contrato_actividad":true,"anexo_1_riesgos":true,"anexo_2_parq":true}'::jsonb,
      'families/aaaaaaaa-0000-0000-0000-000000000002/enrollments/aaaaaaaa-0000-0000-0000-0000000000e1/ffffffff-ffff-ffff-ffff-fffffffffff1/x-firma.png',
      repeat('a', 64), null, null
    );
    raise exception 'RLS fallo: familia pudo firmar una inscripcion ajena';
  exception when others then
    if sqlerrm = 'RLS fallo: familia pudo firmar una inscripcion ajena' then raise; end if;
  end;
end $$;

-- 3. El contrato exige PDF firmado y las aceptaciones de anexos.
do $$ begin
  begin
    perform public.family_sign_document(
      '77777777-7777-7777-7777-777777777771', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 'Tutor Prueba',
      '{"x":{"value":"1"}}'::jsonb,
      '{"lectura_completa":true,"version_aceptada":true,"firma_simulada":true}'::jsonb,
      'families/99999999-9999-9999-9999-999999999999/enrollments/77777777-7777-7777-7777-777777777771/ffffffff-ffff-ffff-ffff-fffffffffff1/x-firma.png',
      repeat('a', 64), null, null
    );
    raise exception 'Fallo: contrato firmado sin anexos ni PDF';
  exception when others then
    if sqlerrm = 'Fallo: contrato firmado sin anexos ni PDF' then raise; end if;
  end;
end $$;

-- 4. Una huella con formato incorrecto se rechaza.
do $$ begin
  begin
    perform public.family_sign_document(
      '77777777-7777-7777-7777-777777777771', 'ffffffff-ffff-ffff-ffff-fffffffffff2', 'Tutor Prueba',
      '{"imageAuthorization":{"value":"deny"}}'::jsonb,
      '{"lectura_completa":true,"version_aceptada":true,"firma_simulada":true}'::jsonb,
      'families/99999999-9999-9999-9999-999999999999/enrollments/77777777-7777-7777-7777-777777777771/ffffffff-ffff-ffff-ffff-fffffffffff2/x-firma.png',
      'no-es-una-huella', null, null
    );
    raise exception 'Fallo: huella invalida aceptada';
  exception when others then
    if sqlerrm = 'Fallo: huella invalida aceptada' then raise; end if;
  end;
end $$;

-- 5. Caso valido de autorizacion de imagen.
-- Requiere haber subido antes, con el usuario de la familia A, la imagen de firma en
-- tk-signature-evidence con la ruta indicada. Sustituir RUTA_FIRMA_SUBIDA y HUELLA_FIRMA.
-- select public.family_sign_document(
--   '77777777-7777-7777-7777-777777777771', 'ffffffff-ffff-ffff-ffff-fffffffffff2', 'Tutor Prueba',
--   '{"imageAuthorization":{"label":"Decision","value":"deny"}}'::jsonb,
--   '{"lectura_completa":true,"version_aceptada":true,"firma_simulada":true}'::jsonb,
--   'RUTA_FIRMA_SUBIDA', 'HUELLA_FIRMA', null, null
-- );
-- Repetir la misma llamada debe devolver el mismo identificador (reintento idempotente).
-- Una llamada con otra huella debe fallar con document_already_signed.

-- 6. Una firma registrada no se puede modificar, ni siquiera por administracion.
set local "request.jwt.claim.sub" = '8266239d-b676-4965-be6e-342138311623';
do $$ begin
  begin
    update public.signature_records set signer_name = 'Cambio' where status = 'signed';
    if found then raise exception 'Fallo: firma modificada tras registrarse'; end if;
  exception when others then
    if sqlerrm = 'Fallo: firma modificada tras registrarse' then raise; end if;
  end;
end $$;

rollback;
