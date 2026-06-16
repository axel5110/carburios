# Carburio - site GitHub / Cloudflare Pages

Ce ZIP est prévu pour être envoyé dans un dépôt GitHub puis connecté à Cloudflare Pages.

## Important

Cette version contient :

```text
index.html
style.css
compare.js
assets/
functions/api/carburants.js
package.json
```

Le fichier important est :

```text
functions/api/carburants.js
```

Il permet au comparateur de fonctionner côté serveur avec Cloudflare Pages Functions.

## Pourquoi passer par GitHub ?

Cloudflare Direct Upload ne prend pas en charge les Pages Functions.
Avec GitHub, Cloudflare déploie automatiquement le dossier `functions`.

## Mise en ligne

1. Crée un dépôt GitHub : `carburio-site`
2. Dézippe ce fichier.
3. Envoie tous les fichiers dans GitHub.
4. Dans Cloudflare : Workers & Pages → Create application → Pages → Connect to Git
5. Choisis ton dépôt.
6. Build command : laisse vide.
7. Build output directory : laisse vide ou mets `/`.
8. Clique Deploy.

## Test API après déploiement

Remplace `ton-site.pages.dev` par ton URL Cloudflare :

```text
https://ton-site.pages.dev/api/carburants?q=02700&fuel=e10
```

Tu dois voir du JSON avec `"results"`.

## Fonctionnement

- Prix : API publique carburants.
- Noms : tentative de récupération depuis la fiche officielle `prix-carburants.gouv.fr/station/{id}`.
- Si le nom officiel n'est pas récupéré, le site affiche un nom déduit ou `Station-service – adresse`.
- Distance : calculée depuis la position navigateur quand l'utilisateur clique sur `Utiliser ma position`.
- Paris : limité aux codes postaux 75001 à 75020.
- Tergnier : recherche aussi Condren, Viry-Noureuil, Beautor et Chauny.
