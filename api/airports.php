<?php
/**
 * Cached airport catalog for the flight wizard autocomplete.
 * Typing does not hit Aviation Edge per keystroke after the catalog is built.
 */
header("Content-Type: application/json; charset=utf-8");
header("X-Content-Type-Options: nosniff");

require_once __DIR__ . "/lib/env.php";
require_once __DIR__ . "/lib/rate-limit.php";
require_once __DIR__ . "/lib/airport-catalog.php";

flight_load_env();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  http_response_code(405);
  echo json_encode(array("ok" => false, "code" => "method_not_allowed"));
  exit;
}

if (!flight_rate_limit_ok("airports:" . flight_client_ip(), 60, 300)) {
  http_response_code(429);
  echo json_encode(array("ok" => false, "code" => "rate_limited", "message" => "Çok fazla sorgu yaptınız. Lütfen kısa süre sonra tekrar deneyin."));
  exit;
}

$wantCatalog = isset($_GET["catalog"]) && $_GET["catalog"] !== "0" && $_GET["catalog"] !== "";
$q = isset($_GET["q"]) ? trim((string) $_GET["q"]) : "";

if ($wantCatalog) {
  header("Cache-Control: public, max-age=3600");
  $airports = airport_catalog_public_list();
  if (count($airports) < 100) {
    http_response_code(503);
    echo json_encode(array("ok" => false, "code" => "catalog_unavailable", "airports" => array(), "count" => 0));
    exit;
  }
  echo json_encode(array("ok" => true, "airports" => $airports, "count" => count($airports)));
  exit;
}

if (strlen($q) < 2) {
  header("Cache-Control: no-store");
  echo json_encode(array("ok" => true, "airports" => array(), "count" => 0));
  exit;
}

header("Cache-Control: no-store");
$results = airport_catalog_search($q, 15);
echo json_encode(array("ok" => true, "airports" => $results, "count" => count($results)));
