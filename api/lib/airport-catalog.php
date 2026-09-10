<?php
require_once __DIR__ . "/flight-config.php";
require_once __DIR__ . "/flight-cache.php";
require_once __DIR__ . "/flight-common.php";
require_once __DIR__ . "/flight-providers/aviation-edge.php";

function airport_fold($value) {
  $s = (string) $value;
  if (function_exists("mb_strtolower")) {
    $s = mb_strtolower($s, "UTF-8");
  } else {
    $s = strtolower($s);
  }
  $map = array(
    "ı" => "i",
    "i̇" => "i",
    "İ" => "i",
    "I" => "i",
    "ş" => "s",
    "Ş" => "s",
    "ğ" => "g",
    "Ğ" => "g",
    "ü" => "u",
    "Ü" => "u",
    "ö" => "o",
    "Ö" => "o",
    "ç" => "c",
    "Ç" => "c",
    "â" => "a",
    "î" => "i",
    "û" => "u"
  );
  $s = strtr($s, $map);
  $s = preg_replace("/[^a-z0-9]+/u", " ", $s);
  return trim(preg_replace("/\s+/", " ", $s));
}

function airport_search_aliases() {
  return array(
    "PRN" => "pristine prishtine prishtina priştine priştina kosova kosovo",
    "BJV" => "bodrum mugla muğla",
    "DLM" => "mugla muğla",
    "SAW" => "sabiha gokcen gökçen",
    "IST" => "yeni havalimani"
  );
}

function airport_is_non_passenger($name) {
  $n = strtolower((string) $name);
  $needles = array(
    "heliport",
    "helipad",
    "seaplane",
    "balloonport",
    "bus station",
    "bus terminal",
    "railway",
    "rail station",
    "rail st",
    "railst",
    "train station"
  );
  foreach ($needles as $needle) {
    if (strpos($n, $needle) !== false) {
      return true;
    }
  }
  if (preg_match("/\\brail/", $n)) {
    return true;
  }
  return false;
}

function airport_format_label($city, $name, $iata, $country) {
  $name = trim((string) $name);
  $iata = strtoupper((string) $iata);
  $city = trim((string) $city);
  $country = trim((string) $country);
  $core = $name !== "" ? $name . " (" . $iata . ")" : $iata;
  if ($city !== "" && $country !== "") {
    return $city . " — " . $core . " — " . $country;
  }
  if ($city !== "") {
    return $city . " — " . $core;
  }
  if ($country !== "") {
    return $core . " — " . $country;
  }
  return $core;
}

function airport_catalog_storage_dir() {
  $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . "cache";
  if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
  }
  return is_dir($dir) && is_writable($dir) ? $dir : null;
}

function airport_catalog_file($name) {
  $dir = airport_catalog_storage_dir();
  return $dir ? $dir . DIRECTORY_SEPARATOR . $name : null;
}

function airport_catalog_read_file($name) {
  $path = airport_catalog_file($name);
  if ($path === null || !is_readable($path)) {
    return null;
  }
  $raw = file_get_contents($path);
  if ($raw === false) {
    return null;
  }
  $wrap = json_decode($raw, true);
  if (!is_array($wrap) || !isset($wrap["exp"], $wrap["data"])) {
    return null;
  }
  if ((int) $wrap["exp"] < time()) {
    @unlink($path);
    return null;
  }
  return $wrap["data"];
}

function airport_catalog_write_file($name, $data, $ttlSeconds) {
  $path = airport_catalog_file($name);
  if ($path === null) {
    flight_cache_set("file:" . $name, $data, $ttlSeconds);
    return;
  }
  @file_put_contents($path, json_encode(array(
    "exp" => time() + (int) $ttlSeconds,
    "data" => $data
  )), LOCK_EX);
}

function airport_city_map($allowFetch) {
  $fromFile = airport_catalog_read_file("cities-v1.json");
  if (is_array($fromFile) && isset($fromFile["map"]) && is_array($fromFile["map"]) && count($fromFile["map"])) {
    return $fromFile["map"];
  }
  $cached = flight_cache_get("aviation_edge:cities:v1");
  if (is_array($cached) && isset($cached["map"]) && is_array($cached["map"]) && count($cached["map"])) {
    return $cached["map"];
  }
  if (!$allowFetch || aviation_edge_api_key() === "") {
    return array();
  }
  $result = aviation_edge_http_get("cityDatabase", array(), 90);
  if (!$result["ok"]) {
    return array();
  }
  $map = array();
  foreach (aviation_edge_to_list($result["json"]) as $row) {
    $code = normalize_iata_code(isset($row["codeIataCity"]) ? $row["codeIataCity"] : "");
    $name = aviation_edge_optional_string($row, "nameCity");
    if ($code === null || !$name) {
      continue;
    }
    $map[$code] = $name;
  }
  if (count($map) > 100) {
    $payload = array("map" => $map);
    airport_catalog_write_file("cities-v1.json", $payload, 86400 * 14);
    flight_cache_set("aviation_edge:cities:v1", $payload, 86400 * 14);
  }
  return $map;
}

