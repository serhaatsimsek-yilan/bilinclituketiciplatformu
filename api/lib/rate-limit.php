<?php
/**
 * Simple per-IP rate limit using temp files.
 */
function flight_client_ip() {
  $ip = isset($_SERVER["REMOTE_ADDR"]) ? (string) $_SERVER["REMOTE_ADDR"] : "0.0.0.0";
  if (strlen($ip) > 64) {
    $ip = substr($ip, 0, 64);
  }
  return $ip;
}

function flight_rate_limit_ok($bucket, $maxHits, $windowSeconds) {
  $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . "btp-flight-ratelimit";
  if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
  }
  if (!is_dir($dir) || !is_writable($dir)) {
    return true;
  }
  $path = $dir . DIRECTORY_SEPARATOR . hash("sha256", $bucket) . ".json";
  $now = time();
  $hits = array();
  if (is_readable($path)) {
    $raw = file_get_contents($path);
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
      $hits = $decoded;
    }
  }
  $fresh = array();
  foreach ($hits as $ts) {
    if ((int) $ts > $now - $windowSeconds) {
      $fresh[] = (int) $ts;
    }
  }
  if (count($fresh) >= $maxHits) {
    return false;
  }
  $fresh[] = $now;
  @file_put_contents($path, json_encode($fresh), LOCK_EX);
  return true;
}
