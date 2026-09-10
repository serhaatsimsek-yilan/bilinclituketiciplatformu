<?php
/**
 * Uçuş tazminatı başvurusu → Formspree → infobilinclituketiciplatformu@gmail.com
 * POST JSON
 */
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("X-Content-Type-Options: nosniff");

require_once __DIR__ . "/lib/env.php";
require_once __DIR__ . "/lib/rate-limit.php";
require_once __DIR__ . "/lib/formspree.php";
require_once __DIR__ . "/lib/claim-mail.php";

flight_load_env();

const CLAIM_CONTACT_EMAIL = "infobilinclituketiciplatformu@gmail.com";

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

function claim_json($http, array $payload) {
  http_response_code($http);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  claim_json(405, array("ok" => false, "message" => "Yalnızca POST kabul edilir."));
}

if (!flight_rate_limit_ok("claim:" . flight_client_ip(), 8, 3600)) {
  claim_json(429, array("ok" => false, "message" => "Çok fazla başvuru gönderdiniz. Lütfen sonra tekrar deneyin."));
}

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);
if (!is_array($data)) {
  claim_json(400, array("ok" => false, "message" => "Geçersiz istek gövdesi."));
}

$honeypot = claim_clean(isset($data["website"]) ? $data["website"] : "", 120);
if ($honeypot !== "") {
  claim_json(200, array("ok" => true, "applicationNumber" => claim_generate_application_number()));
}

$kvkk = isset($data["kvkkConsent"]) ? $data["kvkkConsent"] : false;
if ($kvkk !== true && $kvkk !== "true" && $kvkk !== 1 && $kvkk !== "1") {
  claim_json(400, array("ok" => false, "message" => "KVKK onayı gereklidir."));
}

$fullName = claim_clean(isset($data["fullName"]) ? $data["fullName"] : "", 120);
$phone = claim_clean(isset($data["phone"]) ? $data["phone"] : "", 24);
$email = claim_clean(isset($data["email"]) ? $data["email"] : "", 120);
$pnr = strtoupper(claim_clean(isset($data["pnr"]) ? $data["pnr"] : "", 8));
$notes = claim_clean(isset($data["notes"]) ? $data["notes"] : "", 2000);

if (strlen($fullName) < 3) {
  claim_json(400, array("ok" => false, "message" => "Lütfen ad soyad bilgilerinizi girin."));
}
if (!claim_is_valid_tr_phone($phone)) {
  claim_json(400, array("ok" => false, "message" => "Geçerli bir Türkiye telefon numarası girin."));
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  claim_json(400, array("ok" => false, "message" => "Geçerli bir e-posta adresi girin."));
}
if (!claim_is_valid_pnr($pnr)) {
  claim_json(400, array("ok" => false, "message" => "PNR kodu 5–8 karakter olmalıdır."));
}

$payload = array(
  "fullName" => $fullName,
  "phone" => $phone,
  "email" => $email,
  "pnr" => $pnr,
  "notes" => $notes,
  "flight" => isset($data["flight"]) && is_array($data["flight"]) ? $data["flight"] : array(),
  "assessment" => isset($data["assessment"]) && is_array($data["assessment"]) ? $data["assessment"] : array(),
  "delayMinutes" => isset($data["delayMinutes"]) ? $data["delayMinutes"] : null,
  "distanceKm" => isset($data["distanceKm"]) ? $data["distanceKm"] : null
);

$appNo = claim_generate_application_number();
$submittedAt = claim_format_submitted_at();
$flight = $payload["flight"];
$flightNumber = claim_dash(isset($flight["flightNumber"]) ? $flight["flightNumber"] : "");
$subject = "BTP Uçuş Tazminatı – " . $flightNumber . " – " . $fullName;
$body = claim_build_body($payload, $appNo, $submittedAt, CLAIM_CONTACT_EMAIL);

$result = formspree_send(array(
  "_subject" => $subject,
  "_replyto" => $email,
  "email" => $email,
  "kaynak" => "bilinclituketiciplatformu-ucus-tazminati",
  "sayfa_url" => "https://bilinclituketiciplatformu.com/ucus-tazminati.html",
  "ad_soyad" => $fullName,
  "telefon" => $phone,
  "pnr" => $pnr !== "" ? $pnr : "—",
  "basvuru_no" => $appNo,
  "mesaj" => $body,
  "kvkk_onay" => "Evet"
));

if (!$result["ok"]) {
  error_log("[claim-submit] Formspree failed http=" . $result["http"] . " err=" . $result["error"]);
  claim_json(502, array(
    "ok" => false,
    "message" => "Başvuru gönderilemedi. Lütfen bir süre sonra tekrar deneyin veya " . CLAIM_CONTACT_EMAIL . " adresine yazın."
  ));
}

claim_json(200, array("ok" => true, "applicationNumber" => $appNo));
