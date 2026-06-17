FROM node:alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM httpd:alpine
COPY --from=builder /app/build/ /usr/local/apache2/htdocs/
EXPOSE 81
RUN sed -i 's/Listen 80/Listen 81/' /usr/local/apache2/conf/httpd.conf