function airport_row_coordinate($row, $which) {
  $keys = $which === "lat"
    ? array("latitudeAirport", "latitude", "lat")
    : array("longitudeAirport", "longitude", "lon", "lng");
  foreach ($keys as $key) {
    if (!isset($row[$key]) || $row[$key] === "" || $row[$key] === null) {
      continue;
    }
    $val = (float) $row[$key];
    if ($which === "lat" && $val >= -90 && $val <= 90) {
      return $val;
    }
    if ($which === "lon" && $val >= -180 && $val <= 180) {
      return $val;
    }
  }
  return null;
}

function airport_haversine_km($lat1, $lon1, $lat2, $lon2) {
  $lat1 = (float) $lat1;
  $lon1 = (float) $lon1;
  $lat2 = (float) $lat2;
  $lon2 = (float) $lon2;
  $earth = 6371.0;
  $dLat = deg2rad($lat2 - $lat1);
  $dLon = deg2rad($lon2 - $lon1);
  $a = sin($dLat / 2) * sin($dLat / 2)
    + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) * sin($dLon / 2);
  return (int) round($earth * 2 * atan2(sqrt($a), sqrt(1 - $a)));
}

function airport_catalog_index($allowFetch) {
  static $cached = null;
  static $cachedFetch = null;
  if (is_array($cached) && $cachedFetch === (bool) $allowFetch) {
    return $cached;
  }
  $index = array();
  foreach (airport_catalog_load($allowFetch) as $row) {
    if (isset($row["iata"])) {
      $index[$row["iata"]] = $row;
    }
  }
  $cached = $index;
  $cachedFetch = (bool) $allowFetch;
  return $index;
}

function airport_route_distance_km($depIata, $arrIata) {
  $depIata = normalize_iata_code($depIata);
  $arrIata = normalize_iata_code($arrIata);
  if ($depIata === null || $arrIata === null || $depIata === $arrIata) {
    return null;
  }
  $index = airport_catalog_index(false);
  if (!isset($index[$depIata]) || !isset($index[$arrIata])) {
    $index = airport_catalog_index(true);
  }
  if (!isset($index[$depIata]) || !isset($index[$arrIata])) {
    return null;
  }
  $dep = $index[$depIata];
  $arr = $index[$arrIata];
  if (!isset($dep["lat"], $dep["lon"], $arr["lat"], $arr["lon"])) {
    return null;
  }
  return airport_haversine_km($dep["lat"], $dep["lon"], $arr["lat"], $arr["lon"]);
}

function airport_row_country_code($row) {
  if (!is_array($row)) {
    return null;
  }
  if (!empty($row["countryCode"])) {
    return strtoupper((string) $row["countryCode"]);
  }
  $country = isset($row["country"]) ? trim((string) $row["country"]) : "";
  if ($country === "") {
    return null;
  }
  if (preg_match("/^TR$/i", $country) || preg_match("/t[üu]rk/i", $country)) {
    return "TR";
  }
  return null;
}

function airport_route_is_domestic($depIata, $arrIata) {
  $depIata = normalize_iata_code($depIata);
  $arrIata = normalize_iata_code($arrIata);
  if ($depIata === null || $arrIata === null || $depIata === $arrIata) {
    return null;
  }
  $index = airport_catalog_index(false);
  if (!isset($index[$depIata]) || !isset($index[$arrIata])) {
    $index = airport_catalog_index(true);
  }
  if (!isset($index[$depIata]) || !isset($index[$arrIata])) {
    return null;
  }
  $depCode = airport_row_country_code($index[$depIata]);
  $arrCode = airport_row_country_code($index[$arrIata]);
  if ($depCode === null || $arrCode === null) {
    return null;
  }
  return $depCode === "TR" && $arrCode === "TR";
}

