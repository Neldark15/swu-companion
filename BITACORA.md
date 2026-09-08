# Bitácora — HOLOCRON SWU (swu-companion)

Registro compartido entre Claude y ChatGPT. **La entrada más nueva va arriba.** Formato:

```
## AAAA-MM-DD · Claude | ChatGPT · <título corto>
**Qué cambió:** ...
**Archivos:** ...
**Cómo verificar:** ...
**Pendiente / notas para el siguiente:** ...
```

---

## 2026-09-07 · ChatGPT · Taller Kyber: materiales 3D y editor móvil
**Qué cambió:** Prueba limitada al taller, basada en la maqueta móvil aprobada. Metal cepillado y agarres con mapas deterministas, microbiseles, herrajes redondeados, alojamiento del cristal, iluminación de estudio y halo suave. Más detalle en Faro/Blindaje. Editor compartido con el banco DEV, cuatro pasos, carrusel horizontal y encuadres Detalle/Completo. Recuperación de saldo/inventario sin perder la edición. Se incorpora el contexto compartido creado por Claude conservando su entrada anterior.
**Archivos:** `src/features/sable/` (editor, escena, geometría, materiales, entorno y miniaturas); `Header.tsx` omite la cabecera duplicada solo en el taller; pruebas `kyber-geometria.test.mts` y `kyber-encuadre.test.mts`; plan en `docs/superpowers/plans/2026-09-07-taller-kyber.md`; contexto en CLAUDE.md §5l y AGENTS.md.
**Cómo verificar:** `npm run build`, `npm run lint` (0 errores; 6 advertencias preexistentes fuera del taller), `npx tsx scripts/sable-perfiles.test.mts`, `npx tsx scripts/kyber-geometria.test.mts`, `npx tsx scripts/kyber-encuadre.test.mts`. Todas pasan. Banco revisado a 360×740, 390×844, 820×1180 y 1280×900, con cambios de pieza/material/cristal/color, encuadre y guardado local. Revisión independiente sin bloqueantes pendientes.
**Pendiente / notas para el siguiente:** Rama `feature/taller-kyber-materiales`, prueba local en `/banco-sable-3d`; sin publicar ni aplicar SQL. No se hicieron compras ni guardados de cuenta reales. Medir rendimiento en un teléfono físico antes de prometer FPS; movimiento reducido, WebGL fallback y liberación GPU revisados en código. El shell exige `.env.local` válido incluso para el banco (detalle §5l). Catálogo oculto, reglas de créditos y RPC se conservan.

## 2026-09-07 · Claude · Se crea el contexto compartido para agentes
**Qué cambió:** Se agregan `AGENTS.md` (resumen autocontenido que remite al `CLAUDE.md` por §) y esta `BITACORA.md`; al `CLAUDE.md` solo se le antepone una cabecera que apunta a los dos. Sin cambios de código ni de base.
**Archivos:** `AGENTS.md`, `BITACORA.md`, cabecera de `CLAUDE.md`.
**Cómo verificar:** `npm run build` sigue pasando (no se tocó código); leer `AGENTS.md` §3–§5 y confirmar que los comandos existen en `package.json`.
**Pendiente / notas para el siguiente:** Estado al día de hoy: `main` == `origin/main` en 8b91159 (2026-09-06, «la tienda — repetidas a créditos y sobres que se compran»), árbol limpio. Liga PUENTE 3 en demo cerrado con `publica = false` y 120 inscritos `[demo]`: borrarlos con el SQL de CLAUDE.md §5j antes de abrirla. `docs/torneo-2026-08-15-datos.md` no se carga a Supabase hasta tener las 12 partidas. TODOs en código: QR real en `JoinEventPage.tsx` y Realtime en `EventLobbyPage.tsx`. Rama remota `claude/app-scifi-design-lkdx1i` sin merge (decidir). La «Estructura de carpetas» del `CLAUDE.md` está vieja; el resto del archivo es la fuente de verdad.
