import { AIRPORTS_ENDPOINT, AIRPORTS_STATIC_CATALOG } from "./config.js";

const CATALOG_STORAGE_KEY = "btp-airport-catalog-v1";
const memoryCatalog = { airports: null };
const EXTRA_ALIASES = {
  PRN: "pristine prishtine prishtina",
  BJV: "bodrum mugla",
  DLM: "mugla",
  SAW: "sabiha gokcen"
};

function foldAirportText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haystackFor(row) {
  return foldAirportText(
    [row.iata, row.name, row.city, row.country, row.label, EXTRA_ALIASES[row.iata] || ""].join(" ")
  );
}

function rankAirports(airports, query) {
  const q = foldAirportText(query);
  if (q.length < 2) return [];
  const ranked = [];
  airports.forEach(function (row) {
    const iata = foldAirportText(row.iata);
    const name = foldAirportText(row.name);
    const city = foldAirportText(row.city);
    const country = foldAirportText(row.country);
    const hay = haystackFor(row);
    let score = 0;
    if (iata === q) score = 100;
    else if (iata.indexOf(q) === 0) score = 92;
    else if (city && city === q) score = 88;
    else if (city && city.indexOf(q) === 0) score = 80;
    else if (name.indexOf(q) === 0) score = 74;
    else if (city && (" " + city + " ").indexOf(" " + q + " ") !== -1) score = 70;
    else if (hay.indexOf(q) !== -1) {
      score = country === q || country.indexOf(q) === 0 ? 42 : 58;
    } else return;
    ranked.push({ score: score, row: row });
  });
  ranked.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    const cityCmp = String(a.row.city || "").localeCompare(String(b.row.city || ""), "tr");
    if (cityCmp) return cityCmp;
    return String(a.row.name || "").localeCompare(String(b.row.name || ""), "tr");
  });
  return ranked.slice(0, 15).map(function (item) {
    return item.row;
  });
}

let catalogPromise = null;

function readStoredCatalog() {
  if (memoryCatalog.airports && memoryCatalog.airports.length > 100) {
    return memoryCatalog.airports;
  }
  try {
    const raw = sessionStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.airports) && parsed.airports.length > 100) {
      memoryCatalog.airports = parsed.airports;
      return parsed.airports;
    }
  } catch (e) {}
  return null;
}

function storeCatalog(airports) {
  memoryCatalog.airports = airports;
  try {
    sessionStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ airports: airports }));
  } catch (e) {}
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);
  if ([a1, o1, a2, o2].some(function (n) { return Number.isNaN(n); })) return null;
  const earth = 6371;
  const dLat = ((a2 - a1) * Math.PI) / 180;
  const dLon = ((o2 - o1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a1 * Math.PI) / 180) * Math.cos((a2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function routeDistanceFromAirports(airports, depIata, arrIata) {
  const dep = String(depIata || "").toUpperCase();
  const arr = String(arrIata || "").toUpperCase();
  if (!dep || !arr || dep === arr || !Array.isArray(airports)) return null;
  let depRow = null;
  let arrRow = null;
  airports.forEach(function (row) {
    if (!row || !row.iata) return;
    if (row.iata === dep) depRow = row;
    if (row.iata === arr) arrRow = row;
  });
  if (!depRow || !arrRow || depRow.lat == null || depRow.lon == null || arrRow.lat == null || arrRow.lon == null) {
    return null;
  }
  return haversineDistanceKm(depRow.lat, depRow.lon, arrRow.lat, arrRow.lon);
}

function searchAirportsRemote(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return Promise.resolve([]);
  return fetch(AIRPORTS_ENDPOINT + "?q=" + encodeURIComponent(q), { headers: { Accept: "application/json" } })
    .then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok || !json || json.ok !== true || !Array.isArray(json.airports)) {
          return { ok: false, airports: [] };
        }
        return { ok: true, airports: json.airports };
      });
    })
    .catch(function () {
      return { ok: false, airports: [] };
    });
}

function loadStaticCatalogFile() {
  return fetch(AIRPORTS_STATIC_CATALOG, { headers: { Accept: "application/json" } })
    .then(function (res) {
      if (!res.ok) return [];
      return res.json().then(function (json) {
        const airports = json && Array.isArray(json.airports) ? json.airports : [];
        return airports.length > 100 ? airports : [];
      });
    })
    .catch(function () {
      return [];
    });
}

function loadRemoteCatalogFile() {
  return fetch(AIRPORTS_ENDPOINT + "?catalog=1", { headers: { Accept: "application/json" } })
    .then(function (res) {
      return res.json().then(function (json) {
        return { res: res, json: json };
      });
    })
    .then(function (pack) {
      const json = pack.json;
      const airports = json && json.ok && Array.isArray(json.airports) ? json.airports : [];
      return airports.length > 100 ? airports : [];
    })
    .catch(function () {
      return [];
    });
}

