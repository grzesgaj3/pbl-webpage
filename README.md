# STACJA — panel opadów dla `pbl-api`

Statyczny panel administracyjno‑podglądowy dla
[`pbl-api`](https://github.com/grzesgaj3/pbl-api) — sieci deszczomierzy LoRa.

Panel pokazuje zarejestrowane opady, kolejkę komend czyszczenia, zestawienie
mostków i sensorów, a także tworzy nowe komendy `clean`. Zbudowany jest w czystym
HTML/CSS/JS (bez frameworka i bez build‑stepu), więc **na serwerze nie zużywa
pamięci** — pliki serwuje nginx, a cała logika działa w przeglądarce.

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
- **Pulpit** — odczyty zbiorcze (ostatni pomiar, sumy opadów, liczba mostków,
  komendy oczekujące), wykres opadów dziennych i suma wg mostka, ostatnie pomiary.
- **Pomiary** — filtry (`bridge_id`, `sensor_id`, zakres dat), paginacja offsetowa,
  szczegóły wiersza, eksport CSV / JSON.
- **Komendy** — filtry po statusie i mostku, tworzenie nowej komendy `clean`,
  podgląd payloadu LoRa z kopiowaniem, eksport CSV.
- **Mostki i sensory** — zestawienie wyprowadzone z danych (API nie udostępnia
  `/bridges`), z przejściem do filtrowanych pomiarów.
- **Ustawienia** — podgląd adresu API, motyw, interwał odświeżania, test połączenia,
  wylogowanie.
- Motyw jasny/ciemny, responsywność, dostępność (WCAG AA), `prefers-reduced-motion`.

## Ograniczenia API i wynikające z nich decyzje

- **Brak `GET /bridges`** — listę mostków i sensorów wyprowadzamy z ostatnich
  pomiarów oraz komend.
- **Brak `total`** — API zwraca offset z `has_more`; statystyki pulpitu liczone są
  z wczytanej porcji (limit) i tak oznaczone w interfejsie.
- **`ack` / `reject` wymagają klucza mostka** (nie admina), dlatego panel nie
  potwierdza komend — pokazuje payload do przekazania i status. Rozstrzygnięcie
  należy do mostka.
- **`sent_at`** to czas z urządzenia (epoch s, UTC); w tabelach pokazujemy go w
  czasie lokalnym przeglądarki, a wartość UTC w szczegółach.

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
  css/styles.css               # design system (tokeny, komponenty, motywy)
  js/app.js                    # powłoka, routing, motyw, auto‑odświeżanie
  js/api.js                    # klient API (X-API-Key, koperta błędów)
  js/store.js                  # czyta config.js; klucz w sessionStorage
  js/ui.js                     # DOM, toasty, modal, tabele, formaty
  js/icons.js                  # zestaw ikon SVG
  js/charts.js                 # wykresy Chart.js (leniwe ładowanie z CDN)
  js/facets.js                 # bufor mostków/sensorów
  js/views/                    # login, dashboard, measurements, commands,
                               # bridges, settings
deploy/nginx-pbl-web.conf      # serwowanie statyczne (bez proxy)
```

## Minimalizacja pamięci

- **Serwer**: brak procesu aplikacyjnego — same pliki statyczne (nginx). Narzut RAM
  praktycznie zerowy.
- **Przeglądarka**: paginacja zamiast ładowania całości, leniwe ładowanie widoków
  i Chart.js, ograniczone serie wykresów, brak agresywnego odpytywania (ręczne
  odświeżanie + opcjonalny interwał, pauza przy ukrytej karcie).
