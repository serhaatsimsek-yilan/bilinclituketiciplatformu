/**
 * Client flight search. Talks only to our server.
 * Provider HTTP stays in api/lib/airlabs.php
 */

import { FLIGHT_SEARCH_ENDPOINT } from "./config.js";

export function normalizeFlightNumber(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[\s\-]+/g, "");
}

export function normalizeIataCode(raw) {
  const v = String(raw || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  return /^[A-Z]{3}$/.test(v) ? v : "";
}

export function isValidFlightNumber(ident) {
  return /^[A-Z]{2,3}[0-9]{1,4}[A-Z]?$/.test(ident);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export function flightDateBounds(now) {
  const n = now || new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return { min: "", max: toIsoDate(today) };
}

export function validateFlightDate(isoDate, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) {
    return { ok: false, code: "invalid_date", message: "Lütfen geçerli bir tarih seçin. Gelecek tarih seçilemez." };
  }
  const bounds = flightDateBounds(now);
  if (isoDate > bounds.max) {
    return { ok: false, code: "future", message: "Lütfen geçerli bir tarih seçin. Gelecek tarih seçilemez." };
  }
  return { ok: true };
}

function parseFlightInstant(value) {
  if (!value) return NaN;
  const normalized = String(value).trim().replace(/^(\d{4}-\d{2}-\d{2})t/i, "$1T");
  return Date.parse(normalized);
}

export function calculateArrivalDelay(flight) {
  if (!flight) return null;
  if (flight.cancelled) return null;
  if (flight.arrivalDelayMinutes != null && flight.arrivalDelayMinutes !== "") {
    return Number(flight.arrivalDelayMinutes);
  }
  if (flight.delayMinutes != null && flight.delayMinutes !== "") {
    return Number(flight.delayMinutes);
  }
  const arr = flight.arrival || {};
  const scheduled = arr.scheduled || flight.scheduledArrival;
  const points = [
    arr.actual,
    arr.actualRunway,
    arr.estimated,
    arr.estimatedRunway,
    flight.actualArrival
  ];
  if (scheduled) {
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (!point) continue;
      const a = parseFlightInstant(point);
      const s = parseFlightInstant(scheduled);
      if (!Number.isNaN(a) && !Number.isNaN(s)) {
        return Math.round((a - s) / 60000);
      }
    }
  }
  return null;
}

export function formatDelayMinutes(minutes) {
  if (minutes == null || minutes === "") return null;
  const n = Number(minutes);
  if (Number.isNaN(n)) return null;
  if (n <= 0) return "Yok";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h <= 0) return m + " dakika";
  if (m === 0) return h + " saat";
  return h + " saat " + m + " dakika";
}

export function formatClock(value, timezone) {
  if (!value) return null;
  const raw = String(value).trim();
  // Aviation Edge: "2026-08-27t18:05:00.000" — airport local, no timezone.
  // Do not match ":05:00" after the hour; that produced 05:00 / 30:00 on the site.
  const isoLocal = raw.match(/(\d{4}-\d{2}-\d{2})[tT](\d{1,2}):(\d{2})(?::\d{2})?/);
  if (isoLocal) {
    return pad2(isoLocal[2]) + ":" + isoLocal[3];
  }
  const hmOnly = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hmOnly) {
    const hour = Number(hmOnly[1]);
    if (hour >= 0 && hour <= 23) return pad2(hmOnly[1]) + ":" + hmOnly[2];
  }
  const normalized = raw.replace(/^(\d{4}-\d{2}-\d{2})t/i, "$1T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  const opts = { hour: "2-digit", minute: "2-digit", hour12: false };
  if (timezone) opts.timeZone = timezone;
  try {
    return new Intl.DateTimeFormat("tr-TR", opts).format(d);
  } catch (err) {
    return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  }
}

export function formatAirportLine(leg) {
  if (!leg) return null;
  const name = leg.airportName || "";
  const iata = leg.iata || "";
  if (name && iata) return name + " (" + iata + ")";
  if (name) return name;
  if (iata) return iata;
  if (leg.icao) return leg.icao;
  return null;
}

function shiftIsoLocalTime(value, delayMinutes) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[tT](\d{1,2}):(\d{2})/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(date.getMinutes() + Number(delayMinutes || 0));
  return (
    match[1] +
    "-" +
    match[2] +
    "-" +
    match[3] +
    "T" +
    pad2(date.getHours()) +
    ":" +
    pad2(date.getMinutes()) +
    ":00"
  );
}

