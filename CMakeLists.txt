cmake_minimum_required( VERSION 3.0.0 )
project( nw-page-editor VERSION 1.3 LANGUAGES NONE )

set( CMAKE_MODULE_PATH ${CMAKE_SOURCE_DIR} )

add_custom_target( osx32
  COMMAND rsync -av nwjs/*osx-ia32/nwjs.app .
  COMMAND rsync -avL css html js xslt package.json nwjs.app/Contents/Resources/app.nw/
  COMMAND mv nwjs.app ${PROJECT_NAME}.app
  COMMAND zip -r ${PROJECT_NAME}-${PROJECT_VERSION}-osx32.zip ${PROJECT_NAME}.app
  COMMAND rm -r ${PROJECT_NAME}.app )

add_custom_target( osx64
  COMMAND rsync -av nwjs/*osx-x64/nwjs.app .
  COMMAND rsync -avL css html js xslt package.json nwjs.app/Contents/Resources/app.nw/
  COMMAND mv nwjs.app ${PROJECT_NAME}.app
  COMMAND zip -r ${PROJECT_NAME}-${PROJECT_VERSION}-osx64.zip ${PROJECT_NAME}.app
  COMMAND rm -r ${PROJECT_NAME}.app )

add_custom_target( win32
  COMMAND mkdir ${PROJECT_NAME}-win32
  COMMAND rsync -av --exclude nwjc.exe nwjs/*win-ia32/* ${PROJECT_NAME}-win32
  COMMAND mv ${PROJECT_NAME}-win32/nw.exe ${PROJECT_NAME}-win32/nw-page-editor.exe
  COMMAND rsync -avL css html js xslt package.json ${PROJECT_NAME}-win32
  COMMAND zip -r ${PROJECT_NAME}-${PROJECT_VERSION}-win32.zip ${PROJECT_NAME}-win32
  COMMAND rm -r ${PROJECT_NAME}-win32 )

add_custom_target( win64
  COMMAND mkdir ${PROJECT_NAME}-win64
  COMMAND rsync -av --exclude nwjc.exe nwjs/*win-x64/* ${PROJECT_NAME}-win64
  COMMAND mv ${PROJECT_NAME}-win64/nw.exe ${PROJECT_NAME}-win64/nw-page-editor.exe
  COMMAND rsync -avL css html js xslt package.json ${PROJECT_NAME}-win64
  COMMAND zip -r ${PROJECT_NAME}-${PROJECT_VERSION}-win64.zip ${PROJECT_NAME}-win64
  COMMAND rm -r ${PROJECT_NAME}-win64 )

add_custom_target( deb
  COMMAND mkdir deb ${PROJECT_NAME}-${PROJECT_VERSION}
  COMMAND rsync -avL CMakeLists.txt bin debian css html js xslt package.json ${PROJECT_NAME}-${PROJECT_VERSION}
  COMMAND tar -czf deb/${PROJECT_NAME}_${PROJECT_VERSION}.orig.tar.gz ${PROJECT_NAME}-${PROJECT_VERSION}
  COMMAND mv ${PROJECT_NAME}-${PROJECT_VERSION} deb
  COMMAND cd deb/${PROJECT_NAME}-${PROJECT_VERSION} && debuild -us -uc
  COMMAND mv deb/*.deb .
  COMMAND rm -r deb )

install( DIRECTORY css html js xslt DESTINATION /opt/${PROJECT_NAME} )
install( FILES package.json DESTINATION /opt/${PROJECT_NAME} )
install( PROGRAMS bin/nw-page-editor DESTINATION bin )

add_custom_target( realclean cd ${CMAKE_HOME_DIRECTORY}
  COMMAND rm -fr CMakeFiles CMakeCache.txt cmake_install.cmake install_manifest.txt Makefile deb ${PROJECT_NAME}-${PROJECT_VERSION} )
