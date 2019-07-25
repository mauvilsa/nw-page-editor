<?xml version="1.0"?>
<!--
  - XSLT that transforms Page XMLs from version 2017-07-15 to 2013-07-15.
  -
  - @version $Version: 2019.07.25$
  - @author Mauricio Villegas <mauricio_ville@yahoo.com>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
  - @license MIT License
  -->
<xsl:stylesheet
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:_="https://schema.omnius.com/pagesformat/2019.07.03"
  xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  extension-element-prefixes="xsi _"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:param name="xsltVersion" select="'2019.07.25'"/>

  <xsl:template match="@xsi:schemaLocation"/>

  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="_:*">
    <xsl:element name="{local-name()}">
      <xsl:apply-templates select="@* | node()"/>
    </xsl:element>
  </xsl:template>

</xsl:stylesheet>
