# Taller Kyber — Implementation Plan

> For agentic workers: use subagent-driven-development; execute the approved visual direction in this session.

**Goal:** Mejorar exclusivamente el Taller Kyber con materiales y herrajes más creíbles, encuadre de detalle e interfaz móvil basada en la maqueta aprobada.

**Architecture:** Conservar Three.js directo, el catálogo existente y las RPC. Compartir el render entre producción y el banco de desarrollo. Separar la geometría y las texturas reutilizables de la escena y mantener los recursos cacheados y liberados al desmontar.

**Tech Stack:** React 19, TypeScript estricto, Three.js 0.185, CSS local, Vite 7.

## Global Constraints

- Solo Taller Kyber; no rediseñar inicio ni otros módulos. El Header general se omite únicamente en las dos rutas del taller para evitar duplicación; la navegación global se conserva.
- Mantener catálogo, acceso, créditos, compras, rarezas y guardado sin cambios de reglas.
- Sin migraciones, datos de prueba ni escrituras en producción durante las verificaciones.
- Mantener movimiento reducido, pausa al ocultarse, liberación de GPU y fallback sin WebGL.
- Vista completa conserva el encuadre de todo el sable; detalle encuadra la empuñadura y puede recortar la punta de la hoja deliberadamente.
- Móvil primero: visor y selección horizontal juntos, controles táctiles y etiquetas legibles.
- No imágenes estáticas sustituyendo al modelo 3D ni nuevas dependencias gráficas.

## Task 1: Materiales, geometría y herrajes

Files: `src/features/sable/herrajesTres.ts`, nuevo `geometriaSable.ts`, helpers locales de texturas, `miniaturaSable3D.ts`, prueba de geometría en `scripts/`.

- [x] Crear `crearGeometriaPieza(pieza: PiezaSuelta, segmentos?: number): THREE.LatheGeometry`, con UV proporcional a distancia real y perfiles válidos; reutilizar en la miniatura y entregar a la escena.
- [x] Texturas deterministas de acero cepillado, rugosidad y agarres; textura distinta para cuero. Valores moderados que permitan leer los reflejos.
- [x] Biselar cajas/aletas y mejorar el alojamiento del cristal respetando los modelos existentes y el caché de recursos.
- [x] Verificar geometría finita, UV y todas las combinaciones mediante pruebas del módulo; revisar consumo de recursos y disposal.

## Task 2: Interfaz móvil y banco

Files: `SablePage.tsx`, `BancoSable3D.tsx`, componentes presentacionales y CSS dentro de `src/features/sable/`.

- [x] Mantener los cuatro pasos y las operaciones actuales; separar una presentación reutilizable para probar el taller completo sin cuenta en el banco DEV.
- [x] Implementar grafito, ámbar, jerarquía de texto, visor amplio, carrusel de piezas y botones táctiles. Eliminar decoración de neumorfismo solo dentro del taller.
- [x] Añadir selector Detalle / Completo que envía `encuadre: 'detalle' | 'completo'` a `SableEscena`; default detalle en la pantalla del taller.
- [x] Banco sin compras ni guardado remoto, catálogo local y claro rótulo de prueba. Mantener edición de emisor/cuerpo/pomo, cristales y acabados.
- [x] Verificar a 390×844, 360×740, 820×1180 y escritorio; revisar controles accesibles, desplazamiento del carrusel y visibilidad del modelo al seleccionar.

## Task 3: Escena, iluminación y cámara

Files: `SableEscena.tsx`, helper puro de encuadre si procede, pruebas en `scripts/`.

- [x] Añadir prop opcional `encuadre?: 'detalle' | 'completo'` (default completo para compatibilidad); en detalle medir solo mango y separación, en completo incluir hoja.
- [x] Sustituir entorno decorativo dominante por iluminación de estudio y luz local del cristal, sin sombras o postprocesado costoso.
- [x] Usar la geometría compartida; conservar un renderer por montaje, movimiento reducido y limpieza.
- [x] Verificar que completo no corta extremos y detalle conserva el mango en rotaciones y cambios de piezas.

## Task 4: Integración y entrega

- [x] Ejecutar `npx tsx scripts/sable-perfiles.test.mts`, las nuevas pruebas, `npm run build` y `npm run lint`; documentar fallos preexistentes por separado.
- [x] Revisar visualmente banco compartido, pasos, piezas, acabados y modo completo/detalle; revisar en código el fallback sin WebGL, movimiento reducido y limpieza.
- [x] Revisión independiente del diff y corrección de hallazgos.
- [x] Actualizar `BITACORA.md` y el contexto del proyecto con las nuevas reglas verificadas.
- [x] Entregar la prueba local revisable y la rama de trabajo; publicar solamente si está autorizado.

## Resultado de verificación

Build y lint pasan (0 errores; 6 warnings existentes fuera del taller). Pasan las tres pruebas de perfiles, geometría y encuadre. Banco interactuado en los cuatro tamaños indicados, incluido el guardado local. Revisión independiente sin bloqueantes pendientes. Sin pruebas de compras o guardado remoto, ni mediciones en un móvil físico; no se promete una tasa de FPS. La prueba se entrega local, en la rama `feature/taller-kyber-materiales`.
