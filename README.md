# Konnexio IA — générateur de documents

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

Types de contenu : `heading` (niveaux 1 à 3), `paragraph`, `list` (optionnellement `"ordered": true`), `quote`, `code` et `separator`. Les champs `schemaVersion`, `title`, `description`, `category` et `content` sont requis. `filename` est facultatif.

Chaque fiche permet de télécharger le même contenu en Markdown, HTML, PDF ou Word (`.docx`). Le catalogue est actualisé à chaque push sur `main` ; les fichiers PDF et DOCX ne sont créés qu’au clic dans le navigateur.

## Développement local

```powershell
python scripts/build_catalog.py
python -m http.server 8000 --directory _site
```

Ouvrez ensuite `http://localhost:8000`. La page doit être servie par HTTP pour charger le catalogue et les sources JSON.

## Publication

Le workflow `.github/workflows/pages.yml` prépare le catalogue et le publie sur GitHub Pages. Dans **Settings → Pages**, choisissez **GitHub Actions** comme source.

