<?php
require_once dirname(__DIR__) . "/flight-config.php";
require_once dirname(__DIR__) . "/flight-cache.php";
require_once dirname(__DIR__) . "/flight-common.php";

function aviation_edge_api_host() {
  return "https://aviation-edge.com/v2/public";
}

function aviation_edge_base_url() {
  return aviation_edge_api_host() . "/flightsHistory";
}

function aviation_edge_is_valid_iata($code) {
  return normalize_iata_code($code) !== null;
}

function aviation_edge_optional_string($row, $key) {
  if (!is_array($row) || !array_key_exists($key, $row) || $row[$key] === null || $row[$key] === "") {
    return null;
  }
  return is_string($row[$key]) ? $row[$key] : (string) $row[$key];
}

function aviation_edge_optional_int($row, $key) {
  if (!is_array($row) || !array_key_exists($key, $row) || $row[$key] === null || $row[$key] === "") {
    return null;
  }
  if (!is_numeric($row[$key])) {
    return null;
  }
  return (int) $row[$key];
}

function aviation_edge_parse_time($value) {
  if (!is_string($value) || trim($value) === "") {
    return null;
  }
  $value = trim(str_replace("T", "t", $value));
  $dt = DateTime::createFromFormat("Y-m-d\\tH:i:s.u", $value);
  if ($dt instanceof DateTime) {
    return $dt;
  }
  $dt = DateTime::createFromFormat("Y-m-d\\tH:i:s", $value);
  if ($dt instanceof DateTime) {
    return $dt;
  }
  try {
    return new DateTime(str_replace("t", "T", $value));
  } catch (Exception $e) {
    return null;
  }
}

function aviation_edge_airline_name($iata, $fromApi) {
  if (is_string($fromApi) && trim($fromApi) !== "") {
    $n = trim($fromApi);
    if (strcasecmp($n, "pegasus") === 0) {
      return "Pegasus Airlines";
    }
    return $n;
  }
  $map = array(
    "PC" => "Pegasus Airlines",
    "TK" => "Turkish Airlines",
    "VF" => "AJet",
    "XQ" => "SunExpress",
    "FH" => "Freebird Airlines",
    "8Q" => "Onur Air"
  );
  $code = strtoupper((string) $iata);
  return isset($map[$code]) ? $map[$code] : ($code !== "" ? $code : null);
}

function aviation_edge_map_status($raw, $cancelled, $diverted) {
  if ($cancelled) {
    return "İptal edildi";
  }
  if ($diverted) {
    return "Yönlendirildi";
  }
  $s = strtolower(trim((string) $raw));
  if ($s === "landed") {
    return "Tamamlandı";
  }
  if ($s === "cancelled") {
    return "İptal edildi";
  }
  if ($s === "diverted") {
    return "Yönlendirildi";
  }
  if ($s === "active") {
    return null;
  }
  return $raw ? (string) $raw : null;
}

function aviation_edge_leg_best_actual($leg) {
  if (!is_array($leg)) {
    return null;
  }
  $actual = aviation_edge_optional_string($leg, "actualTime");
  if ($actual) {
    return $actual;
  }
  return aviation_edge_optional_string($leg, "actualRunway");
}

function aviation_edge_leg_best_estimated($leg) {
  if (!is_array($leg)) {
    return null;
  }
  $estimated = aviation_edge_optional_string($leg, "estimatedTime");
  if ($estimated) {
    return $estimated;
  }
  return aviation_edge_optional_string($leg, "estimatedRunway");
}

function aviation_edge_delay_from_times($leg) {
  if (!is_array($leg)) {
    return null;
  }
  $scheduled = aviation_edge_parse_time(aviation_edge_optional_string($leg, "scheduledTime"));
  if (!$scheduled instanceof DateTime) {
    return null;
  }
  foreach (array("actualTime", "actualRunway", "estimatedTime", "estimatedRunway") as $key) {
    $point = aviation_edge_parse_time(aviation_edge_optional_string($leg, $key));
    if ($point instanceof DateTime) {
      return (int) round(($point->getTimestamp() - $scheduled->getTimestamp()) / 60);
    }
  }
  return aviation_edge_optional_int($leg, "delay");
}

