/**
 * Legal decision engine — separate from flight-data providers.
 * Evaluates SHY-YOLCU / EC 261/2004 style rules once delay, distance and disruption
 * facts exist. Amounts are indicative only (not a final legal determination).
 */

export const DISRUPTION_REASONS = {
  not_stated: "Gerekçe bildirilmedi",
  technical: "Teknik arıza",
  weather: "Hava koşulları",
  operational: "Operasyonel nedenler",
  staff: "Personel kaynaklı sorun",
  security: "Güvenlik gerekçesi",
  other: "Diğer"
};

const EXTRAORDINARY_HINTS = new Set(["weather", "security"]);
const ARRIVAL_DELAY_THRESHOLD_MIN = 180;

function resolveDelayMinutes(flight) {
  const f = flight || {};
  if (f.cancelled === true) return null;
  if (f.delayMinutes != null && f.delayMinutes !== "") return Number(f.delayMinutes);
  if (f.arrivalDelayMinutes != null && f.arrivalDelayMinutes !== "") {
    return Number(f.arrivalDelayMinutes);
  }
  return null;
}

function delayBand(delayMinutes, cancelled) {
  if (cancelled) return "cancelled";
  if (delayMinutes == null || Number.isNaN(delayMinutes)) return "unknown";
  if (delayMinutes >= ARRIVAL_DELAY_THRESHOLD_MIN) return "delay_3h_plus";
  if (delayMinutes >= 120) return "delay_2h_plus";
  return "below_threshold";
}

/**
 * SHY-YOLCU Madde 8(1) — statutory compensation bands.
 * @param {number|null} distanceKm
 * @param {boolean|null} isDomestic
 */
export function statutoryAmountEur(distanceKm, isDomestic) {
  if (isDomestic === true) return 100;
  if (distanceKm == null || Number.isNaN(distanceKm)) return null;
  if (distanceKm <= 1500) return 250;
  if (distanceKm <= 3500) return 400;
  return 600;
}

function amountBasisLabel(distanceKm, isDomestic) {
  if (isDomestic === true) return "İç hat (SHY-YOLCU m.8)";
  if (distanceKm == null || Number.isNaN(distanceKm)) return "Dış hat (mesafe bekleniyor)";
  if (distanceKm <= 1500) return "Dış hat, 1.500 km ve altı (SHY-YOLCU m.8)";
  if (distanceKm <= 3500) return "Dış hat, 1.500–3.500 km (SHY-YOLCU m.8)";
  return "Dış hat, 3.500 km üzeri (SHY-YOLCU m.8)";
}

function buildAmountNote(params) {
  const {
    statutoryEur,
    amountBasis,
    amountConfidence,
    cancelled,
    incidentType,
    delayMinutes,
    extraordinaryHint,
    reasonUnknown
  } = params;

  if (statutoryEur == null) {
    return "Uçuş mesafesi netleşince yönetmelik tutarı hesaplanabilir.";
  }

  const perPassenger = "yolcu başına";

  if (amountConfidence === "excluded_possible") {
    return (
      amountBasis +
      " — " +
      perPassenger +
      " €" +
      statutoryEur +
      " gündeme gelebilir; bildirilen olağanüstü hal gerekçesi nedeniyle tazminat doğmayabilir."
    );
  }

  if (amountConfidence === "unlikely") {
    const delayText =
      delayMinutes != null && !Number.isNaN(delayMinutes)
        ? "mevcut varış gecikmesi (" + formatDelayShort(delayMinutes) + ") 3 saat eşiğinin altında"
        : "mevcut gecikme süresi 3 saat eşiğinin altında görünüyor";
    return (
      amountBasis +
      " — " +
      delayText +
      "; şartlar oluşursa " +
      perPassenger +
      " €" +
      statutoryEur +
      " gündeme gelebilir."
    );
  }

  let note =
    amountBasis +
    " — ön değerlendirmeye göre " +
    perPassenger +
    " €" +
    statutoryEur +
    " gündeme gelebilir.";

  if (cancelled || incidentType === "cancelled") {
    note += " İptal bildirim zamanı ve alternatif uçuş teklifi sonucu değiştirebilir.";
  } else if (incidentType === "denied_boarding") {
    note += " Uçağa kabul edilmeme hallerinde Madde 8 tutarları uygulanır.";
  } else if (delayMinutes != null && delayMinutes >= ARRIVAL_DELAY_THRESHOLD_MIN) {
    note += " Son varış gecikmesi 3 saat ve üzeri görünüyor.";
  }

  if (reasonUnknown) {
    note += " Gecikme/iptal nedeni ayrıca incelenmelidir.";
  }

  if (extraordinaryHint && amountConfidence !== "excluded_possible") {
    note += " Olağanüstü hal savunması ayrıca değerlendirilmelidir.";
  }

  return note;
}

function formatDelayShort(minutes) {
  const n = Number(minutes);
  if (Number.isNaN(n)) return "—";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h <= 0) return m + " dk";
  if (m === 0) return h + " sa";
  return h + " sa " + m + " dk";
}

