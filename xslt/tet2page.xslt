<?xml version="1.0"?>
<!--
  - XSLT that transforms TET to Page XML.
  -
  - @version $Version: 2020.04.14$
  - @author Mauricio Villegas <mauricio@omnius.com>
  - @copyright Copyright(c) 2018-present, Mauricio Villegas <mauricio@omnius.com>
  -->
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:_="http://www.pdflib.com/XML/TET5/TET-5.0"
  xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15"
  exclude-result-prefixes="_"
  version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:param name="xsltVersion" select="'2020.04.14'"/>
  <xsl:param name="filename" select="//_:Document/@filename"/>
  <xsl:param name="pageCount" select="//_:Document/@pageCount"/>

  <!-- By default copy everything -->
  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <!-- Ignore some elements -->
  <xsl:template match="_:DocInfo | _:Metadata | _:Options | _:Bookmarks | _:Destinations | _:A | _:Annotations | _:Attachments | _:Resources | _:Graphics | _:OutputIntents | comment()"/>

  <!-- Elements to skip to the children -->
  <xsl:template match="_:Document | _:Pages | _:Content | _:Row">
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- Root element -->
  <xsl:template match="_:TET">
    <PcGts>
      <xsl:apply-templates select="node()"/>
    </PcGts>
  </xsl:template>

  <!-- Metadata element -->
  <xsl:template match="_:Creation">
    <Metadata>
      <Creator><xsl:value-of select="concat('TET ',@tetVersion,' ',@platform,' + tet2page.xslt ',$xsltVersion)"/></Creator>
      <Created><xsl:value-of select="@date"/></Created>
      <LastChange><xsl:value-of select="@date"/></LastChange>
    </Metadata>
  </xsl:template>

  <!-- Page elements -->
  <xsl:template match="_:Page">
    <Page imageWidth="{round(number(@width))}" imageHeight="{round(number(@height))}">
      <xsl:attribute name="imageFilename">
        <xsl:choose>
          <xsl:when test="$pageCount = 1">
            <xsl:value-of select="$filename"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="concat($filename,'[',position()-1,']')"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>
      <xsl:apply-templates select="node()"/>
    </Page>
  </xsl:template>

  <!-- PlacedImage as ImageRegion -->
  <xsl:template match="_:PlacedImage">
    <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
    <xsl:variable name="im" select="count(preceding-sibling::_:PlacedImage)+1"/>
    <xsl:variable name="w" select="@width"/>
    <xsl:variable name="h" select="@height"/>
    <xsl:variable name="x" select="@x"/>
    <xsl:variable name="y" select="@y"/>
    <ImageRegion id="{concat('pg',$pg,'_im',$im)}">
      <!-- @todo Properly compute points when @alpha or @beta present -->
      <xsl:choose>
        <xsl:when test="@beta = 180 and not(@alpha)">
          <Property key="applied-beta" value="{@beta}"/>
          <Coords points="{concat(0+$x,',',0+$y,' ',$x+$w,',',0+$y,' ',$x+$w,',',$y+$h,' ',0+$x,',',$y+$h)}"/>
        </xsl:when>
        <xsl:when test="@alpha = -90 and not(@beta)">
          <Property key="applied-alpha" value="{@alpha}"/>
          <Coords points="{concat($x -$h,',',$y -$w,' ',0+$x,',',$y -$w,' ',0+$x,',',0+$y,' ',$x -$h,',',0+$y)}"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:if test="@alpha">
            <Property key="alpha" value="{@alpha}"/>
          </xsl:if>
          <xsl:if test="@beta">
            <Property key="beta" value="{@beta}"/>
          </xsl:if>
          <Coords points="{concat(0+$x,',',$y -$h,' ',$x+$w,',',$y -$h,' ',$x+$w,',',0+$y,' ',0+$x,',',0+$y)}"/>
        </xsl:otherwise>
      </xsl:choose>
    </ImageRegion>
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- Table as TableRegion -->
  <xsl:template match="_:Table">
    <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
    <xsl:variable name="tb" select="count(preceding::_:Table)+count(ancestor::_:Table)+1"/>
    <TableRegion id="{concat('pg',$pg,'_tb',$tb)}">
      <xsl:call-template name="boxToCoords"/>
    </TableRegion>
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <!-- Row/Cell as TextRegion with special id, Coords and empty content -->
  <xsl:template match="_:Row/_:Cell">
    <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
    <xsl:variable name="tb" select="count(ancestor::_:Table/preceding::_:Table)+count(ancestor::_:Table)"/>
    <xsl:variable name="row" select="count(ancestor::_:Row/preceding-sibling::_:Row)+1"/>
    <xsl:variable name="col" select="count(preceding-sibling::_:Cell)+1"/>
    <TextRegion id="{concat('pg',$pg,'_tb',$tb,'_',$row,'_',$col)}">
      <xsl:if test="@colSpan">
        <Property key="colSpan" value="{@colSpan}"/>
      </xsl:if>
      <xsl:call-template name="boxToCoords"/>
      <xsl:apply-templates select="_:Para/_:Line"/>
    </TextRegion>
    <xsl:apply-templates select="node()[not(local-name()='Para' and _:Line)]"/>
  </xsl:template>

  <!-- Cell/Para as TextRegion with special id and child content -->
  <xsl:template match="_:Cell/_:Para">
    <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
    <xsl:variable name="tb" select="count(ancestor::_:Table/preceding::_:Table)+count(ancestor::_:Table)"/>
    <xsl:variable name="row" select="count(ancestor::_:Row/preceding-sibling::_:Row)+1"/>
    <xsl:variable name="col" select="count(ancestor::_:Cell/preceding-sibling::_:Cell)+1"/>
    <xsl:variable name="p" select="count(preceding-sibling::_:Para)+1"/>
    <xsl:call-template name="paraBoxesToTextRegions">
      <xsl:with-param name="id" select="concat('pg',$pg,'_tb',$tb,'_',$row,'_',$col,'_p',$p)" />
    </xsl:call-template>
    <xsl:apply-templates select="node()[local-name()!='Box']"/>
  </xsl:template>

  <!-- Para as TextRegion(s) -->
  <xsl:template match="_:Content/_:Para">
    <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
    <xsl:variable name="p" select="count(preceding-sibling::_:Para)+1"/>
    <xsl:variable name="id" select="concat('pg',$pg,'_p',$p)"/>
    <xsl:choose>
      <xsl:when test="_:Line">
        <TextRegion id="{$id}">
          <xsl:call-template name="boxToCoords"/>
          <xsl:apply-templates select="node()"/>
        </TextRegion>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="paraBoxesToTextRegions">
          <xsl:with-param name="id" select="$id"/>
        </xsl:call-template>
        <xsl:apply-templates select="node()[local-name()!='Box']"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- Para/Box as TextRegion -->
  <xsl:template name="paraBoxesToTextRegions">
    <xsl:param name="id"/>
    <xsl:for-each select="_:Box">
      <TextRegion>
        <xsl:attribute name="id">
          <xsl:choose>
            <xsl:when test="position() = 1">
              <xsl:value-of select="$id"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="concat($id,'_bx',position())"/>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:attribute>
        <xsl:call-template name="boxToCoords"/>
        <xsl:apply-templates select="node()"/>
      </TextRegion>
    </xsl:for-each>
  </xsl:template>

  <!-- Line as TextLine -->
  <xsl:template match="_:Line">
    <!--<xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
    <xsl:variable name="p" select="count(ancestor::_:Para/preceding-sibling::_:Para)+1"/>
    <xsl:variable name="l" select="count(preceding-sibling::_:Line)+1"/>-->
    <xsl:choose>
      <xsl:when test="count(ancestor::_:Cell) > 0">
        <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
        <xsl:variable name="tb" select="count(ancestor::_:Table/preceding::_:Table)+count(ancestor::_:Table)"/>
        <xsl:variable name="row" select="count(ancestor::_:Row/preceding-sibling::_:Row)+1"/>
        <xsl:variable name="col" select="count(ancestor::_:Cell/preceding-sibling::_:Cell)+1"/>
        <xsl:variable name="p" select="count(preceding-sibling::_:Para)+1"/>
        <xsl:variable name="l" select="count(preceding-sibling::_:Line)+1"/>
        <xsl:variable name="id" select="concat('pg',$pg,'_tb',$tb,'_',$row,'_',$col,'_p',$p,'_l',$l)" />
        <TextLine id="{$id}">
          <xsl:call-template name="boxToCoords"/>
          <xsl:apply-templates select="node()"/>
        </TextLine>
      </xsl:when>
      <xsl:otherwise>
        <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
        <xsl:variable name="p" select="count(ancestor::_:Para/preceding-sibling::_:Para)+1"/>
        <xsl:variable name="l" select="count(preceding-sibling::_:Line)+1"/>
        <xsl:variable name="id" select="concat('pg',$pg,'_p',$p,'_l',$l)"/>
        <TextLine id="{$id}">
          <xsl:call-template name="boxToCoords"/>
          <xsl:apply-templates select="node()"/>
        </TextLine>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- Word as Word -->
  <xsl:template match="_:Word">
    <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
    <xsl:variable name="p" select="count(ancestor::_:Para/preceding-sibling::_:Para)+1"/>
    <xsl:variable name="l" select="count(ancestor::_:Line/preceding-sibling::_:Line)+1"/>
    <xsl:variable name="w" select="count(preceding-sibling::_:Word)+1"/>
    <Word id="{concat('pg',$pg,'_p',$p,'_l',$l,'_w',$w)}">
      <xsl:apply-templates select="_:Box"/>
      <xsl:apply-templates select="node()[local-name()!='Box']"/>
    </Word>
  </xsl:template>

  <!-- Para/Box/Word as TextLine/Word -->
  <!--<xsl:template match="_:Para/_:Box/_:Word">
    <xsl:variable name="pg" select="count(ancestor::_:Page/preceding-sibling::_:Page)+1"/>
    <xsl:variable name="p" select="count(ancestor::_:Para/preceding-sibling::_:Para)+1"/>
    <xsl:variable name="bx" select="count(ancestor::_:Box/preceding-sibling::_:Box)+1"/>
    <xsl:variable name="l" select="count(ancestor::_:Line/preceding-sibling::_:Line)+1"/>
    <xsl:variable name="lid" select="concat('pg',$pg,'_p',$p,'_bx',$bx)"/>
    <TextLine id="{$lid}">
      <xsl:call-template name="boxToCoords"/>
      <xsl:variable name="w" select="count(preceding-sibling::_:Word)+1"/>
      <Word id="{concat($lid,'_w',$w)}">
        <xsl:apply-templates select="_:Box"/>
        <xsl:apply-templates select="node()[local-name()!='Box']"/>
      </Word>
    </TextLine>
  </xsl:template>-->

  <!-- Glyph as Glyph -->
  <xsl:template match="_:Glyph"/>
  <!--<xsl:template match="_:Glyph">
    <xsl:variable name="x" select="@x"/>
    <xsl:variable name="y" select="@y"/>
    <xsl:variable name="w" select="@width"/>
    <xsl:variable name="s" select="-number(@size)"/>
    <Glyph id="">
      <xsl:if test="@alpha">
        <Property key="alpha" value="{@alpha}"/>
      </xsl:if>
      <xsl:if test="@beta">
        <Property key="beta" value="{@beta}"/>
      </xsl:if>
      <Coords points="{concat(0+$x,',',$y+$s,' ',$x+$w,',',$y+$s,' ',$x+$w,',',0+$y,' ',0+$x,',',0+$y)}"/>
      <TextEquiv>
        <Unicode><xsl:value-of select="."/></Unicode>
      </TextEquiv>
    </Glyph>
  </xsl:template>-->

  <!-- Box as Coords -->
  <xsl:template match="_:Box">
    <xsl:call-template name="boxToCoords"/>
    <xsl:apply-templates select="node()"/>
  </xsl:template>
  <xsl:template name="boxToCoords">
    <Coords>
      <xsl:attribute name="points">
        <xsl:choose>
          <xsl:when test="@llx or @lly or @urx or @ury">
            <xsl:variable name="llx" select="@llx"/>
            <xsl:variable name="lly" select="@lly"/>
            <xsl:variable name="urx" select="@urx"/>
            <xsl:variable name="ury" select="@ury"/>
            <xsl:value-of select="concat(0+$llx,',',0+$ury,' ',0+$urx,',',0+$ury,' ',0+$urx,',',0+$lly,' ',0+$llx,',',0+$lly)"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="'0,0 0,0'"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>
    </Coords>
  </xsl:template>

  <!-- Text as TextEquiv -->
  <xsl:template match="_:Text">
    <xsl:if test="count(preceding-sibling::_:Text) = 0">
      <TextEquiv>
        <Unicode>
          <xsl:for-each select="../_:Text">
            <xsl:if test="position() &gt; 1">
              <xsl:value-of select="'&#xa;'"/>
            </xsl:if>
            <xsl:value-of select="."/>
          </xsl:for-each>
        </Unicode>
      </TextEquiv>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>
