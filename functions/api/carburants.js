
const FUEL_API = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records";
const STATION_PAGE = "https://www.prix-carburants.gouv.fr/station/";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

const FUEL_FIELDS = {
  gazole: { price: "prix_gazole", update: "maj_gazole", label: "Gazole" },
  sp95: { price: "prix_sp95", update: "maj_sp95", label: "SP95" },
  sp98: { price: "prix_sp98", update: "maj_sp98", label: "SP98" },
  e10: { price: "prix_e10", update: "maj_e10", label: "E10" },
  e85: { price: "prix_e85", update: "maj_e85", label: "E85" },
  gplc: { price: "prix_gplc", update: "maj_gplc", label: "GPLc" }
};

const BRAND_RULES = [
  { name: "TotalEnergies", logo: "totalenergies.png", words: ["totalenergies", "total energies", "total energie", "total énergie", "total access", "total "] },
  { name: "Auchan", logo: "auchan.png", words: ["auchan"] },
  { name: "E.Leclerc", logo: "leclerc.png", words: ["e.leclerc", "e leclerc", "leclerc"] },
  { name: "Carrefour", logo: "carrefour.png", words: ["carrefour"] },
  { name: "Intermarché", logo: "intermarche.png", words: ["intermarché", "intermarche", "inter marché"] },
  { name: "Super U", logo: "u.png", words: ["super u", "hyper u", "systeme u", "système u", "u express"] },
  { name: "Avia", logo: "avia.png", words: ["avia"] },
  { name: "BP", logo: "bp.png", words: ["bp "] },
  { name: "Esso", logo: "esso.png", words: ["esso"] },
  { name: "Shell", logo: "shell.png", words: ["shell"] }
];

const PARIS_CP = Array.from({ length: 20 }, (_, i) => `750${String(i + 1).padStart(2, "0")}`);

const TERGNIER_QUERIES = ["02700", "Condren", "Viry-Noureuil", "Beautor", "Chauny"];

const TERGNIER_FALLBACK = [
  { name: "TotalEnergies", logo: "totalenergies.png", address: "213 Bd Gambetta", cp: "02700", city: "Condren", lat: 49.6370, lon: 3.2840 },
  { name: "Auchan", logo: "auchan.png", address: "Route de Chauny", cp: "02300", city: "Viry-Noureuil", lat: 49.6330, lon: 3.2430 },
  { name: "E.Leclerc", logo: "leclerc.png", address: "16 Rue de Tergnier", cp: "02800", city: "Beautor", lat: 49.6520, lon: 3.3450 },
  { name: "Intermarché", logo: "intermarche.png", address: "ZAC de l'Univers, Bd de l'Europe", cp: "02300", city: "Chauny", lat: 49.6150, lon: 3.2180 }
];

const stationNameCache = new Map();

