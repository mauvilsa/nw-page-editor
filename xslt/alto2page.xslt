<?xml version="1.0"?>
<!--
  - XSLT that transforms abbyy ALTO to Page XML.
  -
  - @version $Version: 2019.07.02$
  - @author Mauricio Villegas <mauricio@omnius.com>
  - @copyright Copyright(c) 2018-present, Mauricio Villegas <mauricio@omnius.com>
  -->
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:_="http://www.loc.gov/standards/alto/ns-v2#"
  xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  exclude-result-prefixes="_"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:param name="xsltVersion" select="'2019.07.02'"/>
  <xsl:param name="filename"/>

  <!-- By default copy everything -->
  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <!-- Ignore some elements -->
  <xsl:template match="_:Description | _:Styles | _:SP | _:HYP | _:Shape[_:Polygon] | comment()"/>

  <!-- Elements to skip to the children -->
  <xsl:template match="_:Layout">
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- Root element -->
  <xsl:template match="_:alto">
    <PcGts>
      <xsl:variable name="dt" select="concat(//_:processingDateTime,'T00:00:00Z')"/>
      <Metadata>
        <Creator><xsl:value-of select="concat(//_:softwareName,' ',//_:softwareVersion,' + alto2page.xslt ',$xsltVersion)"/></Creator>
        <Created><xsl:value-of select="$dt"/></Created>
        <LastChange><xsl:value-of select="$dt"/></LastChange>
      </Metadata>
      <xsl:apply-templates select="node()"/>
    </PcGts>
  </xsl:template>

  <!-- Page elements -->
  <xsl:template match="_:Page">
    <Page imageWidth="{@WIDTH}" imageHeight="{@HEIGHT}">
      <xsl:attribute name="imageFilename">
        <xsl:choose>
          <xsl:when test="count(../_:Page) = 1">
            <xsl:value-of select="$filename"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="concat($filename,'[',count(preceding-sibling::_:Page)+1,']')"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>
      <xsl:apply-templates select="node()"/>
    </Page>
  </xsl:template>

  <!-- PrintSpaces and Margins as TextRegions with special id and property -->
  <xsl:template match="_:PrintSpace | _:TopMargin | _:BottomMargin | _:LeftMargin | _:RightMargin">
    <xsl:variable name="pg" select="ancestor::_:Page/@ID"/>
    <TextRegion id="{concat($pg,'_',local-name())}">
      <Property key="Margin" value="{substring-before(local-name(),'Margin')}"/>
      <xsl:call-template name="outputCoords"/>
    </TextRegion>
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- Illustration as ImageRegion -->
  <xsl:template match="_:Illustration">
    <ImageRegion id="{@ID}">
      <xsl:call-template name="outputCoords"/>
      <xsl:apply-templates select="node()"/>
    </ImageRegion>
  </xsl:template>

  <!-- GraphicalElement as SeparatorRegion -->
  <xsl:template match="_:GraphicalElement">
    <SeparatorRegion id="{@ID}">
      <xsl:call-template name="outputCoords"/>
      <xsl:apply-templates select="node()"/>
    </SeparatorRegion>
  </xsl:template>

  <!-- ComposedBlock as TextRegion with a property with key ComposedBlock and value IDs of members -->
  <xsl:template match="_:ComposedBlock">
    <TextRegion id="{@ID}">
      <Property key="{local-name()}">
        <xsl:attribute name="value">
          <xsl:for-each select="*[@ID]">
            <xsl:if test="position() != 1">
              <xsl:value-of select="' '"/>
            </xsl:if>
            <xsl:value-of select="@ID"/>
          </xsl:for-each>
        </xsl:attribute>
      </Property>
      <xsl:call-template name="outputCoords"/>
    </TextRegion>
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- TextBlock as TextRegion -->
  <xsl:template match="_:TextBlock">
    <TextRegion id="{@ID}">
      <xsl:if test="@language">
        <Property key="language" value="{@language}"/>
      </xsl:if>
      <xsl:call-template name="outputCoords"/>
      <xsl:apply-templates select="node()"/>
    </TextRegion>
  </xsl:template>

  <!-- TextLine as TextLine -->
  <xsl:template match="_:TextLine">
    <xsl:variable name="rg" select="ancestor::_:TextBlock/@ID"/>
    <xsl:variable name="ln" select="count(preceding-sibling::_:TextLine)+1"/>
    <TextLine id="{concat($rg,'_l',$ln)}">
      <xsl:call-template name="outputCoords"/>
      <xsl:apply-templates select="node()"/>
    </TextLine>
  </xsl:template>

  <!-- Exclude TextLine/String without bounding box information -->
  <xsl:template match="_:TextLine/_:String[not(@HPOS and @VPOS and @WIDTH and @HEIGHT)]"/>

  <!-- TextLine/String as Word with TextEquiv -->
  <xsl:template match="_:TextLine/_:String[@HPOS and @VPOS and @WIDTH and @HEIGHT]">
    <xsl:variable name="rg" select="ancestor::_:TextBlock/@ID"/>
    <xsl:variable name="ln" select="count(../preceding-sibling::_:TextLine)+1"/>
    <xsl:variable name="wd" select="count(preceding-sibling::_:String)+1"/>
    <Word id="{concat($rg,'_l',$ln,'_w',$wd)}">
      <xsl:if test="@STYLE">
        <Property key="style" value="{@STYLE}"/>
      </xsl:if>
      <xsl:choose>
        <xsl:when test="../@STYLEREFS">
          <xsl:variable name="styleref" select="../@STYLEREFS"/>
          <Property key="font-size" value="{/_:alto/_:Styles/_:TextStyle[@ID=$styleref]/@FONTSIZE}"/>
        </xsl:when>
        <xsl:when test="../../@STYLEREFS">
          <xsl:variable name="styleref" select="../../@STYLEREFS"/>
          <Property key="font-size" value="{/_:alto/_:Styles/_:TextStyle[@ID=$styleref]/@FONTSIZE}"/>
        </xsl:when>
      </xsl:choose>
      <xsl:call-template name="outputCoords"/>
      <TextEquiv conf="{@WC}">
        <Unicode><xsl:value-of select="@CONTENT"/></Unicode>
      </TextEquiv>
      <xsl:apply-templates select="node()"/>
    </Word>
  </xsl:template>

  <!-- Output Coords callable template -->
  <xsl:template name="outputCoords">
    <xsl:if test="_:Shape/_:Polygon[@POINTS]">
      <Property key="alto-polygon" value="{_:Shape/_:Polygon/@POINTS}"/>
    </xsl:if>
    <xsl:variable name="x" select="@HPOS"/>
    <xsl:variable name="y" select="@VPOS"/>
    <xsl:variable name="w" select="@WIDTH"/>
    <xsl:variable name="h" select="@HEIGHT"/>
    <Coords points="{concat($x,',',$y,' ',$x+$w,',',$y,' ',$x+$w,',',$y+$h,' ',$x,',',$y+$h)}"/>
  </xsl:template>

</xsl:stylesheet>
