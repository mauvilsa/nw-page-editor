<?xml version="1.0"?>
<!--
  - XSLT that transforms Page XMLs to SVGs.
  -
  - @version $Version: 2018.03.13$
  - @author Mauricio Villegas <mauricio_ville@yahoo.com>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
  - @license MIT License
  -->
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:page="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns="http://www.w3.org/2000/svg"
  exclude-result-prefixes="page"
  version="1.0">

  <xsl:param name="svgns" select="'http://www.w3.org/2000/svg'"/>
  <xsl:param name="xlinkns" select="document('')/*/namespace::*[name()='xlink']"/>

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="page:*">
    <xsl:element name="{local-name()}" namespace="{$svgns}">
      <xsl:copy-of select="@*"/>
      <xsl:apply-templates/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="page:PcGts">
    <xsl:element name="svg" namespace="{$svgns}">
      <xsl:copy-of select="$xlinkns"/>
      <xsl:apply-templates select="node()"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="page:Page">
    <g class="{local-name()}">
      <image class="PageImage" width="{@imageWidth}" height="{@imageHeight}" data-href="{@imageFilename}" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=">
        <xsl:if test="page:ImageOrientation">
          <xsl:attribute name="orientation">
            <xsl:value-of select="page:ImageOrientation/@angle"/>
          </xsl:attribute>
        </xsl:if>
        <xsl:if test="page:ImageOrientation/@conf">
          <xsl:attribute name="orientation-conf">
            <xsl:value-of select="page:ImageOrientation/@conf"/>
          </xsl:attribute>
        </xsl:if>
      </image>
      <xsl:apply-templates select="node()"/>
    </g>
  </xsl:template>

  <xsl:template match="page:ImageOrientation"/>

  <xsl:template match="page:TextRegion | page:TableRegion | page:TextLine | page:Word | page:Glyph | page:Property | page:Relations | page:Relation | page:RegionRef">
    <g class="{local-name()}">
      <xsl:apply-templates select="@* | node()"/>
    </g>
  </xsl:template>

  <xsl:template match="@type">
    <xsl:attribute name="data-{local-name()}">
      <xsl:value-of select="."/>
    </xsl:attribute>
  </xsl:template>

  <xsl:template match="page:TextEquiv">
    <xsl:if test="page:Unicode[normalize-space()] or @conf">
      <text class="{local-name()}">
        <xsl:apply-templates select="@* | page:Unicode/node()"/>
      </text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="page:Coords">
    <polygon class="{local-name()}">
      <xsl:apply-templates select="@*"/>
    </polygon>
  </xsl:template>

  <xsl:template match="page:Baseline">
    <polyline class="{local-name()}">
      <xsl:apply-templates select="@*"/>
    </polyline>
  </xsl:template>

</xsl:stylesheet>