function clean(value) {
  return String(value ?? "").replace(/[<>"']/g, "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeWhere(value) {
  return clean(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function coordToDecimal(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(String(value).replace(",", ".").trim());
  if (!Number.isFinite(n)) return null;

  // The v2 dataset may expose lat/lon as E5 integers, e.g. 4885660 -> 48.85660
  if (Math.abs(n) > 1000) return n / 100000;
  return n;
}

function getCoordinates(row) {
  const lat = coordToDecimal(row.latitude);
  const lon = coordToDecimal(row.longitude);
  if (lat !== null && lon !== null) return { lat, lon };
  return null;
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(km) {
  if (km === null || !Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return clean(value);
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function detectBrand(text) {
  const haystack = normalize(text).replace(/\s+/g, " ");
  for (const rule of BRAND_RULES) {
    if (rule.words.some(word => haystack.includes(normalize(word)))) {
      return { name: rule.name, logo: rule.logo };
    }
  }
  return null;
}

function logoForName(name) {
  const brand = detectBrand(name);
  return brand?.logo || "autre.png";
}

function stripHtml(value) {
  return clean(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " "));
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&agrave;/g, "à")
    .replace(/&Agrave;/g, "À")
    .replace(/&ccedil;/g, "ç")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û")
    .replace(/&icirc;/g, "î");
}

function extractStationName(html, row) {
  const candidates = [];

  const patterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /"name"\s*:\s*"([^"]+)"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) candidates.push(htmlDecode(stripHtml(match[1])));
  }

  // Fallback: search for known brands in the page text.
  const fullText = htmlDecode(stripHtml(html));
  const brand = detectBrand(fullText);
  if (brand) candidates.push(brand.name);

  for (let name of candidates) {
    name = clean(name)
      .replace(/Prix des carburants/i, "")
      .replace(/prix-carburants\.gouv\.fr/i, "")
      .replace(/Station-service/i, "")
      .replace(/\s+[-|–]\s*$/g, "")
      .replace(/^[\-|–]\s+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (name.length >= 3 && !/^\d+$/.test(name)) return name;
  }

  return "";
}

async function fetchOfficialStationName(id, row) {
  const stationId = clean(id);
  if (!stationId) return "";

  if (stationNameCache.has(stationId)) {
    return stationNameCache.get(stationId);
  }

  try {
    const response = await fetch(`${STATION_PAGE}${encodeURIComponent(stationId)}`, {
      headers: {
        "User-Agent": "Carburio/1.0 (+https://carburio.com)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      stationNameCache.set(stationId, "");
      return "";
    }

    const html = await response.text();
    const name = extractStationName(html, row);
    stationNameCache.set(stationId, name);
    return name;
  } catch (_) {
    stationNameCache.set(stationId, "");
    return "";
  }
}

function isParisQuery(q) {
  const value = clean(q);
  const n = normalize(value);
  return n === "paris" || /^750(0[1-9]|1[0-9]|20)$/.test(value);
}

function isTergnierQuery(q) {
  const value = clean(q);
  return normalize(value).includes("tergnier") || value === "02700";
}

function buildWhere(q) {
  const value = clean(q);
  const n = normalize(value);

  if (n === "paris") {
    return PARIS_CP.map(cp => `cp="${cp}"`).join(" or ");
  }

  if (/^\d{5}$/.test(value)) {
    return `cp="${value}"`;
  }

  return `lower(ville)=lower("${escapeWhere(value)}")`;
}

async function reversePostcode(lat, lon) {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lon),
      zoom: "18",
      addressdetails: "1"
    });

    const response = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`, {
      headers: {
        "User-Agent": "Carburio/1.0 (+https://carburio.com)",
        "Accept": "application/json"
      }
    });

    if (!response.ok) return "";
    const data = await response.json();
    return clean(data.address?.postcode || "");
  } catch (_) {
    return "";
  }
}

async function fetchFuelRows(q) {
  const params = new URLSearchParams({
    lang: "fr",
    timezone: "Europe/Paris",
    limit: "100",
    where: buildWhere(q)
  });

  const response = await fetch(`${FUEL_API}?${params.toString()}`, {
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Data API ${response.status}: ${text.slice(0, 120)}`);
  }

  const data = await response.json();
  return data.results || [];
}

async function fetchAllRows(queries) {
  const all = [];
  for (const q of queries) {
    try {
      const rows = await fetchFuelRows(q);
      all.push(...rows);
    } catch (error) {
      console.warn("Query failed", q, error);
    }
  }
  return all;
}

function fallbackName(row) {
  const address = clean(row.adresse);
  const city = clean(row.ville);
  const brand = detectBrand([row.adresse, row.ville, row.services_service, row.horaires_jour].flat().join(" "));
  if (brand) return brand.name;
  if (address) return `Station-service – ${address}`;
  if (city) return `Station-service – ${city}`;
  return "Station-service";
}

async function rowToStation(row, fuel, origin) {
  const fields = FUEL_FIELDS[fuel] || FUEL_FIELDS.e10;
  const price = Number(String(row[fields.price] ?? "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) return null;

  const coords = getCoordinates(row);
  const distance = origin ? haversineKm(origin, coords) : null;

  let officialName = "";
  if (row.id) {
    officialName = await fetchOfficialStationName(row.id, row);
  }

  const name = officialName || fallbackName(row);
  const logo = logoForName(name);

  return {
    id: clean(row.id),
    name,
    logo,
    nameSource: officialName ? "Nom officiel" : "Nom déduit",
    address: clean(row.adresse),
    cp: clean(row.cp),
    city: clean(row.ville),
    price,
    updateDate: clean(row[fields.update]),
    updateDateText: formatDate(row[fields.update]),
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
    distanceKm: distance,
    distanceText: formatDistance(distance)
  };
}

function fallbackTergnier(origin) {
  return TERGNIER_FALLBACK.map(station => {
    const coords = { lat: station.lat, lon: station.lon };
    const distance = haversineKm(origin || { lat: 49.6566, lon: 3.2870 }, coords);
    return {
      id: "",
      name: station.name,
      logo: station.logo,
      nameSource: "Nom intégré",
      address: station.address,
      cp: station.cp,
      city: station.city,
      price: null,
      updateDate: "",
      updateDateText: "",
      lat: station.lat,
      lon: station.lon,
      distanceKm: distance,
      distanceText: formatDistance(distance)
    };
  }).sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  let q = clean(url.searchParams.get("q"));
  const fuel = normalize(url.searchParams.get("fuel") || "e10").replace("prix_", "");
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=120"
  };

  if (!FUEL_FIELDS[fuel]) {
    return new Response(JSON.stringify({ error: "Carburant non reconnu", results: [] }), { status: 400, headers });
  }

  let origin = null;
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    origin = { lat, lon };

    if (!q) {
      q = await reversePostcode(lat, lon);
    }
  }

  if (!q) {
    return new Response(JSON.stringify({ error: "Ville, code postal ou position manquante", results: [] }), { status: 400, headers });
  }

  const queries = isTergnierQuery(q) ? TERGNIER_QUERIES : [q];

  try {
    const rows = await fetchAllRows(queries);
    const seen = new Set();

    const filtered = rows.filter(row => {
      const id = clean(row.id || `${row.adresse}-${row.cp}-${row.ville}`);
      if (seen.has(id)) return false;
      seen.add(id);

      if (isParisQuery(q) && !PARIS_CP.includes(clean(row.cp))) return false;
      return true;
    });

    const stations = (await Promise.all(filtered.map(row => rowToStation(row, fuel, origin))))
      .filter(Boolean)
      .sort((a, b) => {
        if (origin && a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        if ((a.price || 999) !== (b.price || 999)) return (a.price || 999) - (b.price || 999);
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        return 0;
      })
      .slice(0, 12);

    let results = stations;
    let message = "";

    if (!results.length && isTergnierQuery(q)) {
      results = fallbackTergnier(origin);
      message = "Stations proches de Tergnier affichées, prix à vérifier.";
    } else if (origin) {
      message = `${results.length} station(s) trouvée(s), triées par distance depuis ta position.`;
    } else if (isParisQuery(q)) {
      message = `${results.length} station(s) trouvée(s) dans Paris uniquement.`;
    } else {
      message = `${results.length} station(s) trouvée(s), triées par prix.`;
    }

    return new Response(JSON.stringify({
      meta: {
        q,
        fuel,
        message
      },
      results
    }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Impossible de récupérer les stations",
      detail: String(error.message || error),
      results: []
    }), { status: 502, headers });
  }
}
