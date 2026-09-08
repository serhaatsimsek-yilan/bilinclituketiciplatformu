<?php
require_once __DIR__ . "/flight-common.php";

function flight_local_config() {
  static $loaded = false;
  static $cfg = array();
  if ($loaded) {
    return $cfg;
  }
  $loaded = true;
  $path = __DIR__ . DIRECTORY_SEPARATOR . "local-config.php";
  if (is_readable($path)) {
    $raw = include $path;
    if (is_array($raw)) {
      $cfg = $raw;
    }
  }
  return $cfg;
}

function flight_config_string($name, $default = "") {
  $cfg = flight_local_config();
  if (isset($cfg[$name]) && trim((string) $cfg[$name]) !== "") {
    return trim((string) $cfg[$name]);
  }
  $fromEnv = getenv($name);
  if (is_string($fromEnv) && trim($fromEnv) !== "") {
    return trim($fromEnv);
  }
  return $default;
}

function flight_config_int($name, $default) {
  $cfg = flight_local_config();
  if (isset($cfg[$name]) && is_numeric($cfg[$name])) {
    return (int) $cfg[$name];
  }
  $fromEnv = getenv($name);
  if (is_string($fromEnv) && is_numeric(trim($fromEnv))) {
    return (int) trim($fromEnv);
  }
  return (int) $default;
}

function flight_active_provider() {
  $p = strtolower(flight_config_string("ACTIVE_FLIGHT_PROVIDER", "aviation_edge"));
  if ($p === "airlabs") {
    return "airlabs";
  }
  return "aviation_edge";
}

function aviation_edge_api_key() {
  return flight_config_string("AVIATION_EDGE_API_KEY", "");
}

function aviation_edge_history_days() {
  $n = flight_config_int("AVIATION_EDGE_HISTORY_DAYS", 365);
  return $n > 0 ? $n : 365;
}

function aviation_edge_min_age_days() {
  $n = flight_config_int("AVIATION_EDGE_MIN_AGE_DAYS", 3);
  return $n >= 0 ? $n : 3;
}