function resolveAmountConfidence(params) {
  const {
    extraordinaryHint,
    cancelled,
    incidentType,
    delayMinutes,
    band,
    delayEligible
  } = params;

  if (
    extraordinaryHint &&
    (cancelled || incidentType === "denied_boarding" || (delayMinutes != null && delayMinutes >= ARRIVAL_DELAY_THRESHOLD_MIN))
  ) {
    return "excluded_possible";
  }

  if (incidentType === "denied_boarding") {
    return "likely";
  }

  if (cancelled) {
    return "possible";
  }

  if (delayEligible || band === "delay_3h_plus") {
    return "likely";
  }

  if (band === "below_threshold") {
    return "unlikely";
  }

  return "indicative";
}

/**
 * @param {object} params
 * @param {object} params.flight
 * @param {object|null} params.weather
 * @param {string} params.airlineReason
 * @param {string|null} params.incidentType
 * @param {boolean|null} params.isDomestic
 */
export function evaluateCompensation(params) {
  const flight = params.flight || {};
  const incidentType = params.incidentType || flight.userReportedIssue || null;
  const airlineReason = params.airlineReason || "not_stated";
  const isDomestic = params.isDomestic == null ? null : params.isDomestic === true;
  const delayMinutes = resolveDelayMinutes(flight);
  const cancelled = flight.cancelled === true || incidentType === "cancelled";
  const distanceKm = flight.distanceKm == null ? null : Number(flight.distanceKm);
  const band = delayBand(delayMinutes, cancelled);
  const reasonUnknown = !airlineReason || airlineReason === "not_stated";
  const extraordinaryHint = EXTRAORDINARY_HINTS.has(airlineReason);
  const statutoryEur = statutoryAmountEur(distanceKm, isDomestic);
  const amountBasis = amountBasisLabel(distanceKm, isDomestic);

  const delayEligible =
    !cancelled &&
    incidentType !== "denied_boarding" &&
    delayMinutes != null &&
    !Number.isNaN(delayMinutes) &&
    delayMinutes >= ARRIVAL_DELAY_THRESHOLD_MIN &&
    !(extraordinaryHint && airlineReason === "weather");

  const hasCompensationFacts =
    cancelled ||
    incidentType === "denied_boarding" ||
    band === "delay_3h_plus" ||
    (incidentType === "missed_connection" && delayEligible);

  let eligibility = "unknown";
  let headline = "Bu aşamada otomatik bir tazminat sonucu üretilemiyor.";
  const reasonNote = " Uçuşun gecikme/iptal sebebinin ayrıca incelenmesi gerekmektedir.";

  if (incidentType === "denied_boarding") {
    eligibility = extraordinaryHint ? "possible_exclusion" : "possible";
    headline = "Uçağa kabul edilmeme hallerinde tazminat hakkı gündeme gelebilir.";
    if (reasonUnknown) headline += reasonNote;
  } else if (hasCompensationFacts && extraordinaryHint) {
    eligibility = "possible_exclusion";
    headline = "Ön değerlendirmeye göre tazminat hakkınız bulunabilir." + reasonNote;
  } else if (delayEligible || (incidentType === "missed_connection" && band === "delay_3h_plus")) {
    eligibility = "possible";
    headline = "Ön değerlendirmeye göre tazminat hakkınız bulunabilir.";
    if (reasonUnknown) headline += reasonNote;
  } else if (band === "cancelled" || cancelled) {
    eligibility = "possible";
    headline = "Uçuş iptali halinde, bildirim ve alternatif uçuş koşullarına bağlı olarak tazminat hakkı gündeme gelebilir.";
    if (reasonUnknown) headline += reasonNote;
  } else if (band === "below_threshold") {
    eligibility = "unlikely";
    headline = "Mevcut gecikme süresi, otomatik eşiklerin altında görünüyor.";
  } else if (incidentType === "delayed") {
    eligibility = "unlikely";
    headline = "Mevcut varış gecikmesi, parasal tazminat eşiğinin (3 saat) altında görünüyor.";
  }

  const amountConfidence = resolveAmountConfidence({
    extraordinaryHint,
    cancelled,
    incidentType,
    delayMinutes,
    band,
    delayEligible
  });

  const estimatedAmountNote = buildAmountNote({
    statutoryEur,
    amountBasis,
    amountConfidence,
    cancelled,
    incidentType,
    delayMinutes,
    extraordinaryHint,
    reasonUnknown
  });

  return {
    eligibility,
    headline,
    estimatedAmountEur: statutoryEur,
    estimatedAmountNote,
    amountBasis,
    amountConfidence,
    isDomestic,
    statutoryAmountEur: statutoryEur,
    delayBand: band,
    potentialDelayEligibility: delayEligible,
    distanceKm: distanceKm == null ? null : distanceKm,
    airlineReason,
    airlineReasonLabel: DISRUPTION_REASONS[airlineReason] || DISRUPTION_REASONS.other,
    extraordinaryHint,
    incidentType,
    ruleset: ["SHY-YOLCU", "EC 261/2004"],
    disclaimer:
      "Bu sonuç otomatik bir ön değerlendirmedir. Gösterilen tutar yönetmelikteki tablo tutarıdır; kesin hukuki değerlendirme uçuş kayıtları, iptal bildirimi, alternatif uçuş teklifi ve gecikme/iptal nedeni incelendikten sonra yapılacaktır."
  };
}
