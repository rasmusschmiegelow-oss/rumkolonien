'use strict';
// Når spillet kører som iOS-app (Capacitor), bruges telefonens egne funktioner:
// haptisk feedback, lokale notifikationer og statuslinjen. I browseren gør modulet ingenting.

const Native = (() => {
  const cap = window.Capacitor;
  const on = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const P = on ? cap.Plugins : {};
  if (on) {
    document.documentElement.classList.add('native');
    // lys tekst i statuslinjen over spillets mørke himmel
    if (P.StatusBar) P.StatusBar.setStyle({ style: 'DARK' }).catch(() => {});
  }
  return {
    on,
    // delelinks skal pege på hjemmesiden, ikke på appens interne adresse
    SITE: 'https://rasmusschmiegelow-oss.github.io/rumkolonien/',
    haptic(ms) {
      if (!on || !P.Haptics) return false;
      P.Haptics.impact({ style: ms >= 20 ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
      return true;
    },
    notifications: on && P.LocalNotifications ? P.LocalNotifications : null,
  };
})();
