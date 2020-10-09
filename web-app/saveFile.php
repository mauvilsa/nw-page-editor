<?php
/**
 * Saves Page XML files and if configured, requests the file to be commited to git.
 *
 * @version $Version: 2020.10.09$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2017-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

require_once('common.inc.php');

$ddir = getcwd().'/git-daemon';

/// Prepare response ///
$resp = (Object)null;
$resp->code = 200;

/// Accept any of GET, POST and command line ///
$_GET = array_merge( $_GET, $_POST );
if( ! isset($_SERVER['HTTP_HOST']) )
  for( $k = 1; $k < count($argv); $k++ ) {
    parse_str( $argv[$k], $a );
    $_GET = array_merge( $_GET, $a );
  }

/// Check expected parameters ///
$expected = array('fname','xml');
if( file_exists('/var/www/nw-page-editor/data/.git/config') ) {
  $expected = array_merge($expected, array('uname','brhash','page_editor_version'));
}
foreach ( $expected as $v ) {
  if ( empty($_GET[$v]) ) {
    $resp->code = 400;
    $resp->message = 'expected parameter not defined or empty: '.$v;
    echo json_encode($resp)."\n";
    exit($resp->code);
  }
}

/// Validate received XML ///
$numtemp = (int)shell_exec('ls '.$_GET['fname'].'~* 2>/dev/null | wc -l');
$svg2page = new xsltProcessor();
$svg2page->importStyleSheet(DomDocument::load('../xslt/svg2page.xslt'));
$sortattr = new xsltProcessor();
$sortattr->importStyleSheet(DomDocument::load('../xslt/sortattr.xslt'));
$pagexml = $svg2page->transformToXML(DomDocument::loadXML($_GET['xml']));
$pagexml = $sortattr->transformToXML(DomDocument::loadXML($pagexml));
$bytes = file_put_contents($_GET['fname'].'~'.$numtemp,$pagexml);
if( ! $bytes ) {
  $resp->code = 400;
  $resp->message = 'Problems writing to temporal file';
  echo json_encode($resp)."\n";
  exit($resp->code);
}
exec("sed -n -r '/ xmlns=\"[^\"]+\"/{ s|.* xmlns=\"||; s|\".*||; p; }' ../xsd/pagecontent_omnius.xsd",$ns_schema,$rc1);
exec("sed -r '/ xmlns=\"[^\"]+\"/{ s| xmlns=\"[^\"]+\"| xmlns=\"".$ns_schema[0]."\"|; }' ".$_GET['fname'].'~'.$numtemp,$output,$rc2);
if( $rc1 != 0 || $rc2 != 0 ) {
  file_put_contents($_GET['fname'].'.svg~'.$numtemp,$_GET['xml']);
  $resp->code = 400;
  $resp->message = "Problems handling namespace of schema.";
  echo json_encode($resp)."\n";
  exit($resp->code);
}
file_put_contents($_GET['fname'].'~'.$numtemp.'-',implode("\n",$output));
$cmd = 'xmllint --noout --schema ../xsd/pagecontent_omnius.xsd '.$_GET['fname'].'~'.$numtemp.'- 2>&1';
unset($output);
exec($cmd,$output,$valid);
if( $valid != 0 ) {
  file_put_contents($_GET['fname'].'.svg~'.$numtemp,$_GET['xml']);
  $resp->code = 400;
  $resp->message = "Page XML schema validation failed:\n".implode("\n",$output);
  echo json_encode($resp)."\n";
  exit($resp->code);
}
unlink($_GET['fname'].'~'.$numtemp.'-');

/// Rename temporal XML ///
$bytes = rename( $_GET['fname'].'~'.$numtemp, $_GET['fname'] );
if( ! $bytes ) {
  $resp->code = 400;
  $resp->message = 'Problems replacing file '.$_GET['fname'];
  echo json_encode($resp)."\n";
  exit($resp->code);
}

/// Commit to git repository ///
if( file_exists('/var/www/nw-page-editor/data/.git/config') ) {
  $pid = trim(file_get_contents($ddir.'/pid'));
  if ( ! $pid || ! posix_getpgid(intval($pid)) ) {
    //$resp->code = 400;
    $resp->message = 'git-commit-daemon apparently not running. Current changes saved in server, but not committed.';
    echo json_encode($resp)."\n";
    exit($resp->code);
  }

  /// Monitor daemon finished list ///
  $tail = proc_open('tail --pid=$$ -fn 0 '.$ddir.'/git-commit-done', array( 1 => Array('pipe','w') ), $pipes);
  $job_id = $_GET['uname'].':'.$_GET['brhash'].':'.$_GET['page_editor_version'].':'.$_GET['fname'];

  /// Add XML to daemon queue ///
  file_put_contents( $ddir.'/git-commit-queue', $job_id."\n", FILE_APPEND | LOCK_EX );

  /// Wait until daemon finishes processing the requested page ///
  while( ! feof($pipes[1]) ) {
    $line = fgets($pipes[1]);
    list($name, $rc, $msg) = explode(' ', trim($line), 3) + array(NULL, NULL);
    if( $name == $job_id )
      break;
  }
  posix_kill(proc_get_status($tail)['pid'], 9);
  proc_close($tail);

  if( $rc != 0 ) {
    $resp->code = 400;
    $resp->message = 'Problems committing to git repository: '.$msg;
  }
}

echo json_encode($resp)."\n";
exit($resp->code);
?>
