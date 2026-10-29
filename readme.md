# Biblioteka do generowania wizualizacji PDF faktur i UPO

Biblioteka do generowania wizualizacji PDF faktur oraz UPO na podstawie plików XML po stronie klienta.

---

## 1. Główne ustalenia

    Biblioteka zawiera następujące funkcjonalności:
    - Generowanie wizualizacji PDF faktur
    - Generowanie wizualizacji PDF UPO
    - Generowanie wizualizacji PDF faktur PEF

---

## 2. Jak uruchomić aplikację pokazową

1. Zainstaluj Node.js w wersji **22.14.0**  
   Możesz pobrać Node.js z oficjalnej strony: [https://nodejs.org](https://nodejs.org)

2. Sklonuj repozytorium i przejdź do folderu projektu:
   ```bash
   git clone https://github.com/CIRFMF/ksef-pdf-generator#
   cd ksef-pdf-generator
   ```

3. Zainstaluj zależności:
   ```bash
   npm install
   ```

4. Uruchom aplikację:
   ```bash
   npm run dev
   ```

Aplikacja uruchomi się domyślnie pod adresem: [http://localhost:5173/](http://localhost:5173/)

## 2.1 Budowanie bibliotki

1. Jak zbudować bibliotekę produkcyjnie:
   ```bash
   npm run build
   ```

## 3. Jak wygenerować fakturę

1. Po uruchomieniu aplikacji przejdź do **Wygeneruj wizualizacje faktury PDF**.
2. Wybierz plik XML zgodny ze schemą **FA(1), FA(2) lub FA(3)**.
3. Przykładowy plik znajduje się w folderze:
   ```
   examples/invoice.xml
   ```  
4. Po wybraniu pliku, PDF zostanie wygenerowany.

---

## 4. Jak wygenerować UPO

1. Po uruchomieniu aplikacji przejdź do **Wygeneruj wizualizacje UPO PDF**.
2. Wybierz plik XML zgodny ze schemą **UPO v4_2**.
3. Przykładowy plik znajduje się w folderze:
   ```
   examples/upo.xml
   ```  
4. Po wybraniu pliku, PDF zostanie wygenerowany.

---

## 5. Testy jednostkowe

Aplikacja zawiera zestaw testów napisanych w **TypeScript**, które weryfikują poprawność działania aplikacji.  
Projekt wykorzystuje **Vite** do bundlowania i **Vitest** jako framework testowy.

### Uruchamianie testów

1. Uruchom wszystkie testy:
   ```bash
   npm run test
   ```

2. Uruchom testy z interfejsem graficznym:
   ```bash
   npm run test:ui
   ```

3. Uruchom testy w trybie CI z raportem pokrycia:
   ```bash
   npm run test:ci
   ```

---

Raport: /coverage/index.html

---

### 6.Lokalizacja - i18next

Biblioteka wspiera lokalizację, poprzez użycie biblioteki i18next. Pliki z tłumaczeniami należy umieścic w folderze
** src/lib-public/i18n/lang **. Dokumentacja samej biblioteki i18next znajduje się pod adresem https://www.i18next.com/.

---

### 1. Nazewnictwo zmiennych i metod

- **Polsko-angielskie nazwy** stosowane w zmiennych, typach i metodach wynikają bezpośrednio ze struktury pliku schemy
  faktury.  
  Takie podejście zapewnia spójność i ujednolicenie nazewnictwa z definicją danych zawartą w schemie XML.

### 2. Struktura danych

- Struktura danych interfejsu FA odzwierciedla strukturę danych źródłowych pliku XML, zachowując ich logiczne powiązania
  i hierarchię
  w bardziej czytelnej formie.

### 3. Typy i interfejsy

- Typy odzwierciedlają strukturę danych pobieranych z XML faktur oraz ułatwiają generowanie PDF
- Typy i interfejsy są definiowane w folderze types oraz plikach z rozszerzeniem types.ts.

---

## Dokumentacja używanych narzędzi

- Vitest Docs — https://vitest.dev/guide/
- Vite Docs — https://vitejs.dev/guide/
- TypeScript Handbook — https://www.typescriptlang.org/docs/

---

## Uwagi

- Upewnij się, że pliki XML są poprawnie sformatowane zgodnie z odpowiednią schemą.
- W przypadku problemów z Node.js, rozważ użycie menedżera wersji Node, np. [nvm](https://github.com/nvm-sh/nvm).

---

## Ważne!!!

Dodano obsługę faktur PEF - W najbliższym wydaniu będą dostępne na produkcji.

---

## Serwer (fork Appunite)

Ten fork dodaje do biblioteki CIRFMF serwer: XML na wejściu, PDF lub HTML na wyjściu. Zmiany w
`src/` są ograniczone do podziału każdego generatora na `buildXDocDefinition` i `generateX` oraz
do `buildInvoiceDocDefinition` obok `generateInvoice`, żeby HTML powstawał z tej samej definicji
dokumentu co PDF. Reszta jest w `server/`.

Oba wejścia przyjmują numer KSeF (wyświetlany w nagłówku i pod kodem QR) i link KOD I (kod QR).
Błąd zgłaszają jako rodzaj: `parse_error`, `unsupported_schema`, `unknown_format` lub
`render_error`. Logi nigdy nie zawierają treści dokumentu.

### Proces stdio (`server/stdio.js`)

Dla aplikacji, która trzyma generator jako proces potomny (np. port w Erlang/Elixir), bez
otwierania portu sieciowego. Każda wiadomość w obie strony to 4-bajtowa długość (big-endian) i tyle
bajtów: 4-bajtowa długość nagłówka JSON, nagłówek, a potem treść.

| Kierunek | Nagłówek | Treść |
|----------|----------|-------|
| żądanie | `{"format": "pdf" \| "html", "ksef_number"?: "...", "qr_url"?: "..."}` | XML faktury |
| odpowiedź | `{"ok": true}` | PDF lub HTML |
| odpowiedź | `{"ok": false, "kind": "parse_error"}` | brak |

Żądania są obsługiwane po kolei. stdout niesie wyłącznie odpowiedzi, a stderr linię na każdy błąd.
Proces kończy się z kodem 0, gdy zamknie się stdin.

```bash
npm run build
node server/stdio.js
```

### Serwer HTTP (`server/index.js`)

```bash
npm run build
node server/index.js
```

Serwer nasłuchuje na porcie `3001` (zmiana przez zmienną środowiskową `PORT`).

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/generate/pdf` | Wyślij XML, otrzymaj PDF |
| `POST` | `/generate/html` | Wyślij XML, otrzymaj HTML |
| `GET` | `/health` | Health check (`{"status":"ok"}`) |

Opcjonalne nagłówki: `X-KSeF-Number` (numer KSeF) i `X-KSeF-QRCode` (link KOD I).

```bash
curl -X POST \
  -H 'Content-Type: application/xml' \
  -H 'X-KSeF-Number: 5555555555-20250808-9231003CA67B-BE' \
  -H 'X-KSeF-QRCode: https://qr-test.ksef.mf.gov.pl/invoice/...' \
  --data-binary @assets/invoice.xml \
  http://localhost:3001/generate/pdf -o faktura.pdf
```

### Testy i Docker

```bash
npm run test:server
docker build -t ksef-pdf .
docker run -p 3001:3001 ksef-pdf
```

### Aktualizacja z upstreamu

```bash
git fetch upstream
git merge upstream/main
```

Konflikty mogą dotyczyć tylko generatorów w `src/lib-public/*-generator.ts`, `generate-invoice.ts`
i plików `index.ts`. Po scaleniu trzeba uruchomić `npm run test:ci` i `npm run test:server`.
