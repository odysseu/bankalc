'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
    parseNombre,
    calculateMensualite,
    calculateTauxImposition,
    coutRachatAssuranceVie,
    coutEmprunt,
    coutOperation,
    calculateOptimalX
} = require('../calculs.js');

const EPS = 1e-6;

function approx(actual, expected, tolerance = 1e-6, message = '') {
    assert.ok(
        Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
        `${message} attendu ~${expected}, reçu ${actual}`
    );
}

test('parseNombre — virgule française, point, espaces, entrées invalides', () => {
    assert.strictEqual(parseNombre('2,5'), 2.5);
    assert.strictEqual(parseNombre('2.5'), 2.5);
    assert.strictEqual(parseNombre(' 42 '), 42);
    assert.strictEqual(parseNombre('180000'), 180000);
    assert.ok(Number.isNaN(parseNombre('')));
    assert.ok(Number.isNaN(parseNombre('   ')));
    assert.ok(Number.isNaN(parseNombre('abc')));
    assert.ok(Number.isNaN(parseNombre(undefined)));
});

test('calculateMensualite — cas nominal (100k€, 3%, 20 ans)', () => {
    // r = 0.0025, n = 240, mensualité = 100000*0.0025 / (1 - 1.0025^-240) ≈ 554.60
    approx(calculateMensualite(100000, 0.03, 20), 554.60, 1e-4, 'mensualité nominale');
});

test('calculateMensualite — taux nul : remboursement linéaire, pas de NaN', () => {
    approx(calculateMensualite(120000, 0, 20), 500, EPS, 'taux nul');
    approx(calculateMensualite(1, 0, 1), 1 / 12, EPS, 'taux nul, somme minime');
});

test('calculateMensualite — capital nul avec taux nul vaut 0 (pas de 0/0)', () => {
    assert.strictEqual(calculateMensualite(0, 0, 10), 0);
    assert.strictEqual(calculateMensualite(0, 0.03, 10), 0);
});

test('calculateMensualite — durée nulle ou invalide renvoie 0 (pas de division par zéro)', () => {
    assert.strictEqual(calculateMensualite(100000, 0.03, 0), 0);
    assert.strictEqual(calculateMensualite(100000, 0.03, -5), 0);
    assert.strictEqual(calculateMensualite(NaN, 0.03, 10), 0);
    assert.strictEqual(calculateMensualite(100000, NaN, 10), 0);
});

test('calculateMensualite — somme très élevée reste finie et proportionnelle', () => {
    const m = calculateMensualite(1e12, 0.05, 30);
    assert.ok(Number.isFinite(m));
    approx(m / 1e12, calculateMensualite(1, 0.05, 30), 1e-12, 'linéarité');
    assert.ok(m > 1e12 / 360, 'supérieure au remboursement linéaire');
});

test('calculateMensualite — somme très basse', () => {
    const m = calculateMensualite(1, 0.03, 25);
    assert.ok(Number.isFinite(m) && m > 0);
});

test('calculateTauxImposition — tranches et bornes', () => {
    assert.strictEqual(calculateTauxImposition(0), 0);
    assert.strictEqual(calculateTauxImposition(11497), 0);
    assert.strictEqual(calculateTauxImposition(11498), 0.11);
    assert.strictEqual(calculateTauxImposition(29315), 0.11);
    assert.strictEqual(calculateTauxImposition(29316), 0.30);
    assert.strictEqual(calculateTauxImposition(83823), 0.30);
    assert.strictEqual(calculateTauxImposition(83824), 0.41);
    assert.strictEqual(calculateTauxImposition(180294), 0.41);
    assert.strictEqual(calculateTauxImposition(180295), 0.45);
    assert.strictEqual(calculateTauxImposition(1e12), 0.45);
});

test('calculateTauxImposition — entrées dégénératives', () => {
    assert.strictEqual(calculateTauxImposition(-50000), 0);
    assert.strictEqual(calculateTauxImposition(NaN), 0);
    assert.strictEqual(calculateTauxImposition(Infinity), 0); // entrée non finie => non imposable
});

test('coutRachatAssuranceVie — cas nominal', () => {
    // ratio PV = (106000-50000)/106000 ; PV imposable = 10000*ratio - 4600 ; taux = 17.2% + min(30%, 7.5%)
    const ratio = 56000 / 106000;
    const attendu = (0.172 + 0.075) * (10000 * ratio - 4600);
    approx(coutRachatAssuranceVie(10000, 4600, 106000, 50000, 0.30), attendu, EPS, 'coût rachat nominal');
});

