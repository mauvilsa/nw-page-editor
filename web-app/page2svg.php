<?php
/**
 * Transforms a Page XML to SVG using XSLT.
 *
 * @version $Version: 2017.09.24$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2017-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

require_once('common.inc.php');

/// Accept any of GET, POST and command line ///
$_GET = array_merge( $_GET, $_POST );
if( ! isset($_SERVER['HTTP_HOST']) )
  for( $k = 1; $k < count($argv); $k++ ) {
    parse_str( $argv[$k], $a );
    $_GET = array_merge( $_GET, $a );
  }

/// Initialize XSLT ///
$xslt = new xsltProcessor();
$xslt->importStyleSheet(DomDocument::load('../xslt/page2svg.xslt'));

/// Print transformed document ///
header("Content-type: text/xml; charset=utf-8");
print $xslt->transformToXML(DomDocument::load($_GET['f']));
?>
