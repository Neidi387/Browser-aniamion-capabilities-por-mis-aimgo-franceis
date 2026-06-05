FROM httpd:alpine
COPY build/ /usr/local/apache2/htdocs/
EXPOSE 81
RUN sed -i 's/Listen 80/Listen 81/' /usr/local/apache2/conf/httpd.conf
