# Startsida//

En personlig startsida för webbläsaren: schema (nu/nästa), veckans plan, väder, hockey, marknad, nyheter och anteckningar.
Ren HTML, CSS och JavaScript – inga ramverk, inget byggsteg.

## Struktur

```
index.html               Sidan
css/style.css            All design (färger och former som variabler överst)
js/main.js               Startpunkt – laddar data och startar modulerna
js/lib/                  Hjälpfunktioner (tid/veckonummer, JSON, localStorage)
js/modules/              En fil per del av sidan
data/timetable.json      Veckoschemat (redigeras för hand)
data/yearplan.json       Årsplanen per vecka, lov och specialdagar (redigeras för hand)
data/config.json         Orter, aktier, lag och nyhetsflöden
data/live/               Skapas av GitHub Actions – checkas inte in
scripts/update-data.mjs  Hämtar marknad, hockey och flöden (Node 20, inga paket)
.github/workflows/       Kör skriptet var 30:e minut och publicerar till GitHub Pages
```

**Två sorters data:** det du skriver själv (schema, årsplan) ligger i repot. Det som hämtas från andra
(aktier, hockey, RSS) hämtas av en GitHub Action på servern – webbläsaren får inte läsa de flesta
av de källorna direkt (CORS). Vädret (Open-Meteo) tillåter webbläsaren, så det hämtas live på sidan.

## Kom igång

1. Skapa ett nytt **publikt** repo på GitHub och pusha de här filerna till `main`.
2. Gå till **Settings → Pages** och välj **Source: GitHub Actions**.
3. Gå till **Actions → "Hämta data och publicera" → Run workflow** för första körningen.
4. Sidan finns sedan på `https://<användarnamn>.github.io/<repo>/`. Sätt den som startsida i webbläsaren.

## Uppdatera

- **Schemat ändras:** redigera `data/timetable.json`.
- **Ett tema flyttas i årsplanen:** redigera veckan i `data/yearplan.json` (nyckel `2026-45` = vecka 45 år 2026).
- **Lov eller studiedag:** `"break": "Höstlov"` stänger av hela veckan; en enskild dag läggs i `specialDays` med `"noLessons": true`.
- **Andra aktier eller flöden:** redigera `data/config.json`.

Pusha – sidan publiceras om automatiskt inom någon minut.

## Köra lokalt

ES-moduler och `fetch` fungerar inte från `file://`, så starta en enkel server i mappen:

```
node scripts/update-data.mjs     (hämtar live-data till data/live/)
python -m http.server 8000       (öppna sedan http://localhost:8000)
```

## Tema, uppdatering och animationer

- **Ljust/mörkt:** knappen i sidhuvudet. Valet sparas i webbläsaren; har du aldrig valt följer sidan datorns inställning.
- **Uppdatera-knapparna** läser om den senaste datan från GitHub Actions. Hacker News och kryptokurser hämtas
  dessutom live direkt i webbläsaren (de källorna tillåter det). Aktier, NHL och RSS kan bara bli så färska som
  senaste Action-körningen (var 30:e minut) – kör workflowet manuellt under Actions om du vill tvinga fram ny data.
- Sidan uppdaterar sig själv tyst var 10:e minut.
- **Rörelse:** remsan med kurser och rubriker rullar automatiskt (pausar när du håller musen över den).
  Har datorn "minska rörelse" påslaget stängs alla animationer av.

## Bra att veta

- Sidan är **publik**. Lägg inte in något i repot som inte får synas.
- Anteckningarna sparas bara i din webbläser (localStorage) och publiceras aldrig.
- GitHub stänger av schemalagda körningar om repot inte har haft någon aktivitet på 60 dagar – en push eller ett klick på "Enable workflow" startar dem igen.
- Aktiekurserna kommer från Yahoo Finance via ett inofficiellt gränssnitt och är fördröjda. Om de slutar fungera visas en notis i stället för siffror.
- Växjö Lakers visas som nyhetsrubriker plus länk till shl.se – SHL har inget öppet API för resultat.
