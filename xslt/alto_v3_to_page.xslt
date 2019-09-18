<?xml version="1.0"?>
<!--
  - XSLT that transforms abbyy ALTO to Page XML.
  -
  - @version $Version: 2019.09.18$
  - @author Mauricio Villegas <mauricio@omnius.com>
  - @copyright Copyright(c) 2018-present, Mauricio Villegas <mauricio@omnius.com>
  -->
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:_="http://www.loc.gov/standards/alto/ns-v3#"
  xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  exclude-result-prefixes="_"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:param name="xsltVersion" select="'2019.09.18'"/>

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
      <Metadata>
        <Creator><xsl:value-of select="concat(//_:softwareName,' ',//_:softwareVersion,' + alto_v3_to_page.xslt v',$xsltVersion)"/></Creator>
        <xsl:choose>
          <xsl:when test="string-length(//_:processingDateTime) = 10">
            <Created><xsl:value-of select="concat(//_:processingDateTime,'T00:00:00Z')"/></Created>
            <LastChange><xsl:value-of select="concat(//_:processingDateTime,'T00:00:00Z')"/></LastChange>
          </xsl:when>
          <xsl:otherwise>
            <Created><xsl:value-of select="//_:processingDateTime"/></Created>
            <LastChange><xsl:value-of select="//_:processingDateTime"/></LastChange>
          </xsl:otherwise>
        </xsl:choose>
      </Metadata>
      <xsl:apply-templates select="node()"/>
    </PcGts>
  </xsl:template>

  <!-- Page elements -->
  <xsl:template match="_:Page">
    <!--<Page id="{@ID}" imageWidth="{round(@WIDTH)}" imageHeight="{round(@HEIGHT)}">-->
    <Page imageWidth="{round(@WIDTH)}" imageHeight="{round(@HEIGHT)}">
    <xsl:variable name="filename" select="//_:sourceImageInformation/_:fileName"/>
      <xsl:attribute name="imageFilename">
        <xsl:choose>
          <xsl:when test="count(../_:Page) = 1">
            <xsl:value-of select="$filename"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="concat($filename,'[',count(preceding-sibling::_:Page),']')"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>
      <xsl:apply-templates select="node()"/>
    </Page>
  </xsl:template>

  <!-- Margins as TextRegions with special id and property -->
  <xsl:template match="_:TopMargin | _:BottomMargin | _:LeftMargin | _:RightMargin">
    <xsl:variable name="pg" select="ancestor::_:Page/@ID"/>
    <TextRegion id="{concat($pg,'_',local-name())}">
      <Property key="Margin" value="{substring-before(local-name(),'Margin')}"/>
      <xsl:call-template name="outputCoords"/>
    </TextRegion>
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- PrintSpaces as TextRegions with special id and property -->
  <xsl:template match="_:PrintSpace">
    <xsl:if test="@HPOS and @VPOS and @WIDTH and @HEIGHT">
      <xsl:variable name="pg" select="ancestor::_:Page/@ID"/>
      <TextRegion id="{concat($pg,'_',local-name())}">
        <Property key="{local-name()}"/>
        <xsl:call-template name="outputCoords"/>
      </TextRegion>
    </xsl:if>
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- Illustration as ImageRegion -->
  <xsl:template match="_:Illustration">
    <ImageRegion id="{@ID}">
      <xsl:if test="@TYPE">
        <Property key="type" value="{@TYPE}"/>
      </xsl:if>
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
        <xsl:if test="count(*[@ID]) > 0">
          <xsl:attribute name="value">
            <xsl:for-each select="*[@ID]">
              <xsl:if test="position() != 1">
                <xsl:value-of select="' '"/>
              </xsl:if>
              <xsl:value-of select="@ID"/>
            </xsl:for-each>
          </xsl:attribute>
        </xsl:if>
      </Property>
      <xsl:call-template name="outputCoords"/>
    </TextRegion>
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- TextBlock as TextRegion -->
  <xsl:template match="_:TextBlock">
    <TextRegion id="{@ID}">
      <xsl:if test="@LANG">
        <Property key="lang" value="{@LANG}"/>
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
      <xsl:if test="@LANG">
        <Property key="lang" value="{@LANG}"/>
      </xsl:if>
      <xsl:if test="@BASELINE">
        <Property key="alto-baseline" value="{@BASELINE}"/>
      </xsl:if>
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
      <xsl:if test="@LANG">
        <Property key="lang" value="{@LANG}"/>
      </xsl:if>
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
      <xsl:if test="translate(@CONTENT,'\n\r\t ','') != ''">
        <TextEquiv>
          <xsl:if test="@WC">
            <xsl:attribute name="conf">
              <xsl:value-of select="@WC"/>
            </xsl:attribute>
          </xsl:if>
          <Unicode><xsl:value-of select="@CONTENT"/></Unicode>
        </TextEquiv>
      </xsl:if>
      <xsl:apply-templates select="node()"/>
    </Word>
  </xsl:template>

  <!-- Output Coords callable template -->
  <xsl:template name="outputCoords">
    <xsl:if test="_:Shape/_:Polygon[@POINTS]">
      <Property key="alto-polygon" value="{_:Shape/_:Polygon/@POINTS}"/>
    </xsl:if>
    <xsl:if test="@ROTATION">
      <Property key="alto-rotation" value="{@ROTATION}"/>
    </xsl:if>
    <xsl:if test="@HPOS and @VPOS and @WIDTH and @HEIGHT">
      <xsl:variable name="x" select="@HPOS"/>
      <xsl:variable name="y" select="@VPOS"/>
      <xsl:variable name="w" select="@WIDTH"/>
      <xsl:variable name="h" select="@HEIGHT"/>
      <Coords points="{concat($x,',',$y,' ',$x+$w,',',$y,' ',$x+$w,',',$y+$h,' ',$x,',',$y+$h)}"/>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>