export function resolveArrivalDisplayTime(flight) {
  const f = flight || {};
  const arr = f.arrival || {};
  const tz = arr.timezone;
  const actual = f.actualArrival || arr.actual;
  if (actual) return formatClock(actual, tz);
  const estimated = arr.estimated;
  if (estimated) return formatClock(estimated, tz);
  const delay =
    f.arrivalDelayMinutes != null && f.arrivalDelayMinutes !== ""
      ? Number(f.arrivalDelayMinutes)
      : f.delayMinutes != null && f.delayMinutes !== ""
        ? Number(f.delayMinutes)
        : null;
  const scheduled = f.scheduledArrival || arr.scheduled;
  if (scheduled && delay != null && delay > 0) {
    const shifted = shiftIsoLocalTime(scheduled, delay);
    if (shifted) return formatClock(shifted, tz);
  }
  if (scheduled && delay === 0) {
    return formatClock(scheduled, tz);
  }
  return null;
}

export function resolveRouteDistanceKm(flight, input, catalogDistanceFn) {
  const f = flight || {};
  const ctx = input || {};
  if (f.distanceKm != null && f.distanceKm !== "" && !Number.isNaN(Number(f.distanceKm))) {
    return Number(f.distanceKm);
  }
  if (ctx.distanceKm != null && ctx.distanceKm !== "" && !Number.isNaN(Number(ctx.distanceKm))) {
    return Number(ctx.distanceKm);
  }
  const dep = ctx.departureIata || (f.departure && f.departure.iata);
  const arr = ctx.arrivalIata || (f.arrival && f.arrival.iata);
  if (typeof catalogDistanceFn === "function") {
    const fromCatalog = catalogDistanceFn(dep, arr);
    if (fromCatalog != null && !Number.isNaN(Number(fromCatalog))) {
      return Number(fromCatalog);
    }
  }
  return null;
}

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
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

