# OBS — configuración del stream SWU

OBS ya está instalado (v32.2.1). Estos pasos se hacen **una vez**. Después, el día
del torneo, solo abrís OBS y tocás dos botones.

---

## 1. Primer arranque (da permisos)

Abrí OBS. En el primer arranque:

1. Si aparece el **asistente de configuración automática**, elegí **Cancelar** —
   lo configuramos a mano abajo, que es más preciso.
2. macOS va a pedir permiso de **Cámara** y **Micrófono** la primera vez que OBS
   los use. Concedelos. Si no salen solos: Ajustes del Sistema → Privacidad y
   seguridad → Cámara / Micrófono → activar OBS.

---

## 2. Importar las escenas

`Colección de escenas` (menú de arriba) → `Importar` → elegí el archivo:

```
/Users/nelson/Claude/swu-companion/obs/SWU-EN-VIVO.json
```

Quedan dos escenas:

- **SWU · EN VIVO** — cámara al centro + marcador encima. Es la del torneo.
- **SWU · Solo marcador** — solo el arte, para probarlo sin cámara.

La fuente **Marcador** ya apunta a `https://www.swusv.com/overlay/SV01`, 1920×1080,
fondo transparente, con «apagar cuando no esté visible» y «refrescar al activar»
en OFF (así no parpadea).

> Mientras el sitio no esté publicado, para probar el arte cambiá esa URL a
> `https://www.swusv.com/overlay/SV01?debug=1` (datos de demo) o a
> `http://localhost:5173/overlay/SV01?debug=1` si estás corriendo el proyecto local.

---

## 3. Elegir la cámara

En la escena, doble clic en **Cámara (iPhone)** → en `Dispositivo` elegí tu iPhone
(aparece como cámara de Continuity cuando está cerca, con Bluetooth y Wi-Fi
encendidos, mismo Apple ID). **No uses modo avión**: apaga la cámara de Continuity.
Si preferís por cable, conectá el iPhone por USB y aceptá «Confiar» en el teléfono.

El encuadre ya está puesto para ocupar la franja central de 1080 px y dejar los
420 px de cada lado para el marcador.

---

## 4. Ajustes que hay que escribir a mano

### Ajustes → Vídeo
| Campo | Valor |
|---|---|
| Resolución base (lienzo) | **1920×1080** |
| Resolución de salida | **1920×1080** |
| FPS | **30** |

### Ajustes → Salida  (modo «Avanzado»)
| Campo | Valor |
|---|---|
| Codificador | **Apple VT H264 Hardware** (usa el chip del M5, no calienta) |
| Control de tasa | **CBR** |
| Tasa de bits | **4500 Kbps** (plan B de red: 3000) |
| Intervalo de fotograma clave | **2 s** |
| Perfil | high |
| Audio | **128 Kbps** |

### Ajustes → Salida → Grabación
| Campo | Valor |
|---|---|
| Formato | **mkv** (sobrevive a un corte de luz) |
| Ruta | **un disco aparte**, con ≥40 GB libres |

> La grabación local es el seguro: aunque se caiga el internet de la tienda, el
> archivo se sigue grabando y el VOD queda entero.

### Ajustes → Transmisión
| Campo | Valor |
|---|---|
| Servicio | **YouTube - RTMPS** |
| Servidor | Primary YouTube ingest server |
| Clave de transmisión | **la tuya** (ver abajo cómo sacarla) |

### Ajustes → Avanzado → Retardo de transmisión
- **Suizo:** desactivado (0 s).
- **Top cut (Top 8/4/final):** activar, **600 segundos**. Evita que alguien vea
  las manos por el stream. Ojo: con retardo activo, «Detener transmisión» tarda
  10 min en drenar — un clic drena, dos clics cortan ya y perdés esos 10 min.

---

## 5. El día del evento: solo dos botones

1. **Iniciar grabación** (siempre, primero).
2. **Iniciar transmisión.**

Las escenas (Empezamos pronto / Juego / Descanso / Fin) y todo el marcador se
manejan desde el **panel del estudio en tu celular** (`swusv.com/estudio/SV01`),
no desde OBS. OBS queda quieto.
