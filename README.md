# Médiathèque — générateur de documents

Une médiathèque statique publiée sur GitHub Pages. **Les documents JSON sont les sources maîtres.** Lorsqu’un visiteur clique sur un format, son navigateur charge le JSON correspondant et fabrique le fichier localement. Aucun document n’est envoyé à un serveur de conversion.

## Ajouter un document

Créez un fichier `.json` dans `documents/` ou dans un sous-dossier. Utilisez la structure suivante :

```json
{
  "schemaVersion": 1,
  "title": "Mon document",
  "description": "Résumé affiché dans le catalogue.",
  "category": "Ateliers",
  "filename": "mon-document",
  "content": [
    { "type": "heading", "level": 1, "text": "Mon document" },
    { "type": "paragraph", "text": "Un paragraphe de présentation." },
    { "type": "heading", "level": 2, "text": "À retenir" },
    { "type": "list", "items": ["Premier point", "Deuxième point"] },
    { "type": "quote", "text": "Une citation ou un conseil." },
    { "type": "code", "text": "Un exemple ou une consigne." },
    { "type": "separator" }
  ]
}
```

Types de contenu : `heading` (niveaux 1 à 3), `paragraph`, `list` (optionnellement `"ordered": true`), `quote`, `code`, `link` (avec `text` et une URL HTTPS), `separator` et `diagram`. Un diagramme a un `title`, des `nodes` (`id`, `label`, `reference`, `url`) et des `edges` (`from`, `to`, `label` facultatif). Chaque nœud ouvre sa référence HTTPS au clic et les liens sont aussi disponibles au clavier. Les champs `schemaVersion`, `title`, `description`, `category` et `content` sont requis. `filename` est facultatif.

Chaque fiche permet de prévisualiser le document puis de télécharger le même contenu en Markdown, HTML, PDF ou Word (`.docx`). Le catalogue est actualisé à chaque push sur `main` ; les fichiers sont créés au clic dans le navigateur.

## Modèles HTML partagés

Les données d’en-tête et de pied de page des documents sont maintenues dans `data/header.json` et `data/footer.json`. Le groupe de boutons de téléchargement a sa configuration dans `data/components/downloads.json`. Les modèles Eta communs sont dans `templates/` : `page.eta` assemble les partials `header.eta`, `blocks.eta` et `footer.eta`. Un nouveau document n’a besoin que de son JSON dans `documents/`, sans fichier Eta correspondant. `schema.json` décrit le format attendu et n’est pas transmis au moteur Eta.

Alpine.js pilote les composants d’interface du catalogue (recherche, filtre, aperçu et actions de téléchargement). Eta rend le HTML de l’aperçu et du fichier téléchargé depuis la même source JSON.

## Styles Bootstrap et Bootswatch

L’interface utilise Bootstrap 5 et le thème Yeti de Bootswatch. Le balisage s’appuie sur les composants et utilitaires Bootstrap ; `assets/site.css` ne contient que quelques règles d’assemblage et reprend les variables Bootstrap du thème actif. Pour essayer un autre thème Bootswatch de la série 5.3.8, remplacez `yeti` dans les feuilles CSS de `index.html` et `templates/page.eta` par son identifiant, par exemple `flatly`, `minty` ou `cosmo`. Le HTML téléchargé reprend le même thème.

## Développement local

```powershell
python scripts/build_catalog.py
python -m http.server 8000 --directory _site
```

Ouvrez ensuite `http://localhost:8000`. La page doit être servie par HTTP pour charger le catalogue et les sources JSON.

## Publication

Le workflow `.github/workflows/pages.yml` prépare le catalogue et le publie sur GitHub Pages. Dans **Settings → Pages**, choisissez **GitHub Actions** comme source.


