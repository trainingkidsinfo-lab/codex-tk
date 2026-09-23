-- Pruebas negativas manuales de Fase D.
-- Ejecutar solo tras aplicar la migracion D en el proyecto de pruebas.
-- Sustituir los UUID marcados por usuarios y registros ficticios aislados.

begin;
set local role authenticated;

-- Una familia no puede editar un jugador ajeno mediante la RPC.
set local "request.jwt.claim.sub" = 'UUID_AUTH_FAMILIA_A';
do $$ begin
  begin
    perform public.family_save_player(
      'UUID_JUGADOR_FAMILIA_B', 'Intento', 'Cruzado', '2017-01-01', '', '', '', '', 'Tutor'
    );
    raise exception 'RLS fallo: familia pudo editar jugador ajeno';
  exception when others then
    if sqlerrm = 'RLS fallo: familia pudo editar jugador ajeno' then raise; end if;
  end;
end $$;

-- Una familia no puede convertirse en admin.
do $$ begin
  begin
    insert into public.user_roles (user_id, role, family_id)
    values ('UUID_AUTH_FAMILIA_A', 'admin', null);
    raise exception 'RLS fallo: familia pudo asignarse rol admin';
  exception when insufficient_privilege then null;
  when others then
    if sqlerrm = 'RLS fallo: familia pudo asignarse rol admin' then raise; end if;
  end;
end $$;

-- Una familia no puede revisar una solicitud administrativamente.
do $$ begin
  begin
    perform public.admin_review_enrollment('UUID_INSCRIPCION_FAMILIA_A', 'approve', null, 'Intento');
    raise exception 'RLS fallo: familia pudo aprobar una solicitud';
  exception when others then
    if sqlerrm = 'RLS fallo: familia pudo aprobar una solicitud' then raise; end if;
  end;
end $$;

-- El admin ficticio si puede revisar la solicitud autorizada.
set local "request.jwt.claim.sub" = 'UUID_AUTH_ADMIN';
select public.admin_review_enrollment('UUID_INSCRIPCION_FAMILIA_A', 'request_changes', null, 'Prueba transaccional');

rollback;
