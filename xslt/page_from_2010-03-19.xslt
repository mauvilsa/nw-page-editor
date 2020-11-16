<?xml version="1.0"?>
<!--
  - XSLT that transforms Page XMLs from version 2010-03-19 to the internal page format.
  -
  - @version $Version: 2020.11.16$
  - @author Mauricio Villegas <mauricio_ville@yahoo.com>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
  - @license MIT License
  -->
<xsl:stylesheet
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:_="http://schema.primaresearch.org/PAGE/gts/pagecontent/2010-03-19"
  xmlns="https://github.com/mauvilsa/nw-page-editor"
  extension-element-prefixes="xsi _"
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

  <xsl:template match="_:*">
    <xsl:element name="{local-name()}">
      <xsl:apply-templates select="@* | node()"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="//_:Coords">
    <Coords>
      <xsl:attribute name="points">
        <xsl:for-each select="_:Point">
          <xsl:choose>
            <xsl:when test="position() = 1">
              <xsl:value-of select="concat(@x,',',@y)"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="concat(' ',@x,',',@y)"/>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:for-each>
      </xsl:attribute>
    </Coords>
  </xsl:template>

</xsl:stylesheet>
