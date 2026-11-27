# Design notes — Konnexio IA

## Purpose

Une petite médiathèque pour les supports de formation à l’IA. La page aide un formateur à trouver une ressource et à télécharger une version adaptée au contexte de diffusion.

## Visual direction

- Base visuelle : Bootstrap 5 avec le thème Minty de Bootswatch. Les classes Bootstrap et les variables `--bs-*` gardent l’interface compatible avec les thèmes Bootswatch.
- Mise en page : catalogue responsive construit avec la grille et les composants Bootstrap.
- Signature : les boutons de téléchargement restent dans le bandeau de l’aperçu ; la fiche du catalogue ouvre l’aperçu HTML.
- `assets/site.css` ne redéfinit pas la palette du thème ; il règle seulement le bandeau collant, la hauteur de l’aperçu et l’affichage avant Alpine.

## Interaction contract

- Une fiche représente un document source JSON et garde un nom stable pour les quatre formats générés.
- Le titre ouvre un aperçu HTML intégré ; les boutons de téléchargement restent groupés dans le bandeau fixe au-dessus de l’aperçu.
- Alpine.js gère la recherche, le filtre, l’état d’aperçu et les actions de téléchargement ; Eta compose le HTML avec un jeu de modèles partagé.
- Les données globales d’en-tête et de pied de page sont séparées dans `data/header.json` et `data/footer.json` ; aucun template dédié n’est créé par document.
- Markdown, HTML, PDF et DOCX sont créés uniquement après activation explicite du bouton correspondant.
- La recherche filtre localement ; le bouton d’effacement reste disponible quand un terme est saisi.
- Les erreurs de chargement ou de génération sont annoncées dans une zone de statut accessible.
- Aucun document n’est envoyé à un service externe.

