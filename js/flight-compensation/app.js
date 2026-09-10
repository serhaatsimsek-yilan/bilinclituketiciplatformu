import { lookupFlight, assessConfirmedFlight, buildLookupState } from "./client.js";
import {
  bindAirportSelector,
  routeDistanceKmFromCatalog,
  getStoredAirportCatalog,
  loadAirportCatalog
} from "./airport-selector.js";
import {
  createEmptyApplicationState,
  submitApplication
} from "./application-service.js";
import {
  normalizeFlightNumber,
  isValidFlightNumber,
  validateFlightDate,
  flightDateBounds,
  formatClock,
  formatDelayMinutes,
  formatAirportLine,
  resolveRouteDomestic,
  withRouteDistance,
  resolveArrivalDisplayTime,
  resolveRouteDistanceKm
} from "./flight-service.js";

function formatResultArrivalTime(flight) {
  const time = resolveArrivalDisplayTime(flight);
  if (!time) return "Kayıtta yok";
  if (flight && flight.arrivalDelayInferred) return time + " (tahmini)";
  return time;
}

function formatResultDelay(flight) {
  const minutes =
    flight && flight.delayMinutes != null ? flight.delayMinutes : flight && flight.arrivalDelayMinutes;
  const text = formatDelayMinutes(minutes);
  if (!text) return "Kayıtta yok";
  if (flight && flight.arrivalDelayInferred && text !== "Yok") return text + " (tahmini)";
  return text;
}

function $(id) {
  return document.getElementById(id);
}

let wizardScrollRoot = null;