test('coutRachatAssuranceVie — abattement supérieur à la plus-value : coût nul', () => {
    assert.strictEqual(coutRachatAssuranceVie(1000, 4600, 106000, 50000, 0.30), 0);
    assert.strictEqual(coutRachatAssuranceVie(1, 4600, 106000, 50000, 0.30), 0);
});

test('coutRachatAssuranceVie — montantActuel nul : pas de NaN', () => {
    assert.strictEqual(coutRachatAssuranceVie(10000, 4600, 0, 50000, 0.30), 0);
    assert.strictEqual(coutRachatAssuranceVie(0, 0, 0, 0, 0), 0);
});

test('coutRachatAssuranceVie — moins-value (VA < VI) : coût nul', () => {
    assert.strictEqual(coutRachatAssuranceVie(10000, 0, 40000, 50000, 0.45), 0);
});

test('coutRachatAssuranceVie — taux d’imposition nul : seuls les prélèvements sociaux (17.2%)', () => {
    const ratio = 56000 / 106000;
    approx(coutRachatAssuranceVie(10000, 4600, 106000, 50000, 0), 0.172 * (10000 * ratio - 4600), EPS, 'taux 0');
});

test('coutRachatAssuranceVie — somme très élevée : fini et positif', () => {
    const c = coutRachatAssuranceVie(1e12, 4600, 2e12, 1e12, 0.45);
    assert.ok(Number.isFinite(c) && c > 0);
});

test('coutEmprunt — cas nominal et taux nul', () => {
    approx(coutEmprunt(100000, 0.03, 20), 240 * 554.60 - 100000, 1e-3, 'intérêts nominaux');
    assert.strictEqual(coutEmprunt(100000, 0, 20), 0);
    assert.strictEqual(coutEmprunt(0, 0, 20), 0);
    assert.strictEqual(coutEmprunt(0, 0.03, 20), 0);
});

test('coutEmprunt — somme très élevée reste finie', () => {
    assert.ok(Number.isFinite(coutEmprunt(1e12, 0.04, 25)));
});

test('coutOperation — cohérence interne des champs', () => {
    const r = coutOperation(20000, 4600, 106000, 50000, 0.30, 0.025, 180000, 0.03, 15);
    approx(r.partAssurVieUtilisee, 20000, EPS);
    approx(r.impotPlusValue, coutRachatAssuranceVie(20000, 4600, 106000, 50000, 0.30), EPS);
    approx(r.interetsPayes, coutEmprunt(160000, 0.03, 15), EPS);
    approx(r.coutTotal, r.impotPlusValue + r.interetsPayes, EPS);
    approx(r.valeurFutureAssuranceVie, 86000 * Math.pow(1.025, 15), EPS, 'valeur future = (VA-x)(1+r)^n');
    approx(r.bilan, r.valeurFutureAssuranceVie - r.coutTotal, EPS);
});

test('coutOperation — rendement nul : la valeur future est le capital restant (pas 0)', () => {
    const r = coutOperation(20000, 4600, 106000, 50000, 0.30, 0, 180000, 0.03, 15);
    approx(r.valeurFutureAssuranceVie, 86000, EPS, 'r=0 => VF = VA - x');
});

test('coutOperation — rachat total : valeur future nulle', () => {
    const r = coutOperation(106000, 4600, 106000, 50000, 0.30, 0.025, 180000, 0.03, 15);
    assert.strictEqual(r.valeurFutureAssuranceVie, 0);
});

test('coutOperation — taux d’emprunt nul : aucun intérêt', () => {
    const r = coutOperation(20000, 4600, 106000, 50000, 0.30, 0.025, 180000, 0, 15);
    assert.strictEqual(r.interetsPayes, 0);
    assert.ok(Number.isFinite(r.coutTotal));
});

test('coutOperation — sommes extrêmes restent finies', () => {
    const r = coutOperation(5e11, 4600, 1e12, 5e11, 0.45, 0.05, 2e12, 0.04, 25);
    for (const k of ['coutTotal', 'interetsPayes', 'impotPlusValue', 'valeurFutureAssuranceVie', 'bilan']) {
        assert.ok(Number.isFinite(r[k]), `${k} fini`);
    }
});

