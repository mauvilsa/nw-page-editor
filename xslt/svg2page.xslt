<?xml version="1.0"?>
<!--
  - XSLT that transforms SVGs to Page XMLs.
  -
  - @version $Version: 2019.02.17$
  - @author Mauricio Villegas <mauricio_ville@yahoo.com>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
  - @license MIT License
  -->
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:svg="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  exclude-result-prefixes="svg xlink"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:param name="xsltVersion" select="'2019.02.17'"/>

  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="svg:*">
    <xsl:element name="{local-name()}">
      <xsl:copy-of select="@*"/>
      <xsl:apply-templates/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="svg:svg">
    <xsl:element name="PcGts">
      <xsl:apply-templates select="node()"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="svg:g[@class='Page']">
    <Page imageFilename="{svg:image/@data-href}" imageHeight="{svg:image/@height}" imageWidth="{svg:image/@width}">
      <xsl:if test="svg:image/@orientation and svg:image/@orientation != '' and not(svg:image/@orientation = '0' and not(svg:image/@orientation-conf))">
        <ImageOrientation>
          <xsl:attribute name="angle">
            <xsl:value-of select="svg:image/@orientation"/>
          </xsl:attribute>
          <xsl:if test="svg:image/@orientation-conf">
            <xsl:attribute name="conf">
              <xsl:value-of select="svg:image/@orientation-conf"/>
            </xsl:attribute>
          </xsl:if>
        </ImageOrientation>
      </xsl:if>
      <xsl:apply-templates select="node()"/>
    </Page>
  </xsl:template>

  <xsl:template match="svg:image"/>
  <xsl:template match="@style"/>

  <xsl:template match="svg:g[@class='TextRegion' or @class='TableRegion' or @class='TextLine' or @class='Word' or @class='Glyph' or @class='Property' or @class='Relations' or @class='Relation' or @class='RegionRef' or @class='ImageRegion' or @class='SeparatorRegion']">
    <xsl:element name="{@class}">
      <xsl:apply-templates select="@*[local-name()!='class'] | node()"/>
      <xsl:if test="(@class='TextRegion' or @class='TableRegion' or @class='TextLine' or @class='Word' or @class='Glyph' or @class='ImageRegion' or @class='SeparatorRegion') and not(svg:polygon[@class='Coords'])">
        <Coords points="0,0 0,0"/>
      </xsl:if>
    </xsl:element>
  </xsl:template>

  <xsl:template match="@data-type">
    <xsl:attribute name="{substring(local-name(),6)}">
      <xsl:value-of select="."/>
    </xsl:attribute>
  </xsl:template>

  <xsl:template match="svg:text[@class='TextEquiv']">
    <xsl:if test="normalize-space() or @conf">
      <TextEquiv>
        <xsl:apply-templates select="@*[local-name()!='class']"/>
        <Unicode>
          <xsl:apply-templates select="node()"/>
        </Unicode>
      </TextEquiv>
    </xsl:if>
  </xsl:template>

  <xsl:template match="svg:tspan">
    <xsl:if test="count(preceding-sibling::*) &gt; 0">
      <xsl:text>&#xa;</xsl:text>
    </xsl:if>
    <xsl:value-of select="node()"/>
  </xsl:template>

  <xsl:template match="svg:polygon[@class='Coords'] | svg:polyline[@class='Baseline']">
    <xsl:element name="{@class}">
      <xsl:apply-templates select="@*[local-name()!='class']"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="svg:polygon[@class='fpgram']">
    <Property key="{@class}" value="{@points}"/>
  </xsl:template>

  <xsl:template match="@points[not(contains(.,','))]">
    <xsl:attribute name="points">
      <xsl:call-template name="addCommasToPoints">
        <xsl:with-param name="list" select="normalize-space(.)"/>
        <xsl:with-param name="delimiter" select="' '"/>
        <xsl:with-param name="num" select="'0'"/>
      </xsl:call-template>
    </xsl:attribute>
  </xsl:template>

  <xsl:template name="addCommasToPoints">
    <xsl:param name="list"/>
    <xsl:param name="delimiter"/>
    <xsl:param name="num"/>
    <xsl:choose>
      <xsl:when test="contains($list,$delimiter)">
        <xsl:choose>
          <xsl:when test="number($num) mod 2 = 1">
            <xsl:value-of select="','"/>
          </xsl:when>
          <xsl:when test="number($num) &gt; 0">
            <xsl:value-of select="' '"/>
          </xsl:when>
        </xsl:choose>
        <xsl:value-of select="substring-before($list,$delimiter)"/>
        <xsl:call-template name="addCommasToPoints">
          <xsl:with-param name="list" select="substring-after($list,$delimiter)"/>
          <xsl:with-param name="delimiter" select="$delimiter"/>
          <xsl:with-param name="num" select="number($num)+1"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:choose>
          <xsl:when test="$list = ''">
            <xsl:text/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="concat(',',$list)"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
