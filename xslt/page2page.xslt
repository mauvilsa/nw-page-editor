<?xml version="1.0"?>
<!--
  - XSLT that transforms Page XMLs from various page versions to the internal page format.
  -
  - @version $Version: 2020.11.16$
  - @author Mauricio Villegas <mauricio_ville@yahoo.com>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
  - @license MIT License
  -->
<xsl:stylesheet
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:_1="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  xmlns:_2="http://schema.primaresearch.org/PAGE/gts/pagecontent/2015-09-01"
  xmlns:_3="http://schema.primaresearch.org/PAGE/gts/pagecontent/2016-07-15"
  xmlns:_4="http://schema.primaresearch.org/PAGE/gts/pagecontent/2017-07-15"
  xmlns:_5="http://schema.primaresearch.org/PAGE/gts/pagecontent/2018-07-15"
  xmlns:_6="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15"
  xmlns:_7="https://schema.omnius.com/pagesformat/2019.04.11"
  xmlns:_8="https://schema.omnius.com/pagesformat/2019.07.03"
  xmlns:_9="https://schema.omnius.com/pagesformat/2020.02.04"
  xmlns="https://github.com/mauvilsa/nw-page-editor"
  extension-element-prefixes="xsi"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:param name="xsltVersion" select="'2020.11.16'"/>

  <xsl:template match="@xsi:schemaLocation"/>

  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="*[local-name()='PcGts']">
    <xsl:element name="{local-name()}">
      <xsl:for-each select="namespace::*[name()='']">
        <xsl:attribute name="orig-xmlns">
          <xsl:value-of select="."/>
        </xsl:attribute>
      </xsl:for-each>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="*">
    <xsl:element name="{local-name()}">
      <xsl:apply-templates select="@* | node()"/>
    </xsl:element>
  </xsl:template>

</xsl:stylesheet>
