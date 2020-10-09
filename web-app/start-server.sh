#!/bin/bash

##
## @version $Version: 2020.10.09$
## @author Mauricio Villegas <mauricio_ville@yahoo.com>
## @copyright Copyright(c) 2016-present, Mauricio Villegas <mauricio_ville@yahoo.com>
## @license MIT License
##

## Setup umask, user and group IDs for running apachectl ##
[ "$DATA_UMASK" != "" ] && umask "$DATA_UMASK";
[ "$DATA_UID" = "" ] && DATA_UID=$(stat -c %u /var/www/nw-page-editor/data);
[ "$DATA_GID" = "" ] && DATA_GID=$(stat -c %g /var/www/nw-page-editor/data);
usermod -u $DATA_UID www-data;
groupmod -g $DATA_GID www-data;
chown :www-data /var/www/nw-page-editor/app;
chmod g+w /var/www/nw-page-editor/app;

## Start the git commit daemon ##
if [ -d "/var/www/nw-page-editor/data/.git" ]; then
  cd /var/www/nw-page-editor/data;
  export HOME="/var/www";
  git config --global user.email "www-data@nw-page-editor.org";
  git config --global user.name "www-data";
  chown www-data: /var/www/.gitconfig;
  git status >/dev/null 2>&1;
  RC="$?";
  cd -;
  if [ "$RC" = 0 ]; then
    echo "Starting git-commit-daemon ...";
    cd /var/www/nw-page-editor/app;
    sudo -u www-data ./git-commit-daemon.sh \
      >>/var/log/apache2/git-commit-daemon.log \
      2>>/var/log/apache2/git-commit-daemon.err &
    # @todo These logs are not being flushed properly
  else
    echo "ERROR: /var/www/nw-page-editor/data/.git exists but commit daemon not started due to an unexpected git status";
    exit $RC;
  fi
fi

## Start apache server ##
apachectl -D FOREGROUND;
