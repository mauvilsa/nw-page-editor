<?php
// APR1-MD5 encryption method (windows compatible)
// https://www.linuxquestions.org/questions/programming-9/php-how-to-validate-a-password-from-htpasswd-4175589072/
function crypt_apr1_md5( $plainpasswd, $salt ) {
  $tmp = "";
  $len = strlen($plainpasswd);
  $text = $plainpasswd.'$apr1$'.$salt;
  $bin = pack("H32", md5($plainpasswd.$salt.$plainpasswd));
  for ( $i = $len; $i > 0; $i -= 16 ) { $text .= substr($bin, 0, min(16, $i)); }
  for ( $i = $len; $i > 0; $i >>= 1 ) { $text .= ($i & 1) ? chr(0) : $plainpasswd{0}; }
  $bin = pack("H32", md5($text));
  for ( $i = 0; $i < 1000; $i++ ) {
    $new = ($i & 1) ? $plainpasswd : $bin;
    if ( $i % 3 ) $new .= $salt;
    if ( $i % 7 ) $new .= $plainpasswd;
    $new .= ($i & 1) ? $bin : $plainpasswd;
    $bin = pack("H32", md5($new));
  }
  for ( $i = 0; $i < 5; $i++ ) {
    $k = $i + 6;
    $j = $i + 12;
    if ( $j == 16 ) $j = 5;
    $tmp = $bin[$i].$bin[$k].$bin[$j].$tmp;
  }
  $tmp = chr(0).chr(0).$bin[11].$tmp;
  $tmp = strtr(strrev(substr(base64_encode($tmp), 2)),
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
  "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

  return "$"."apr1"."$".$salt."$".$tmp;
}

function get_htpasswd( $passwdFile, $username ) {
  $lines = file($passwdFile);
  foreach ( $lines as $line ) {
    $arr = explode(":", $line);
    $fileUsername = $arr[0];
    if ( $fileUsername == $username ) {
      $filePasswd = trim($arr[1]);
      return $filePasswd;
    }
  }
  return false;
}

function test_htpasswd( $htpasswdfile, $realm, $lifetime = 600, $path = '/' ) {
  $unauth = "<body><h1>Unauthorized</h1><p>This server could not verify that you are authorized to access the document requested. Either you supplied the wrong credentials (e.g., bad password), or your browser doesn't understand how to supply the credentials required.</p></body>";

  if ( isset($_SESSION) ) {
    if ( isset($_SERVER['PHP_AUTH_USER']) ) {
      $_SESSION['PHP_AUTH_USER'] = $_SERVER['PHP_AUTH_USER'];
      $_SESSION['PHP_AUTH_PW']   = $_SERVER['PHP_AUTH_PW'];
    }
    $session = $_SESSION;
  }
  elseif ( isset($_COOKIE['PHP_AUTH_USER']) )
    $session = $_COOKIE;
  else
    $session = $_SERVER;

  if ( ! file_exists($htpasswdfile) ) {
    http_response_code(500);
    exit;
  }
  if ( ! isset($session['PHP_AUTH_USER']) ) {
    http_response_code(401);
    header('WWW-Authenticate: Basic realm="'.$realm.'"');
    die($unauth);
  }

  $filePasswd = get_htpasswd( $htpasswdfile, $session['PHP_AUTH_USER'] );

  if ( strpos($filePasswd, '$apr1') === 0 ) {
    // MD5
    $passParts = explode('$', $filePasswd);
    $salt = $passParts[2];
    $hashed = isset($session['PHP_AUTH_HS']) ?
      $session['PHP_AUTH_HS']:
      crypt_apr1_md5($session['PHP_AUTH_PW'], $salt);
  }
  elseif ( strpos($filePasswd, '{SHA}') === 0 ) {
    // SHA1
    $hashed = isset($session['PHP_AUTH_HS']) ?
      $session['PHP_AUTH_HS']:
      "{SHA}" . base64_encode(sha1($session['PHP_AUTH_PW'], TRUE));
  }
  elseif ( strpos($filePasswd, '$2y$') === 0 ) {
    // Bcrypt
    $hashed = isset($session['PHP_AUTH_HS']) ?
      $session['PHP_AUTH_HS']:
      password_hash($session['PHP_AUTH_PW'], PASSWORD_BCRYPT);
  }
  else {
    // Crypt
    $salt = substr($filePasswd, 0, 2);
    $hashed = isset($session['PHP_AUTH_HS']) ?
      $session['PHP_AUTH_HS']:
      crypt($session['PHP_AUTH_PW'], $salt);
  }

  if ( $hashed != $filePasswd ) {
    logout_htpasswd();
    die($unauth);
  }

  if ( isset($_SESSION) ) {
    if ( isset($_SESSION['PHP_AUTH_PW']) ) {
      unset($_SESSION['PHP_AUTH_PW']);
      $_SESSION['PHP_AUTH_HS'] = $hashed;
    }
  }
  else if ( ! isset($_COOKIE['PHP_AUTH_USER']) ) {
    $_COOKIE['PHP_AUTH_USER'] = $session['PHP_AUTH_USER'];
    $lifetime += time();
    setcookie('PHP_AUTH_USER', $session['PHP_AUTH_USER'], $lifetime, $path );
    setcookie('PHP_AUTH_HS', $hashed, $lifetime, $path );
  }
}

function logout_htpasswd( $path = '/' ) {
  if ( isset($_SESSION) ) {
    unset($_SESSION['PHP_AUTH_USER']);
    unset($_SESSION['PHP_AUTH_HS']);
  }
  if ( isset($_COOKIE['PHP_AUTH_USER']) ) {
    header('Set-Cookie: PHP_AUTH_USER=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; path='.$path, false);
    header('Set-Cookie: PHP_AUTH_HS=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; path='.$path, false);
  }
  if ( isset($_SERVER['PHP_AUTH_USER']) )
    http_response_code(401);
}