function aviation_edge_arrival_delay_minutes($arr) {
  return aviation_edge_delay_from_times($arr);
}

function aviation_edge_departure_delay_minutes($dep) {
  return aviation_edge_delay_from_times($dep);
}

function aviation_edge_flight_needs_arrival_lookup($flight) {
  if (!is_array($flight) || !empty($flight["cancelled"])) {
    return false;
  }
  if ($flight["arrivalDelayMinutes"] !== null) {
    return false;
  }
  $arrival = isset($flight["arrival"]) && is_array($flight["arrival"]) ? $flight["arrival"] : array();
  return aviation_edge_leg_best_actual($arrival) === null && aviation_edge_leg_best_estimated($arrival) === null;
}

function aviation_edge_enrich_flight_from_row($flight, $row) {
  if (!is_array($flight) || !is_array($row)) {
    return $flight;
  }
  $arr = isset($row["arrival"]) && is_array($row["arrival"]) ? $row["arrival"] : array();
  $dep = isset($row["departure"]) && is_array($row["departure"]) ? $row["departure"] : array();
  if (isset($flight["arrival"]) && is_array($flight["arrival"])) {
    if (empty($flight["arrival"]["actual"])) {
      $actual = aviation_edge_leg_best_actual($arr);
      if ($actual) {
        $flight["arrival"]["actual"] = $actual;
      }
    }
    if (empty($flight["arrival"]["estimated"])) {
      $estimated = aviation_edge_leg_best_estimated($arr);
      if ($estimated) {
        $flight["arrival"]["estimated"] = $estimated;
      }
    }
  }
  if (isset($flight["departure"]) && is_array($flight["departure"])) {
    if (empty($flight["departure"]["actual"])) {
      $actual = aviation_edge_leg_best_actual($dep);
      if ($actual) {
        $flight["departure"]["actual"] = $actual;
      }
    }
    if (empty($flight["departure"]["estimated"])) {
      $estimated = aviation_edge_leg_best_estimated($dep);
      if ($estimated) {
        $flight["departure"]["estimated"] = $estimated;
      }
    }
  }
  $statusRaw = aviation_edge_optional_string($row, "status");
  $statusLower = strtolower((string) $statusRaw);
  if ($statusLower === "landed") {
    $flight["status"] = $statusRaw;
    $flight["flightStatus"] = aviation_edge_map_status($statusRaw, false, false);
  }
  if (empty($flight["cancelled"])) {
    $arrDelay = aviation_edge_arrival_delay_minutes($arr);
    if ($arrDelay !== null) {
      $flight["arrivalDelayMinutes"] = $arrDelay;
      $flight["arrivalDelayInferred"] = false;
    }
    $depDelay = aviation_edge_departure_delay_minutes($dep);
    if ($depDelay !== null) {
      $flight["departureDelayMinutes"] = $depDelay;
    }
  }
  return $flight;
}

function aviation_edge_infer_arrival_from_departure($flight) {
  if (!is_array($flight) || !empty($flight["cancelled"])) {
    return $flight;
  }
  if ($flight["arrivalDelayMinutes"] !== null) {
    return $flight;
  }
  $depDelay = isset($flight["departureDelayMinutes"]) ? $flight["departureDelayMinutes"] : null;
  if ($depDelay === null || (int) $depDelay <= 0) {
    return $flight;
  }
  $flight["arrivalDelayMinutes"] = (int) $depDelay;
  $flight["arrivalDelayInferred"] = true;
  return $flight;
}

