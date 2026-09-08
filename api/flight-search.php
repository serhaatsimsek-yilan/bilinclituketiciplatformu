<?php
/**
 * Internal flight search. Frontend never calls Aviation Edge directly.
 * POST JSON { "flight_number": "PC2292", "date": "2026-08-27", "departure_iata": "SAW", "arrival_iata": "DLM" }
 */
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("X-Content-Type-Options: nosniff");

require_once __DIR__ . "/lib/env.php";
require_once __DIR__ . "/lib/rate-limit.php";
require_once __DIR__ . "/lib/flight-search-service.php";
require_once __DIR__ . "/lib/airport-catalog.php";

flight_load_env();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

function flight_search_public_payload($payload) {
  unset($payload["requests"], $payload["debug"], $payload["cached"]);
  return $payload;
}

function flight_search_fail($http, $code, $message, $extra = array()) {
  http_response_code($http);
  $payload = flight_search_public_payload(array_merge(array("ok" => false, "code" => $code, "message" => $message), $extra));
  echo json_encode($payload);
  exit;
}

function is_dev_client() {
  $env = getenv("APP_ENV");
  if ($env === "development" || $env === "dev" || $env === "local") {
    return true;
  }
  $host = isset($_SERVER["HTTP_HOST"]) ? strtolower((string) $_SERVER["HTTP_HOST"]) : "";
  $host = preg_replace("/:\d+$/", "", $host);
  return $host === "127.0.0.1" || $host === "localhost";
}

function flight_search_read_body() {
  $flightNumber = "";
  $date = "";
  $depIataRaw = "";
  $arrIataRaw = "";
  if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $ctype = isset($_SERVER["CONTENT_TYPE"]) ? strtolower((string) $_SERVER["CONTENT_TYPE"]) : "";
    if (strpos($ctype, "application/json") !== false) {
      $raw = file_get_contents("php://input");
      $body = json_decode($raw, true);
      if (is_array($body)) {
        $flightNumber = isset($body["flight_number"]) ? $body["flight_number"] : (isset($body["flightNumber"]) ? $body["flightNumber"] : "");
        $date = isset($body["date"]) ? $body["date"] : (isset($body["flightDate"]) ? $body["flightDate"] : "");
        $depIataRaw = isset($body["departure_iata"]) ? $body["departure_iata"] : (isset($body["departureIata"]) ? $body["departureIata"] : "");
        $arrIataRaw = isset($body["arrival_iata"]) ? $body["arrival_iata"] : (isset($body["arrivalIata"]) ? $body["arrivalIata"] : "");
      }
    } else {
      $flightNumber = isset($_POST["flight_number"]) ? $_POST["flight_number"] : "";
      $date = isset($_POST["date"]) ? $_POST["date"] : "";
      $depIataRaw = isset($_POST["departure_iata"]) ? $_POST["departure_iata"] : "";
      $arrIataRaw = isset($_POST["arrival_iata"]) ? $_POST["arrival_iata"] : "";
    }
  } else {
    $flightNumber = isset($_GET["flight_number"]) ? $_GET["flight_number"] : "";
    $date = isset($_GET["date"]) ? $_GET["date"] : "";
    $depIataRaw = isset($_GET["departure_iata"]) ? $_GET["departure_iata"] : "";
    $arrIataRaw = isset($_GET["arrival_iata"]) ? $_GET["arrival_iata"] : "";
  }
  return array($flightNumber, $date, $depIataRaw, $arrIataRaw);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST" && $_SERVER["REQUEST_METHOD"] !== "GET") {
  flight_search_fail(405, "method_not_allowed", "Yalnızca GET veya POST kabul edilir.");
}

if (!flight_rate_limit_ok("search:" . flight_client_ip(), 8, 300)) {
  flight_search_fail(429, "rate_limited", "Çok fazla sorgu yaptınız. Lütfen kısa süre sonra tekrar deneyin.");
}

list($flightNumber, $date, $depIataRaw, $arrIataRaw) = flight_search_read_body();

$ident = normalize_flight_number($flightNumber);
if (!is_valid_flight_number($ident)) {
  flight_search_fail(400, "invalid_flight_number", "Geçerli bir uçuş numarası girin. Örn. TK1985");
}

$depIata = normalize_iata_code($depIataRaw);
if ($depIata === null) {
  flight_search_fail(400, "invalid_departure", "Lütfen kalkış havalimanını seçin.");
}

$arrIata = normalize_iata_code($arrIataRaw);
if ($arrIata === null) {
  flight_search_fail(400, "invalid_arrival", "Lütfen varış havalimanını seçin.");
}

if ($depIata === $arrIata) {
  flight_search_fail(400, "invalid_route", "Kalkış ve varış havalimanı aynı olamaz.");
}

$dateCheck = validate_search_date($date);
if ($dateCheck === "future" || $dateCheck === "invalid") {
  flight_search_fail(400, "invalid_date", "Lütfen geçerli bir tarih seçin. Gelecek tarih seçilemez.");
}

if (flight_active_provider() === "aviation_edge" && aviation_edge_api_key() === "") {
  $msg = is_dev_client()
    ? "Uçuş servisi henüz yapılandırılmadı."
    : "Uçuş bilgileri şu anda alınamıyor. Lütfen kısa süre sonra tekrar deneyin.";
  flight_search_fail(503, "not_configured", $msg, array("canContinue" => true, "manualReviewRequired" => true));
}

$result = search_flights_for_claim($ident, $date, $depIata, $arrIata);
$routeDistanceKm = airport_route_distance_km($depIata, $arrIata);
$routeIsDomestic = airport_route_is_domestic($depIata, $arrIata);

if (!empty($result["ok"])) {
  $flights = $result["flights"];
  if ($routeDistanceKm !== null) {
    foreach ($flights as $idx => $flight) {
      if (!is_array($flight)) {
        continue;
      }
      if (!isset($flight["distanceKm"]) || $flight["distanceKm"] === null || $flight["distanceKm"] === "") {
        $flights[$idx]["distanceKm"] = $routeDistanceKm;
      }
      if ($routeIsDomestic !== null && (!isset($flight["isDomestic"]) || $flight["isDomestic"] === null)) {
        $flights[$idx]["isDomestic"] = $routeIsDomestic;
      }
    }
  }
  echo json_encode(flight_search_public_payload(array(
    "ok" => true,
    "flightNumber" => $ident,
    "date" => $date,
    "departureIata" => $depIata,
    "arrivalIata" => $arrIata,
    "distanceKm" => $routeDistanceKm,
    "isDomestic" => $routeIsDomestic,
    "flights" => $flights,
    "manualReviewRequired" => !empty($result["manualReviewRequired"]),
    "canContinue" => true,
    "providerVerifiedCancellation" => isset($result["providerVerifiedCancellation"]) ? $result["providerVerifiedCancellation"] : false
  )));
  exit;
}

$code = isset($result["code"]) ? $result["code"] : "PROVIDER_ERROR";
$canContinue = !empty($result["canContinue"]);
$http = ($code === "invalid_date" || $code === "invalid_flight_number" || $code === "invalid_departure" || $code === "invalid_arrival") ? 400 : 200;
if ($code === "not_configured") {
  $http = 503;
}
flight_search_fail($http, $code, isset($result["message"]) ? $result["message"] : "", array(
  "manualReviewRequired" => true,
  "canContinue" => $canContinue,
  "providerVerifiedCancellation" => isset($result["providerVerifiedCancellation"]) ? $result["providerVerifiedCancellation"] : null
));
