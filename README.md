# 🎉 Fiestas de Abraveses de Tera 2027

> Aplicación web progresiva (PWA) moderna, ligera y optimizada para móvil para consultar el programa oficial de fiestas de **Abraveses de Tera (Zamora)**.

Sitio web en GitHub Pages: **[https://abraveses-de-tera.github.io/Abraveses2027/](https://abraveses-de-tera.github.io/Abraveses2027/)**

---

## 🌟 Características principales

* 📱 **Experiencia Mobile-First ultrarrápida:** Diseñada específicamente para abrirse al instante desde enlaces compartidos en WhatsApp y redes sociales, con tipografía nítida y botones táctiles amplios.
* 📅 **Agenda interactiva por días:** Selector de días de la semana (del 23 al 29 de agosto de 2027) con códigos de color festivos y vista general de "Todos los días".
* 🔍 **Buscador en tiempo real:** Filtra al instante por título de actividad, artistas, descripción o ubicación con botón de borrado rápido.
* 🏷️ **Filtros por categoría:** Música, Gastronomía, Infantil, Tradición, Deporte, Juegos, Solidario y Ocio.
* ❤️ **Mis planes (Favoritos):** Marca actividades con el corazón o estrella para crear tu itinerario festivo personalizado, guardado automáticamente en tu navegador (`localStorage`).
* 🔴 **Estado "En directo ahora":** Resaltado dinámico con pulso visual de la actividad que se está celebrando en el momento actual y etiqueta de "Siguiente actividad".
* 📍 **Guía de lugares y navegación:** Fichas con ubicaciones y modal explicativo de los puntos clave del pueblo (Plaza Mayor, Frontón, Bodegas, Santuario, Iglesia, La Era) con botón de navegación directa en Google Maps.
* 🗓️ **Sincronización con calendarios:** Añade cualquier actividad con 1 clic a **Google Calendar** o descarga el archivo `.ics` para **Apple Calendar y Outlook**.
* 📤 **Compartir en redes y WhatsApp:** Enlaces directos a cada actividad mediante la API nativa `navigator.share` o copia al portapapeles con aviso flotante.
* 🖼️ **Visor de Cartel Oficial:** Modal integrado para consultar el cartel completo de las fiestas en alta resolución sin salir de la web.
* 📲 **PWA instalable y modo 100% offline:** Funciona sin cobertura en el pueblo gracias al Service Worker con estrategia de caché inteligente (precarga de assets e imágenes).
* 💬 **Comunidad:** Botón directo para unirse al grupo oficial de WhatsApp del pueblo.

---

## 📁 Estructura del proyecto

```text
Abraveses2027/
├── index.html              # Estructura semántica principal y modales
├── manifest.json           # Manifiesto de la aplicación PWA
├── sw.js                   # Service Worker para funcionamiento sin conexión
├── css/
│   └── styles.css          # Estilos CSS modulares, variables de color y diseño responsive
├── js/
│   ├── app.js              # Lógica de agenda, filtros, favoritos, modales y exportación
│   └── countdown.js        # Cuenta atrás dinámica hasta el inicio de fiestas
├── data/
│   └── events.json         # Base de datos editable de actividades, categorías y lugares
├── images/
│   ├── abraveses.jpg       # Escudo representativo de Abraveses de Tera
│   ├── cartel-oficial.jpg  # Cartel de fiestas completo optimizado
│   ├── bendicion-boyas.jpg # Fotografía bendición de boyas
│   ├── cagada-gallina.jpg  # Fotografía cagada de la gallina
│   ├── disfraz.jpg         # Fotografía desfile infantil
│   ├── hermita.jpg         # Fotografía Santuario / Romería
│   ├── marcha-solidaria.jpg# Fotografía marcha solidaria FUNDAME
│   ├── romeria-pendones.jpg# Fotografía romería de pendones
│   ├── ruta-bodegas.jpg    # Fotografía ruta por las bodegas
│   └── icons/              # Iconos PWA y favicon (192px, 512px, favicon)
├── .gitignore              # Exclusiones de archivos del sistema
└── README.md               # Documentación y guía de mantenimiento
```

---

## ✏️ Cómo añadir o editar actividades en `data/events.json`

Toda la información del programa está centralizada en `data/events.json`. **No hace falta tocar código HTML ni JavaScript** para modificar los eventos.

### 1. Formato de un día

Cada día dentro del array `"days"` tiene esta estructura:

```json
{
  "id": "24",
  "date": "2027-08-24",
  "short": "Mar",
  "label": "Martes 24 de agosto",
  "color": "red",
  "events": [ ... ]
}
```

* `color`: puede ser `orange`, `red`, `blue`, `yellow`, `green`, `pink`, `cyan` o `purple`.

### 2. Formato de una actividad (evento)

Para añadir o editar un evento dentro del array `"events"`:

```json
{
  "eventId": "nombre-unico-sin-espacios",
  "category": "musica",
  "time": "23:30",
  "title": "Concierto o actividad",
  "description": "Subtítulo o resumen corto.",
  "note": "Aviso opcional (ej: Inscripción previa)",
  "location": "Plaza Mayor",
  "icon": "🎸",
  "photo": "images/mi-foto.jpg",
  "featured": true,
  "link": {
    "label": "Instagram de la orquesta",
    "url": "https://www.instagram.com/..."
  },
  "detail": "Explicación detallada de la actividad que aparecerá al desplegar la tarjeta."
}
```

> **Consejo:** Si un dato o artista aún no está cerrado, puedes indicarlo como `"Por confirmar"` en `title` o `note`.

---

## 🚀 Cómo activar GitHub Pages

Para publicar la web de forma gratuita y con HTTPS en GitHub:

1. Ve a tu repositorio en GitHub: [https://github.com/Abraveses-de-tera/Abraveses2027](https://github.com/Abraveses-de-tera/Abraveses2027)
2. Haz clic en la pestaña **Settings** (Configuración) arriba a la derecha.
3. En el menú lateral izquierdo, haz clic en **Pages**.
4. En la sección **Build and deployment**:
   - **Source:** selecciona `Deploy from a branch`.
   - **Branch:** elige la rama `main` y la carpeta `/ (root)`.
   - Pulsa **Save**.
5. En unos instantes, la web estará disponible en:  
   👉 **`https://abraveses-de-tera.github.io/Abraveses2027/`**

---

## 🚀 Funcionalidades de la Fase 2 (¡Implementadas!)

1. 🔔 **Notificaciones Push Web:**
   * Los vecinos pueden suscribirse a los avisos oficiales de las fiestas directamente desde el navegador.
   * Alertas urgentes en pantalla para cancelaciones o reubicaciones por lluvia (ej: traslado al frontón) o cambios de horario en las orquestas.
   * Manejador nativo en `sw.js` con vibración háptica e icono oficial de la ermita.
   * Botón de prueba instantánea incluido para verificar la recepción de avisos.

2. 👥 **Contador de asistencia con Firebase Realtime Database:**
   * Autenticación anónima transparente (`signInAnonymously()`) que genera un identificador único seguro por usuario sin pedir contraseñas ni emails.
   * Recuento colaborativo en tiempo real de asistentes para actividades multitudinarias (paella popular, sardinada tradicional, ruta por las bodegas, chocolatada).
   * Reglas de base de datos seguras (`database.rules.json`) que impiden la manipulación o sobrescritura malintencionada:
     ```json
     {
       "rules": {
         "attendance": {
           ".read": true,
           "$eventId": {
             "$uid": {
               ".write": "auth != null && auth.uid === $uid",
               ".validate": "!newData.exists() || (newData.isBoolean() && newData.val() === true)"
             }
           }
         }
       }
     }
     ```

3. 🌙 **Modo Noche / Oscuro automático:**
   * Detección automática al anochecer (entre las 21:00 y las 08:00) o según la preferencia del sistema (`prefers-color-scheme: dark`).
   * Botón de alternancia en la cabecera (🌓 Auto / 🌙 Noche / ☀️ Día) con persistencia en `localStorage`.
   * Diseñado con tonos oscuros de alto contraste para evitar deslumbramientos durante los conciertos y verbenas de madrugada, reduciendo además el consumo de batería en pantallas OLED móviles.

4. 🗺️ **Mapa interactivo embebido (Leaflet.js + OpenStreetMap):**
   * Mapa interactivo integrado en el modal de lugares con chinchetas sobre Abraveses de Tera.
   * Chinchetas interactivas para:
     * ⛪ **Santuario Virgen de las Encinas**
     * 🏛️ **Plaza del pueblo**
     * 🍷 **Las Bodegas tradicionales**
     * 🎾 **El Frontón municipal**
     * 🌾 **La Era / Campo de la fiesta**
   * Popups personalizados con detalles, botón de navegación GPS y acceso directo desde cada actividad de la agenda.

5. 🎉 **Extras festivos:**
   * 🚀 **Chupinazo interactivo:** Botón para lanzar el cohete festivo con sonido sintetizado (Web Audio API sin descargas pesadas), vibración háptica y lluvia de confeti multicolor.
   * ☀️ **El tiempo en directo en Abraveses de Tera:** Previsión meteorológica en tiempo real mediante la API gratuita Open-Meteo, con consejos adaptados al programa de fiestas.

---

## 👥 Créditos

Creado con cariño por **Andoni Herrera** para el pueblo de **Abraveses de Tera (Zamora)**.