function aviation_edge_normalize_row($row, $ident) {
  $flight = isset($row["flight"]) && is_array($row["flight"]) ? $row["flight"] : array();
  $dep = isset($row["departure"]) && is_array($row["departure"]) ? $row["departure"] : array();
  $arr = isset($row["arrival"]) && is_array($row["arrival"]) ? $row["arrival"] : array();
  $airline = isset($row["airline"]) && is_array($row["airline"]) ? $row["airline"] : array();
  $statusRaw = aviation_edge_optional_string($row, "status");
  $statusLower = strtolower((string) $statusRaw);
  $cancelled = $statusLower === "cancelled";
  $diverted = $statusLower === "diverted";
  $iataNumber = aviation_edge_optional_string($flight, "iataNumber");
  $flightNumber = $iataNumber
    ? strtoupper(preg_replace("/[\s\-]+/", "", $iataNumber))
    : $ident;
  $airlineIata = aviation_edge_optional_string($airline, "iataCode");
  if ($airlineIata) {
    $airlineIata = strtoupper($airlineIata);
  }
  $depTime = aviation_edge_optional_string($dep, "scheduledTime");
  $arrTime = aviation_edge_optional_string($arr, "scheduledTime");
  $depIata = aviation_edge_optional_string($dep, "iataCode");
  $arrIata = aviation_edge_optional_string($arr, "iataCode");
  return array(
    "id" => $flightNumber . "-" . ($depTime ? $depTime : $arrTime),
    "flightNumber" => $flightNumber,
    "airlineName" => aviation_edge_airline_name($airlineIata, aviation_edge_optional_string($airline, "name")),
    "flightStatus" => aviation_edge_map_status($statusRaw, $cancelled, $diverted),
    "status" => $statusRaw,
    "cancelled" => $cancelled,
    "diverted" => $diverted,
    "departureDelayMinutes" => $cancelled ? null : aviation_edge_departure_delay_minutes($dep),
    "arrivalDelayMinutes" => $cancelled ? null : aviation_edge_arrival_delay_minutes($arr),
    "dataProvider" => "aviation_edge",
    "providerVerifiedCancellation" => $cancelled ? true : false,
    "arrivalDelayInferred" => false,
    "departure" => array(
      "airportName" => null,
      "iata" => $depIata ? strtoupper($depIata) : null,
      "scheduled" => $depTime,
      "estimated" => aviation_edge_leg_best_estimated($dep),
      "actual" => aviation_edge_leg_best_actual($dep)
    ),
    "arrival" => array(
      "airportName" => null,
      "iata" => $arrIata ? strtoupper($arrIata) : null,
      "scheduled" => $arrTime,
      "estimated" => aviation_edge_leg_best_estimated($arr),
      "actual" => aviation_edge_leg_best_actual($arr)
    )
  );
}

function aviation_edge_airport_rows($json) {
  if (!is_array($json) || isset($json["error"])) {
    return array();
  }
  if (isset($json["codeIataAirport"])) {
    return array($json);
  }
  if (isset($json[0]) && is_array($json[0]) && (isset($json[0]["codeIataAirport"]) || isset($json[0]["nameAirport"]))) {
    return $json;
  }
  return aviation_edge_to_list($json);
}

function aviation_edge_to_list($json) {
  if (!is_array($json)) {
    return array();
  }
  if (isset($json["error"])) {
    return array();
  }
  if (isset($json["data"]) && is_array($json["data"]) && !isset($json["departure"]) && !isset($json["flight"])) {
    return aviation_edge_to_list($json["data"]);
  }
  if (isset($json["departure"]) || isset($json["flight"]) || isset($json["departureIata"]) || isset($json["depIata"])) {
    return array($json);
  }
  $out = array();
  foreach ($json as $row) {
    if (is_array($row)) {
      $out[] = $row;
    }
  }
  return $out;
}

/**
 * @return array{ok:bool,http:int,json:mixed,error:?string}
 */
