# Carburio - Cloudflare Pages GitHub

IMPORTANT : ce projet doit être déployé avec Cloudflare Pages, pas avec Worker/Wrangler.

## Réglages Cloudflare Pages

Framework preset : None
Build command : laisser vide
Build output directory : .
Root directory : laisser vide

Ne mets pas :
npx wrangler deploy

## Arborescence obligatoire

index.html
style.css
compare.js
assets/
functions/api/carburants.js

Le dossier functions est nécessaire pour le comparateur.

## Test après déploiement

https://ton-site.pages.dev/api/carburants?q=02700&fuel=e10

Si tu vois du JSON avec "results", c'est bon.
