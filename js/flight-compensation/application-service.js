/**
 * Application submit — same path as Bize Yazın: browser → Formspree (xdardvrj).
 */

import { FORMSPREE_ENDPOINT, CONTACT_EMAIL, SITE_ORIGIN } from "./config.js";

const INCIDENT_LABELS = {
  delayed: "Uçuş gecikti",
  cancelled: "Uçuş iptal edildi",
  denied_boarding: "Uçağa alınmadım",
  missed_connection: "Aktarmalı uçuşumu kaçırdım"
};

export function createEmptyApplicationState() {
  return {
    fullName: "",
    phone: "",
    email: "",
    pnr: "",
    notes: "",
    kvkkConsent: false,
    applicationNumber: null
  };
}

export function generateApplicationNumber(now) {
  const d = now || new Date();
  const year = d.getFullYear();
  const serial = String(Math.floor(10000 + Math.random() * 90000));
  return "BTP-" + year + "-" + serial;
}

function dash(value) {
  const v = value == null ? "" : String(value).trim();
  return v ? v : "—";
}

function formatDelayForMail(minutes) {
  if (minutes == null || minutes === "") return "Henüz doğrulanmadı";
  const n = Number(minutes);
  if (Number.isNaN(n)) return "Henüz doğrulanmadı";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h <= 0) return m + " dakika";
  if (m === 0) return h + " saat";
  return h + " saat " + m + " dakika";
}

function formatSubmittedAt(now) {
  const d = now || new Date();
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul"
    }).format(d);
  } catch (err) {
    return d.toISOString();
  }
}

function formspreeErrorMessage(json) {
  if (!json || typeof json !== "object") {
    return "Başvuru gönderilemedi. Lütfen tekrar deneyin.";
  }
  if (Array.isArray(json.errors) && json.errors[0] && json.errors[0].message) {
    return "Başvuru gönderilemedi: " + json.errors[0].message;
  }
  if (typeof json.error === "string" && json.error.trim()) {
    return "Başvuru gönderilemedi: " + json.error.trim();
  }
  return "Başvuru gönderilemedi. Lütfen tekrar deneyin.";
}

function resolveIncidentLabel(flight) {
  const key = flight.incidentType || flight.userReportedIssue;
  return INCIDENT_LABELS[key] || dash(key);
}

function buildClaimBody(payload, appNo, submittedAt) {
  const flight = payload.flight || {};
  const assessment = payload.assessment || {};
  const flightNumber = dash(flight.flightNumber);
  return [
    "Bilinçli Tüketici Platformu — uçuş tazminatı başvurusu",
    "",
    "Başvuru numarası: " + appNo,
    "Ad Soyad: " + dash(payload.fullName),
    "Telefon: " + dash(payload.phone),
    "E-posta: " + dash(payload.email),
    "PNR: " + (payload.pnr ? payload.pnr : "—"),
    "Açıklama: " + (payload.notes ? payload.notes : "—"),
    "Uçuş tarihi: " + dash(flight.flightDate),
    "Uçuş numarası: " + flightNumber,
    "Havayolu: " + dash(flight.airline),
    "Kalkış havalimanı: " + dash(flight.departureAirport),
    "Varış havalimanı: " + dash(flight.arrivalAirport),
    "Uçuşta yaşanan sorun: " + resolveIncidentLabel(flight),
    "Havayolunun bildirdiği gerekçe: " + dash(assessment.airlineReasonLabel || flight.airlineReason),
    "Gecikme süresi: " + formatDelayForMail(payload.delayMinutes),
    "Uçuş mesafesi: " +
      (payload.distanceKm != null && payload.distanceKm !== ""
        ? Number(payload.distanceKm).toLocaleString("tr-TR") + " km"
        : "Harici kayıt bekleniyor"),
    "Tahmini tazminat: " +
      (assessment.estimatedAmountEur != null
        ? "€" + assessment.estimatedAmountEur
        : "Bu aşamada otomatik tutar üretilemedi"),
    "Başvuru tarihi: " + submittedAt,
    "",
    "Belgeler: Tüketici evraklarını " + CONTACT_EMAIL + " adresine e-posta ile gönderecek.",
    "KVKK onayı: Evet",
    "Kaynak: bilinclituketiciplatformu.com / ucus-tazminati"
  ].join("\n");
}

export async function submitApplication(payload) {
  if (payload.website) {
    return { ok: true, applicationNumber: generateApplicationNumber() };
  }

  const flight = payload.flight || {};
  const appNo = generateApplicationNumber();
  const submittedAt = formatSubmittedAt();
  const flightNumber = dash(flight.flightNumber);
  const subject =
    "BTP Uçuş Tazminatı – " +
    (flightNumber !== "—" ? flightNumber : "—") +
    " – " +
    dash(payload.fullName);
  const body = buildClaimBody(payload, appNo, submittedAt);

  const data = new FormData();
  data.set("_subject", subject);
  data.set("_replyto", payload.email || "");
  data.set("email", payload.email || "");
  data.set("kaynak", "bilinclituketiciplatformu-ucus-tazminati");
  data.set("sayfa_url", SITE_ORIGIN + "/ucus-tazminati.html");
  data.set("ad_soyad", dash(payload.fullName));
  data.set("telefon", dash(payload.phone));
  data.set("mesaj", body);
  data.set("kvkk_onay", "Evet");

  let res;
  try {
    res = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" }
    });
  } catch (err) {
    const error = new Error("Bağlantı hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.");
    error.code = "network_error";
    throw error;
  }

  let json = null;
  try {
    json = await res.json();
  } catch (err) {
    json = null;
  }

  if (!res.ok) {
    const error = new Error(formspreeErrorMessage(json));
    error.code = "submit_failed";
    throw error;
  }

  return { ok: true, applicationNumber: appNo };
}