function aviation_edge_http_get($path, $query, $timeout = 20) {
  $key = aviation_edge_api_key();
  if ($key === "") {
    return array("ok" => false, "http" => 0, "json" => null, "error" => "not_configured");
  }
  if (!function_exists("curl_init")) {
    return array("ok" => false, "http" => 0, "json" => null, "error" => "curl_missing");
  }
  $params = $query;
  $params["key"] = $key;
  $url = aviation_edge_api_host() . "/" . ltrim($path, "/") . "?" . http_build_query($params);
  $ch = curl_init($url);
  curl_setopt_array($ch, array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => array(
      "Accept: application/json",
      "User-Agent: BTP-FlightSearch/1.0"
    ),
    CURLOPT_TIMEOUT => (int) $timeout,
    CURLOPT_CONNECTTIMEOUT => 10
  ));
  $raw = curl_exec($ch);
  $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($raw === false) {
    flight_log("aviation_edge transport error path=" . $path);
    return array("ok" => false, "http" => $http, "json" => null, "error" => "timeout");
  }
  $json = json_decode($raw, true);
  if (!is_array($json)) {
    if ($http === 404) {
      return array("ok" => true, "http" => $http, "json" => array(), "error" => null);
    }
    flight_log("aviation_edge invalid json http=" . $http . " path=" . $path);
    return array("ok" => false, "http" => $http, "json" => null, "error" => "provider");
  }
  if (isset($json["error"])) {
    $msg = is_string($json["error"]) ? $json["error"] : "provider";
    $lower = strtolower($msg);
    if (strpos($lower, "no record") !== false || $http === 404) {
      return array("ok" => true, "http" => $http, "json" => array(), "error" => null);
    }
    flight_log("aviation_edge error path=" . $path);
    return array("ok" => false, "http" => $http, "json" => $json, "error" => "provider");
  }
  return array("ok" => true, "http" => $http, "json" => $json, "error" => null);
}

function aviation_edge_get_history($query) {
  return aviation_edge_http_get("flightsHistory", $query);
}

function aviation_edge_catalog_name($iata) {
  $iata = normalize_iata_code($iata);
  if ($iata === null) {
    return null;
  }
  $catalogPath = dirname(__DIR__) . "/airport-catalog.php";
  if (!function_exists("airport_catalog_by_iata")) {
    if (!is_readable($catalogPath)) {
      return null;
    }
    require_once $catalogPath;
  }
  if (!function_exists("airport_catalog_by_iata")) {
    return null;
  }
  $row = airport_catalog_by_iata($iata, false);
  return $row && !empty($row["name"]) ? $row["name"] : null;
}

function aviation_edge_row_matches($row, $ident, $date, $depIata, $arrIata) {
  if (!is_array($row)) {
    return false;
  }
  $parsed = parse_flight_ident($ident);
  if (!$parsed) {
    return false;
  }
  $flight = isset($row["flight"]) && is_array($row["flight"]) ? $row["flight"] : array();
  $dep = isset($row["departure"]) && is_array($row["departure"]) ? $row["departure"] : array();
  $arr = isset($row["arrival"]) && is_array($row["arrival"]) ? $row["arrival"] : array();
  $airline = isset($row["airline"]) && is_array($row["airline"]) ? $row["airline"] : array();
  $num = preg_replace("/^0+/", "", (string) aviation_edge_optional_string($flight, "number"));
  $wantNum = preg_replace("/^0+/", "", $parsed["flight_number"]);
  $iataN = strtoupper(preg_replace("/[\s\-]+/", "", (string) aviation_edge_optional_string($flight, "iataNumber")));
  $al = strtoupper((string) aviation_edge_optional_string($airline, "iataCode"));
  $rowDep = strtoupper((string) aviation_edge_optional_string($dep, "iataCode"));
  $rowArr = strtoupper((string) aviation_edge_optional_string($arr, "iataCode"));
  $sched = aviation_edge_optional_string($dep, "scheduledTime");
  $rowDate = $sched ? substr(str_replace("T", "t", $sched), 0, 10) : null;
  $numOk = ($num === $wantNum) || ($iataN === $ident);
  $alOk = ($al === "") || ($al === $parsed["airline_iata"]);
  $depOk = $rowDep === $depIata;
  $arrOk = $rowArr === $arrIata;
  $dateOk = ($rowDate === null) || ($rowDate === $date);
  return $numOk && $alOk && $depOk && $arrOk && $dateOk;
}