function airport_compact_from_row($row, $cityMap) {
  $iata = normalize_iata_code(isset($row["codeIataAirport"]) ? $row["codeIataAirport"] : "");
  if ($iata === null) {
    return null;
  }
  if ($iata[0] === "Q") {
    return null;
  }
  $rawName = aviation_edge_optional_string($row, "nameAirport");
  if (airport_is_non_passenger($rawName)) {
    return null;
  }
  $name = $rawName ? $rawName : $iata;
  $countryName = aviation_edge_optional_string($row, "nameCountry");
  $countryCode = aviation_edge_optional_string($row, "codeIso2Country");
  $cityCode = normalize_iata_code(isset($row["codeIataCity"]) ? $row["codeIataCity"] : "");
  $city = null;
  if ($cityCode !== null && isset($cityMap[$cityCode])) {
    $city = $cityMap[$cityCode];
  }
  $aliases = airport_search_aliases();
  $hay = airport_fold(implode(" ", array(
    $iata,
    $name,
    $rawName,
    $city,
    $cityCode,
    $countryName,
    $countryCode,
    isset($aliases[$iata]) ? $aliases[$iata] : ""
  )));
  $lat = airport_row_coordinate($row, "lat");
  $lon = airport_row_coordinate($row, "lon");
  return array(
    "iata" => $iata,
    "name" => $name,
    "city" => $city,
    "country" => $countryName ? $countryName : ($countryCode ? strtoupper($countryCode) : null),
    "countryCode" => $countryCode ? strtoupper($countryCode) : null,
    "cityCode" => $cityCode,
    "lat" => $lat,
    "lon" => $lon,
    "search" => $hay
  );
}

function airport_catalog_bundled_rows() {
  static $rows = null;
  if ($rows !== null) {
    return $rows;
  }
  $rows = array();
  $path = dirname(__DIR__, 2) . "/data/airports-catalog.json";
  if (!is_readable($path)) {
    return $rows;
  }
  $raw = @file_get_contents($path);
  if ($raw === false) {
    return $rows;
  }
  $json = json_decode($raw, true);
  if (!is_array($json) || !isset($json["airports"]) || !is_array($json["airports"])) {
    return $rows;
  }
  foreach ($json["airports"] as $item) {
    if (!is_array($item)) {
      continue;
    }
    $iata = normalize_iata_code(isset($item["iata"]) ? $item["iata"] : "");
    if ($iata === null) {
      continue;
    }
    $name = aviation_edge_optional_string($item, "name");
    if ($name === null) {
      $name = $iata;
    }
    $city = aviation_edge_optional_string($item, "city");
    $country = aviation_edge_optional_string($item, "country");
    $search = isset($item["search"]) ? (string) $item["search"] : airport_fold(
      $iata . " " . $name . " " . ($city ? $city : "") . " " . ($country ? $country : "")
    );
    $rows[] = array(
      "iata" => $iata,
      "name" => $name,
      "city" => $city,
      "country" => $country,
      "countryCode" => null,
      "cityCode" => null,
      "lat" => isset($item["lat"]) ? $item["lat"] : null,
      "lon" => isset($item["lon"]) ? $item["lon"] : null,
      "search" => $search
    );
  }
  return $rows;
}

function airport_catalog_load($allowFetch) {
  $fromFile = airport_catalog_read_file("airports-v4.json");
  if (is_array($fromFile) && isset($fromFile["airports"]) && count($fromFile["airports"]) > 500) {
    return $fromFile["airports"];
  }
  $cached = flight_cache_get("aviation_edge:airports:compact:v4");
  if (is_array($cached) && isset($cached["airports"]) && count($cached["airports"]) > 500) {
    return $cached["airports"];
  }
  $bundled = airport_catalog_bundled_rows();
  if (count($bundled) >= 100) {
    return $bundled;
  }
  if (!$allowFetch) {
    return array();
  }
  if (aviation_edge_api_key() === "") {
    return array();
  }

  $lockPath = airport_catalog_file("airports.lock");
  $lock = null;
  if ($lockPath) {
    $lock = @fopen($lockPath, "c");
    if ($lock) {
      flock($lock, LOCK_EX);
      $again = airport_catalog_read_file("airports-v4.json");
      if (is_array($again) && isset($again["airports"]) && count($again["airports"]) > 500) {
        flock($lock, LOCK_UN);
        fclose($lock);
        return $again["airports"];
      }
    }
  }

  if (function_exists("set_time_limit")) {
    @set_time_limit(120);
  }
  $result = aviation_edge_http_get("airportDatabase", array(), 90);
  if (!$result["ok"]) {
    if ($lock) {
      flock($lock, LOCK_UN);
      fclose($lock);
    }
    return array();
  }
  $cityMap = airport_city_map(true);
  $seen = array();
  $airports = array();
  foreach (aviation_edge_airport_rows($result["json"]) as $row) {
    $item = airport_compact_from_row($row, $cityMap);
    if ($item === null || isset($seen[$item["iata"]])) {
      continue;
    }
    $seen[$item["iata"]] = true;
    $airports[] = $item;
  }
  $cityCounts = array();
  foreach ($airports as $item) {
    if (!empty($item["cityCode"])) {
      $cc = $item["cityCode"];
      $cityCounts[$cc] = isset($cityCounts[$cc]) ? $cityCounts[$cc] + 1 : 1;
    }
  }
  foreach ($airports as $idx => $item) {
    $cc = isset($item["cityCode"]) ? $item["cityCode"] : null;
    $airports[$idx]["metro"] = ($cc && isset($cityCounts[$cc])) ? (int) $cityCounts[$cc] : 1;
  }
  usort($airports, function ($a, $b) {
    return strcmp($a["iata"], $b["iata"]);
  });
  if (count($airports) > 500) {
    $payload = array("airports" => $airports);
    airport_catalog_write_file("airports-v4.json", $payload, 86400 * 14);
    flight_cache_set("aviation_edge:airports:compact:v4", $payload, 86400 * 14);
  }
  if ($lock) {
    flock($lock, LOCK_UN);
    fclose($lock);
  }
  return $airports;
}

