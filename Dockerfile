FROM ubuntu:20.04

LABEL maintainer="Mauricio Villegas <mauricio_ville@yahoo.com>"

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
COPY LICENSE.md README.md /var/www/nw-page-editor/
COPY css /var/www/nw-page-editor/css
COPY js /var/www/nw-page-editor/js
COPY node_modules /var/www/nw-page-editor/node_modules
COPY xsd /var/www/nw-page-editor/xsd
COPY xslt /var/www/nw-page-editor/xslt
COPY web-app /var/www/nw-page-editor/app
RUN rm -f /etc/apache2/sites-enabled/* \
 && mv /var/www/nw-page-editor/app/apache2_http.conf /etc/apache2/sites-enabled/nw-page-editor.conf \
 && a2enmod rewrite ssl

### By default start the apache web server ###
CMD /var/www/nw-page-editor/app/start-server.sh
