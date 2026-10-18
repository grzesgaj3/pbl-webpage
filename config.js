/* =============================================================================
 *  STACJA — konfiguracja panelu
 *
 *  Zwykły plik statyczny. Edytuj i wgraj na serwer (bez build‑stepu).
 *  Ładowany jest przed aplikacją (zob. <script src="config.js"> w index.html).
 * =============================================================================
 */
window.PBL_CONFIG = {
  /* Adres bazowy API pbl-api. Panel i API są ZAWSZE w innym origin, więc podaj
   * pełny adres (tu: publiczny adres API).
   *
   *  UWAGA (CORS): ponieważ to inny origin, API musi zezwolić na żądania z adresu
   *  panelu. W pliku .env API ustaw listę originów, z których otwierasz panel:
   *      CORS_ORIGINS=http://localhost:8080,https://frog01-30138.wykr.es
   *  (kilka originów rozdziela się przecinkiem). Bez tego przeglądarka zablokuje
   *  żądania i logowanie pokaże błąd połączenia.
   */
  apiBase: "https://frog01-40138.wykr.es",

  /* Domyślny motyw, gdy użytkownik nie wybrał własnego: "auto" | "light" | "dark". */
  theme: "auto",

  /* Domyślny interwał auto‑odświeżania w sekundach (0 = wyłączone). */
  refreshSeconds: 60,
};
