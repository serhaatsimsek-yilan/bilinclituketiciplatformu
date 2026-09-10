<?php
/**
 * Shared Formspree client used by server-side forms.
 * Set FORMSPREE_ENDPOINT in local-config.php or .env (form verified for infobilinclituketiciplatformu@gmail.com).
 */

require_once __DIR__ . "/flight-config.php";

function formspree_endpoint() {
  $configured = flight_config_string("FORMSPREE_ENDPOINT", "");
  if ($configured !== "") {
    return $configured;
  }
  return "https://formspree.io/f/xppzknyn";
}

/**
 * @param array $fields string => string
 * @param array $files  fieldName => array{tmp_name,type,name}
 * @return array{ok:bool,http:int,body:string,error:?string}
 */
function formspree_send(array $fields, array $files = array()) {
  if (!function_exists("curl_init")) {
    return array("ok" => false, "http" => 0, "body" => "", "error" => "curl_missing");
  }

  $endpoint = formspree_endpoint();
  $post = $fields;
  foreach ($files as $name => $file) {
    $post[$name] = new CURLFile($file["tmp_name"], $file["type"], $file["name"]);
  }

  $siteOrigin = flight_config_string("SITE_ORIGIN", "https://bilinclituketiciplatformu.com");
  $referer = rtrim($siteOrigin, "/") . "/ucus-tazminati.html";

  $ch = curl_init($endpoint);
  curl_setopt_array($ch, array(
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $post,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => array("Accept: application/json", "Referer: " . $referer),
    CURLOPT_TIMEOUT => 45,
    CURLOPT_CONNECTTIMEOUT => 15
  ));
  $raw = curl_exec($ch);
  $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);

  if ($raw === false) {
    return array("ok" => false, "http" => $http, "body" => "", "error" => $err ?: "curl_failed");
  }
  return array(
    "ok" => $http >= 200 && $http < 300,
    "http" => $http,
    "body" => $raw,
    "error" => $http >= 200 && $http < 300 ? null : "formspree_http_" . $http
  );
}
