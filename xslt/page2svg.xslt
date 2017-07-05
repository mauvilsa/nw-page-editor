<?xml version="1.0"?>
<!--
  - XSLT that transforms Page XMLs to SVGs.
  -
  - @version $Version: 2017.07.05$
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
      <image class="page_img" x="-0.5" y="-0.5" width="{@imageWidth}" height="{@imageHeight}" xlink:href="{@imageFilename}"/>
      <xsl:apply-templates select="node()"/>
    </g>
  </xsl:template>

  <xsl:template match="page:TextRegion | page:TableRegion">
    <g class="{local-name()} {@type}">
      <xsl:apply-templates select="@*[local-name()!='type'] | node()"/>
    </g>
  </xsl:template>

  <xsl:template match="page:TextLine | page:Word | page:Glyph">
    <g class="{local-name()}">
      <xsl:apply-templates select="@* | node()"/>
    </g>
  </xsl:template>

  <xsl:template match="page:TextEquiv">
    <xsl:if test="page:Unicode[normalize-space()]">
      <text class="TextEquiv">
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
