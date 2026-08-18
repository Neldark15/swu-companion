-- ─────────────────────────────────────────────────────────────────────
-- Guardar ajustes SIN borrar los que quien guarda no conoce.
-- Aplicada en producción el 2026-08-18.
--
-- `update profiles set settings = <objeto>` reemplaza el jsonb ENTERO. El
-- cliente manda lo que tiene en su store local, y toda clave que ese store no
-- conozca desaparece. Medido en producción: al abrir la credencial por primera
-- vez se escribieron sus 6 campos nuevos y se llevaron por delante `country` y
-- `continent` — que viven en `settings` pero NO en ese store. Efecto visible:
-- la sala de chat del país dejó de existir para esa cuenta, porque la
-- pertenencia se decide con `settings->>'country'`. Afectó a 2 cuentas.
--
-- La mina es vieja (cualquier guardado de ajustes podía dispararla); lo que
-- cambió es que apareció una pantalla que la pisaba seguido.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.fusionar_settings(p_parche jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_final jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  if p_parche is null or jsonb_typeof(p_parche) <> 'object' then
    raise exception 'El parche tiene que ser un objeto';
  end if;

  -- `||` sobre jsonb es fusión superficial: conserva lo que no venga en el
  -- parche. Y al ser UNA sentencia, dos aparatos guardando a la vez no se
  -- pisan — cosa que un leer-modificar-escribir desde el cliente no garantiza.
  update profiles
     set settings = coalesce(settings, '{}'::jsonb) || p_parche
   where id = auth.uid()
   returning settings into v_final;

  return v_final;
end $$;

revoke all on function public.fusionar_settings(jsonb) from anon;
grant execute on function public.fusionar_settings(jsonb) to authenticated;

-- Restauración de lo perdido. Fusión, no reemplazo.
update profiles
   set settings = coalesce(settings,'{}'::jsonb) || '{"country":"SV","continent":"CA"}'::jsonb
 where not (settings ? 'country');
