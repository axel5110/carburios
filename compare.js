
(() => {
  const form = document.getElementById("compareForm");
  const placeInput = document.getElementById("placeInput");
  const fuelSelect = document.getElementById("fuelSelect");
  const status = document.getElementById("compareStatus");
  const results = document.getElementById("compareResults");
  const geoButton = document.getElementById("geoButton");

  if (!form) return;

  let userPosition = null;

  const fuelLabels = {
    gazole: "Gazole",
    sp95: "SP95",
    sp98: "SP98",
    e10: "E10",
    e85: "E85",
    gplc: "GPLc"
  };

  function clean(value) {
    return String(value ?? "").replace(/[<>"']/g, "").trim();
  }

  function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "Prix à vérifier";
    return n.toFixed(3).replace(".", ",") + " €/L";
  }

  function logoHtml(item) {
    const name = clean(item.name || item.brand || "Station-service");
    const logo = clean(item.logo || "autre.png");
    return `<img src="assets/station_logos/${logo}" alt="${name}" onerror="this.outerHTML='<div class=&quot;station-initial&quot;>${name.charAt(0)}</div>'">`;
  }

  function render(items, fuel, meta = {}) {
    results.innerHTML = "";
    const label = fuelLabels[fuel] || fuel.toUpperCase();

    if (!items.length) {
      status.textContent = meta.message || "Aucune station trouvée. Essaie un code postal proche.";
      return;
    }

    status.textContent = meta.message || `${items.length} station(s) trouvée(s).`;

    for (const [index, item] of items.entries()) {
      const name = clean(item.name || "Station-service");
      const address = clean(item.address);
      const cp = clean(item.cp);
      const city = clean(item.city);
      const distance = clean(item.distanceText);
      const maj = clean(item.updateDateText);
      const price = item.price ? formatPrice(item.price) : "Prix à vérifier";
      const mapQuery = encodeURIComponent([address, cp, city].filter(Boolean).join(" "));
      const sourceBadge = item.nameSource
        ? `<span class="name-source">${item.nameSource}</span>`
        : "";

      const info = `${label}${distance ? " · à " + distance : ""}${maj ? " · Mis à jour : " + maj : ""}`;

      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = `
        <div class="result-main">
          <div class="station-logo">${logoHtml(item)}</div>
          <div>
            <strong>${index + 1}. ${name} ${sourceBadge}</strong>
            <div class="address">${address}${address && (cp || city) ? " · " : ""}${cp} ${city}</div>
            <div class="small">${info}</div>
            ${mapQuery ? `<a class="map-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${mapQuery}">Itinéraire</a>` : ""}
          </div>
        </div>
        <div class="price-badge">${price}<span class="date">${label}</span></div>
      `;
      results.appendChild(card);
    }
  }

  async function searchStations() {
    const q = clean(placeInput.value);
    const fuel = String(fuelSelect.value || "e10").replace("prix_", "");

    if (!q && !userPosition) {
      status.textContent = "Entre une ville, un code postal ou utilise ta position.";
      return;
    }

    const params = new URLSearchParams();
    params.set("fuel", fuel);
    if (q) params.set("q", q);
    if (userPosition) {
      params.set("lat", String(userPosition.lat));
      params.set("lon", String(userPosition.lon));
    }

    results.innerHTML = "";
    status.textContent = "Recherche des prix et des vrais noms de stations…";

    try {
      const response = await fetch(`/api/carburants?${params.toString()}`, {
        headers: { "Accept": "application/json" }
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erreur API");
      }

      render(data.results || [], fuel, data.meta || {});
    } catch (error) {
      console.error(error);
      status.textContent = "Erreur de chargement. Vérifie que le dossier functions/api/carburants.js est bien déployé via GitHub sur Cloudflare Pages.";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await searchStations();
  });

  if (geoButton) {
    geoButton.addEventListener("click", () => {
      if (!navigator.geolocation) {
        status.textContent = "Ton navigateur ne permet pas la géolocalisation.";
        return;
      }

      status.textContent = "Autorise la localisation pour calculer la distance…";

      navigator.geolocation.getCurrentPosition(async (position) => {
        userPosition = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };

        status.textContent = "Position trouvée. Recherche des stations autour de toi…";
        await searchStations();
      }, () => {
        status.textContent = "Localisation refusée. Tu peux entrer ton code postal à la place.";
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 120000
      });
    });
  }
})();
