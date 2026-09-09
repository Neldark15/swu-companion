# Avisos de terceros

## Forceteki

Motor de reglas: https://github.com/SWU-Karabast/forceteki
Revisión: `139c14a240b75498b403ccdb06144a136972ecb6`.
La caché del servicio conserva el código y LICENSE originales. El adaptador de HOLOCRON no inicia servicios de Karabast.

```text
Copyright (c) 2016 Stuart Walsh (https://github.com/ringteki/ringteki)
Copyright (c) 2024 Addison Mayberry

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Datos de cartas

**El snapshot descrito abajo no se distribuye en este repositorio** (ver
`fixtures/LEEME.md`): la fuente contradice la decisión registrada en el §3h-ter de
`CLAUDE.md` y hay que reemplazarla por `api.swuapi.com` antes de encender el servicio.
Lo que sigue describe el archivo tal como lo generó la rama, para que se pueda auditar.

Catálogo público de Fantasy Flight Games: https://admin.starwarsunlimited.com/api/cards, consultado el 8 de septiembre de 2026, normalizado por scripts/fetchdata.js del motor fijado. El snapshot comprimido conserva datos de reglas y metadatos; no incluye ilustraciones. Las cartas y marcas Star Wars: Unlimited pertenecen a sus titulares (Fantasy Flight Games / Lucasfilm). La licencia MIT del motor no otorga derechos sobre esas marcas o ilustraciones.

Premier se valida contra el catálogo Current de esta revisión (JTL, LOF, IBH, SEC, LAW, ASH; reimpresiones por identidad). TS26 es Eternal según upstream. Cad Bane, Still Faster Than You está suspendido en Premier. Actualizar revisión/catálogo requiere revisar legalidad y pruebas.
