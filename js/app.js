/**
 * ============================================================================
 * PROGRAMA DE FIESTAS DE ABRAVESES DE TERA 2027
 * Lógica principal de la aplicación web (Vanilla JavaScript moderno)
 * ============================================================================
 */

(function () {
  "use strict";

  // --- Constantes y Claves de Almacenamiento ---
  const STORAGE_FAVS_KEY = "abraveses2027_favorites";
  const STORAGE_ATTEND_KEY = "abraveses2027_attendances";
  const STORAGE_THEME_KEY = "abraveses2027_theme";
  const ESTIMATED_DURATION_MINUTES = 120; // 2 horas de duración estimada por evento

  // --- Estado de la Aplicación ---
  let appData = {
    year: 2027,
    title: "",
    subtitle: "",
    dates: "",
    whatsappUrl: "",
    categories: {},
    locations: [],
    days: []
  };

  let selectedDayId = "all";
  let selectedCategory = "all";
  let searchQuery = "";
  let showFavoritesOnly = false;
  let eventStatuses = new Map();
  let attendCounts = {};
  let authReady = false;
  let authReadyPromise = null;
  let currentThemeMode = "auto";
  let leafletMap = null;
  let mapMarkers = {};

  function hasFirebase() {
    return typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0;
  }

  function ensureAuth() {
    if (!hasFirebase() || typeof firebase.auth !== "function") {
      return Promise.reject(new Error("Firebase no disponible"));
    }
    if (authReady && firebase.auth().currentUser) {
      return Promise.resolve(firebase.auth().currentUser);
    }
    if (authReadyPromise) return authReadyPromise;

    authReadyPromise = new Promise((resolve, reject) => {
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          authReady = true;
          unsubscribe();
          resolve(user);
        }
      });
      firebase.auth().signInAnonymously().catch((err) => {
        unsubscribe();
        authReadyPromise = null;
        reject(err);
      });
    });
    return authReadyPromise;
  }

  function listenAttendanceCounts() {
    if (!hasFirebase()) return;
    try {
      firebase.database().ref("attendance").on("value", (snapshot) => {
        const data = snapshot.val() || {};
        attendCounts = Object.fromEntries(
          Object.entries(data).map(([eventId, users]) => [eventId, Object.keys(users || {}).length])
        );
        document.querySelectorAll("[data-attend-count]").forEach((element) => {
          const eventId = element.dataset.attendCount;
          const count = attendCounts[eventId] || 0;
          element.textContent = `${count} ${count === 1 ? "persona va" : "personas van"}`;
        });
      });
    } catch (e) {
      console.warn("Aviso en listenAttendanceCounts:", e);
    }
  }

  // --- Elementos del DOM ---
  const dayTabsEl = document.getElementById("dayTabs");
  const categoryFiltersEl = document.getElementById("categoryFilters");
  const eventsContainerEl = document.getElementById("eventsContainer");
  const selectedDayLabelEl = document.getElementById("selectedDayLabel");
  const searchInputEl = document.getElementById("searchInput");
  const searchClearEl = document.getElementById("searchClear");
  const favoritesButtonEl = document.getElementById("favoritesButton");
  const favoritesCounterEl = document.getElementById("favoritesCounter");
  const todayButtonEl = document.getElementById("todayButton");
  const noResultsEl = document.getElementById("noResults");
  const resetFiltersBtnEl = document.getElementById("resetFiltersButton");
  const whatsappBtnEl = document.getElementById("whatsappBtn");

  // Modales y Toasts
  const posterModalEl = document.getElementById("posterModal");
  const mapModalEl = document.getElementById("mapModal");
  const adminModalEl = document.getElementById("adminModal");
  const btnOpenPosterEl = document.getElementById("btnOpenPoster");
  const btnOpenMapEl = document.getElementById("btnOpenMap");
  const btnOpenAdminEl = document.getElementById("btnOpenAdmin");
  const locationsListEl = document.getElementById("locationsList");
  const toastEl = document.getElementById("appToast");

  // Elementos de Alerta Activa en Vivo
  const liveAlertBannerEl = document.getElementById("liveAlertBanner");
  const liveAlertLabelEl = document.getElementById("liveAlertLabel");
  const liveAlertTimeEl = document.getElementById("liveAlertTime");
  const liveAlertTitleEl = document.getElementById("liveAlertTitle");
  const liveAlertMessageEl = document.getElementById("liveAlertMessage");

  // --- Utilidades de Almacenamiento Local (LocalStorage) ---
  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_FAVS_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function setFavorites(favs) {
    localStorage.setItem(STORAGE_FAVS_KEY, JSON.stringify(favs));
    updateFavoritesUI();
  }

  function toggleFavorite(eventId) {
    const favs = getFavorites();
    if (favs[eventId]) {
      delete favs[eventId];
      showToast("Eliminado de tus planes");
    } else {
      favs[eventId] = true;
      showToast("¡Añadido a tus planes! ❤️");
    }
    setFavorites(favs);
    renderEvents();
  }

  function getAttendances() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_ATTEND_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function toggleAttendance(eventId, button) {
    const attends = getAttendances();
    const alreadyGoing = attends[eventId] === true;

    // Actualización local inmediata
    attends[eventId] = !alreadyGoing;
    localStorage.setItem(STORAGE_ATTEND_KEY, JSON.stringify(attends));
    if (!alreadyGoing) {
      launchConfetti();
      showToast("¡Te has apuntado a esta actividad! ✓");
    } else {
      showToast("Has retirado tu asistencia");
    }

    if (button) {
      button.classList.toggle("is-attending", !alreadyGoing);
      const iconSpan = button.querySelector("span[aria-hidden='true']");
      if (iconSpan) iconSpan.textContent = !alreadyGoing ? "✓" : "🙋";
      button.childNodes[button.childNodes.length - 1].textContent = !alreadyGoing ? " Ya voy a esta actividad" : " Confirmar asistencia";
    } else {
      renderEvents();
    }

    // Sincronización en la nube con Firebase (si está disponible)
    if (hasFirebase()) {
      ensureAuth()
        .then((user) => {
          const ref = firebase.database().ref(`attendance/${eventId}/${user.uid}`);
          if (!alreadyGoing) {
            return ref.set(true);
          } else {
            return ref.remove();
          }
        })
        .catch((err) => {
          console.warn("Aviso al sincronizar asistencia con Firebase:", err);
        });
    }
  }

  // --- Notificación Toast ---
  let toastTimer = null;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2400);
  }

  // --- Carga Inicial de Datos ---
  async function loadData() {
    let initialized = false;

    // 1. Carga inmediata desde datos precargados si están disponibles
    if (window.ABRAVESES_DATA && Array.isArray(window.ABRAVESES_DATA.days)) {
      appData = window.ABRAVESES_DATA;
      try {
        initApp();
        initialized = true;
      } catch (e) {
        console.error("Error al inicializar con datos precargados:", e);
      }
    }

    // 2. Cargar o actualizar desde data/events.json dinámicamente
    try {
      const basePath = window.location.pathname.endsWith("/")
        ? window.location.pathname
        : window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      const jsonUrl = window.location.origin + basePath + "data/events.json?v=" + Date.now();

      const response = await fetch(jsonUrl);
      if (response.ok) {
        const freshData = await response.json();
        if (freshData && Array.isArray(freshData.days) && freshData.days.length > 0) {
          appData = freshData;
          if (!initialized) {
            initApp();
            initialized = true;
          } else {
            renderDayTabs();
            renderCategoryFilters();
            renderLocationsModal();
            updateFavoritesUI();
            renderEvents();
          }
          return;
        }
      }
    } catch (err) {
      console.warn("Aviso al consultar events.json en red:", err);
    }

    // 3. Si por alguna razón crítica no se pudo inicializar
    if (!initialized) {
      eventsContainerEl.innerHTML = `
        <div class="no-results">
          <p class="no-results-title">Error al cargar el programa</p>
          <p class="no-results-desc">Por favor, recarga la página o comprueba tu conexión.</p>
        </div>
      `;
    }
  }

  // --- Inicialización de Interfaz ---
  let hasAutoTriggeredChupinazo = false;

  function initApp() {
    if (appData.whatsappUrl && whatsappBtnEl) {
      whatsappBtnEl.href = appData.whatsappUrl;
    }

    initTheme();
    renderDayTabs();
    renderCategoryFilters();
    renderLocationsModal();
    updateFavoritesUI();
    renderEvents();

    setupEventListeners();
    handleHashNavigation();
    listenAttendanceCounts();
    ensureAuth().catch(() => {});
    initNotifications();
    loadWeather();
    listenLiveAlerts();
    initAdminPanel();

    // Chupinazo festivo automático al abrir la aplicación
    if (!hasAutoTriggeredChupinazo) {
      hasAutoTriggeredChupinazo = true;
      setTimeout(() => {
        triggerChupinazo();
      }, 700);
    }

    // Actualizar estado de "en directo" periódicamente
    setInterval(() => {
      computeEventStatuses();
      renderEvents();
    }, 60 * 1000);
  }

  // --- Renderizado de Pestañas de Días ---
  function renderDayTabs() {
    let tabsHtml = `
      <button class="day-tab is-active" type="button" data-day-id="all">
        <span class="tab-day-name">Todos</span>
        <span class="tab-day-number">✓</span>
      </button>
    `;

    appData.days.forEach((day) => {
      tabsHtml += `
        <button class="day-tab" type="button" data-day-id="${day.id}" data-color="${day.color}">
          <span class="tab-day-name">${day.short}</span>
          <span class="tab-day-number">${day.id}</span>
        </button>
      `;
    });

    dayTabsEl.innerHTML = tabsHtml;
  }

  // --- Renderizado de Filtros de Categoría ---
  function renderCategoryFilters() {
    let chipsHtml = `
      <button class="cat-pill ${selectedCategory === "all" ? "is-active" : ""}" type="button" data-category="all">
        <span>✨ Todas</span>
      </button>
    `;

    Object.entries(appData.categories).forEach(([key, cat]) => {
      chipsHtml += `
        <button class="cat-pill ${selectedCategory === key ? "is-active" : ""}" type="button" data-category="${key}">
          <span>${cat.icon} ${cat.label}</span>
        </button>
      `;
    });

    categoryFiltersEl.innerHTML = chipsHtml;
  }

  // --- Renderizado de Lugares en el Modal ---
  function renderLocationsModal() {
    if (!locationsListEl || !appData.locations) return;

    locationsListEl.innerHTML = appData.locations.map((loc) => {
      const mapsQuery = encodeURIComponent(`${loc.name}, Abraveses de Tera, Zamora`);
      const mapsUrl = loc.mapUrl || `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
      return `
        <li class="location-item">
          <div class="location-item-main">
            <span class="location-item-icon" aria-hidden="true">${loc.icon || "📍"}</span>
            <div class="location-item-text">
              <div class="location-item-title-row">
                <h4 class="location-item-name">${loc.name}</h4>
                <span class="location-item-badge">${loc.tag || "Punto festivo"}</span>
              </div>
              <p class="location-item-desc">${loc.description}</p>
            </div>
          </div>
          <div class="location-item-actions">
            <button type="button" class="mini-pill btn-focus-loc-map" data-loc-id="${loc.id}" title="Centrar en el mapa de Abraveses">
              <span>🗺️ Ver</span>
            </button>
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="mini-pill mini-pill--gps" title="Navegación GPS en Google Maps">
              <span>↗️ GPS</span>
            </a>
          </div>
        </li>
      `;
    }).join("");
  }

  // --- Actualizar Estado de Favoritos en Interfaz ---
  function updateFavoritesUI() {
    const favs = getFavorites();
    const count = Object.keys(favs).length;

    if (favoritesCounterEl) {
      favoritesCounterEl.textContent = count;
      favoritesCounterEl.hidden = count === 0;
    }

    if (favoritesButtonEl) {
      favoritesButtonEl.classList.toggle("is-active", showFavoritesOnly);
      const heartIcon = favoritesButtonEl.querySelector(".heart-icon");
      if (heartIcon) {
        heartIcon.textContent = showFavoritesOnly ? "❤️" : "♡";
      }
      favoritesButtonEl.setAttribute("aria-pressed", showFavoritesOnly ? "true" : "false");
    }
  }

  // --- Cálculo de Estado "En Directo" y "Siguiente" ---
  function computeEventStatuses() {
    const now = new Date();
    const flatList = [];

    appData.days.forEach((day) => {
      day.events.forEach((ev) => {
        const [hours, minutes] = ev.time.split(":").map(Number);
        const dayNum = parseInt(day.id, 10);
        // Mes de agosto es índice 7 en JavaScript
        const start = new Date(appData.year, 7, dayNum, hours, minutes, 0, 0);
        const end = new Date(start.getTime() + ESTIMATED_DURATION_MINUTES * 60 * 1000);
        flatList.push({ eventId: ev.eventId, start, end });
      });
    });

    flatList.sort((a, b) => a.start - b.start);

    eventStatuses.clear();
    const live = flatList.find((item) => now >= item.start && now < item.end);
    if (live) {
      eventStatuses.set(live.eventId, "live");
    }

    const upcoming = flatList.find((item) => item.start > now);
    if (upcoming && (!live || live.eventId !== upcoming.eventId)) {
      eventStatuses.set(upcoming.eventId, "next");
    }
  }

  // --- Filtro de Actividades ---
  function filterEvents(day) {
    const favs = getFavorites();
    const term = searchQuery.trim().toLowerCase();

    return day.events.filter((ev) => {
      // Filtro por categoría
      if (selectedCategory !== "all" && ev.category !== selectedCategory) {
        return false;
      }

      // Filtro por favoritos
      if (showFavoritesOnly && !favs[ev.eventId]) {
        return false;
      }

      // Filtro por texto de búsqueda
      if (term) {
        const titleMatch = ev.title.toLowerCase().includes(term);
        const descMatch = (ev.description || "").toLowerCase().includes(term);
        const locMatch = (ev.location || "").toLowerCase().includes(term);
        const detailMatch = (ev.detail || "").toLowerCase().includes(term);
        if (!titleMatch && !descMatch && !locMatch && !detailMatch) {
          return false;
        }
      }

      return true;
    });
  }

  // --- Generación de Marcado de Tarjeta de Evento ---
  function renderEventCard(ev, day, cardId) {
    const isFav = getFavorites()[ev.eventId] === true;
    const isAttending = getAttendances()[ev.eventId] === true;
    const status = eventStatuses.get(ev.eventId);

    const isFeaturedClass = ev.featured ? "event-card--featured" : "";
    const isLiveClass = status === "live" ? "event-card--live" : "";

    // Badges en resumen
    let statusBadgeHtml = "";
    if (status === "live") {
      statusBadgeHtml = `
        <span class="event-tag event-tag--live">
          <span class="pulse-dot" aria-hidden="true"></span> EN DIRECTO
        </span>
      `;
    } else if (status === "next") {
      statusBadgeHtml = `<span class="event-tag event-tag--next">⏰ Siguiente</span>`;
    }

    const categoryObj = appData.categories[ev.category] || {};
    const categoryTagHtml = categoryObj.label ? `<span class="event-tag">${categoryObj.icon || "📌"} ${categoryObj.label}</span>` : "";
    const locationTagHtml = ev.location ? `<span class="event-tag event-tag--location">📍 ${ev.location}</span>` : "";
    const noteTagHtml = ev.note ? `<span class="event-tag event-tag--note">⚠️ ${ev.note}</span>` : "";

    // Foto o detalle visual
    let photoHtml = "";
    if (ev.photo) {
      photoHtml = `<img class="event-photo" src="${ev.photo}" alt="${ev.title}" loading="lazy" />`;
    }

    // Ubicación y URLs para mapa y calendario
    const locationQuery = `${ev.location || "Plaza del pueblo"}, Abraveses de Tera, Zamora`;
    const mapsQuery = encodeURIComponent(locationQuery);

    let mapsUrl = ev.mapUrl;
    if (!mapsUrl) {
      const locationObj = appData.locations?.find((l) => l.name === ev.location);
      if (locationObj && locationObj.mapUrl) {
        mapsUrl = locationObj.mapUrl;
      } else {
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
      }
    }

    // Google Calendar URL
    const [hours, minutes] = ev.time.split(":").map(Number);
    const dayNum = parseInt(day.id, 10);
    const startDate = new Date(appData.year, 7, dayNum, hours, minutes);
    const endDate = new Date(startDate.getTime() + ESTIMATED_DURATION_MINUTES * 60 * 1000);

    const formatGCalDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title + " · Fiestas Abraveses " + appData.year)}&dates=${formatGCalDate(startDate)}/${formatGCalDate(endDate)}&details=${encodeURIComponent((ev.detail || ev.description || "") + "\n\nPrograma Abraveses de Tera 2027")}&location=${mapsQuery}`;

    // Enlace externo si existe
    let externalLinkHtml = "";
    if (ev.link) {
      externalLinkHtml = `
        <a href="${ev.link.url}" target="_blank" rel="noopener noreferrer" class="event-external-link">
          <span>🔗</span> ${ev.link.label}
        </a>
      `;
    }

    return `
      <article class="event-card ${isFeaturedClass} ${isLiveClass}" style="--accent: var(--${day.color})" data-event-id="${ev.eventId}">
        <div class="event-summary" role="button" tabindex="0" aria-expanded="false" aria-controls="details-${cardId}">
          <time class="event-time-col">${ev.time}</time>
          <div class="event-info-col">
            <h4 class="event-title">${ev.title}</h4>
            ${ev.description ? `<p class="event-desc-short">${ev.description}</p>` : ""}
            <div class="event-badges-row">
              ${statusBadgeHtml}
              ${categoryTagHtml}
              ${locationTagHtml}
              ${noteTagHtml}
            </div>
          </div>
          <button type="button" class="event-quick-btn share-btn" data-share="${ev.eventId}" data-share-title="${ev.title}" aria-label="Compartir ${ev.title}">
            <span aria-hidden="true">📤</span>
          </button>
          <button type="button" class="event-quick-btn favorite-toggle ${isFav ? "is-favorite" : ""}" data-favorite="${ev.eventId}" aria-label="${isFav ? "Quitar de mis planes" : "Guardar en mis planes"}" aria-pressed="${isFav}">
            <span aria-hidden="true">${isFav ? "❤️" : "♡"}</span>
          </button>
          <span class="event-chevron" aria-hidden="true">﹢</span>
        </div>

        <div class="event-details" id="details-${cardId}">
          <div class="event-details-content">
            ${photoHtml}
            <div class="event-details-body">
              <p class="event-full-detail">${ev.detail || ev.description || "Sin descripción adicional disponible."}</p>
              
              <div class="event-meta-strip">
                <div class="meta-strip-row">
                  <div class="meta-strip-info">
                    <span class="meta-strip-icon" aria-hidden="true">📍</span>
                    <span class="meta-strip-text">${ev.location || "Abraveses de Tera"}</span>
                  </div>
                  <div class="meta-strip-actions">
                    <button type="button" class="mini-pill btn-open-interactive-map" data-location-name="${ev.location || "Plaza del pueblo"}" title="Ver en el mapa de Abraveses">
                      <span>🗺️ Mapa</span>
                    </button>
                    <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="mini-pill mini-pill--gps" title="Cómo llegar con Google Maps">
                      <span>↗️ GPS</span>
                    </a>
                  </div>
                </div>

                <div class="meta-strip-row">
                  <div class="meta-strip-info">
                    <span class="meta-strip-icon" aria-hidden="true">📅</span>
                    <span class="meta-strip-text">Añadir aviso:</span>
                  </div>
                  <div class="meta-strip-actions">
                    <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="mini-pill" title="Añadir a Google Calendar">
                      <span>Google</span>
                    </a>
                    <button type="button" class="mini-pill ics-download-btn" data-event-id="${ev.eventId}" data-day-id="${day.id}" title="Descargar recordatorio .ics (Apple Calendar / Outlook)">
                      <span>Apple/iCal</span>
                    </button>
                  </div>
                </div>
              </div>

              ${externalLinkHtml}

              <div class="attendance-bar">
                <div class="attendance-row">
                  <button type="button" class="attend-btn ${isAttending ? "is-attending" : ""}" data-attend="${ev.eventId}">
                    <span aria-hidden="true">${isAttending ? "✓" : "🙋"}</span> ${isAttending ? "Ya voy a esta actividad" : "Confirmar asistencia"}
                  </button>
                  <span class="attend-count" data-attend-count="${ev.eventId}">
                    👥 ${attendCounts[ev.eventId] || 0} ${(attendCounts[ev.eventId] || 0) === 1 ? "persona va" : "personas van"}
                  </span>
                </div>
                <p class="attend-notice">ℹ️ Recuento orientativo para la organización. La inscripción formal se realizará en la comisión de fiestas.</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  // --- Renderizado Principal de Actividades ---
  function renderEvents() {
    computeEventStatuses();

    const selectedDayObj = appData.days.find((d) => d.id === selectedDayId);
    const daysToRender = selectedDayObj ? [selectedDayObj] : appData.days;

    // Actualizar texto de día seleccionado
    if (showFavoritesOnly) {
      selectedDayLabelEl.textContent = "Mis planes guardados";
    } else if (selectedDayObj) {
      selectedDayLabelEl.textContent = selectedDayObj.label;
    } else {
      selectedDayLabelEl.textContent = `Todos los eventos · ${appData.dates}`;
    }

    let totalVisible = 0;
    let html = "";

    daysToRender.forEach((day) => {
      const filtered = filterEvents(day);
      if (filtered.length > 0) {
        totalVisible += filtered.length;
        if (!selectedDayObj) {
          html += `<div class="day-group-header"><span>${day.label}</span></div>`;
        }
        filtered.forEach((ev, idx) => {
          html += renderEventCard(ev, day, `${day.id}-${idx}`);
        });
      }
    });

    eventsContainerEl.innerHTML = html;
    noResultsEl.hidden = totalVisible > 0;
  }

  // --- Exportación a archivo .ICS (Apple Calendar / Outlook) ---
  function exportIcsFile(eventId, dayId) {
    const day = appData.days.find((d) => d.id === dayId);
    if (!day) return;
    const ev = day.events.find((e) => e.eventId === eventId);
    if (!ev) return;

    const [hours, minutes] = ev.time.split(":").map(Number);
    const dayNum = parseInt(day.id, 10);
    const start = new Date(appData.year, 7, dayNum, hours, minutes);
    const end = new Date(start.getTime() + ESTIMATED_DURATION_MINUTES * 60 * 1000);

    const formatUtc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const nowUtc = formatUtc(new Date());

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//Abraveses de Tera//Fiestas ${appData.year}//ES`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${ev.eventId}-${appData.year}@abraveses-de-tera`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${ev.title} · Fiestas Abraveses ${appData.year}`,
      `DESCRIPTION:${(ev.detail || ev.description || "").replace(/\r?\n/g, "\\n")}`,
      `LOCATION:${ev.location || "Abraveses de Tera"}, Abraveses de Tera, Zamora`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ev.eventId}-fiestas-abraveses-${appData.year}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Descargando archivo de calendario (.ics)");
  }

  // --- Compartir Actividad (WhatsApp / Redes / Enlace) ---
  function shareActivity(eventId, title) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#${eventId}`;
    const shareText = `¡Mira esta actividad de las Fiestas de Abraveses de Tera 2027: "${title}"!`;

    if (navigator.share) {
      navigator.share({
        title: `${title} · Fiestas Abraveses 2027`,
        text: shareText,
        url: shareUrl
      }).catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("¡Enlace copiado al portapapeles! 📋");
      }).catch(() => {
        prompt("Copia el siguiente enlace para compartir:", shareUrl);
      });
    } else {
      prompt("Copia el siguiente enlace para compartir:", shareUrl);
    }
  }

  // --- Navegación por Hash (#evento-id) ---
  function handleHashNavigation() {
    const hash = window.location.hash.replace("#", "").trim();
    if (!hash) return;

    // Buscar si el evento pertenece a un día específico
    for (const day of appData.days) {
      const found = day.events.find((e) => e.eventId === hash);
      if (found) {
        selectedDayId = day.id;
        updateActiveTabUI();
        renderEvents();
        break;
      }
    }

    setTimeout(() => {
      const card = document.querySelector(`[data-event-id="${hash}"]`);
      if (card) {
        card.classList.add("is-open");
        const summary = card.querySelector(".event-summary");
        if (summary) summary.setAttribute("aria-expanded", "true");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  }

  // --- Actualizar pestaña activa en la barra de días ---
  function updateActiveTabUI() {
    document.querySelectorAll(".day-tab").forEach((tab) => {
      const isActive = tab.dataset.dayId === selectedDayId;
      tab.classList.toggle("is-active", isActive);
      if (isActive && typeof tab.scrollIntoView === "function") {
        try {
          tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        } catch (_) {}
      }
    });
  }

  // --- Habilitar deslizamiento por arrastre (touch y ratón) ---
  function enableDragScroll(el) {
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      hasMoved = false;
    });

    const stopDrag = () => {
      isDown = false;
    };

    el.addEventListener("pointerleave", stopDrag);
    el.addEventListener("pointerup", stopDrag);
    el.addEventListener("pointercancel", stopDrag);

    el.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      const walk = x - startX;
      if (Math.abs(walk) > 4) {
        hasMoved = true;
        el.scrollLeft = scrollLeft - walk;
      }
    });

    el.addEventListener("click", (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
      }
    }, true);
  }

  // --- Controladores de Eventos ---
  let eventListenersAttached = false;
  function setupEventListeners() {
    if (eventListenersAttached) return;
    eventListenersAttached = true;

    // Habilitar arrastre suave en la barra de días
    enableDragScroll(dayTabsEl);

    // Selección de día
    dayTabsEl.addEventListener("click", (e) => {
      const tab = e.target.closest(".day-tab");
      if (!tab) return;
      selectedDayId = tab.dataset.dayId;
      showFavoritesOnly = false;
      updateFavoritesUI();
      updateActiveTabUI();
      renderEvents();
    });

    // Filtros de categoría
    categoryFiltersEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".cat-pill");
      if (!chip) return;
      selectedCategory = chip.dataset.category;
      document.querySelectorAll(".cat-pill").forEach((c) => {
        c.classList.toggle("is-active", c.dataset.category === selectedCategory);
      });
      renderEvents();
    });

    // Botón de Favoritos ("Mis planes")
    favoritesButtonEl.addEventListener("click", () => {
      showFavoritesOnly = !showFavoritesOnly;
      updateFavoritesUI();
      renderEvents();
    });

    // Botón "Hoy"
    todayButtonEl.addEventListener("click", () => {
      const now = new Date();
      // Si estamos en agosto 2027
      if (now.getMonth() === 7 && now.getFullYear() === appData.year) {
        const todayStr = String(now.getDate());
        const match = appData.days.find((d) => d.id === todayStr);
        if (match) {
          selectedDayId = match.id;
          updateActiveTabUI();
          renderEvents();
          return;
        }
      }
      // Por defecto muestra todos
      selectedDayId = "all";
      showFavoritesOnly = false;
      updateFavoritesUI();
      updateActiveTabUI();
      renderEvents();
    });

    // Buscador
    searchInputEl.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      searchClearEl.hidden = searchQuery.length === 0;
      renderEvents();
    });

    searchClearEl.addEventListener("click", () => {
      searchInputEl.value = "";
      searchQuery = "";
      searchClearEl.hidden = true;
      renderEvents();
      searchInputEl.focus();
    });

    resetFiltersBtnEl.addEventListener("click", () => {
      searchQuery = "";
      searchInputEl.value = "";
      searchClearEl.hidden = true;
      selectedCategory = "all";
      selectedDayId = "all";
      showFavoritesOnly = false;
      document.querySelectorAll(".cat-pill").forEach((c) => {
        c.classList.toggle("is-active", c.dataset.category === "all");
      });
      updateFavoritesUI();
      updateActiveTabUI();
      renderEvents();
    });

    // Delegación de eventos en la lista de actividades
    eventsContainerEl.addEventListener("click", (e) => {
      // 1. Botón favorito
      const favBtn = e.target.closest(".favorite-toggle");
      if (favBtn) {
        e.stopPropagation();
        toggleFavorite(favBtn.dataset.favorite);
        return;
      }

      // 2. Botón compartir
      const shareBtn = e.target.closest(".share-btn");
      if (shareBtn) {
        e.stopPropagation();
        shareActivity(shareBtn.dataset.share, shareBtn.dataset.shareTitle);
        return;
      }

      // 3. Botón descargar .ics
      const icsBtn = e.target.closest(".ics-download-btn");
      if (icsBtn) {
        e.stopPropagation();
        exportIcsFile(icsBtn.dataset.eventId, icsBtn.dataset.dayId);
        return;
      }

      // 4. Botón confirmar asistencia
      const attendBtn = e.target.closest(".attend-btn");
      if (attendBtn) {
        e.stopPropagation();
        toggleAttendance(attendBtn.dataset.attend, attendBtn);
        return;
      }

      // 5. Botón abrir mapa interactivo
      const openMapBtn = e.target.closest(".btn-open-interactive-map");
      if (openMapBtn) {
        e.stopPropagation();
        const locName = openMapBtn.dataset.locationName;
        const matched = (appData.locations || []).find((l) => l.name === locName || (l.name && locName && (locName.includes(l.name) || l.name.includes(locName))));
        openMapModal(matched ? matched.id : "all");
        return;
      }

      // 6. Expandir/contraer tarjeta de evento
      const summary = e.target.closest(".event-summary");
      if (summary) {
        const card = summary.closest(".event-card");
        const isOpen = card.classList.toggle("is-open");
        summary.setAttribute("aria-expanded", isOpen ? "true" : "false");
      }
    });

    // Accesibilidad con teclado (Enter / Espacio para expandir)
    eventsContainerEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const summary = e.target.closest(".event-summary");
        if (summary) {
          e.preventDefault();
          const card = summary.closest(".event-card");
          const isOpen = card.classList.toggle("is-open");
          summary.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }
      }
    });

    // --- Modales ---
    btnOpenPosterEl.addEventListener("click", () => {
      posterModalEl.hidden = false;
      posterModalEl.setAttribute("aria-hidden", "false");
    });

    btnOpenMapEl.addEventListener("click", () => {
      openMapModal("all");
    });

    // Selector de tema (Día / Noche / Auto)
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", cycleTheme);
    }

    // Botón de Chupinazo y logo interactivo de la ermita
    const btnChupinazo = document.getElementById("btnChupinazo");
    if (btnChupinazo) {
      btnChupinazo.addEventListener("click", triggerChupinazo);
    }
    const heroLogoEl = document.querySelector(".hero-logo");
    if (heroLogoEl) {
      heroLogoEl.addEventListener("click", triggerChupinazo);
    }

    // Pestañas rápidas del mapa interactivo
    const mapPillsBar = document.getElementById("mapPillsBar");
    if (mapPillsBar) {
      mapPillsBar.addEventListener("click", (e) => {
        const pill = e.target.closest(".map-pill");
        if (!pill) return;
        const locId = pill.dataset.locId;
        initOrUpdateLeafletMap(locId);
      });
    }

    // Centrar desde la lista de lugares del modal
    if (locationsListEl) {
      locationsListEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-focus-loc-map");
        if (btn) {
          const locId = btn.dataset.locId;
          initOrUpdateLeafletMap(locId);
          const mapFrame = document.querySelector(".map-frame");
          if (mapFrame) {
            mapFrame.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      });
    }

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeAllModals();
      });
    });

    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          closeAllModals();
        }
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllModals();
      }
    });

    window.addEventListener("hashchange", handleHashNavigation);
  }

  function closeAllModals() {
    [posterModalEl, mapModalEl, adminModalEl].forEach((modal) => {
      if (modal) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
      }
    });
  }

  // ==========================================================================
  // FASE 2: MODO NOCHE / TEMA OSCURO (AUTOMÁTICO Y MANUAL)
  // ==========================================================================
  function isNightTime() {
    const hour = new Date().getHours();
    return hour >= 21 || hour < 8; // De 21:00 a 08:00
  }

  function shouldBeDark() {
    if (currentThemeMode === "dark") return true;
    if (currentThemeMode === "light") return false;
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isNightTime() || systemPrefersDark;
  }

  function applyTheme(mode, notify = false) {
    currentThemeMode = mode;
    localStorage.setItem(STORAGE_THEME_KEY, mode);

    const isDark = shouldBeDark();
    document.body.classList.toggle("theme-dark", isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", isDark ? "#090e17" : "#111827");
    }

    const iconEl = document.getElementById("themeToggleIcon");
    const textEl = document.getElementById("themeToggleText");
    if (iconEl && textEl) {
      if (mode === "dark") {
        iconEl.textContent = "🌙";
        textEl.textContent = "Noche";
      } else if (mode === "light") {
        iconEl.textContent = "☀️";
        textEl.textContent = "Día";
      } else {
        iconEl.textContent = "🌓";
        textEl.textContent = isDark ? "Auto (Noche)" : "Auto (Día)";
      }
    }

    if (notify) {
      if (mode === "dark") {
        showToast("Modo Noche activado (ideal para las verbenas) 🌙");
      } else if (mode === "light") {
        showToast("Modo Día activado ☀️");
      } else {
        showToast("Modo Automático activado (se activa al anochecer) 🌓");
      }
    }
  }

  function cycleTheme() {
    if (currentThemeMode === "auto") {
      applyTheme("dark", true);
    } else if (currentThemeMode === "dark") {
      applyTheme("light", true);
    } else {
      applyTheme("auto", true);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_THEME_KEY) || "auto";
    applyTheme(saved, false);

    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (currentThemeMode === "auto") {
          applyTheme("auto", false);
        }
      });
    }

    setInterval(() => {
      if (currentThemeMode === "auto") {
        applyTheme("auto", false);
      }
    }, 60 * 60 * 1000);
  }

  // ==========================================================================
  // FASE 2: MAPA INTERACTIVO DE ABRAVESES (LEAFLET + OPENSTREETMAP)
  // ==========================================================================
  function openMapModal(focusId = "all") {
    if (!mapModalEl) return;
    mapModalEl.hidden = false;
    mapModalEl.setAttribute("aria-hidden", "false");
    initOrUpdateLeafletMap(focusId);
  }

  function updateMapPills(activeId) {
    document.querySelectorAll(".map-pill").forEach((pill) => {
      pill.classList.toggle("is-active", pill.dataset.locId === activeId);
    });
  }

  function initOrUpdateLeafletMap(focusId = "all") {
    if (typeof L === "undefined") {
      console.warn("Leaflet no está disponible");
      return;
    }
    const mapEl = document.getElementById("abravesesMap");
    if (!mapEl) return;

    if (!leafletMap) {
      // Centro inicial en el valle de Abraveses de Tera
      leafletMap = L.map("abravesesMap", {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([41.9908, -5.8920], 15);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }).addTo(leafletMap);

      const locations = appData.locations || [];
      locations.forEach((loc) => {
        if (!loc.lat || !loc.lng) return;

        const customIcon = L.divIcon({
          className: "leaflet-custom-marker-wrapper",
          html: `<div class="leaflet-custom-marker leaflet-custom-marker--${loc.id}">
                  <span>${loc.icon || "📍"}</span>
                 </div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -20]
        });

        const mapsQuery = encodeURIComponent(`${loc.name}, Abraveses de Tera, Zamora`);
        const mapsLink = loc.mapUrl || `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

        const popupContent = `
          <div class="map-popup-header">
            <span class="map-popup-icon">${loc.icon || "📍"}</span>
            <div>
              <h4 class="map-popup-title">${loc.name}</h4>
              <span class="map-popup-tag">${loc.tag || "Punto de fiesta"}</span>
            </div>
          </div>
          <p class="map-popup-desc">${loc.description}</p>
          <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" class="map-popup-btn">
            <span>🗺️ Cómo llegar</span>
          </a>
        `;

        const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(leafletMap);
        marker.bindPopup(popupContent);
        mapMarkers[loc.id] = marker;
      });
    }

    setTimeout(() => {
      if (leafletMap) {
        leafletMap.invalidateSize();
        if (focusId && focusId !== "all" && mapMarkers[focusId]) {
          const loc = (appData.locations || []).find((l) => l.id === focusId);
          if (loc) {
            leafletMap.flyTo([loc.lat, loc.lng], 16, { animate: true, duration: 0.8 });
            mapMarkers[focusId].openPopup();
          }
          updateMapPills(focusId);
        } else {
          const markerList = Object.values(mapMarkers);
          if (markerList.length > 0) {
            const group = L.featureGroup(markerList);
            leafletMap.fitBounds(group.getBounds().pad(0.14));
          }
          updateMapPills("all");
        }
      }
    }, 250);
  }

  // ==========================================================================
  // FASE 2: NOTIFICACIONES PUSH WEB Y ALERTAS
  // ==========================================================================
  function initNotifications() {
    const badge = document.getElementById("pushBadgeStatus");
    const btnToggle = document.getElementById("btnPushToggle");
    const btnText = document.getElementById("btnPushText");
    const btnTest = document.getElementById("btnPushTest");

    if (!btnToggle && !badge) return;

    if (!("Notification" in window)) {
      if (badge) badge.textContent = "No soportado";
      if (btnText) btnText.textContent = "Avisos no disponibles";
      if (btnToggle) btnToggle.disabled = true;
      return;
    }

    function updateState() {
      const perm = Notification.permission;
      if (perm === "granted") {
        if (badge) badge.textContent = "Activado ✓";
        if (btnText) btnText.textContent = "Avisos activados ✓";
        if (btnToggle) btnToggle.classList.add("is-granted");
        if (btnTest) btnTest.hidden = false;
      } else if (perm === "denied") {
        if (badge) badge.textContent = "Bloqueado";
        if (btnText) btnText.textContent = "Avisos bloqueados";
        if (btnToggle) btnToggle.classList.remove("is-granted");
        if (btnTest) btnTest.hidden = true;
      } else {
        if (badge) badge.textContent = "Web Push";
        if (btnText) btnText.textContent = "Activar notificaciones";
        if (btnToggle) btnToggle.classList.remove("is-granted");
        if (btnTest) btnTest.hidden = true;
      }
    }

    updateState();

    if (btnToggle) {
      btnToggle.addEventListener("click", () => {
        if (Notification.permission === "granted") {
          showToast("¡Los avisos ya están activos en tu móvil! 🔔");
          triggerPushNotification(
            "🔔 Fiestas Abraveses 2027",
            "Notificaciones activas. Te avisaremos puntualmente de novedades y meteorología."
          );
        } else if (Notification.permission === "denied") {
          showToast("Has bloqueado los avisos. Habilítalos en el candado del navegador.");
        } else {
          Notification.requestPermission().then((perm) => {
            updateState();
            if (perm === "granted") {
              showToast("¡Avisos de fiestas activados! 🔔");
              triggerPushNotification(
                "🎉 ¡Bienvenido a las Fiestas de Abraveses 2027!",
                "Avisos activados. Te avisaremos al instante si llueve o hay cambios de horario."
              );
            }
          });
        }
      });
    }

    if (btnTest) {
      btnTest.addEventListener("click", () => {
        triggerPushNotification(
          "☔ Aviso de la Comisión de Fiestas",
          "Por previsión de lluvia ligera, el torneo se disputará en el frontón cubierto. ¡Nos vemos allí!"
        );
        showToast("Aviso urgente de prueba enviado 📲");
      });
    }
  }

  function triggerPushNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body: body,
          icon: "images/icons/icon-192.png",
          badge: "images/icons/icon-192.png",
          vibrate: [200, 100, 200],
          tag: "abraveses-alert-" + Date.now()
        });
      });
    } else {
      try {
        new Notification(title, {
          body: body,
          icon: "images/icons/icon-192.png"
        });
      } catch (_) {}
    }
  }

  // ==========================================================================
  // EXTRAS: CHUPINAZO FESTIVO (SONIDO SINTETIZADO + CONFETI)
  // ==========================================================================
  let soundPlayedOnce = false;

  function playChupinazoSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const runOscillators = () => {
        soundPlayedOnce = true;
        const now = ctx.currentTime;

        // 1. Silbido ascendente del cohete (250Hz -> 1800Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.6);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.6);

        // 2. Explosión del cohete (BOOM!)
        setTimeout(() => {
          try {
            const boomBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
            const data = boomBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.22));
            }

            const noise = ctx.createBufferSource();
            noise.buffer = boomBuffer;

            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(450, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.8);

            const boomGain = ctx.createGain();
            boomGain.gain.setValueAtTime(0.65, ctx.currentTime);
            boomGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);

            noise.connect(filter);
            filter.connect(boomGain);
            boomGain.connect(ctx.destination);

            noise.start();
          } catch (_) {}
        }, 620);
      };

      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          runOscillators();
        }).catch(() => {
          // Autoplay policy móvil: desbloquear sonido en el primer toque de pantalla
          const unlockAudio = () => {
            if (!soundPlayedOnce) {
              playChupinazoSound();
            }
          };
          window.addEventListener("pointerdown", unlockAudio, { once: true });
          window.addEventListener("touchstart", unlockAudio, { once: true });
          window.addEventListener("click", unlockAudio, { once: true });
        });
      } else {
        runOscillators();
      }
    } catch (e) {
      console.warn("AudioContext no disponible:", e);
    }
  }

  function launchConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const colors = ["#ff3b30", "#ff8a00", "#ffcc00", "#0284c7", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b", "#38bdf8"];
    const count = 160;
    const particles = [];

    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      particles.push({
        x: fromLeft ? width * 0.35 + (Math.random() - 0.5) * 80 : width * 0.65 + (Math.random() - 0.5) * 80,
        y: height * 0.42,
        vx: (Math.random() - 0.5) * 18,
        vy: -Math.random() * 15 - 7,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 14,
        opacity: 1
      });
    }

    let frame = 0;
    function render() {
      ctx.clearRect(0, 0, width, height);
      let alive = false;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // Gravedad
        p.vx *= 0.98; // Resistencia
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.007;

        if (p.opacity > 0 && p.y < height + 40) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive && frame < 200) {
        frame++;
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    requestAnimationFrame(render);
  }

  function triggerChupinazo() {
    playChupinazoSound();
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 300]);
    }
    launchConfetti();
    showToast("🚀 ¡BOOOOOM! ¡Vivan las fiestas de Abraveses de Tera! 🎉🥂");
  }

  // ==========================================================================
  // EXTRAS: EL TIEMPO EN DIRECTO (OPEN-METEO ABRAVESES DE TERA)
  // ==========================================================================
  async function loadWeather() {
    const tempEl = document.getElementById("weatherTemp");
    const descEl = document.getElementById("weatherDesc");
    const iconEl = document.getElementById("weatherIcon");
    const tipEl = document.getElementById("weatherTip");

    if (!tempEl || !descEl) return;

    try {
      const url = "https://api.open-meteo.com/v1/forecast?latitude=41.9927&longitude=-5.8948&current_weather=true&timezone=Europe%2FMadrid";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.current_weather) {
          const cw = data.current_weather;
          const temp = Math.round(cw.temperature);
          const code = cw.weathercode;
          const isDay = cw.is_day === 1;

          let desc = "Cielo despejado";
          let icon = isDay ? "☀️" : "🌙";
          let tip = "🎉 ¡Ideal para disfrutar en la calle!";

          if (code === 0) {
            desc = isDay ? "Cielo despejado y soleado" : "Noche despejada y estrellada";
            icon = isDay ? "☀️" : "✨";
          } else if (code <= 3) {
            desc = "Intervalos nubosos y brisa agradable";
            icon = isDay ? "⛅" : "☁️";
          } else if (code >= 51 && code <= 67) {
            desc = "Probabilidad de llovizna";
            icon = "🌧️";
            tip = "☔ Si llueve, nos vemos en el frontón";
          } else if (code >= 95) {
            desc = "Tormenta de verano";
            icon = "⛈️";
            tip = "⚠️ Actividades a cubierto";
          }

          tempEl.textContent = `${temp}°C`;
          descEl.textContent = `${desc} · Viento: ${Math.round(cw.windspeed)} km/h`;
          if (iconEl) iconEl.textContent = icon;
          if (tipEl) tipEl.textContent = tip;
          return;
        }
      }
    } catch (_) {
      // Fallback estival si no hay conexión
    }

    tempEl.textContent = "27°C";
    descEl.textContent = "Típico verano en Abraveses de Tera · Zamora";
    if (iconEl) iconEl.textContent = "☀️";
    if (tipEl) tipEl.textContent = "🎉 ¡Ambiente perfecto de fiestas!";
  }

  // ==========================================================================
  // FASE 2: EMISIÓN Y ESCUCHA DE AVISOS EN TIEMPO REAL (ADMIN / COMISIÓN)
  // ==========================================================================
  const ADMIN_PASSWORD = "bolincheto";
  const STORAGE_ALERT_ID_KEY = "abraveses2027_last_seen_alert";

  function listenLiveAlerts() {
    if (!hasFirebase()) return;
    try {
      firebase.database().ref("alerts/active").on("value", (snapshot) => {
        const alert = snapshot.val();
        if (alert && alert.active === true && alert.title) {
          if (liveAlertBannerEl) {
            liveAlertBannerEl.hidden = false;
            if (liveAlertTitleEl) liveAlertTitleEl.textContent = alert.title;
            if (liveAlertMessageEl) liveAlertMessageEl.textContent = alert.message;
            if (liveAlertTimeEl) liveAlertTimeEl.textContent = alert.timeStr || "";

            if (liveAlertLabelEl) {
              if (alert.type === "urgente") {
                liveAlertLabelEl.textContent = "🔴 AVISO URGENTE";
              } else if (alert.type === "horario") {
                liveAlertLabelEl.textContent = "🟡 CAMBIO DE HORARIO";
              } else {
                liveAlertLabelEl.textContent = "🔵 AVISO DE LA COMISIÓN";
              }
            }
          }

          // Notificar automáticamente con Web Push al móvil si es un aviso nuevo
          const lastSeenId = localStorage.getItem(STORAGE_ALERT_ID_KEY);
          if (alert.id && alert.id !== lastSeenId) {
            localStorage.setItem(STORAGE_ALERT_ID_KEY, alert.id);
            triggerPushNotification(alert.title, alert.message);
          }
        } else {
          if (liveAlertBannerEl) {
            liveAlertBannerEl.hidden = true;
          }
        }
      });
    } catch (e) {
      console.warn("Aviso en listenLiveAlerts:", e);
    }
  }

  function initAdminPanel() {
    const adminPinInput = document.getElementById("adminPinInput");
    const btnAdminLogin = document.getElementById("btnAdminLogin");
    const adminAuthSection = document.getElementById("adminAuthSection");
    const adminDashboardSection = document.getElementById("adminDashboardSection");
    const adminCurrentAlertSummary = document.getElementById("adminCurrentAlertSummary");
    const adminAlertForm = document.getElementById("adminAlertForm");
    const adminAlertTitle = document.getElementById("adminAlertTitle");
    const adminAlertMessage = document.getElementById("adminAlertMessage");
    const adminAlertType = document.getElementById("adminAlertType");
    const btnClearAlert = document.getElementById("btnClearAlert");

    // Abrir modal de admin
    if (btnOpenAdminEl) {
      btnOpenAdminEl.addEventListener("click", () => {
        if (adminModalEl) {
          adminModalEl.hidden = false;
          adminModalEl.setAttribute("aria-hidden", "false");
          if (adminPinInput) adminPinInput.focus();
        }
      });
    }

    // Login con Contraseña
    function handleAdminLogin() {
      if (!adminPinInput) return;
      const entered = adminPinInput.value.trim().toLowerCase();
      if (entered === ADMIN_PASSWORD) {
        if (adminAuthSection) adminAuthSection.hidden = true;
        if (adminDashboardSection) adminDashboardSection.hidden = false;
        showToast("Acceso de Comisión desbloqueado ✓");
        checkCurrentAdminAlert();
      } else {
        showToast("Contraseña incorrecta. Vuelve a intentarlo.");
        adminPinInput.value = "";
        adminPinInput.focus();
      }
    }

    if (btnAdminLogin) {
      btnAdminLogin.addEventListener("click", handleAdminLogin);
    }
    if (adminPinInput) {
      adminPinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAdminLogin();
        }
      });
    }

    // Consultar estado de alertas
    function checkCurrentAdminAlert() {
      if (!hasFirebase() || !adminCurrentAlertSummary) return;
      ensureAuth().then(() => {
        firebase.database().ref("alerts/active").once("value", (snap) => {
          const val = snap.val();
          if (val && val.active === true) {
            adminCurrentAlertSummary.innerHTML = `
              <span style="color:#e11d48; font-weight:700;">🟢 Aviso activo en este momento:</span><br/>
              <strong>${val.title}</strong> — ${val.timeStr || ""}<br/>
              <em>"${val.message}"</em>
            `;
            if (btnClearAlert) btnClearAlert.hidden = false;
          } else {
            adminCurrentAlertSummary.innerHTML = `<span style="color:#64748b;">⚪ No hay ningún aviso urgente activo en este momento.</span>`;
            if (btnClearAlert) btnClearAlert.hidden = true;
          }
        });
      }).catch(() => {});
    }

    // Plantillas rápidas
    const templates = {
      lluvia: {
        title: "☔ Traslado por lluvia al Frontón Cubierto",
        message: "Por inclemencias meteorológicas, la actividad se traslada al frontón cubierto. ¡La fiesta continúa con normalidad!",
        type: "urgente"
      },
      horario: {
        title: "⏰ Ajuste de horario oficial",
        message: "Aviso de última hora: la orquesta/actividad comenzará con 30 minutos de retraso sobre la hora prevista en el programa.",
        type: "horario"
      },
      comida: {
        title: "🍽️ Convocatoria de comida popular",
        message: "Recordatorio: la recogida de raciones comenzará en breve. Rogamos acudir con el ticket de la comisión de fiestas.",
        type: "info"
      },
      general: {
        title: "📢 Comunicado de la Comisión de Fiestas",
        message: "Aviso de la comisión para todos los vecinos, peñas y visitantes de Abraveses de Tera.",
        type: "info"
      }
    };

    document.querySelectorAll(".admin-template-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const tplKey = chip.dataset.tpl;
        const tpl = templates[tplKey];
        if (tpl) {
          if (adminAlertTitle) adminAlertTitle.value = tpl.title;
          if (adminAlertMessage) adminAlertMessage.value = tpl.message;
          if (adminAlertType) adminAlertType.value = tpl.type;
        }
      });
    });

    // Publicar aviso
    if (adminAlertForm) {
      adminAlertForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = adminAlertTitle.value.trim();
        const message = adminAlertMessage.value.trim();
        const type = adminAlertType ? adminAlertType.value : "urgente";

        if (!title || !message) {
          showToast("Rellena el título y el mensaje del aviso.");
          return;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " h";

        const alertData = {
          id: Date.now().toString(),
          active: true,
          title: title,
          message: message,
          type: type,
          timeStr: timeStr,
          timestamp: Date.now()
        };

        if (hasFirebase()) {
          ensureAuth().then(() => {
            return firebase.database().ref("alerts/active").set(alertData);
          }).then(() => {
            launchConfetti();
            showToast("¡Aviso emitido a todo el pueblo con éxito! 📢");
            closeAllModals();
          }).catch((err) => {
            console.error("Error al publicar aviso:", err);
            showToast("Aviso emitido localmente ✓");
            closeAllModals();
          });
        } else {
          showToast("Aviso publicado en modo local");
          closeAllModals();
        }
      });
    }

    // Retirar aviso activo
    if (btnClearAlert) {
      btnClearAlert.addEventListener("click", () => {
        if (!confirm("¿Deseas retirar el aviso activo para que deje de aparecer en las pantallas?")) return;

        if (hasFirebase()) {
          ensureAuth().then(() => {
            return firebase.database().ref("alerts/active").set({ active: false });
          }).then(() => {
            showToast("Aviso activo retirado");
            checkCurrentAdminAlert();
            closeAllModals();
          }).catch((err) => {
            console.error("Error al retirar aviso:", err);
          });
        } else {
          showToast("Aviso retirado");
          closeAllModals();
        }
      });
    }
  }

  // Arrancar aplicación al cargar DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadData);
  } else {
    loadData();
  }
})();
