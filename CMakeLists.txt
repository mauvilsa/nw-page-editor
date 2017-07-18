cmake_minimum_required( VERSION 3.0.0 )
project( nw-page-editor VERSION 2017.07.18 LANGUAGES NONE )

set( CMAKE_MODULE_PATH ${CMAKE_SOURCE_DIR} )

add_custom_command( OUTPUT js/page-canvas.min.js js/svg-canvas.min.js
  COMMAND closure-compiler --js js/page-canvas.js --create_source_map js/page-canvas.map --js_output_file js/page-canvas.min.js
  COMMAND closure-compiler --js js/svg-canvas.js --create_source_map js/svg-canvas.map --js_output_file js/svg-canvas.min.js
  DEPENDS js/page-canvas.js js/svg-canvas.js )

add_custom_target( minify DEPENDS js/page-canvas.min.js js/svg-canvas.min.js )

#function( js_minify )
#  set(result)
#  foreach( filepath ${ARGN} )
#    get_filename_component( filedir ${filepath} DIRECTORY )
#    get_filename_component( filebase ${filepath} NAME_WE )
#    set( output ${filedir}/${filebase}.min.js ${filedir}/${filebase}.map )
#    add_custom_command( OUTPUT ${output}
#      COMMAND closure-compiler --js ${filepath} --create_source_map ${filedir}/${filebase}.map --js_output_file ${filedir}/${filebase}.min.js )
#    set_source_files_properties( ${output} PROPERTIES GENERATED TRUE )
#  endforeach()
#endfunction()

add_custom_target( osx32 DEPENDS minify
  COMMAND rsync -av nwjs/*osx-ia32/nwjs.app .
  COMMAND rsync -avL --exclude '*-canvas.js' css html js xslt package.json nwjs.app/Contents/Resources/app.nw/
  COMMAND sed -i 's|-canvas.js"|-canvas.min.js"|' nwjs.app/Contents/Resources/app.nw/html/index.html
  COMMAND mv nwjs.app ${PROJECT_NAME}.app
  COMMAND zip -r ${PROJECT_NAME}-${PROJECT_VERSION}-osx32.zip ${PROJECT_NAME}.app
  COMMAND rm -r ${PROJECT_NAME}.app )

add_custom_target( osx64 DEPENDS minify
  COMMAND rsync -av nwjs/*osx-x64/nwjs.app .
  COMMAND rsync -avL --exclude '*-canvas.js' css html js xslt package.json nwjs.app/Contents/Resources/app.nw/
  COMMAND sed -i 's|-canvas.js"|-canvas.min.js"|' nwjs.app/Contents/Resources/app.nw/html/index.html
  COMMAND mv nwjs.app ${PROJECT_NAME}.app
  COMMAND zip -r ${PROJECT_NAME}-${PROJECT_VERSION}-osx64.zip ${PROJECT_NAME}.app
  COMMAND rm -r ${PROJECT_NAME}.app )

add_custom_target( win32 DEPENDS minify
  COMMAND mkdir ${PROJECT_NAME}-win32
  COMMAND rsync -av --exclude nwjc.exe nwjs/*win-ia32/* ${PROJECT_NAME}-win32
  COMMAND mv ${PROJECT_NAME}-win32/nw.exe ${PROJECT_NAME}-win32/nw-page-editor.exe
  COMMAND rsync -avL --exclude '*-canvas.js' css html js xslt package.json ${PROJECT_NAME}-win32
  COMMAND sed -i 's|-canvas.js"|-canvas.min.js"|' ${PROJECT_NAME}-win32/html/index.html
  COMMAND zip -r ${PROJECT_NAME}-${PROJECT_VERSION}-win32.zip ${PROJECT_NAME}-win32
  COMMAND rm -r ${PROJECT_NAME}-win32 )

add_custom_target( win64 DEPENDS minify
  COMMAND mkdir ${PROJECT_NAME}-win64
  COMMAND rsync -av --exclude nwjc.exe nwjs/*win-x64/* ${PROJECT_NAME}-win64
  COMMAND mv ${PROJECT_NAME}-win64/nw.exe ${PROJECT_NAME}-win64/nw-page-editor.exe
  COMMAND rsync -avL --exclude '*-canvas.js' css html js xslt package.json ${PROJECT_NAME}-win64
  COMMAND sed -i 's|-canvas.js"|-canvas.min.js"|' ${PROJECT_NAME}-win64/html/index.html
  COMMAND zip -r ${PROJECT_NAME}-${PROJECT_VERSION}-win64.zip ${PROJECT_NAME}-win64
  COMMAND rm -r ${PROJECT_NAME}-win64 )

add_custom_target( deb DEPENDS minify
  COMMAND mkdir deb ${PROJECT_NAME}-${PROJECT_VERSION}
  COMMAND rsync -avL --exclude '*-canvas.js' CMakeLists.txt bin debian css html js xslt package.json ${PROJECT_NAME}-${PROJECT_VERSION}
  COMMAND sed -i 's|-canvas.js"|-canvas.min.js"|' ${PROJECT_NAME}-${PROJECT_VERSION}/html/index.html
  COMMAND tar -czf deb/${PROJECT_NAME}_${PROJECT_VERSION}.orig.tar.gz ${PROJECT_NAME}-${PROJECT_VERSION}
  COMMAND mv ${PROJECT_NAME}-${PROJECT_VERSION} deb
  COMMAND cd deb/${PROJECT_NAME}-${PROJECT_VERSION} && debuild -us -uc
  COMMAND mv deb/*.deb .
  COMMAND rm -r deb )

install( DIRECTORY css html js xslt DESTINATION share/${PROJECT_NAME} )
install( FILES package.json DESTINATION share/${PROJECT_NAME} )
install( PROGRAMS bin/nw-page-editor DESTINATION bin )

add_custom_target( realclean cd ${CMAKE_HOME_DIRECTORY} COMMAND rm -fr CMakeFiles CMakeCache.txt cmake_install.cmake install_manifest.txt Makefile deb ${PROJECT_NAME}-${PROJECT_VERSION} js/*-canvas.min.js js/*-canvas.map )
