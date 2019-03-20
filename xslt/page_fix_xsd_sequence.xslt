<?xml version="1.0"?>
<!--
  - XSLT that fixes the order of elements in Page XMLs.
  -
  - @version $Version: 2019.03.20$
  - @author Mauricio Villegas <mauricio_ville@yahoo.com>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
  - @license MIT License
  -->
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="*[local-name()='PcGts']">
    <xsl:copy>
      <xsl:apply-templates select="@*"/>
      <xsl:apply-templates select="*[local-name()='Metadata']"/>
      <xsl:apply-templates select="*[local-name()='Property']"/>
      <xsl:apply-templates select="*[local-name()='Page']"/>
      <xsl:apply-templates select="node()[not(contains(' Metadata Property Page ',concat(' ',local-name(),' ')))]"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="*[*[local-name()='Coords' or local-name()='Baseline' or local-name()='TextEquiv']]">
    <xsl:copy>
      <xsl:apply-templates select="@*"/>
      <xsl:apply-templates select="*[local-name()='ImageOrientation']"/>
      <xsl:apply-templates select="*[local-name()='Property']"/>
      <xsl:apply-templates select="*[local-name()='Coords']"/>
      <xsl:apply-templates select="*[local-name()='Baseline']"/>
      <xsl:apply-templates select="*[local-name()='TextLine' or local-name()='Word' or local-name()='Glyph']"/>
      <xsl:apply-templates select="*[local-name()='TextEquiv']"/>
      <xsl:apply-templates select="node()[not(contains(' ImageOrientation Property Coords Baseline TextLine Word Glyph TextEquiv ',concat(' ',local-name(),' ')))]"/>
    </xsl:copy>
  </xsl:template>

</xsl:stylesheet>
