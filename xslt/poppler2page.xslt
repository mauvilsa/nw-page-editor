<?xml version="1.0"?>
<!--
  - XSLT that transforms poppler's pdftotext xhtml to Page XML.
  -
  - @version $Version: 2020.11.16$
  - @author Mauricio Villegas <mauricio@omnius.com>
  - @copyright Copyright(c) 2018-present, Mauricio Villegas <mauricio@omnius.com>
  -->
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:_="http://www.w3.org/1999/xhtml"
  xmlns="https://github.com/mauvilsa/nw-page-editor"
  exclude-result-prefixes="_"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:param name="xsltVersion" select="'2020.11.16'"/>
  <xsl:param name="filename"/>
  <xsl:param name="createdate"/>

  <!-- By default copy everything -->
  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <!-- Elements to skip to the children -->
  <xsl:template match="_:body | _:doc | _:flow | _:block">
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- Root element -->
  <xsl:template match="_:html">
    <PcGts>
      <xsl:apply-templates select="node()"/>
    </PcGts>
  </xsl:template>

  <!-- head element -->
  <xsl:template match="_:head">
    <Metadata>
      <Creator><xsl:value-of select="concat('pdftotext + poppler2page.xslt v',$xsltVersion,' (PDF creator: ',_:meta[@name='Creator']/@content,'; PDF producer: ',_:meta[@name='Producer']/@content)"/></Creator>
      <Created><xsl:value-of select="$createdate"/></Created>
      <LastChange><xsl:value-of select="$createdate"/></LastChange>
    </Metadata>
  </xsl:template>

  <!-- page elements -->
  <xsl:template match="_:page">
    <xsl:variable name="fact">
      <xsl:call-template name="scaleFactor"/>
    </xsl:variable>
    <Page imageWidth="{round($fact*@width)}" imageHeight="{round($fact*@height)}">
      <xsl:attribute name="imageFilename">
        <xsl:value-of select="concat($filename,'[',count(preceding-sibling::_:page),']')"/>
      </xsl:attribute>
      <xsl:apply-templates select="node()"/>
    </Page>
  </xsl:template>

  <!-- block/line as TextLine -->
  <xsl:template match="_:block/_:line">
    <xsl:variable name="pg" select="count(ancestor::_:page/preceding-sibling::_:page)+1"/>
    <xsl:variable name="fl" select="count(ancestor::_:flow/preceding-sibling::_:flow)+1"/>
    <xsl:variable name="bk" select="count(ancestor::_:block/preceding-sibling::_:block)+1"/>
    <xsl:variable name="ln" select="count(preceding-sibling::_:line)+1"/>
    <TextLine id="{concat('pg',$pg,'_f',$fl,'_b',$bk,'_l',$ln)}">
      <xsl:call-template name="outputCoords"/>
      <xsl:apply-templates select="node()"/>
    </TextLine>
  </xsl:template>

  <!-- word as Word with TextEquiv -->
  <xsl:template match="_:word[not(text())]"/>
  <xsl:template match="_:line/_:word[text()]">
    <xsl:variable name="pg" select="count(ancestor::_:page/preceding-sibling::_:page)+1"/>
    <xsl:variable name="fl" select="count(ancestor::_:flow/preceding-sibling::_:flow)+1"/>
    <xsl:variable name="bk" select="count(ancestor::_:block/preceding-sibling::_:block)+1"/>
    <xsl:variable name="ln" select="count(ancestor::_:line/preceding-sibling::_:line)+1"/>
    <xsl:variable name="wd" select="count(preceding-sibling::_:word)+1"/>
    <Word id="{concat('pg',$pg,'_f',$fl,'_b',$bk,'_l',$ln,'_w',$wd)}">
      <xsl:call-template name="outputCoords"/>
      <TextEquiv>
        <Unicode><xsl:value-of select="text()"/></Unicode>
      </TextEquiv>
    </Word>
  </xsl:template>

  <!-- Output Coords callable template -->
  <xsl:template name="outputCoords">
    <xsl:variable name="fact">
      <xsl:call-template name="scaleFactor"/>
    </xsl:variable>
    <xsl:variable name="x1" select="floor($fact*@xMin)"/>
    <xsl:variable name="y1" select="floor($fact*@yMin)"/>
    <xsl:variable name="x2" select="ceiling($fact*@xMax)"/>
    <xsl:variable name="y2" select="ceiling($fact*@yMax)"/>
    <Coords points="{concat($x1,',',$y1,' ',$x2,',',$y1,' ',$x2,',',$y2,' ',$x1,',',$y2)}"/>
  </xsl:template>

  <!-- Template to compute scale factor -->
  <xsl:template name="scaleFactor">
    <xsl:param name="pwidth" select="number(ancestor-or-self::_:page/@width)"/>
    <xsl:param name="pheight" select="number(ancestor-or-self::_:page/@height)"/>
    <xsl:param name="fact" select="(300.0 div 72.0) * 0.5 * ( (round($pwidth) div $pwidth) + (round($pheight) div $pheight) )"/>
    <xsl:value-of select="$fact"/>
  </xsl:template>

</xsl:stylesheet>
