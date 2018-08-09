<?xml version="1.0"?>
<!--
  - XSLT that transforms SVGs to Page XMLs.
  -
  - @version $Version: 2018.08.09$
  - @author Mauricio Villegas <mauricio_ville@yahoo.com>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
  - @license MIT License
  -->
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:page="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="page:PcGts">
    <xsl:copy>
      <xsl:apply-templates select="@*"/>
      <xsl:apply-templates select="page:Metadata"/>
      <xsl:apply-templates select="page:Property"/>
      <xsl:apply-templates select="page:Page"/>
      <xsl:apply-templates select="node()[not(contains(' Metadata Property Page ',concat(' ',local-name(),' ')))]"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="*[page:Coords or page:Baseline or page:TextEquiv]">
    <xsl:copy>
      <xsl:apply-templates select="@*"/>
      <xsl:apply-templates select="page:ImageOrientation"/>
      <xsl:apply-templates select="page:Property"/>
      <xsl:apply-templates select="page:Coords"/>
      <xsl:apply-templates select="page:Baseline"/>
      <xsl:apply-templates select="page:TextLine | page:Word | page:Glyph"/>
      <xsl:apply-templates select="page:TextEquiv"/>
      <xsl:apply-templates select="node()[not(contains(' ImageOrientation Property Coords Baseline TextLine Word Glyph TextEquiv ',concat(' ',local-name(),' ')))]"/>
    </xsl:copy>
  </xsl:template>

</xsl:stylesheet>
