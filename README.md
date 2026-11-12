# bankalc

Calculatrice : faut-il racheter son assurance-vie ou emprunter pour financer un achat immobilier ?

Site statique (GitHub Pages) en JavaScript vanilla, sans dépendance.

## Tests

Les fonctions de calcul pures vivent dans `calculs.js` (testables sous Node) et la couche
d'affichage dans `script.js`. Les tests utilisent le test runner natif de Node (aucune
dépendance à installer) :

```bash
npm test
```

La commande lance les tests et affiche le rapport de couverture (`calculs.js`, `script.js`).
Les cas couverts incluent les cas limites : taux nuls, capitaux nuls, sommes très basses
ou très élevées, abattement supérieur à la plus-value, aucun plan respectant le taux d'effort.
