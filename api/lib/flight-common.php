<?php
/**
 * Shared helpers for /api/flight-search.php
 * Provider HTTP stays in airlabs.php
 */
function flight_log($message) {
  error_log("[flight-search] " . $message);
}

function normalize_flight_number($raw) {
  return strtoupper(preg_replace("/[\s\-]+/", "", (string) $raw));
}

function is_valid_flight_number($ident) {
  return (bool) preg_match("/^[A-Z]{2,3}[0-9]{1,4}[A-Z]?$/", $ident);
}

function parse_flight_ident($ident) {
  $ident = normalize_flight_number($ident);
  if (!preg_match("/^([A-Z]{2,3})([0-9]{1,4}[A-Z]?)$/", $ident, $m)) {
    return null;
  }
  return array(
    "ident" => $ident,
    "airline_iata" => $m[1],
    "flight_number" => $m[2]
  );
}

function normalize_iata_code($raw) {
  $v = strtoupper(preg_replace("/\s+/", "", (string) $raw));
  if (!preg_match("/^[A-Z]{3}$/", $v)) {
    return null;
  }
  return $v;
}

function flight_age_days($date) {
  $dt = DateTime::createFromFormat("!Y-m-d", $date, new DateTimeZone("Europe/Istanbul"));
  if ($dt === false) {
    return null;
  }
  $today = flight_today_istanbul();
  if ($dt > $today) {
    return -1;
  }
  return (int) $dt->diff($today)->days;
}

function flight_today_istanbul() {
  return new DateTime("today", new DateTimeZone("Europe/Istanbul"));
}

function validate_search_date($date) {
  if (!is_string($date) || !preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
    return "invalid";
  }
  $dt = DateTime::createFromFormat("!Y-m-d", $date, new DateTimeZone("Europe/Istanbul"));
  if ($dt === false || $dt->format("Y-m-d") !== $date) {
    return "invalid";
  }
  $today = flight_today_istanbul()->format("Y-m-d");
  if ($date > $today) {
    return "future";
  }
  return "ok";
}

function airline_iata_from_ident($ident) {
  if (preg_match("/^([A-Z]{2})[0-9]/", $ident, $m)) {
    return $m[1];
  }
  if (preg_match("/^([A-Z]{3})[0-9]/", $ident, $m)) {
    return $m[1];
  }
  return null;
}
