<?xml version="1.0"?>
<!--
  - XSLT that transforms SVGs to Page XMLs.
  -
  - @version $Version: 2017.05.05$
  - @author Mauricio Villegas <mauvilsa@upv.es>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauvilsa@upv.es>
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
    <Page imageFilename="{svg:image/@xlink:href}" imageHeight="{svg:image/@height}" imageWidth="{svg:image/@width}">
      <xsl:apply-templates select="node()"/>
    </Page>
  </xsl:template>

  <xsl:template match="svg:image"/>

  <!--<xsl:template match="svg:g[contains(concat(' ',normalize-space(@class),' '),' TextRegion ')]">-->
  <xsl:template match="svg:g[starts-with(@class,'TextRegion')]">
    <TextRegion>
      <xsl:if test="starts-with(normalize-space(@class),'TextRegion ')">
        <xsl:attribute name="type">
          <xsl:value-of select="substring(@class,12)"/>
        </xsl:attribute>
      </xsl:if>
      <xsl:apply-templates select="@*[local-name()!='class'] | node()"/>
    </TextRegion>
  </xsl:template>

  <xsl:template match="svg:g[starts-with(@class,'TableRegion')]">
    <TableRegion>
      <xsl:if test="starts-with(normalize-space(@class),'TableRegion ')">
        <xsl:attribute name="type">
          <xsl:value-of select="substring(@class,13)"/>
        </xsl:attribute>
      </xsl:if>
      <xsl:apply-templates select="@*[local-name()!='class'] | node()"/>
    </TableRegion>
  </xsl:template>

  <xsl:template match="svg:g[@class='TextLine' or @class='Word' or @class='Glyph']">
    <xsl:element name="{@class}">
      <xsl:apply-templates select="@*[local-name()!='class'] | node()"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="svg:text">
    <xsl:if test="normalize-space()">
      <TextEquiv>
        <xsl:apply-templates select="@*"/>
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

  <xsl:template match="svg:polygon[@class='Coords']">
    <Coords>
      <xsl:apply-templates select="@*[local-name()!='class' and local-name()!='id']"/>
    </Coords>
  </xsl:template>

  <xsl:template match="svg:polyline[@class='Baseline']">
    <Baseline>
      <xsl:apply-templates select="@*[local-name()!='class']"/>
    </Baseline>
  </xsl:template>

</xsl:stylesheet>
