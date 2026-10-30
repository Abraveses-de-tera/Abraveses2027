/**
 * Cuenta atrás interactiva para las Fiestas de Abraveses de Tera 2027
 */
(function() {
  function updateCountdown() {
    const el = document.getElementById("countdown");
    if (!el) return;

    // Fechas de las fiestas 2027: del 23 de agosto al 29 de agosto
    const YEAR = 2027;
    const MONTH = 7; // Agosto (0-indexed: 7 es agosto)
    
    const startDate = new Date(YEAR, MONTH, 23, 0, 0, 0, 0);
    const endDate = new Date(YEAR, MONTH, 29, 23, 59, 59, 999);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.ceil((startDate.getTime() - now.getTime()) / msPerDay);

    el.classList.remove("is-live");

    if (now >= startDate && now <= endDate) {
      el.innerHTML = `<span aria-hidden="true">🎉</span> ¡Estamos de fiesta en Abraveses!`;
      el.classList.add("is-live");
    } else if (diffDays === 1) {
      el.innerHTML = `<span aria-hidden="true">⏳</span> ¡Mañana comienzan las fiestas!`;
    } else if (diffDays > 1) {
      el.innerHTML = `<span aria-hidden="true">⏳</span> Faltan <strong>${diffDays}</strong> días para las fiestas`;
    } else if (now > endDate) {
      el.innerHTML = `<span aria-hidden="true">✨</span> Fiestas 2027 finalizadas · ¡Nos vemos en 2028!`;
    } else {
      el.innerHTML = `<span aria-hidden="true">🔥</span> ¡Hoy comienzan las fiestas!`;
      el.classList.add("is-live");
    }
  }

  // Ejecutar inmediatamente y programar cada minuto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateCountdown);
  } else {
    updateCountdown();
  }

  setInterval(updateCountdown, 60 * 1000);
})();
