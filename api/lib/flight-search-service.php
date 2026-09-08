<?php
require_once __DIR__ . "/flight-config.php";
require_once __DIR__ . "/flight-cache.php";
require_once __DIR__ . "/flight-common.php";
require_once __DIR__ . "/flight-providers/aviation-edge.php";

function flight_user_messages() {
  return array(
    "FLIGHT_TOO_RECENT" => "Bu uçuş çok yakın tarihli olduğu için kesinleşmiş uçuş bilgileri henüz sistemimize yansımamış olabilir. Başvurunuza devam edebilirsiniz.",
    "HISTORICAL_LIMIT" => "Bu uçuş için otomatik uçuş kaydına ulaşılamadı. Başvurunuza devam edebilirsiniz; uçuş bilgileriniz ekibimiz tarafından ayrıca incelenecektir.",
    "FLIGHT_NOT_FOUND" => "Uçuş bilgileri otomatik olarak doğrulanamadı. Uçuşunuz iptal edilmiş veya veri sağlayıcımızın geçmiş kayıtlarında bulunmuyor olabilir. Başvurunuza devam edebilirsiniz.",
    "PROVIDER_ERROR" => "Uçuş bilgileri şu anda otomatik olarak alınamadı. Başvurunuza devam edebilirsiniz."
  );
}

function flight_empty_debug() {
  return array(
    "historicalRequestCount" => 0,
    "finalMatchCount" => 0
  );
}

function flight_soft_fail($code, $requests, $debug = null) {
  $messages = flight_user_messages();
  return array(
    "ok" => false,
    "code" => $code,
    "message" => isset($messages[$code]) ? $messages[$code] : $messages["PROVIDER_ERROR"],
    "flights" => array(),
    "manualReviewRequired" => true,
    "canContinue" => true,
    "providerVerifiedCancellation" => null,
    "requests" => (int) $requests,
    "debug" => is_array($debug) ? $debug : flight_empty_debug()
  );
}

function search_flights_for_claim($ident, $date, $depIata, $arrIata) {
  $minAge = aviation_edge_min_age_days();
  $maxAge = aviation_edge_history_days();
  $age = flight_age_days($date);
  if ($age === null) {
    return array(
      "ok" => false,
      "code" => "invalid_date",
      "message" => "Lütfen geçerli bir tarih seçin. Gelecek tarih seçilemez.",
      "flights" => array(),
      "canContinue" => false,
      "requests" => 0,
      "debug" => flight_empty_debug()
    );
  }
  if ($age < $minAge) {
    return flight_soft_fail("FLIGHT_TOO_RECENT", 0);
  }
  if ($age > $maxAge) {
    return flight_soft_fail("HISTORICAL_LIMIT", 0);
  }

  $cacheKey = "aviation_edge:search:v4:" . $ident . ":" . $date . ":" . $depIata . ":" . $arrIata;
  $cached = flight_cache_get($cacheKey);
  if (is_array($cached) && array_key_exists("ok", $cached)) {
    $cached["cached"] = true;
    $cached["requests"] = 0;
    if (isset($cached["debug"]) && is_array($cached["debug"])) {
      $cached["debug"]["historicalRequestCount"] = 0;
    }
    return $cached;
  }

  if (aviation_edge_api_key() === "") {
    return array(
      "ok" => false,
      "code" => "not_configured",
      "message" => "Uçuş bilgileri şu anda alınamıyor. Lütfen kısa süre sonra tekrar deneyin.",
      "flights" => array(),
      "canContinue" => true,
      "manualReviewRequired" => true,
      "requests" => 0,
      "debug" => flight_empty_debug()
    );
  }

  $result = aviation_edge_search($ident, $date, $depIata, $arrIata);
  $used = isset($result["requests"]) ? (int) $result["requests"] : 0;
  $debug = isset($result["debug"]) && is_array($result["debug"]) ? $result["debug"] : flight_empty_debug();
  if (!$result["ok"]) {
    if ($result["error"] === "not_configured") {
      return array(
        "ok" => false,
        "code" => "not_configured",
        "message" => "Uçuş bilgileri şu anda alınamıyor. Lütfen kısa süre sonra tekrar deneyin.",
        "flights" => array(),
        "canContinue" => true,
        "manualReviewRequired" => true,
        "requests" => $used,
        "debug" => $debug
      );
    }
    return flight_soft_fail("PROVIDER_ERROR", $used, $debug);
  }

  $flights = $result["flights"];
  if (!count($flights)) {
    $out = flight_soft_fail("FLIGHT_NOT_FOUND", $used, $debug);
    flight_cache_set($cacheKey, $out, 7200);
    $out["cached"] = false;
    return $out;
  }

  $verifiedCancel = false;
  foreach ($flights as $f) {
    if (!empty($f["cancelled"])) {
      $verifiedCancel = true;
      break;
    }
  }
  $out = array(
    "ok" => true,
    "code" => null,
    "message" => null,
    "flights" => $flights,
    "manualReviewRequired" => false,
    "canContinue" => true,
    "providerVerifiedCancellation" => $verifiedCancel ? true : false,
    "requests" => $used,
    "debug" => $debug
  );
  $ttl = ($date === flight_today_istanbul()->format("Y-m-d")) ? 1800 : 86400 * 7;
  flight_cache_set($cacheKey, $out, $ttl);
  $out["cached"] = false;
  return $out;
}
