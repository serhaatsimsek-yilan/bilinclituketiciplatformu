<?php
/**
 * Shared Formspree client used by server-side forms.
 * Same inbox as "Bize Yazın" (form id xdardvrj) unless FORMSPREE_ENDPOINT is set.
 */

function formspree_endpoint() {
  $fromEnv = getenv("FORMSPREE_ENDPOINT");
  if (is_string($fromEnv) && trim($fromEnv) !== "") {
    return trim($fromEnv);
  }
  return "https://formspree.io/f/xdardvrj";
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

  $ch = curl_init($endpoint);
  curl_setopt_array($ch, array(
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $post,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => array("Accept: application/json"),
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
