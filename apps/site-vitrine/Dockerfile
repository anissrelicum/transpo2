# Site vitrine — statique, servi par nginx. Aucune construction : les fichiers du dépôt
# SONT le site (pas de bundler, pas de dépendance, pas de police téléchargée).
FROM nginx:1.27-alpine

COPY apps/site-vitrine/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/site-vitrine/index.html apps/site-vitrine/styles.css apps/site-vitrine/scene.js \
     apps/site-vitrine/robots.txt apps/site-vitrine/sitemap.xml \
     /usr/share/nginx/html/

EXPOSE 80