function loadAirportCatalog() {
  if (catalogPromise) return catalogPromise;
  const stored = readStoredCatalog();
  if (stored) {
    catalogPromise = Promise.resolve(stored);
    return catalogPromise;
  }
  catalogPromise = loadStaticCatalogFile()
    .then(function (airports) {
      if (airports.length > 100) {
        storeCatalog(airports);
        return airports;
      }
      return loadRemoteCatalogFile().then(function (remote) {
        if (remote.length > 100) {
          storeCatalog(remote);
          return remote;
        }
        throw new Error("catalog_unavailable");
      });
    })
    .catch(function () {
      catalogPromise = null;
      return [];
    });
  return catalogPromise;
}

export { loadAirportCatalog };

export function getStoredAirportCatalog() {
  return readStoredCatalog() || [];
}

export function routeDistanceKmFromCatalog(depIata, arrIata) {
  return routeDistanceFromAirports(readStoredCatalog() || [], depIata, arrIata);
}

export function bindAirportSelector(opts) {
  const input = document.getElementById(opts.inputId);
  const list = document.getElementById(opts.listId);
  const hidden = document.getElementById(opts.hiddenId);
  const group = document.getElementById(opts.groupId);
  let status = group ? group.querySelector(".airport-status") : null;
  if (!status && group) {
    status = document.createElement("p");
    status.className = "airport-status";
    status.hidden = true;
    group.appendChild(status);
  }
  let items = [];
  let active = -1;
  let selected = null;
  let debounceTimer = null;
  let catalog = readStoredCatalog() || [];
  let catalogReady = catalog.length > 100;

  loadAirportCatalog().then(function (rows) {
    if (rows && rows.length > 100) {
      catalog = rows;
      catalogReady = true;
    }
  });

  function setStatus(text) {
    if (!status) return;
    if (!text) {
      status.hidden = true;
      status.textContent = "";
      return;
    }
    status.hidden = false;
    status.textContent = text;
  }

  function labelFor(row) {
    return row.label || row.name + " (" + row.iata + ")";
  }

  function setSelected(row) {
    selected = row;
    hidden.value = row ? row.iata : "";
    if (row) {
      input.value = labelFor(row);
      setStatus("");
    }
  }

  function closeList() {
    list.hidden = true;
    list.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    active = -1;
  }

  function highlight() {
    Array.prototype.forEach.call(list.children, function (el, idx) {
      el.classList.toggle("is-active", idx === active);
      if (idx === active) el.setAttribute("aria-selected", "true");
      else el.setAttribute("aria-selected", "false");
    });
  }

  function render(rows) {
    items = rows;
    list.innerHTML = "";
    if (!rows.length) {
      closeList();
      return;
    }
    rows.forEach(function (row, idx) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "airport-option";
      btn.id = opts.listId + "-opt-" + idx;
      btn.setAttribute("role", "option");
      btn.textContent = labelFor(row);
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        setSelected(row);
        closeList();
      });
      list.appendChild(btn);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    active = 0;
    highlight();
  }

  function searchNow(query) {
    const q = foldAirportText(query);
    if (q.length < 2) {
      closeList();
      setStatus("");
      return;
    }
    if (catalogReady) {
      const local = rankAirports(catalog, query);
      if (local.length) {
        setStatus("");
        render(local);
        return;
      }
    }
    setStatus("Havalimanları aranıyor…");
    searchAirportsRemote(query).then(function (result) {
      if (foldAirportText(input.value) !== q) {
        return;
      }
      if (!result.ok) {
        closeList();
        setStatus("Liste şu anda yüklenemedi. Birkaç saniye sonra tekrar yazın.");
        return;
      }
      if (!result.airports.length) {
        closeList();
        setStatus("Eşleşen havalimanı bulunamadı.");
        return;
      }
      setStatus("");
      render(result.airports);
    });
  }

  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", opts.listId);
  list.setAttribute("role", "listbox");

  input.addEventListener("input", function () {
    hidden.value = "";
    selected = null;
    const query = input.value;
    clearTimeout(debounceTimer);
    if (foldAirportText(query).length < 2) {
      closeList();
      setStatus("");
      return;
    }
    debounceTimer = setTimeout(function () {
      searchNow(query);
    }, 220);
  });

  input.addEventListener("focus", function () {
    if (foldAirportText(input.value).length >= 2 && !hidden.value) {
      searchNow(input.value);
    }
  });

  input.addEventListener("keydown", function (e) {
    if (list.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = Math.min(items.length - 1, active + 1);
      highlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(0, active - 1);
      highlight();
    } else if (e.key === "Enter") {
      if (active >= 0 && items[active]) {
        e.preventDefault();
        setSelected(items[active]);
        closeList();
      }
    } else if (e.key === "Escape") {
      closeList();
    }
  });

  input.addEventListener("blur", function () {
    setTimeout(function () {
      closeList();
    }, 180);
  });

  return {
    getIata: function () {
      return hidden.value || "";
    },
    getSelected: function () {
      return selected;
    },
    clear: function () {
      setSelected(null);
      input.value = "";
      closeList();
      setStatus("");
    },
    setByIata: function (iata) {
      const code = String(iata || "").toUpperCase();
      if (!code) return;
      const list = catalog.length > 100 ? catalog : readStoredCatalog() || catalog;
      const pick = list.find(function (row) {
        return row && row.iata === code;
      });
      if (pick) {
        setSelected(pick);
        return;
      }
      hidden.value = code;
      input.value = code;
    },
    group: group
  };
}
