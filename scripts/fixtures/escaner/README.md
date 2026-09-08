# Imágenes de regresión del escáner

Cinco imágenes oficiales en inglés, obtenidas del CDN de Star Wars Unlimited el 2026-09-07. `cartas.json` conserva las URLs de origen y UUID del catálogo; arte y nombres pertenecen a sus respectivos titulares. Se usan como fixtures de prueba, fuera de `public/`.

`escaner-imagen.test.mts` ejecuta el reconocedor real contra `public/card-hashes.bin`, con Canvas nativo e IndexedDB en memoria. Verifica imagen completa, cuatro tamaños de cámara, centrado, ±3% de escala, 2% de desplazamiento y mesa vacía. El hash conserva su reducción por áreas y DCT originales.

Antes de corregir la geometría: 2/20 fotogramas centrados reconocidos. Después: 20/20 centrados y 80/80 con las variaciones descritas, más cinco fotos recortadas. Es una regresión controlada, no una tasa de acierto en fotografías reales ni una medición de latencia en móvil. Faltan pruebas físicas con distintas cámaras, fundas, reflejos y perspectiva.

El banco `/banco-escaner` solo se importa en DEV. Sus guardados viven en un Map, y únicamente hidrata el catálogo local con estos datos públicos. Ni su chunk ni estas imágenes deben aparecer en `dist/assets` ni en el precache de producción.
