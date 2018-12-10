# Name

nw-page-editor - Simple app for visual editing of Page XML files.

Version: 2018.12.10


# Description

nw-page-editor is an application for editing ground truth information for
diverse purposes related to the area of handwriting text recognition (HTR).
The edition is done interactively and visually on top of images of scanned
documents. The format used for storing the ground truth information is based
on the [Page XML schema](http://www.primaresearch.org/tools/PAGELibraries),
but with a few minor [extensions](https://github.com/mauvilsa/pageformat). It
is available in two variants. The first variant is as a desktop application,
based on the NW.js framework thus making it cross-platform. The second variant
is as a web application that can be easily setup as a docker container.


# Desktop variant installation

Linux/Mac:

1. Download the NW.js package appropriate for your platform from
   http://nwjs.io/downloads. Extract it to a location where you store
   applications and add to your PATH the directory containing the nw/nwjs
   binary: root of package in Linux or nwjs.app/Contents/MacOS in OSX.

2. Move the nw-page-editor directory to a location where you store
   applications and add the package's bin directory to your PATH.

Windows:

1. Download the NW.js package appropriate for your platform from
   http://nwjs.io/downloads. Extract it to a location where you store
   applications renaming the base directory to nw-page-editor.

2. Move, copy or clone the files of this github repository such that the
   file package.json is in the same directory as nw.exe.

3. Create a shortcut to nw.exe to ease opening of the app. In windows it is
   not possible to open files directly from the command line.


# Application usage shortcuts

<table>
<tr><th>Shortcut</th>              <th>Command</th></tr>

<tr><td>ctrl/cmd + q</td>          <td>Quit application</td></tr>
<tr><td>ctrl/cmd + o</td>          <td>Open file dialog</td></tr>
<tr><td>ctrl/cmd + s</td>          <td>Save changes to file</td></tr>
<tr><td>ctrl/cmd + shift + s</td>  <td>Save as new file dialog</td></tr>
<tr><td>ctrl/cmd + p</td>          <td>Print</td></tr>
<tr><td>ctrl/cmd + enter</td>      <td>Open/close menu</td></tr>
<tr><td>ctrl/cmd + n</td>          <td>New window</td></tr>
<tr><td>pageup</td>                <td>Load previous document</td></tr>
<tr><td>pagedown</td>              <td>Load next document</td></tr>
<tr><td>shift + pageup</td>        <td>Load previous 10th document</td></tr>
<tr><td>shift + pagedown</td>      <td>Load next 10th document</td></tr>

<tr><td>ctrl/cmd + z</td>          <td>Undo last change</td></tr>
<tr><td>ctrl/cmd + y</td>          <td>Redo last change</td></tr>

<tr><td>mouse click</td>           <td>Select or deselect element</td></tr>
<tr><td>esc</td>                   <td>Deselect the currently selected element</td></tr>
<tr><td>tab</td>                   <td>Select the next element</td></tr>
<tr><td>shift + tab</td>           <td>Select the previous element</td></tr>
<tr><td>ctrl + tab</td>            <td>Select the next dragpoint</td></tr>
<tr><td>ctrl + shift + tab</td>    <td>Select the previous dragpoint</td></tr>
<tr><td>ctrl + f</td>              <td>Enable/disable text filtering</td></tr>

<tr><td>ctrl/cmd + del</td>        <td>Delete selected element</td></tr>
<tr><td>del</td>                   <td>Delete selected element (only when text not editable)</td></tr>
<tr><td>minus + .</td>             <td>Delete selected dragpoint</td></tr>
<tr><td>plus + .</td>              <td>Add dragpoint next to selected</td></tr>

<tr><td>ctrl/cmd + 0</td>          <td>View full page (initial zoom)</td></tr>
<tr><td>ctrl/cmd + plus/minus</td> <td>Zoom in/out</td></tr>
<tr><td>shift + mouse wheel</td>   <td>Zoom in/out</td></tr>
<tr><td>ctrl/cmd + arrows</td>     <td>Move (pan) the image in the respective direction</td></tr>
<tr><td>mouse wheel</td>           <td>Move (pan) the image in the respective direction</td></tr>
<tr><td>mouse drag</td>            <td>Move (pan) the image in the respective direction</td></tr>

<tr><td>ctrl + ,</td>              <td>Select the next edit mode element level</td></tr>
<tr><td>ctrl + shift + ,</td>      <td>Select the previous edit mode element level</td></tr>
<tr><td>ctrl + .</td>              <td>Select the next edit mode type</td></tr>
<tr><td>ctrl + shift + .</td>      <td>Select the previous edit mode type</td></tr>

<tr><td>ctrl/cmd + e</td>          <td>Open property editor for selected element</td></tr>

<tr><td>ctrl/cmd + pageup</td>     <td>Increase font size</td></tr>
<tr><td>ctrl/cmd + pagedown</td>   <td>Decrease font size</td></tr>
<tr><td>ctrl/cmd + g</td>          <td>Change gamma of image</td></tr>

<tr><td>alt + arrows</td>          <td>Change table selected cell in the respective direction</td></tr>
<tr><td>plus + c/r</td>            <td>Split selected table column/row</td></tr>
<tr><td>minus + c/r</td>           <td>Remove selected table column/row</td></tr>
<tr><td>move dragpoint</td>        <td>Modifies dragpoint and its opposite dragpoint(s)</td></tr>
<tr><td>shift+ move dragpoint</td> <td>Modifies only the dragpoint, not the opposite(s)</td></tr>

<tr><td>ctrl/cmd + r</td>          <td>Toggle selected element protection</td></tr>
</table>


# Command line synopsis

    nw-page-editor [*page.xml*]+ [*pages_dir*]+ [--list *pages_list*]+ [--css *file.css*]+ [--js *file.js*]+


# Examples

You can find example Page XML files in the nw-page-editor source code repository, the directory *examples*.


# Startup CSS and JavaScript files

The --css and --js command line options can be used to modify the appearance or execute custom code on startup. For example, the following JavaScript code changes the position, color and size of overlayed text, and prints to a pdf.

```javascript
setTimeout( function() {
    $.stylesheet('#page_styles { #xpg .TextEquiv }').css( 'fill', 'green' ); /* Set font color to green */
    $.stylesheet('#page_styles { #xpg .TextEquiv }').css( 'font-size', '60px' ); /* Set font size to 60px */
    pageCanvas.cfg.textPositionOffset = [ 10, 0 ]; /* Set text position x and y offsets */
    pageCanvas.util.positionText(); /* Update text position */
    nw.Window.get().print({pdf_path:loadedFile.replace(/\.xml$/,'.pdf')}); /* Print to pdf */
}, 500 );
```

To run this example save this code snippet to a file test.js and start the editor from the command line as

    nw-page-editor --js test.js examples/lorem.xml


# Copyright

The MIT License (MIT)

Copyright (c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
