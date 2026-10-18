# STACJA — panel opadów dla `pbl-api`

Statyczny panel administracyjno‑podglądowy dla
[`pbl-api`](https://github.com/grzesgaj3/pbl-api) — sieci deszczomierzy LoRa.

Panel ma dwie zakładki: **Wykresy** (po jednym wykresie opadów na każdy
zarejestrowany sensor) oraz **Czyszczenie** (formularz żądania czyszczenia i
historia żądań). Zbudowany jest w czystym HTML/CSS/JS (bez frameworka i bez
build‑stepu), więc **na serwerze nie zużywa pamięci** — pliki serwuje nginx, a
cała logika działa w przeglądarce.

## Założenia

- **Panel i API są zawsze w innym origin.** Adres API ustawiasz w statycznym pliku
  [`config.js`](config.js). Ponieważ to inny origin, **API musi mieć włączony CORS**
  dla adresu panelu (`CORS_ORIGINS` w `.env` API).
- **Logowanie jest zawsze wymagane** — okno „Podaj API key admina" pojawia się przy
  każdym wejściu. Klucz trzymany jest w `sessionStorage` (znika po zamknięciu karty).
  Brak auto‑logowania z pliku.

## Konfiguracja — `config.js`

```js
window.PBL_CONFIG = {
  apiBase: "",          // adres API, np. "https://api.example.com" (WYMAGANY)
  theme: "auto",        // "auto" | "light" | "dark"
  refreshSeconds: 60,   // auto‑odświeżanie (0 = wyłączone)
};
```

Zmiana konfiguracji to edycja pliku i ponowne wgranie — nie ma żadnego serwera
ani kompilacji.

## Wymagany CORS po stronie API

W pliku `.env` repozytorium `pbl-api` ustaw origin panelu (można podać kilka,
rozdzielonych przecinkami):

```
CORS_ORIGINS=https://panel.example.com
```

API domyślnie ma `CORS_ORIGINS=` puste, czyli CORS wyłączony — bez tego kroku
przeglądarka zablokuje żądania (błąd „Failed to fetch").

## Funkcje

- **Okno logowania** „Podaj API key admina" (klucz `ADMIN_API_KEY`).
- **Wykresy** — siatka wykresów, po jednym na sensor z `GET /sensors`, z globalnym
  wyborem zakresu: 12 h / 24 h / tydzień / miesiąc / całość (domyślnie 24 h).
  Oś Y w mm, oś X to czas.
- **Czyszczenie** — wybór mostka (`GET /bridges`) i sensora
  (`GET /sensors?bridge_id=…`), wysłanie żądania czyszczenia (`POST /commands`,
  typ `clean`) oraz lista żądań z `GET /commands` (od najnowszych) ze statusami:
  Oczekuje / Wykonano / Odrzucono.
- Motyw jasny/ciemny, responsywność, dostępność (WCAG AA), `prefers-reduced-motion`.

## Warstwa wizualna

Wygląd opiera się w całości na **Bootstrapie 5.3** wciąganym z CDN (jsDelivr):

- tylko arkusz CSS — **bez JS bundle'a** Bootstrapa. Zakładki to zwykłe linki
  w `navbar`, a rozwijane elementy (modal potwierdzenia, alerty) obsługujemy
  własnym, kilkunastoliniowym kodem z `assets/js/ui.js`;
- motyw jasny/ciemny to atrybut `data-bs-theme` na `<html>` — ustawiany skryptem
  w `<head>` (przed pierwszym malowaniem, żeby uniknąć mignięcia) i przełącznikiem
  w prawym górnym rogu;
- kolory wykresów Chart.js czytamy z tokenów Bootstrapa (`--bs-primary`,
  `--bs-body-color`…), więc wykresy same dopasowują się do motywu;
- plik [`assets/css/styles.css`](assets/css/styles.css) to tylko garść nadpisań:
  rozmiar ikon SVG, wysokość kontenera wykresu i kropka stanu API. Reszta klas
  pochodzi z Bootstrapa, np. `card`, `btn-group` + `btn-check`, `form-select`,
  `table`, `badge`, `alert`.

**Wymagany dostęp do internetu** — Bootstrap i Chart.js lecą z CDN, więc panel
nie zadziała w sieci odciętej od świata (można je wtedy podmienić na pliki lokalne).

## Ograniczenia API i wynikające z nich decyzje

- **`ack` / `reject` wymagają klucza mostka** (nie admina), dlatego panel tylko
  tworzy żądania `clean` i pokazuje ich status. Rozstrzygnięcie należy do mostka.
- **Brak `total`** — API zwraca `count` i `has_more`. To prototyp zakładający mało
  danych, więc panel pobiera pierwszą porcję (`limit=1000`) bez paginacji.
- **`sent_at`** to czas z urządzenia (epoch s, UTC); w interfejsie pokazujemy go w
  czasie lokalnym przeglądarki.

## Szybki start (dewelopersko)

```bash
# 1. Uruchom API (osobne repozytorium)
uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Włącz CORS w .env API (adres, z którego serwujesz panel)
#    CORS_ORIGINS=http://localhost:8080

# 3. Ustaw adres API w config.js
#    apiBase: "http://127.0.0.1:8000"

# 4. Serwuj panel
cd pbl-webpage
python3 -m http.server 8080
# Otwórz http://localhost:8080 i zaloguj się kluczem ADMIN_API_KEY
```

## Wdrożenie (produkcyjnie)

1. Skopiuj panel na serwer, np. `sudo cp -r pbl-webpage /var/www/pbl-webpage`.
2. Uzupełnij `config.js` — podaj publiczny adres API (np. `https://api.example.com`).
3. Po stronie API ustaw `CORS_ORIGINS=https://panel.example.com`.
4. Wgraj konfigurację nginx (serwowanie statyczne):
   ```bash
   sudo cp deploy/nginx-pbl-web.conf /etc/nginx/sites-available/pbl-webpage
   sudo ln -s /etc/nginx/sites-available/pbl-webpage /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. Dodaj HTTPS: `sudo certbot --nginx -d panel.example.com`.
6. Otwórz panel i zaloguj się kluczem `ADMIN_API_KEY`.

## Bezpieczeństwo

- Klucz admina podawany jest ręcznie w oknie logowania i trzymany w
  `sessionStorage` — znika po zamknięciu karty. Wystawiaj panel po **HTTPS**.
- Klucz wysyłany jest tylko do API w nagłówku `X-API-Key`. Nie ma go w `config.js`,
  w URL ani w repozytorium.
- Ponieważ panel łączy się z API w innym origin, CORS po stronie API zawężaj do
  dokładnego adresu panelu (nie używaj `*`).

## Struktura

```
config.js                      # ← konfiguracja: adres API, ustawienia domyślne
index.html                     # powłoka SPA
assets/
  css/styles.css               # nadpisania nad Bootstrapem (ikony, wykres)
  js/app.js                    # powłoka, routing, motyw, auto‑odświeżanie
  js/api.js                    # klient API (X-API-Key, koperta błędów)
  js/store.js                  # czyta config.js; klucz w sessionStorage
  js/ui.js                     # DOM, toasty, modal, tabele, formaty
  js/icons.js                  # zestaw ikon SVG
  js/charts.js                 # wykresy Chart.js (leniwe ładowanie z CDN)
  js/ranges.js                 # zakresy czasu i budowa serii wykresu
  js/views/                    # login, overview (wykresy), cleaning
tests/
  ranges.test.mjs              # testy logiki zakresów i serii (node --test)
deploy/nginx-pbl-web.conf      # serwowanie statyczne (bez proxy)
```

## Testy

```bash
node --test tests/     # logika zakresów czasu i budowy serii (bez zależności)
```

## Minimalizacja pamięci

- **Serwer**: brak procesu aplikacyjnego — same pliki statyczne (nginx). Narzut RAM
  praktycznie zerowy.
- **Przeglądarka**: leniwe ładowanie widoków i Chart.js, jeden wykres na sensor,
  brak agresywnego odpytywania (ręczne odświeżanie + opcjonalny interwał, pauza
  przy ukrytej karcie).
