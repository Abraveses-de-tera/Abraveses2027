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
  const btnOpenPosterEl = document.getElementById("btnOpenPoster");
  const btnOpenMapEl = document.getElementById("btnOpenMap");
  const locationsListEl = document.getElementById("locationsList");
  const toastEl = document.getElementById("appToast");

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

  function toggleAttendance(eventId) {
    const attends = getAttendances();
    attends[eventId] = !attends[eventId];
    localStorage.setItem(STORAGE_ATTEND_KEY, JSON.stringify(attends));
    showToast(attends[eventId] ? "¡Te has apuntado a esta actividad! ✓" : "Ya no estás apuntado");
    renderEvents();
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
  function initApp() {
    if (appData.whatsappUrl && whatsappBtnEl) {
      whatsappBtnEl.href = appData.whatsappUrl;
    }

    renderDayTabs();
    renderCategoryFilters();
    renderLocationsModal();
    updateFavoritesUI();
    renderEvents();

    setupEventListeners();
    handleHashNavigation();

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
      <button class="cat-pill is-active" type="button" data-category="all">
        <span>✨ Todas</span>
      </button>
    `;

    Object.entries(appData.categories).forEach(([key, cat]) => {
      chipsHtml += `
        <button class="cat-pill" type="button" data-category="${key}">
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
      const mapsUrl = loc.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name + ", Abraveses de Tera, Zamora")}`;
      return `
        <li class="location-item">
          <div class="location-item-info">
            <h4>${loc.name}</h4>
            <p>${loc.description}</p>
          </div>
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="location-nav-btn">
            <span>📍 Ir</span>
          </a>
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
              
              <div class="location-action-bar">
                <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="location-map-btn">
                  <span aria-hidden="true">📍</span> Ver ${ev.location || "ubicación"} en Google Maps ↗
                </a>
              </div>

              ${externalLinkHtml}

              <div class="calendar-bar">
                <span class="calendar-bar-title">Añadir a mi calendario</span>
                <div class="calendar-btn-group">
                  <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="cal-button">
                    <span aria-hidden="true">📅</span> Google Calendar
                  </a>
                  <button type="button" class="cal-button ics-download-btn" data-event-id="${ev.eventId}" data-day-id="${day.id}">
                    <span aria-hidden="true">🍏</span> Apple / Outlook (.ics)
                  </button>
                </div>
              </div>

              <div class="attendance-bar">
                <button type="button" class="attend-btn ${isAttending ? "is-attending" : ""}" data-attend="${ev.eventId}">
                  <span aria-hidden="true">${isAttending ? "✓" : "🙋"}</span> ${isAttending ? "Ya voy a esta actividad" : "Confirmar asistencia"}
                </button>
                <span class="attend-info">${isAttending ? "¡Te esperamos allí!" : "¿Te apuntas?"}</span>
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
      tab.classList.toggle("is-active", tab.dataset.dayId === selectedDayId);
    });
  }

  // --- Controladores de Eventos ---
  let eventListenersAttached = false;
  function setupEventListeners() {
    if (eventListenersAttached) return;
    eventListenersAttached = true;

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
        toggleAttendance(attendBtn.dataset.attend);
        return;
      }

      // 5. Expandir/contraer tarjeta de evento
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
      mapModalEl.hidden = false;
      mapModalEl.setAttribute("aria-hidden", "false");
    });

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
    [posterModalEl, mapModalEl].forEach((modal) => {
      if (modal) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
      }
    });
  }

  // Arrancar aplicación al cargar DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadData);
  } else {
    loadData();
  }
})();
