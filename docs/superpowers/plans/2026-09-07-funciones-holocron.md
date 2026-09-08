# Funciones de HOLOCRON sin rediseño

Nel pide conservar la tarjeta de jugador, mantener el aspecto general y mejorar funciones. Durante esta tanda prioriza que el escáner reconozca rápidamente una carta al colocarla frente al móvil.

## Alcance acordado

1. Escáner: reproducir el fallo, corregir geometría del encuadre y concurrencia de lectura, reconocimiento automático con confirmación para agregar. Conservar método por imagen y umbrales de seguridad. Mostrar fallos recuperables de catálogo/índice y mejorar cámara móvil. Probar con imágenes conocidas y fotogramas simulados; el resultado no sustituye una medición en teléfono físico.
2. Accesos: Mercado móvil abre su pestaña; registro y recuperación abren sus formularios y conservan retorno.
3. Mazos: comparar demanda (principal, sideboard, líderes/base) contra colección física, mostrar faltantes y enlazar a mercado filtrado.

La cola durable de sincronización queda para otra tanda: su implementación aún no comenzó y requiere pruebas propias de importaciones, perfiles y conflictos. Esta decisión concentra el trabajo actual en el escáner solicitado.

## Verificación y entrega

- Pruebas de regresión del reconocimiento, encuadre, lecturas concurrentes y descarte de resultados obsoletos.
- Pruebas de accesos/retorno y faltantes/impresiones/perfiles.
- TypeScript, build y lint; revisión móvil en banco DEV sin escribir datos de cuentas.
- Documentar limitaciones y cambios en BITACORA, CLAUDE y AGENTS. Entregar rama revisable sin desplegar esta tanda automáticamente.

No cambiar tarjeta de jugador, HomePage, tema visual ni SQL de producción.
