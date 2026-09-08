<?php
/**
 * Load repo-root .env into getenv() when the host has not set variables.
 * Does not override existing environment values.
 */
function flight_load_env() {
  $root = dirname(dirname(__DIR__));
  $path = $root . DIRECTORY_SEPARATOR . ".env";
  if (!is_readable($path)) {
    return;
  }
  $lines = file($path, FILE_IGNORE_NEW_LINES);
  if ($lines === false) {
    return;
  }
  foreach ($lines as $line) {
    $line = trim($line);
    if ($line === "" || $line[0] === "#") {
      continue;
    }
    if (strpos($line, "=") === false) {
      continue;
    }
    list($key, $value) = explode("=", $line, 2);
    $key = trim($key);
    $value = trim($value);
    if ($key === "") {
      continue;
    }
    if (strlen($value) >= 2) {
      $q = $value[0];
      if (($q === '"' || $q === "'") && substr($value, -1) === $q) {
        $value = substr($value, 1, -1);
      }
    }
    if (getenv($key) === false) {
      putenv($key . "=" . $value);
      $_ENV[$key] = $value;
    }
  }
}
