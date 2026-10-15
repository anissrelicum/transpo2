# Site vitrine Portrail — statique, servi par nginx. Aucune construction : les fichiers du
# dépôt SONT le site (pas de bundler, pas de dépendance). La police Inter est
# auto-hébergée (fonts/, licence OFL jointe).
FROM nginx:1.27-alpine

COPY apps/site-vitrine/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/site-vitrine/nginx-entetes.conf /etc/nginx/snippets/portrail-entetes.conf

COPY apps/site-vitrine/index.html apps/site-vitrine/404.html \
     apps/site-vitrine/styles.css apps/site-vitrine/scene.js \
     apps/site-vitrine/robots.txt apps/site-vitrine/sitemap.xml apps/site-vitrine/site.webmanifest \
     apps/site-vitrine/favicon.svg apps/site-vitrine/apple-touch-icon.png \
     /usr/share/nginx/html/
# Version anglaise, police, visuels (illustrations, captures du produit, vidéo, icônes,
# images de partage Open Graph).
COPY apps/site-vitrine/en/ /usr/share/nginx/html/en/
COPY apps/site-vitrine/fonts/ /usr/share/nginx/html/fonts/
COPY apps/site-vitrine/medias/ /usr/share/nginx/html/medias/

EXPOSE 80
