# Design notes — Konnexio IA

## Purpose

Une petite médiathèque pour les supports de formation à l’IA. La page aide un formateur à trouver une ressource et à télécharger une version adaptée au contexte de diffusion.

## Visual direction

- Palette : encre forêt `#14231F`, papier froid `#F5F7F4`, sauge `#E5EEE8`, corail signal `#D76545`, gris lecture `#65716B`.
- Typographie : titres en Georgia, texte et commandes avec les polices système sans sérif. Pas de dépendance distante.
- Mise en page : catalogue éditorial, avec une colonne de repères de format et une liste de fiches compacte.
- Signature : le choix du format est visible sur chaque fiche, comme un petit sélecteur d’outils, plutôt qu’un bouton de téléchargement générique.

## Interaction contract

- Une fiche représente un document source JSON et garde un nom stable pour les quatre formats générés.
- Le titre ouvre un aperçu HTML intégré ; les boutons de téléchargement restent groupés dans le bandeau fixe au-dessus de l’aperçu.
- Alpine.js gère la recherche, le filtre, l’état d’aperçu et les actions de téléchargement ; Eta compose le HTML avec un jeu de modèles partagé.
- Les données globales d’en-tête et de pied de page sont séparées dans `data/header.json` et `data/footer.json` ; aucun template dédié n’est créé par document.
- Markdown, HTML, PDF et DOCX sont créés uniquement après activation explicite du bouton correspondant.
- La recherche filtre localement ; le bouton d’effacement reste disponible quand un terme est saisi.
- Les erreurs de chargement ou de génération sont annoncées dans une zone de statut accessible.
- Aucun document n’est envoyé à un service externe.

