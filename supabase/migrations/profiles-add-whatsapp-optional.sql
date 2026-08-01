-- Teléfono de WhatsApp para cerrar intercambios. OPCIONAL.
-- Aplicada en producción el 2026-07-31.
--
-- ── Qué exposición implica, dicho sin vueltas ─────────────────────────
--
-- Guardar un teléfono es guardar un dato personal. La app nunca lo va a
-- DIBUJAR como texto —arma el enlace wa.me y listo— pero cualquiera de los
-- miembros con sesión que sepa mirar el código de la página puede sacarlo.
-- Es aceptable en un grupo de 16 personas que se conocen y juegan juntas los
-- sábados; no lo sería en una app abierta. Por eso es opcional y se puede
-- borrar en cualquier momento dejando el campo vacío.
--
-- ── Quién lo puede leer ───────────────────────────────────────────────
--
-- `anon` NO. Y no hizo falta hacer nada para eso: en
-- privacy-close-email-and-honor-is-public.sql se le quitó el grant de tabla y
-- se le dio una lista explícita de 9 columnas, así que toda columna nueva le
-- queda invisible por omisión. Verificado con curl antes y después: pedir
-- `select=id,name,whatsapp` sin sesión devuelve 42501.
--
-- `authenticated` SÍ, y sujeto a las políticas de fila que ya existen: si
-- alguien apaga "perfil público", desaparece junto con su colección.
--
-- El opt-in real es el propio valor: si está NULL no hay nada que leer y la
-- app cae al modo compartir del navegador, que no necesita número.

alter table public.profiles
  add column if not exists whatsapp text;

-- Solo dígitos y un + inicial opcional, de 8 a 15 caracteres (E.164 admite
-- hasta 15). No valida que el número exista — eso lo dice WhatsApp al abrirlo.
alter table public.profiles
  drop constraint if exists profiles_whatsapp_format;
alter table public.profiles
  add constraint profiles_whatsapp_format
  check (whatsapp is null or whatsapp ~ '^\+?[0-9]{8,15}$');

comment on column public.profiles.whatsapp is
  'PII opcional. Solo para armar el enlace wa.me de intercambios; la app nunca lo muestra como texto. Invisible para anon por los grants de columna.';
