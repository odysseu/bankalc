'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Rend les fonctions de calculs.js disponibles en globales, comme dans le navigateur
// où <script src="calculs.js"> les expose avant script.js.
Object.assign(globalThis, require('../calculs.js'));

// --- Stub minimal de DOM ---
function makeTable() {
    const table = {
        innerHTML: '',
        rows: [],
        _tbody: { innerHTML: '' },
        insertRow() {
            const row = {
                cells: [],
                insertCell(i) {
                    const cell = { innerText: '', colSpan: 1 };
                    this.cells[i] = cell;
                    return cell;
                }
            };
            this.rows.push(row);
            return row;
        },
        querySelector() {
            return table._tbody;
        }
    };
    return table;
}

const VALEURS_PAR_DEFAUT = {
    montant_initial: '50000',
    montant_actuel: '106000',
    taux_rendement: '2.5',
    abattement_fiscal: '4600',
    montant_achat: '180000',
    taux_interet_emprunt: '3',
    salaire_annuel: '45000',
    taux_effort_max: '33',
    montant_rachat_perso: '20000',
    duree_emprunt_perso: '15',
    optimiser_bilan: false
};

const elements = {};
for (const id of Object.keys(VALEURS_PAR_DEFAUT)) {
    elements[id] = {
        value: String(VALEURS_PAR_DEFAUT[id]),
        checked: id === 'optimiser_bilan',
        textContent: '',
        listeners: {},
        addEventListener(event, fn) { this.listeners[event] = fn; }
    };
}
elements['optimisation-label'] = { textContent: 'Coût des impôts', listeners: {}, addEventListener() {} };
for (const id of ['resultsTable', 'optimalResultTable', 'randomCaseTable', 'persoResultTable']) {
    elements[id] = makeTable();
}

global.document = { getElementById: (id) => elements[id] };

const app = require('../script.js');

function setValeur(id, valeur) {
    elements[id].value = String(valeur);
}

function resetValeurs() {
    for (const id of Object.keys(VALEURS_PAR_DEFAUT)) {
        if (id === 'optimiser_bilan') {
            elements[id].checked = false;
        } else {
            elements[id].value = String(VALEURS_PAR_DEFAUT[id]);
        }
    }
    for (const id of ['resultsTable', 'optimalResultTable', 'randomCaseTable', 'persoResultTable']) {
        elements[id].innerHTML = '';
        elements[id].rows = [];
        elements[id]._tbody.innerHTML = '';
    }
}

function contientNaN() {
    return ['resultsTable', 'optimalResultTable', 'randomCaseTable'].some((id) => elements[id].innerHTML.includes('NaN'))
        || elements['persoResultTable']._tbody.innerHTML.includes('NaN')
        || elements['resultsTable'].rows.some((r) => r.cells.some((c) => String(c.innerText).includes('NaN')))
        || elements['optimalResultTable'].rows.some((r) => r.cells.some((c) => String(c.innerText).includes('NaN')));
}

test('calculateRandomCase sans calcul préalable : message au lieu d’un crash', () => {
    resetValeurs();
    app.calculateRandomCase();
    assert.ok(elements['randomCaseTable'].innerHTML.includes("Lancez d'abord un calcul"));
});

test('calculate — cas nominal du formulaire : résultats affichés sans NaN', () => {
    resetValeurs();
    app.calculate();
    const results = app.getResults();
    assert.ok(results.length > 0 && results.length <= 25, `nb de durées ${results.length}`);
    for (const r of results) {
        assert.ok(r.mensualite <= (45000 / 12) * 0.33 + 1e-9, 'taux d’effort respecté');
        for (const k of ['partAssurVieUtilisee', 'pret', 'mensualite', 'coutTotal', 'bilan', 'valeurFutureAssuranceVie']) {
            assert.ok(Number.isFinite(r[k]), `${k} fini`);
        }
    }
    assert.strictEqual(elements['optimalResultTable'].rows.length, 1, 'une ligne optimale');
    assert.ok(!contientNaN(), 'aucun NaN affiché');
});

test('calculate — taux d’emprunt nul : mensualités linéaires, pas de NaN', () => {
    resetValeurs();
    setValeur('taux_interet_emprunt', '0');
    app.calculate();
    const results = app.getResults();
    assert.ok(results.length > 0);
    for (const r of results) {
        const attendu = r.pret / (r.dureeEmprunt * 12);
        assert.ok(Math.abs(r.mensualite - attendu) < 1e-6, 'mensualité = prêt / (durée*12)');
        assert.ok(Math.abs(r.interetsPayes) < 1e-6, 'intérêts ~ 0');
    }
    assert.ok(!contientNaN());
});

test('calculate — taux d’effort nul avec salaire nul : aucun plan, message au lieu d’un crash', () => {
    resetValeurs();
    setValeur('taux_effort_max', '0');
    setValeur('salaire_annuel', '0');
    app.calculate();
    assert.strictEqual(app.getResults().length, 0);
    assert.strictEqual(elements['optimalResultTable'].rows.length, 1);
    assert.ok(elements['optimalResultTable'].rows[0].cells[0].innerText.includes('Aucun plan'));
    assert.ok(elements['resultsTable'].rows[0].cells[0].innerText.includes('Aucun résultat'));
    assert.ok(!contientNaN());
});

test('calculate — champ vide (NaN) : message de paramètres invalides', () => {
    resetValeurs();
    setValeur('montant_initial', '');
    app.calculate();
    assert.ok(elements['optimalResultTable'].rows[0].cells[0].innerText.includes('invalides'));
    assert.strictEqual(app.getResults().length, 0);
});

