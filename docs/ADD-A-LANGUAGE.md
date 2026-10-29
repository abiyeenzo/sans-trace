# Ajouter une langue

Les regles de texte sont dans `js/text-clean.js`. Pour une nouvelle langue (par exemple `es`) :

1. Ajoute des lignes dans les tables `INTERJECTION`, `LEAD` et `CLOSER` (phrases d'assistant au debut et a la fin d'une reponse).
2. Ajoute une entree `es: [...]` dans `HUMANIZE` : chaque regle est `[expression reguliere, remplacement]`. Un remplacement vide supprime la formule.
3. Ajoute les mots courants de la langue dans `detectLang` pour la detection automatique.
4. Ajoute au moins un test dans `test/clean.test.js`.
5. Lance `npm test` et `node scripts/policy-check.js`, puis ouvre une pull request.

Conseils : prefere des remplacements simples et surs, evite de changer le sens, garde les accents corrects, et n'ajoute que des regles que tu as vues dans de vrais textes generes.
