<?php

function claim_clean($value, $maxLen = 500) {
  $v = trim(preg_replace("/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u", "", (string) $value));
  if ($maxLen > 0 && strlen($v) > $maxLen) {
    $v = substr($v, 0, $maxLen);
  }
  return $v;
}

function claim_dash($value) {
  $v = claim_clean($value, 500);
  return $v !== "" ? $v : "—";
}

function claim_generate_application_number() {
  return "BTP-" . date("Y") . "-" . (string) random_int(10000, 99999);
}

function claim_format_delay($minutes) {
  if ($minutes === null || $minutes === "") {
    return "Henüz doğrulanmadı";
  }
  if (!is_numeric($minutes)) {
    return "Henüz doğrulanmadı";
  }
  $n = (int) $minutes;
  $h = intdiv($n, 60);
  $m = $n % 60;
  if ($h <= 0) {
    return $m . " dakika";
  }
  if ($m === 0) {
    return $h . " saat";
  }
  return $h . " saat " . $m . " dakika";
}

function claim_incident_label($flight) {
  $labels = array(
    "delayed" => "Uçuş gecikti",
    "cancelled" => "Uçuş iptal edildi",
    "denied_boarding" => "Uçağa alınmadım",
    "missed_connection" => "Aktarmalı uçuşumu kaçırdım"
  );
  $key = isset($flight["incidentType"]) ? $flight["incidentType"] : "";
  if ($key === "" && isset($flight["userReportedIssue"])) {
    $key = $flight["userReportedIssue"];
  }
  return isset($labels[$key]) ? $labels[$key] : claim_dash($key);
}

function claim_format_submitted_at() {
  try {
    $dt = new DateTime("now", new DateTimeZone("Europe/Istanbul"));
    return $dt->format("d.m.Y H:i");
  } catch (Exception $e) {
    return date("d.m.Y H:i");
  }
}

function claim_build_body(array $payload, $appNo, $submittedAt, $contactEmail) {
  $flight = isset($payload["flight"]) && is_array($payload["flight"]) ? $payload["flight"] : array();
  $assessment = isset($payload["assessment"]) && is_array($payload["assessment"]) ? $payload["assessment"] : array();
  $flightNumber = claim_dash(isset($flight["flightNumber"]) ? $flight["flightNumber"] : "");
  $distanceKm = isset($payload["distanceKm"]) ? $payload["distanceKm"] : null;
  $estimated = isset($assessment["estimatedAmountEur"]) ? $assessment["estimatedAmountEur"] : null;
  $reason = isset($assessment["airlineReasonLabel"])
    ? $assessment["airlineReasonLabel"]
    : (isset($flight["airlineReason"]) ? $flight["airlineReason"] : "");

  $distanceText = "Harici kayıt bekleniyor";
  if ($distanceKm !== null && $distanceKm !== "") {
    $distanceText = number_format((float) $distanceKm, 0, ",", ".") . " km";
  }

  $amountText = "Bu aşamada otomatik tutar üretilemedi";
  if ($estimated !== null && $estimated !== "") {
    $amountText = "€" . $estimated;
  }

  $lines = array(
    "Bilinçli Tüketici Platformu — uçuş tazminatı başvurusu",
    "",
    "Başvuru numarası: " . $appNo,
    "Ad Soyad: " . claim_dash(isset($payload["fullName"]) ? $payload["fullName"] : ""),
    "Telefon: " . claim_dash(isset($payload["phone"]) ? $payload["phone"] : ""),
    "E-posta: " . claim_dash(isset($payload["email"]) ? $payload["email"] : ""),
    "PNR: " . (isset($payload["pnr"]) && claim_clean($payload["pnr"], 16) !== "" ? claim_clean($payload["pnr"], 16) : "—"),
    "Açıklama: " . (isset($payload["notes"]) && claim_clean($payload["notes"], 2000) !== "" ? claim_clean($payload["notes"], 2000) : "—"),
    "Uçuş tarihi: " . claim_dash(isset($flight["flightDate"]) ? $flight["flightDate"] : ""),
    "Uçuş numarası: " . $flightNumber,
    "Havayolu: " . claim_dash(isset($flight["airline"]) ? $flight["airline"] : ""),
    "Kalkış havalimanı: " . claim_dash(isset($flight["departureAirport"]) ? $flight["departureAirport"] : ""),
    "Varış havalimanı: " . claim_dash(isset($flight["arrivalAirport"]) ? $flight["arrivalAirport"] : ""),
    "Uçuşta yaşanan sorun: " . claim_incident_label($flight),
    "Havayolunun bildirdiği gerekçe: " . claim_dash($reason),
    "Gecikme süresi: " . claim_format_delay(isset($payload["delayMinutes"]) ? $payload["delayMinutes"] : null),
    "Uçuş mesafesi: " . $distanceText,
    "Tahmini tazminat: " . $amountText,
    "Başvuru tarihi: " . $submittedAt,
    "",
    "Belgeler: İnceleme sırasında ihtiyaç duyulursa ayrıca talep edilir (" . $contactEmail . ").",
    "KVKK onayı: Evet",
    "Kaynak: bilinclituketiciplatformu.com / ucus-tazminati"
  );

  return implode("\n", $lines);
}

function claim_is_valid_tr_phone($phone) {
  $digits = preg_replace("/\D+/", "", (string) $phone);
  if (strlen($digits) === 10 && $digits[0] === "5") {
    return true;
  }
  if (strlen($digits) === 11 && substr($digits, 0, 2) === "05") {
    return true;
  }
  if (strlen($digits) === 12 && substr($digits, 0, 3) === "905") {
    return true;
  }
  return false;
}

function claim_is_valid_pnr($pnr) {
  $v = strtoupper(preg_replace("/\s+/", "", (string) $pnr));
  if ($v === "") {
    return true;
  }
  return (bool) preg_match("/^[A-Z0-9]{5,8}$/", $v);
}