test('calculate — montant actuel nul : pas de NaN', () => {
    resetValeurs();
    setValeur('montant_actuel', '0');
    app.calculate();
    for (const r of app.getResults()) {
        assert.strictEqual(r.partAssurVieUtilisee, 0);
    }
    assert.ok(!contientNaN());
});

test('calculate — somme d’achat très élevée (1 Md€) : calcul rapide, pas de freeze', () => {
    resetValeurs();
    setValeur('montant_achat', '1000000000');
    const t0 = Date.now();
    app.calculate();
    const dureeMs = Date.now() - t0;
    assert.ok(dureeMs < 20000, `calcul trop lent (${dureeMs} ms)`);
    assert.ok(!contientNaN());
});

test('calculate — somme d’achat très basse (1 €) : pas de crash', () => {
    resetValeurs();
    setValeur('montant_achat', '1');
    app.calculate();
    assert.ok(!contientNaN());
});

test('calculate — optimisation par le bilan : bascule et résultats cohérents', () => {
    resetValeurs();
    elements['optimiser_bilan'].checked = true;
    app.calculate();
    const results = app.getResults();
    assert.ok(results.length > 0);
    const meilleur = results.reduce((a, b) => (b.bilan > a.bilan ? b : a));
    assert.strictEqual(elements['optimalResultTable'].rows.length, 1);
    assert.ok(!contientNaN());
    elements['optimiser_bilan'].checked = false;
});

test('calculateRandomCase après calcul : tableau rempli, x borné, pas de NaN', () => {
    resetValeurs();
    app.calculate();
    app.calculateRandomCase();
    const html = elements['randomCaseTable'].innerHTML;
    assert.ok(html.includes('<td>'), 'ligne de résultat affichée');
    assert.ok(!html.includes('NaN'));
    const tds = [...html.matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1]);
    assert.strictEqual(tds.length, 8, 'huit cellules de résultat');
    assert.ok(parseFloat(tds[1]) >= 0, 'part assurance vie non négative');
    assert.ok(parseFloat(tds[2]) >= 0, 'montant du prêt non négatif'); // xRandom borné à min(rachat max, achat)
});

test('calculateRandomCase — paramètres invalides : message', () => {
    resetValeurs();
    app.calculate();
    setValeur('montant_actuel', 'abc');
    app.calculateRandomCase();
    assert.ok(elements['randomCaseTable'].innerHTML.includes('invalides'));
});

test('calculatePerso — cas nominal : ligne affichée sans NaN', () => {
    resetValeurs();
    app.calculatePerso();
    const html = elements['persoResultTable']._tbody.innerHTML;
    assert.ok(html.includes('<td>'));
    assert.ok(!html.includes('NaN'));
});

test('calculatePerso — rachat supérieur au capital actuel : message invalide', () => {
    resetValeurs();
    setValeur('montant_rachat_perso', '999999');
    app.calculatePerso();
    assert.ok(elements['persoResultTable']._tbody.innerHTML.includes('invalides'));
});

test('calculatePerso — rachat supérieur au coût d’achat : message invalide', () => {
    resetValeurs();
    setValeur('montant_rachat_perso', '200000'); // > montant_achat (180000)
    app.calculatePerso();
    assert.ok(elements['persoResultTable']._tbody.innerHTML.includes('invalides'));
});

test('calculatePerso — durée nulle ou négative : message invalide', () => {
    resetValeurs();
    setValeur('duree_emprunt_perso', '0');
    app.calculatePerso();
    assert.ok(elements['persoResultTable']._tbody.innerHTML.includes('invalides'));
    setValeur('duree_emprunt_perso', '-3');
    app.calculatePerso();
    assert.ok(elements['persoResultTable']._tbody.innerHTML.includes('invalides'));
});

test('calculatePerso — taux d’emprunt nul : mensualité linéaire', () => {
    resetValeurs();
    setValeur('taux_interet_emprunt', '0');
    setValeur('montant_rachat_perso', '20000');
    setValeur('duree_emprunt_perso', '10');
    app.calculatePerso();
    const html = elements['persoResultTable']._tbody.innerHTML;
    assert.ok(!html.includes('NaN'));
    assert.ok(html.includes((160000 / 120).toFixed(2)), 'mensualité = 160000/120');
});

test('listener change sur optimiser_bilan : le label bascule', () => {
    const toggle = elements['optimiser_bilan'];
    toggle.listeners['change'].call({ checked: true });
    assert.strictEqual(elements['optimisation-label'].textContent, 'Bilan');
    toggle.listeners['change'].call({ checked: false });
    assert.strictEqual(elements['optimisation-label'].textContent, 'Coût des impôts');
});

test('lireParametres — validation des bornes', () => {
    resetValeurs();
    assert.strictEqual(app.lireParametres().valide, true);
    setValeur('taux_effort_max', '150'); // > 100 %
    assert.strictEqual(app.lireParametres().valide, false);
    resetValeurs();
    setValeur('montant_achat', '-10');
    assert.strictEqual(app.lireParametres().valide, false);
    resetValeurs();
    setValeur('taux_rendement', '-100'); // rendement de -100 % est le minimum accepté
    assert.strictEqual(app.lireParametres().valide, true);
    setValeur('taux_rendement', '-150');
    assert.strictEqual(app.lireParametres().valide, false);
});
