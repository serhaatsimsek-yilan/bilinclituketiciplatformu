<?php
/**
 * File cache. No Redis. Keys are hashed; values are JSON.
 */
function flight_cache_dir() {
  $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . "btp-flight-cache";
  if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
  }
  return is_dir($dir) && is_writable($dir) ? $dir : null;
}

function flight_cache_get($key) {
  $dir = flight_cache_dir();
  if ($dir === null) {
    return null;
  }
  $path = $dir . DIRECTORY_SEPARATOR . hash("sha256", $key) . ".json";
  if (!is_readable($path)) {
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

function flight_cache_set($key, $data, $ttlSeconds) {
  $dir = flight_cache_dir();
  if ($dir === null) {
    return;
  }
  $path = $dir . DIRECTORY_SEPARATOR . hash("sha256", $key) . ".json";
  $payload = json_encode(array(
    "exp" => time() + (int) $ttlSeconds,
    "data" => $data
  ));
  @file_put_contents($path, $payload, LOCK_EX);
}
