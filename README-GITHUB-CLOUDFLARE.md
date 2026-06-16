# Carburio - ZIP propre pour Cloudflare Pages + GitHub

⚠️ Important : ce projet doit être créé dans Cloudflare **Pages**, pas dans Workers.

## Arborescence

Tu dois avoir à la racine du dépôt GitHub :

index.html
style.css
compare.js
assets/
functions/api/carburants.js
confidentialite.html
mentions-legales.html
robots.txt
sitemap.xml

## Réglages Cloudflare Pages

Quand tu crées le projet :

- Type : Pages
- Méthode : Connect to Git
- Framework preset : None
- Build command : laisser vide
- Build output directory : .
- Root directory : laisser vide

Ne mets PAS :
npx wrangler deploy

Si Cloudflare demande une “Deploy command” obligatoire, tu es dans Workers, pas dans Pages.

## Test après déploiement

Remplace ton-site.pages.dev par ton URL :

https://ton-site.pages.dev/api/carburants?q=02700&fuel=e10

Si tu vois du JSON avec results, le comparateur fonctionne.