function aviation_edge_search($ident, $date, $depIata, $arrIata) {
  $parsed = parse_flight_ident($ident);
  $debug = array("historicalRequestCount" => 0, "finalMatchCount" => 0);
  if (!$parsed) {
    return array("ok" => false, "error" => "invalid_flight_number", "flights" => array(), "requests" => 0, "debug" => $debug);
  }
  $cacheKey = "aviation_edge:hist:v3:" . $ident . ":" . $date . ":" . $depIata . ":" . $arrIata;
  $cached = flight_cache_get($cacheKey);
  if (is_array($cached) && isset($cached["flights"]) && is_array($cached["flights"])) {
    $debug["finalMatchCount"] = count($cached["flights"]);
    return array("ok" => true, "error" => null, "flights" => $cached["flights"], "requests" => 0, "debug" => $debug);
  }

  $result = aviation_edge_get_history(array(
    "code" => $depIata,
    "type" => "departure",
    "date_from" => $date,
    "airline_iata" => $parsed["airline_iata"],
    "flight_number" => $parsed["flight_number"]
  ));
  $debug["historicalRequestCount"] = 1;
  if (!$result["ok"]) {
    return array(
      "ok" => false,
      "error" => $result["error"] === "not_configured" ? "not_configured" : "provider",
      "flights" => array(),
      "requests" => 1,
      "debug" => $debug
    );
  }

  $matched = array();
  foreach (aviation_edge_to_list($result["json"]) as $row) {
    if (!aviation_edge_row_matches($row, $ident, $date, $depIata, $arrIata)) {
      continue;
    }
    $flight = aviation_edge_normalize_row($row, $ident);
    $depName = aviation_edge_catalog_name($flight["departure"]["iata"]);
    $arrName = aviation_edge_catalog_name($flight["arrival"]["iata"]);
    if ($depName) {
      $flight["departure"]["airportName"] = $depName;
    }
    if ($arrName) {
      $flight["arrival"]["airportName"] = $arrName;
    }
    $matched[] = $flight;
  }

  if (count($matched) && aviation_edge_is_valid_iata($arrIata)) {
    $needsArrivalLookup = false;
    foreach ($matched as $flight) {
      if (aviation_edge_flight_needs_arrival_lookup($flight)) {
        $needsArrivalLookup = true;
        break;
      }
    }
    if ($needsArrivalLookup) {
      $arrResult = aviation_edge_get_history(array(
        "code" => $arrIata,
        "type" => "arrival",
        "date_from" => $date,
        "airline_iata" => $parsed["airline_iata"],
        "flight_number" => $parsed["flight_number"]
      ));
      $debug["historicalRequestCount"] = 2;
      if ($arrResult["ok"]) {
        foreach (aviation_edge_to_list($arrResult["json"]) as $row) {
          if (!aviation_edge_row_matches($row, $ident, $date, $depIata, $arrIata)) {
            continue;
          }
          for ($i = 0; $i < count($matched); $i++) {
            $matched[$i] = aviation_edge_enrich_flight_from_row($matched[$i], $row);
          }
        }
      }
    }
  }

  for ($i = 0; $i < count($matched); $i++) {
    $matched[$i] = aviation_edge_infer_arrival_from_departure($matched[$i]);
  }

  $debug["finalMatchCount"] = count($matched);
  $ttl = count($matched)
    ? (($date === flight_today_istanbul()->format("Y-m-d")) ? 1800 : 86400 * 7)
    : 7200;
  flight_cache_set($cacheKey, array("flights" => $matched), $ttl);
  $requests = isset($debug["historicalRequestCount"]) ? (int) $debug["historicalRequestCount"] : 1;
  return array("ok" => true, "error" => null, "flights" => $matched, "requests" => $requests, "debug" => $debug);
}