test('calculateOptimalX — cohérent avec un scan fin exhaustif (petit cas)', () => {
    const args = [50000, 8000, 0.025, 3000, 0.03, 4600, 0.30, 10];
    for (const optimiserBilan of [false, true]) {
        const res = calculateOptimalX(...args, optimiserBilan);
        let bestX = null;
        let bestVal = optimiserBilan ? -Infinity : Infinity;
        const maxX = Math.min(args[3], args[1] - coutRachatAssuranceVie(args[1], args[5], args[1], args[0], args[6]), args[1]);
        for (let x = 0; x <= maxX; x += 1) {
            const r = coutOperation(x, args[5], args[1], args[0], args[6], args[2], args[3], args[4], args[7]);
            const v = optimiserBilan ? r.bilan : r.coutTotal;
            if ((optimiserBilan && v > bestVal) || (!optimiserBilan && v < bestVal)) {
                bestVal = v;
                bestX = x;
            }
        }
        assert.strictEqual(res.partAssurVieUtilisee, bestX, `x optimal (bilan=${optimiserBilan})`);
    }
});

test('calculateOptimalX — bornes : 0 <= x <= min(achat, rachat max net, capital actuel)', () => {
    const res = calculateOptimalX(50000, 106000, 0.025, 180000, 0.03, 4600, 0.30, 15, false);
    const rachatMax = 106000 - coutRachatAssuranceVie(106000, 4600, 106000, 50000, 0.30);
    const maxX = Math.min(180000, rachatMax, 106000);
    assert.ok(res.partAssurVieUtilisee >= 0 && res.partAssurVieUtilisee <= maxX);
});

test('calculateOptimalX — achat nul : x = 0, pas de crash', () => {
    const res = calculateOptimalX(50000, 106000, 0.025, 0, 0.03, 4600, 0.30, 15, false);
    assert.strictEqual(res.partAssurVieUtilisee, 0);
    assert.strictEqual(res.coutTotal, 0);
});

test('calculateOptimalX — capital actuel nul : x = 0, pas de NaN', () => {
    const res = calculateOptimalX(0, 0, 0.025, 180000, 0.03, 4600, 0.30, 15, false);
    assert.ok(res !== null);
    assert.strictEqual(res.partAssurVieUtilisee, 0);
    assert.ok(Number.isFinite(res.coutTotal));
});

test('calculateOptimalX — somme très élevée : rapide et borné', () => {
    const t0 = Date.now();
    const res = calculateOptimalX(1e12, 2e12, 0.05, 1e9, 0.04, 4600, 0.45, 20, false);
    const dureeMs = Date.now() - t0;
    assert.ok(res !== null);
    assert.ok(res.partAssurVieUtilisee >= 0 && res.partAssurVieUtilisee <= 1e9);
    assert.ok(Number.isFinite(res.coutTotal));
    assert.ok(dureeMs < 5000, `calcul trop lent (${dureeMs} ms)`);
});

test('calculateOptimalX — somme très basse (achat = 1 €)', () => {
    const res = calculateOptimalX(0, 10, 0.02, 1, 0.03, 0, 0, 5, false);
    assert.ok(res.partAssurVieUtilisee === 0 || res.partAssurVieUtilisee === 1);
    assert.ok(Number.isFinite(res.coutTotal));
});

test('calculateOptimalX — taux nuls partout : coût min à x=0, bilan max à x=0 (rendement nul)', () => {
    // emprunt gratuit => intérêts = 0 ; coût = impôt(x) croissant => min à x = 0
    const resCout = calculateOptimalX(50000, 106000, 0, 180000, 0, 4600, 0.30, 15, false);
    assert.strictEqual(resCout.partAssurVieUtilisee, 0);
    // rendement nul et emprunt gratuit => bilan = (VA - x) - impôt(x), décroissant => max à x = 0
    const resBilan = calculateOptimalX(50000, 106000, 0, 180000, 0, 4600, 0.30, 15, true);
    assert.strictEqual(resBilan.partAssurVieUtilisee, 0);
});

test('calculateOptimalX — emprunt très cher, rendement nul : bilan max en rachetant tout', () => {
    const res = calculateOptimalX(50000, 106000, 0, 50000, 0.20, 4600, 0.30, 25, true);
    const rachatMax = 106000 - coutRachatAssuranceVie(106000, 4600, 106000, 50000, 0.30);
    assert.strictEqual(res.partAssurVieUtilisee, Math.min(50000, rachatMax, 106000));
});

test('calculateOptimalX — entrées NaN : retourne null au lieu de crash', () => {
    assert.strictEqual(calculateOptimalX(NaN, 106000, 0.025, 180000, 0.03, 4600, 0.30, 15, false), null);
});
