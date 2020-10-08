#!/bin/bash

##
## @version $Version: 2020.10.08$
## @author Mauricio Villegas <mauricio_ville@yahoo.com>
## @copyright Copyright(c) 2016-present, Mauricio Villegas <mauricio_ville@yahoo.com>
## @license MIT License
##

## Change user and group IDs of www-data to that of /var/www/nw-page-editor/data directory ##
[ "$WWWDATA_UID" = "" ] && WWWDATA_UID=$(stat -c %u /var/www/nw-page-editor/data);
[ "$WWWDATA_GID" = "" ] && WWWDATA_GID=$(stat -c %g /var/www/nw-page-editor/data);
usermod -u $WWWDATA_UID www-data;
groupmod -g $WWWDATA_GID www-data;
chown :www-data /var/www/nw-page-editor/app;
chmod g+w /var/www/nw-page-editor/app;

## Start the git commit daemon ##
if [ -d "/var/www/nw-page-editor/data/.git" ]; then
  cd /var/www/nw-page-editor/data;
  export HOME="/var/www";
  git config --global user.email "www-data@nw-page-editor.org";
  git config --global user.name "www-data";
  git status >/dev/null 2>&1;
  cd $OLDPWD;
  if [ "$?" = 0 ]; then
    echo "Starting git-commit-daemon ...";
    cd /var/www/nw-page-editor/app;
    sudo -u www-data ./git-commit-daemon.sh \
      >>/var/log/apache2/git-commit-daemon.log \
      2>>/var/log/apache2/git-commit-daemon.err &
    # @todo These logs are not being flushed properly
    cd $OLDPWD;
  else
    echo "WARNING: /var/www/nw-page-editor/data/.git exists but commit daemon not started due to an unexpected git status";
  fi
fi

## Start apache server ##
apachectl -D FOREGROUND;