export function routeDistanceFromAirports(airports, depIata, arrIata) {
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

function airportCatalogRow(airports, iata) {
  const code = String(iata || "").toUpperCase();
  if (!code || !Array.isArray(airports)) return null;
  let row = null;
  airports.forEach(function (entry) {
    if (entry && entry.iata === code) row = entry;
  });
  return row;
}

/** Both endpoints in Turkey → iç hat (SHY-YOLCU m.8). */
export function resolveRouteDomestic(airports, depIata, arrIata) {
  const depRow = airportCatalogRow(airports, depIata);
  const arrRow = airportCatalogRow(airports, arrIata);
  if (!depRow || !arrRow) return null;
  const depCode = String(depRow.countryCode || "").toUpperCase();
  const arrCode = String(arrRow.countryCode || "").toUpperCase();
  if (depCode === "TR" && arrCode === "TR") return true;
  if (depCode && arrCode && depCode !== arrCode) return false;
  const tr = /türk|turk/i;
  if (tr.test(String(depRow.country || "")) && tr.test(String(arrRow.country || ""))) {
    return true;
  }
  return null;
}

export function withRouteDistance(flight, depIata, arrIata, routeDistanceKm, airports) {
  const base = Object.assign({}, flight || {});
  if (base.distanceKm != null && base.distanceKm !== "") {
    return base;
  }
  let km = routeDistanceKm != null && routeDistanceKm !== "" ? Number(routeDistanceKm) : null;
  if (km == null || Number.isNaN(km)) {
    km = routeDistanceFromAirports(airports, depIata, arrIata);
  }
  if (km != null && !Number.isNaN(km)) {
    base.distanceKm = km;
  }
  return base;
}

export function normalizeFlightData(apiFlight, query) {
  const f = apiFlight || {};
  const delay =
    f.arrivalDelayMinutes != null && f.arrivalDelayMinutes !== ""
      ? Number(f.arrivalDelayMinutes)
      : calculateArrivalDelay(f);
  const depLine = formatAirportLine(f.departure);
  const arrLine = formatAirportLine(f.arrival);
  const scheduledArrival = f.arrival ? f.arrival.scheduled : null;
  let actualArrival = f.arrival ? f.arrival.actual : null;
  if (!actualArrival && scheduledArrival && delay != null && delay > 0) {
    actualArrival = shiftIsoLocalTime(scheduledArrival, delay);
  }
  return {
    id: f.id || null,
    flightNumber: f.flightNumber || (query && query.flightNumber) || null,
    airline: f.airlineName || null,
    airlineName: f.airlineName || null,
    flightStatus: f.flightStatus || null,
    departureAirport: depLine,
    arrivalAirport: arrLine,
    scheduledDeparture: f.departure ? f.departure.scheduled : null,
    scheduledArrival: scheduledArrival,
    actualDeparture: f.departure ? f.departure.actual : null,
    actualArrival: actualArrival,
    delayMinutes: delay,
    arrivalDelayMinutes: delay,
    arrivalDelayInferred: f.arrivalDelayInferred === true,
    departureDelayMinutes:
      f.departureDelayMinutes != null && f.departureDelayMinutes !== ""
        ? Number(f.departureDelayMinutes)
        : null,
    cancelled: f.cancelled === true,
    diverted: f.diverted === true,
    providerVerifiedCancellation:
      f.providerVerifiedCancellation === true ? true : f.providerVerifiedCancellation === false ? false : null,
    manualReviewRequired: f.manualReviewRequired === true,
    dataProvider: f.dataProvider || null,
    distanceKm: f.distanceKm != null && f.distanceKm !== "" ? Number(f.distanceKm) : null,
    source: "live",
    departure: f.departure || null,
    arrival: f.arrival || null
  };
}

export async function searchFlight(input) {
  const flightNumber = normalizeFlightNumber(input.flightNumber || input.flight_number);
  const date = input.date || input.flightDate;
  const departureIata = normalizeIataCode(input.departureIata || input.departure_iata);
  const arrivalIata = normalizeIataCode(input.arrivalIata || input.arrival_iata);
  const dateCheck = validateFlightDate(date);
  if (!dateCheck.ok) {
    const err = new Error(dateCheck.message);
    err.code = dateCheck.code;
    throw err;
  }
  if (!isValidFlightNumber(flightNumber)) {
    const err = new Error("Geçerli bir uçuş numarası girin. Örn. TK1985");
    err.code = "invalid_flight_number";
    throw err;
  }
  if (!departureIata) {
    const err = new Error("Lütfen kalkış havalimanını seçin.");
    err.code = "invalid_departure";
    throw err;
  }
  if (!arrivalIata) {
    const err = new Error("Lütfen varış havalimanını seçin.");
    err.code = "invalid_arrival";
    throw err;
  }

  const res = await fetch(FLIGHT_SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      flight_number: flightNumber,
      date: date,
      departure_iata: departureIata,
      arrival_iata: arrivalIata
    })
  });

  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }

  const continueCodes = {
    FLIGHT_TOO_RECENT: true,
    HISTORICAL_LIMIT: true,
    FLIGHT_NOT_FOUND: true,
    PROVIDER_ERROR: true,
    not_found: true
  };
  if (json && json.ok !== true && json.code && continueCodes[json.code]) {
    const err = new Error(json.message || "Uçuş bilgileri otomatik olarak doğrulanamadı. Başvurunuza devam edebilirsiniz.");
    err.code = json.code;
    err.canContinue = json.canContinue !== false;
    err.manualReviewRequired = true;
    err.providerVerifiedCancellation =
      json.providerVerifiedCancellation === true
        ? true
        : json.providerVerifiedCancellation === false
          ? false
          : null;
    throw err;
  }

  if (!res.ok || !json || json.ok !== true) {
    const err = new Error(
      "Uçuş bilgileri şu anda otomatik olarak alınamadı. Başvurunuza devam edebilirsiniz."
    );
    err.code = (json && json.code) || "PROVIDER_ERROR";
    err.canContinue = true;
    err.manualReviewRequired = true;
    throw err;
  }

  const flights = (json.flights || []).map(function (row) {
    return withRouteDistance(
      normalizeFlightData(row, { flightNumber: json.flightNumber, date: json.date }),
      json.departureIata || departureIata,
      json.arrivalIata || arrivalIata,
      json.distanceKm,
      null
    );
  });
  return {
    flightNumber: json.flightNumber,
    date: json.date,
    departureIata: json.departureIata || departureIata,
    arrivalIata: json.arrivalIata || arrivalIata,
    distanceKm: json.distanceKm != null ? Number(json.distanceKm) : null,
    isDomestic: json.isDomestic == null ? null : json.isDomestic === true,
    flights: flights,
    manualReviewRequired: !!json.manualReviewRequired,
    providerVerifiedCancellation: json.providerVerifiedCancellation
  };
}
