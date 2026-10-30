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
│   ├── bendicion-bollas.jpg# Fotografía bendición de bollas
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

## 🔮 Funcionalidades recomendadas para una segunda fase

1. **Notificaciones Push Web:** Avisos automáticos en el móvil cuando haya un cambio de hora o aviso meteorológico emitido por la comisión.
2. **Contador de asistencia con Firebase Realtime Database:** Integración segura y anónima para conocer cuántos vecinos prevén asistir a la paella, sardinada o ruta de bodegas.
3. **Modo Claro / Modo Noche automático:** Selector de tema para mayor comodidad visual durante las verbenas nocturnas.
4. **Mapa interactivo con Leaflet/OpenStreetMap:** Visualización gráfica con pines interactivos dentro de Abraveses de Tera directamente en la web.

---

## 👥 Créditos

Creado con cariño por **Andoni Herrera** para el pueblo de **Abraveses de Tera (Zamora)**.
