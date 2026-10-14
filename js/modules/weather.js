// Weather strip via Open-Meteo (free, no API key, allows browser requests).
// Results are cached in localStorage for 15 minutes so new tabs open instantly.

import { esc, store } from "../lib/data.js";

const CACHE_KEY = "startsida.weather";
const CACHE_MIN = 15;

// WMO weather codes -> Swedish description
const WMO = {
  0: "Klart", 1: "Mest klart", 2: "Halvklart", 3: "Mulet",
  45: "Dimma", 48: "Rimfrostdimma",
  51: "Lätt duggregn", 53: "Duggregn", 55: "Kraftigt duggregn",
  56: "Underkylt duggregn", 57: "Underkylt duggregn",
  61: "Lätt regn", 63: "Regn", 65: "Kraftigt regn",
  66: "Underkylt regn", 67: "Underkylt regn",
  71: "Lätt snöfall", 73: "Snöfall", 75: "Kraftigt snöfall", 77: "Snökorn",
  80: "Regnskurar", 81: "Regnskurar", 82: "Kraftiga skurar",
  85: "Snöbyar", 86: "Kraftiga snöbyar",
  95: "Åska", 96: "Åska med hagel", 99: "Åska med hagel",
};

async function fetchLocation(loc) {
  const params = new URLSearchParams({
    latitude: loc.lat,
    longitude: loc.lon,
    current: "temperature_2m,weather_code,wind_speed_10m",
    hourly: "precipitation,precipitation_probability",
    forecast_hours: "10",
    wind_speed_unit: "ms",
    timezone: "Europe/Stockholm",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(res.status);
  const d = await res.json();
  return {
    name: loc.name,
    temp: d.current.temperature_2m,
    code: d.current.weather_code,
    wind: d.current.wind_speed_10m,
    hourly: d.hourly.time.map((t, i) => ({
      time: t,
      mm: d.hourly.precipitation[i],
      prob: d.hourly.precipitation_probability[i],
    })),
  };
}

/** Earliest upcoming hour with real rain risk, across all places. */
function rainAlert(places) {
  let best = null;
  for (const p of places) {
    if (p.code >= 51 && p.code <= 82) return `Det regnar nu i ${p.name}`;
    const hit = p.hourly.find((h) => h.mm >= 0.3 || h.prob >= 60);
    if (hit && (!best || hit.time < best.time)) best = { ...hit, name: p.name };
  }
  return best ? `Regn väntas i ${best.name} ca ${best.time.slice(11, 16)}` : null;
}

function render(el, places) {
  const items = places.map((p) => `
    <div class="wx">
      <span class="wx__place">${esc(p.name)}</span>
      <span class="wx__temp">${Math.round(p.temp)}°</span>
      <span class="wx__desc">${esc(WMO[p.code] || "")}</span>
      <span class="wx__wind">${Math.round(p.wind)} m/s</span>
    </div>`).join("");
  const alert = rainAlert(places);
  el.innerHTML = items + (alert ? `<span class="wx-alert">☂ ${esc(alert)}</span>` : "");
}

export async function initWeather(el, locations) {
  const cached = store.get(CACHE_KEY);
  if (cached) render(el, cached.places);

  const fresh = cached && Date.now() - cached.at < CACHE_MIN * 60_000;
  if (fresh) return;

  try {
    const places = await Promise.all(locations.map(fetchLocation));
    store.set(CACHE_KEY, { at: Date.now(), places });
    render(el, places);
  } catch (err) {
    if (!cached) el.innerHTML = `<p class="error">Vädret kunde inte hämtas.</p>`;
    console.warn("Väder:", err);
  }
}