function airport_catalog_by_iata($iata, $allowFetch = true) {
  $iata = normalize_iata_code($iata);
  if ($iata === null) {
    return null;
  }
  foreach (airport_catalog_load($allowFetch) as $row) {
    if ($row["iata"] === $iata) {
      return $row;
    }
  }
  return null;
}

function airport_catalog_search($query, $limit = 15) {
  $q = airport_fold($query);
  if (strlen($q) < 2) {
    return array();
  }
  $limit = max(1, min(25, (int) $limit));
  $airports = airport_catalog_load(true);
  $ranked = array();
  foreach ($airports as $row) {
    $hay = isset($row["search"]) ? $row["search"] : airport_fold($row["iata"] . " " . $row["name"]);
    $iataFold = airport_fold($row["iata"]);
    $nameFold = airport_fold($row["name"]);
    $cityFold = airport_fold(isset($row["city"]) ? $row["city"] : "");
    $countryFold = airport_fold(isset($row["country"]) ? $row["country"] : "");
    $score = 0;
    if ($iataFold === $q) {
      $score = 100;
    } elseif (strpos($iataFold, $q) === 0) {
      $score = 92;
    } elseif ($cityFold !== "" && $cityFold === $q) {
      $score = 88;
    } elseif ($cityFold !== "" && strpos($cityFold, $q) === 0) {
      $score = 80;
    } elseif (strpos($nameFold, $q) === 0) {
      $score = 74;
    } elseif ($cityFold !== "" && preg_match("/(?:^| )" . preg_quote($q, "/") . "(?: |$)/", $cityFold)) {
      $score = 70;
    } elseif (strpos($hay, $q) !== false) {
      $score = 48;
      if ($countryFold === $q || strpos($countryFold, $q) === 0) {
        $score = 42;
      }
      if (strpos($hay, " " . $q) !== false || strpos($hay, $q . " ") === 0) {
        $score = max($score, 58);
      }
    } else {
      continue;
    }
    if (!empty($row["city"]) && $cityFold === $q) {
      $metro = isset($row["metro"]) ? (int) $row["metro"] : 1;
      $score += min(10, max(0, $metro - 1));
    }
    $ranked[] = array("score" => $score, "row" => $row);
  }
  usort($ranked, function ($a, $b) {
    if ($a["score"] === $b["score"]) {
      $cityCmp = strcmp((string) (isset($a["row"]["city"]) ? $a["row"]["city"] : ""), (string) (isset($b["row"]["city"]) ? $b["row"]["city"] : ""));
      if ($cityCmp !== 0) {
        return $cityCmp;
      }
      return strcmp($a["row"]["name"], $b["row"]["name"]);
    }
    return $a["score"] > $b["score"] ? -1 : 1;
  });
  $out = array();
  foreach (array_slice($ranked, 0, $limit) as $item) {
    $out[] = airport_catalog_public($item["row"]);
  }
  return $out;
}

function airport_catalog_public_list() {
  $out = array();
  foreach (airport_catalog_load(true) as $row) {
    $out[] = airport_catalog_public($row);
  }
  return $out;
}

function airport_catalog_public($row) {
  $city = isset($row["city"]) ? $row["city"] : null;
  $country = isset($row["country"]) ? $row["country"] : null;
  return array(
    "iata" => $row["iata"],
    "name" => $row["name"],
    "city" => $city,
    "country" => $country,
    "lat" => isset($row["lat"]) ? $row["lat"] : null,
    "lon" => isset($row["lon"]) ? $row["lon"] : null,
    "label" => airport_format_label($city, $row["name"], $row["iata"], $country)
  );
}