function scrollToStep(el) {
  if (!el) return;
  if (wizardScrollRoot) {
    wizardScrollRoot.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(function () {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function scrollToWizardStart() {
  if (wizardScrollRoot) {
    wizardScrollRoot.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function formatDelay(minutes) {
  if (minutes == null) return "Henüz doğrulanmadı";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return m + " dakika";
  if (m === 0) return h + " saat";
  return h + " saat " + m + " dakika";
}

function formatTrDate(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatAirport(value) {
  return value && String(value).trim() ? value : null;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatTrPhone(value) {
  let d = digitsOnly(value);
  if (d.indexOf("90") === 0 && d.length > 10) d = d.slice(2);
  if (d.charAt(0) === "0") d = d.slice(1);
  d = d.slice(0, 10);
  if (!d) return "";
  let out = "0" + d.slice(0, 3);
  if (d.length > 3) out += " " + d.slice(3, 6);
  if (d.length > 6) out += " " + d.slice(6, 8);
  if (d.length > 8) out += " " + d.slice(8, 10);
  return out;
}

function isValidTrPhone(value) {
  const d = digitsOnly(formatTrPhone(value));
  return /^05\d{9}$/.test(d);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidPnr(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  return /^[A-Z0-9]{5,8}$/.test(v.toUpperCase());
}

function ensureFlightDistance(flight, depIata, arrIata, routeDistanceKm) {
  return withRouteDistance(flight, depIata, arrIata, routeDistanceKm, null);
}

function formatDistanceKm(km) {
  if (km == null || km === "" || Number.isNaN(Number(km))) return "Harici kayıt bekleniyor";
  return Number(km).toLocaleString("tr-TR") + " km";
}

function setFieldError(groupId, errorId, show) {
  const group = $(groupId);
  const err = $(errorId);
  if (group) group.classList.toggle("has-error", !!show);
  if (err) err.classList.toggle("is-visible", !!show);
}

function hideAllSteps() {
  $("checkFormCard").hidden = true;
  $("searchMissCard").hidden = true;
  $("flightPickCard").hidden = true;
  $("foundFlightCard").hidden = true;
  $("incidentCard").hidden = true;
  $("resultCard").hidden = true;
  $("claimSection").hidden = true;
  $("applicationSuccessCard").hidden = true;
}

function addFoundStat(container, label, value) {
  if (!value) return;
  const el = document.createElement("div");
  el.className = "stat";
  const span = document.createElement("span");
  span.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  el.appendChild(span);
  el.appendChild(strong);
  container.appendChild(el);
}

function renderFoundFlight(state) {
  const f = state.flight;
  const dep = formatAirport(f.departureAirport) || formatAirportLine(f.departure);
  const arr = formatAirport(f.arrivalAirport) || formatAirportLine(f.arrival);
  $("foundFlightNumber").textContent = f.flightNumber || state.input.flightNumber || "—";
  $("foundAirline").textContent = f.airlineName || f.airline || "—";
  $("foundRoute").textContent = dep && arr ? dep + "\n→\n" + arr : "—";
  $("foundDate").textContent = formatTrDate(state.input.flightDate);
  const statusEl = $("foundStatus");
  if (f.cancelled) {
    statusEl.hidden = false;
    statusEl.textContent = "İptal edildi";
    statusEl.classList.add("is-cancelled");
  } else if (f.flightStatus) {
    statusEl.hidden = false;
    statusEl.textContent = f.flightStatus;
    statusEl.classList.toggle("is-cancelled", f.flightStatus === "İptal edildi");
  } else {
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("is-cancelled");
  }
  const times = $("foundTimes");
  times.innerHTML = "";
  const depTz = f.departure && f.departure.timezone;
  const arrTz = f.arrival && f.arrival.timezone;
  addFoundStat(times, "Planlanan kalkış", formatClock(f.scheduledDeparture || (f.departure && f.departure.scheduled), depTz));
  addFoundStat(times, "Planlanan varış", formatClock(f.scheduledArrival || (f.arrival && f.arrival.scheduled), arrTz));
  addFoundStat(times, "Gerçek kalkış", formatClock(f.actualDeparture || (f.departure && f.departure.actual), depTz));
  addFoundStat(times, "Gerçek varış", formatResultArrivalTime(f));
  const delayText = formatResultDelay(f);
  if (delayText && delayText !== "Yok" && delayText !== "Kayıtta yok") {
    addFoundStat(times, "Varış gecikmesi", delayText);
  }
  if (f.diverted) {
    $("foundSourceNote").textContent = "Uçuş farklı bir havalimanına yönlendirilmiş görünüyor.";
  } else {
    $("foundSourceNote").textContent = "";
  }
}

function renderResult(state) {
  const f = state.flight;
  const a = state.assessment;
  const input = state.input;
  const dep = formatAirport(f.departureAirport);
  const arr = formatAirport(f.arrivalAirport);

  $("resultFlightCode").textContent = input.flightNumber || "—";
  $("resultRoute").textContent = dep && arr ? dep + " → " + arr : "Güzergâh bekleniyor";
  $("resultAirline").textContent = f.airline || "—";
  $("resultDate").textContent = formatTrDate(input.flightDate);
  $("resultSchedArr").textContent =
    formatClock(f.scheduledArrival || (f.arrival && f.arrival.scheduled), f.arrival && f.arrival.timezone) || "—";
  $("resultActualArr").textContent = formatResultArrivalTime(f);
  $("resultDelay").textContent = formatResultDelay(f);
  $("resultDistance").textContent = formatDistanceKm(
    resolveRouteDistanceKm(f, input, routeDistanceKmFromCatalog)
  );
  $("resultWeather").textContent =
    state.weather && state.weather.summary
      ? state.weather.summary
      : "Olağanüstü koşul göstergesi henüz bağlanmadı";
  $("resultReason").textContent = a.airlineReasonLabel;
  $("resultHeadline").textContent = a.headline;
  const amountBox = $("resultAmountBox");
  const amountValue = $("resultAmountValue");
  const amountNote = $("resultAmountNote");
  if (amountBox && amountValue) {
    if (a.estimatedAmountEur != null) {
      amountBox.hidden = false;
      amountValue.textContent = "€" + a.estimatedAmountEur;
      if (amountNote) {
        if (a.estimatedAmountNote) {
          amountNote.hidden = false;
          amountNote.textContent = a.estimatedAmountNote;
        } else {
          amountNote.hidden = true;
          amountNote.textContent = "";
        }
      }
    } else {
      amountBox.hidden = true;
      amountValue.textContent = "";
      if (amountNote) {
        amountNote.hidden = true;
        amountNote.textContent = "";
      }
    }
  }
  $("resultDisclaimer").textContent = a.disclaimer;
  $("resultSourceNote").textContent =
    state.dataSource === "user-only"
      ? "Bu özet henüz harici uçuş kaydıyla doğrulanmamıştır."
      : f.arrivalDelayInferred
        ? "Varış saati kayıtta eksik; kalkış gecikmesine göre tahmini gösterilmektedir."
        : f.arrivalDelayMinutes == null && !resolveArrivalDisplayTime(f)
          ? "Uçuş bulundu ancak varış saati/gecikme kaydı henüz tam değil."
          : "Uçuş özeti harici kayıttan alınmıştır.";
}

function wireUi() {
  const checkForm = $("flightCheckForm");
  const incidentForm = $("incidentForm");
  const claimForm = $("claimForm");
  if (!checkForm || !incidentForm || !claimForm) return;
  let lookupState = null;
  let lastState = null;
  let pendingUnverified = null;
  let applicationState = createEmptyApplicationState();
  const originSelector = bindAirportSelector({
    inputId: "originAirport",
    listId: "originAirportList",
    hiddenId: "originIata",
    groupId: "group-origin"
  });
  const destinationSelector = bindAirportSelector({
    inputId: "destinationAirport",
    listId: "destinationAirportList",
    hiddenId: "destinationIata",
    groupId: "group-destination"
  });

  function applyQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const number = params.get("flightNumber");
    const date = params.get("flightDate");
    const originIata = params.get("originIata") || params.get("origin");
    const destIata = params.get("destinationIata") || params.get("destination");
    if (number && $("flightNumber")) {
      $("flightNumber").value = normalizeFlightNumber(number);
    }
    if (date && $("flightDate")) {
      $("flightDate").value = date;
    }
    if (originIata || destIata) {
      loadAirportCatalog().then(function () {
        if (originIata) originSelector.setByIata(originIata);
        if (destIata) destinationSelector.setByIata(destIata);
      });
    }
  }

  function applyDateLimits() {
    const bounds = flightDateBounds();
    const dateInput = $("flightDate");
    dateInput.min = "";
    dateInput.max = bounds.max;
  }
  applyDateLimits();
  applyQueryParams();

  function showSearchForm() {
    hideAllSteps();
    applyDateLimits();
    $("checkFormCard").hidden = false;
    $("searchFormError").classList.remove("is-visible");
    $("searchFormError").textContent = "";
  }

  function confirmSelectedFlight(flight, query) {
    const depIata = query.departureIata || (flight.departure && flight.departure.iata);
    const arrIata = query.arrivalIata || (flight.arrival && flight.arrival.iata);
    const enriched = ensureFlightDistance(flight, depIata, arrIata, query.distanceKm);
    lookupState = buildLookupState(enriched, Object.assign({}, query, { distanceKm: enriched.distanceKm }));
    hideAllSteps();
    renderFoundFlight(lookupState);
    $("foundFlightCard").hidden = false;
    scrollToStep($("foundFlightCard"));
  }

  function renderFlightChoices(result) {
    const list = $("flightPickList");
    list.innerHTML = "";
    result.flights.forEach(function (flight) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flight-pick";
      const dep = formatAirportLine(flight.departure) || flight.departureAirport || "—";
      const arr = formatAirportLine(flight.arrival) || flight.arrivalAirport || "—";
      const depIata = flight.departure && flight.departure.iata;
      const arrIata = flight.arrival && flight.arrival.iata;
      const route =
        depIata && arrIata
          ? depIata + " → " + arrIata
          : dep + " → " + arr;
      const time = formatClock(
        flight.scheduledDeparture || (flight.departure && flight.departure.scheduled),
        flight.departure && flight.departure.timezone
      );
      const title = document.createElement("strong");
      title.textContent = flight.flightNumber || result.flightNumber;
      const line = document.createElement("span");
      line.textContent = route + (time ? "  " + time : "");
      btn.appendChild(title);
      btn.appendChild(line);
      btn.addEventListener("click", function () {
        confirmSelectedFlight(flight, {
          flightDate: result.flightDate || result.date,
          flightNumber: result.flightNumber,
          departureIata: (flight.departure && flight.departure.iata) || result.departureIata || null,
          arrivalIata: (flight.arrival && flight.arrival.iata) || result.arrivalIata || null,
          distanceKm: result.distanceKm,
          isDomestic:
            flight.isDomestic != null
              ? flight.isDomestic === true
              : result.isDomestic == null
                ? null
                : result.isDomestic === true
        });
      });
      list.appendChild(btn);
    });
    hideAllSteps();
    $("flightPickCard").hidden = false;
    scrollToStep($("flightPickCard"));
  }

  function resetApplicationUi() {
    applicationState = createEmptyApplicationState();
    claimForm.reset();
    setFieldError("group-fullName", "error-fullName", false);
    setFieldError("group-phone", "error-phone", false);
    setFieldError("group-email", "error-email", false);
    setFieldError("group-pnr", "error-pnr", false);
    $("group-kvkk").classList.remove("has-error");
    $("error-kvkk").classList.remove("is-visible");
    $("claimSubmit").disabled = false;
    $("claimSubmit").classList.remove("is-loading");
    $("claimSubmitLabel").textContent = "Başvurumu Tamamla";
    $("claimSubmitError").classList.remove("is-visible");
    $("claimSubmitError").textContent = "";
  }

  function resetWizard() {
    lookupState = null;
    lastState = null;
    pendingUnverified = null;
    resetApplicationUi();
    hideAllSteps();
    incidentForm.reset();
    checkForm.reset();
    applyDateLimits();
    $("searchFormError").classList.remove("is-visible");
    $("searchFormError").textContent = "";
    setFieldError("group-flightDate", "error-flightDate", false);
    setFieldError("group-flightNumber", "error-flightNumber", false);
    setFieldError("group-origin", "error-origin", false);
    setFieldError("group-destination", "error-destination", false);
    originSelector.clear();
    destinationSelector.clear();
    $("checkFormCard").hidden = false;
    scrollToWizardStart();
  }

  $("claimPhone").addEventListener("input", function (e) {
    e.target.value = formatTrPhone(e.target.value);
  });

  $("flightNumber").addEventListener("input", function (e) {
    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const upper = el.value.toUpperCase();
    if (el.value !== upper) {
      el.value = upper;
      if (start != null && end != null) {
        el.setSelectionRange(start, end);
      }
    }
  });

  $("flightNumber").addEventListener("blur", function (e) {
    e.target.value = normalizeFlightNumber(e.target.value);
  });

  $("searchRetryBtn").addEventListener("click", showSearchForm);
  $("searchContinueBtn").addEventListener("click", function () {
    if (!pendingUnverified) return;
    const depIata = pendingUnverified.departureIata || null;
    const arrIata = pendingUnverified.arrivalIata || null;
    const routeKm = routeDistanceKmFromCatalog(depIata, arrIata);
    const routeDomestic = resolveRouteDomestic(getStoredAirportCatalog(), depIata, arrIata);
    lookupState = buildLookupState(
      ensureFlightDistance(
        {
          flightNumber: pendingUnverified.flightNumber,
          airlineName: null,
          cancelled: false,
          diverted: false,
          delayMinutes: null,
          arrivalDelayMinutes: null,
          manualReviewRequired: true,
          providerVerifiedCancellation: pendingUnverified.providerVerifiedCancellation,
          source: "user-only",
          departure: { iata: depIata, airportName: null },
          arrival: { iata: arrIata, airportName: null }
        },
        depIata,
        arrIata,
        routeKm
      ),
      {
        flightDate: pendingUnverified.flightDate,
        flightNumber: pendingUnverified.flightNumber,
        departureIata: depIata,
        arrivalIata: arrIata,
        manualReviewRequired: true,
        distanceKm: routeKm,
        isDomestic: routeDomestic == null ? null : routeDomestic === true
      }
    );
    hideAllSteps();
    $("incidentCard").hidden = false;
    scrollToStep($("incidentCard"));
  });
  $("pickSearchAgainBtn").addEventListener("click", resetWizard);

  checkForm.addEventListener("submit", function (e) {
    e.preventDefault();
    applyDateLimits();
    const dateVal = checkForm.flightDate.value;
    const numberVal = normalizeFlightNumber(checkForm.flightNumber.value);
    checkForm.flightNumber.value = numberVal;

    const originIata = originSelector.getIata();
    const destIata = destinationSelector.getIata();

    const dateCheck = validateFlightDate(dateVal);
    const numberOk = isValidFlightNumber(numberVal);
    const originOk = !!originIata;
    const destOk = !!destIata;
    const dateErr = $("error-flightDate");
    if (!dateCheck.ok) dateErr.textContent = dateCheck.message;
    setFieldError("group-flightDate", "error-flightDate", !dateCheck.ok);
    setFieldError("group-flightNumber", "error-flightNumber", !numberOk);
    setFieldError("group-origin", "error-origin", !originOk);
    setFieldError("group-destination", "error-destination", !destOk);
    $("searchFormError").classList.remove("is-visible");
    $("searchFormError").textContent = "";
    if (!dateCheck.ok || !numberOk || !originOk || !destOk) return;

    const btn = $("checkSubmit");
    btn.disabled = true;
    btn.textContent = "Uçuşunuz aranıyor...";
    lookupFlight({
      flightDate: dateVal,
      flightNumber: numberVal,
      departureIata: originIata,
      arrivalIata: destIata
    })
      .then(function (result) {
        pendingUnverified = null;
        if (!result.flights || result.flights.length === 0) {
          pendingUnverified = {
            flightDate: dateVal,
            flightNumber: numberVal,
            departureIata: originIata,
            arrivalIata: destIata,
            providerVerifiedCancellation: null
          };
          hideAllSteps();
          $("searchMissMessage").textContent =
            "Uçuş bilgileri otomatik olarak doğrulanamadı. Uçuşunuz iptal edilmiş veya veri sağlayıcımızın geçmiş kayıtlarında bulunmuyor olabilir. Başvurunuza devam edebilirsiniz.";
          $("searchMissCard").hidden = false;
          scrollToStep($("searchMissCard"));
          return;
        }
        if (result.flights.length > 1) {
          renderFlightChoices(result);
          return;
        }
        confirmSelectedFlight(result.flights[0], {
          flightDate: result.date || dateVal,
          flightNumber: result.flightNumber,
          departureIata: result.departureIata || originIata,
          arrivalIata: result.arrivalIata || destIata,
          distanceKm: result.distanceKm,
          isDomestic: result.isDomestic == null ? null : result.isDomestic === true
        });
      })
      .catch(function (err) {
        const continueCodes = {
          FLIGHT_TOO_RECENT: true,
          HISTORICAL_LIMIT: true,
          FLIGHT_NOT_FOUND: true,
          PROVIDER_ERROR: true,
          not_found: true
        };
        if (err && err.canContinue !== false && err.code && continueCodes[err.code]) {
          pendingUnverified = {
            flightDate: dateVal,
            flightNumber: numberVal,
            departureIata: originIata,
            arrivalIata: destIata,
            providerVerifiedCancellation: err.providerVerifiedCancellation
          };
          hideAllSteps();
          $("searchMissMessage").textContent = err.message;
          $("searchMissCard").hidden = false;
          scrollToStep($("searchMissCard"));
          return;
        }
        const box = $("searchFormError");
        box.textContent =
          "Uçuş bilgileri şu anda otomatik olarak alınamadı. Başvurunuza devam edebilirsiniz.";
        box.classList.add("is-visible");
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Uçuşumu Bul";
      });
  });

  $("confirmFlightBtn").addEventListener("click", function () {
    hideAllSteps();
    $("incidentCard").hidden = false;
    scrollToStep($("incidentCard"));
  });

  $("searchAgainBtn").addEventListener("click", resetWizard);

  incidentForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!lookupState) return;
    const incidentType = incidentForm.incidentType.value;
    const airlineReason = incidentForm.airlineReason.value;
    lastState = assessConfirmedFlight(lookupState, { incidentType, airlineReason });
    hideAllSteps();
    renderResult(lastState);
    $("resultCard").hidden = false;
    scrollToStep($("resultCard"));
  });

  $("openClaimBtn").addEventListener("click", function () {
    hideAllSteps();
    $("claimSection").hidden = false;
    scrollToStep($("claimSection"));
  });

  $("resetCheckBtn").addEventListener("click", resetWizard);
  $("newFlightCheckBtn").addEventListener("click", resetWizard);

  claimForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!lastState) return;

    applicationState.fullName = $("claimName").value.trim();
    applicationState.phone = formatTrPhone($("claimPhone").value);
    applicationState.email = $("claimEmail").value.trim();
    applicationState.pnr = $("claimPnr").value.trim().toUpperCase();
    if (applicationState.pnr) $("claimPnr").value = applicationState.pnr;
    applicationState.notes = $("claimNotes").value.trim();
    applicationState.kvkkConsent = $("claimKvkk").checked;

    const nameOk = applicationState.fullName.length >= 3;
    const phoneOk = isValidTrPhone(applicationState.phone);
    const emailOk = isValidEmail(applicationState.email);
    const pnrOk = isValidPnr(applicationState.pnr);
    const kvkkOk = applicationState.kvkkConsent === true;

    setFieldError("group-fullName", "error-fullName", !nameOk);
    setFieldError("group-phone", "error-phone", !phoneOk);
    setFieldError("group-email", "error-email", !emailOk);
    setFieldError("group-pnr", "error-pnr", !pnrOk);
    $("group-kvkk").classList.toggle("has-error", !kvkkOk);
    $("error-kvkk").classList.toggle("is-visible", !kvkkOk);
    if (!nameOk || !phoneOk || !emailOk || !pnrOk || !kvkkOk) return;

    const btn = $("claimSubmit");
    const errBox = $("claimSubmitError");
    errBox.classList.remove("is-visible");
    errBox.textContent = "";
    btn.disabled = true;
    btn.classList.add("is-loading");
    $("claimSubmitLabel").textContent = "Başvuru gönderiliyor...";

    submitApplication({
      fullName: applicationState.fullName,
      phone: applicationState.phone,
      email: applicationState.email,
      pnr: applicationState.pnr,
      notes: applicationState.notes,
      website: $("claimWebsite").value,
      kvkkConsent: applicationState.kvkkConsent,
      flight: lastState.input,
      assessment: lastState.assessment,
      delayMinutes: lastState.flight ? lastState.flight.delayMinutes : null,
      distanceKm: lastState.flight ? lastState.flight.distanceKm : null
    }).then(function (res) {
      applicationState.applicationNumber = res.applicationNumber;
      $("applicationNumberLabel").textContent = "Başvuru No: " + res.applicationNumber;
      const successNote = $("applicationSuccessNote");
      if (successNote) {
        successNote.textContent =
          "Ön değerlendirmeniz alındı. Bilet, boarding pass ve havayolu yazışmalarınızı infobilinclituketiciplatformu@gmail.com adresine e-posta ile gönderin. Başvuru numaranızı konu satırına yazmanız yeterlidir.";
      }
      hideAllSteps();
      $("applicationSuccessCard").hidden = false;
      scrollToStep($("applicationSuccessCard"));
    }).catch(function (err) {
      errBox.textContent =
        err && err.message
          ? err.message
          : "Başvuru gönderilemedi. Lütfen tekrar deneyin.";
      errBox.classList.add("is-visible");
    }).finally(function () {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      $("claimSubmitLabel").textContent = "Başvurumu Tamamla";
    });
  });
}

export function initFlightWizard(options) {
  wizardScrollRoot = options && options.scrollRoot ? options.scrollRoot : null;
  wireUi();
}

if (document.getElementById("flightCheckForm") && !document.getElementById("articleFlightWizardMount")) {
  initFlightWizard();
}
