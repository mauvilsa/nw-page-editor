FROM library/ubuntu:16.04

MAINTAINER Mauricio Villegas <mauricio_ville@yahoo.com>

### Install pre-requisites ###
RUN apt-get update --fix-missing \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      less \
      nano \
      git \
      sudo \
      apache2 \
      libapache2-mod-php \
      libxml2-utils \
      php-fxsl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

### Setup the web app ###
COPY . /var/www/nw-page-editor/
RUN mv /var/www/nw-page-editor/web-app /var/www/nw-page-editor/app \
 && rm -f /etc/apache2/sites-enabled/* \
 && mv /var/www/nw-page-editor/app/apache2_http.conf /etc/apache2/sites-enabled/nw-page-editor.conf \
 && a2enmod rewrite ssl

### By default start the apache web server ###
CMD /var/www/nw-page-editor/app/start-server.sh
