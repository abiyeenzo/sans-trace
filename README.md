# Sans Trace

Outil gratuit qui nettoie les traces d'IA dans les textes et les images, directement dans le navigateur.

Créé et maintenu par **Abiye Enzo**.

## Ce que fait Sans Trace

- **Texte** (français et anglais) : retire les phrases d'assistant, les résidus de citations, les caractères invisibles, le Markdown, les tirets longs, et remplace les tics de style les plus courants.
- **Images** (JPEG, PNG, WebP) : retire les métadonnées (EXIF avec GPS, XMP, Content Credentials C2PA, prompts écrits dans les PNG) sans toucher aux pixels.
- **Détection** : repère les traces de provenance IA dans les images et donne un indice de style pour les textes. Ce sont des estimations, pas des preuves.

## Ce que Sans Trace ne fait pas

- Il ne retire pas les filigranes invisibles intégrés aux pixels (SynthID et équivalents).
- Il ne promet pas de tromper un détecteur, un enseignant ou une plateforme.
- Il ne contient aucune section pour contourner des protections.

## Vie privée

Les textes et les images restent dans ton navigateur. Le site ne compte que le pays d'où vient une visite (déduit par l'hébergeur, sans adresse IP ni contenu) pour afficher des statistiques anonymes. Voir `privacy.html`.

## Licence

Code sous licence [PolyForm Noncommercial 1.0.0](LICENSE). Tu peux lire, installer en local, modifier et partager le code pour un usage **non commercial**. Il est interdit de le vendre ou de l'utiliser dans une offre commerciale. Tous les droits restent à Abiye Enzo. Ce n'est donc pas une licence "open source" au sens strict de l'OSI : c'est du code ouvert et non commercial.

## Contribuer

Lis [CONTRIBUTING.md](CONTRIBUTING.md). Chaque pull request passe des vérifications automatiques (tests, règles de politique, analyse de sécurité, recherche de secrets), puis le mainteneur confirme.

## Signaler une faille

Lis [SECURITY.md](SECURITY.md). N'ouvre pas d'issue publique pour une faille.

## Installer en local

```
git clone https://github.com/abiyeenzo/sans-trace.git
cd sans-trace
npm test
npx serve .
```

Aucune étape de build. Le site est statique, avec deux petites fonctions serveur (`api/`) pour le compteur de pays, inutiles en local.

## Application mobile

Le site est une PWA : sur téléphone, ouvre-le dans le navigateur puis choisis "Installer l'application" ou "Ajouter à l'écran d'accueil".
