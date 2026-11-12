'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Rend les fonctions de calculs.js disponibles en globales, comme dans le navigateur
// où <script src="calculs.js"> les expose avant script.js.
Object.assign(globalThis, require('../calculs.js'));

// --- Stub minimal de DOM + localStorage ---

const store = {};
global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; }
};

function makeCell() {
    return { innerText: '', colSpan: 1, dataset: {} };
}

function makeTable() {
    const table = {
        rows: [],
        scrollAppele: false,
        _tbody: { innerHTML: '' },
        insertRow() {
            const row = {
                cells: [],
                insertCell(i) {
                    const cell = makeCell();
                    this.cells[i] = cell;
                    return cell;
                }
            };
            this.rows.push(row);
            return row;
        },
        scrollIntoView() {
            this.scrollAppele = true;
        },
        querySelector() {
            return table._tbody;
        }
    };
    // Comme dans le vrai DOM, assigner innerHTML vide les lignes existantes.
    let html = '';
    Object.defineProperty(table, 'innerHTML', {
        get: () => html,
        set: (v) => {
            html = v;
            table.rows = [];
        }
    });
    return table;
}

function makeBouton() {
    return {
        disabled: false,
        textContent: '',
        tabIndex: 0,
        attrs: {},
        focusAppele: false,
        listeners: {},
        addEventListener(event, fn) { this.listeners[event] = fn; },
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return this.attrs[k]; },
        focus() { this.focusAppele = true; }
    };
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
    duree_emprunt_perso: '15'
};

const elements = {};
for (const id of Object.keys(VALEURS_PAR_DEFAUT)) {
    elements[id] = {
        value: VALEURS_PAR_DEFAUT[id],
        checked: false,
        textContent: '',
        listeners: {},
        addEventListener(event, fn) { this.listeners[event] = fn; }
    };
}
// Segmented control « Optimiser pour » (radios)
elements['optimisation_cout'] = { checked: true, listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; } };
elements['optimisation_bilan'] = { checked: false, listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; } };
elements['optimisation-label'] = { textContent: 'Optimiser pour :' };
elements['calculate-button'] = makeBouton();
elements['calculate-button'].textContent = 'Calculer';
elements['reset-button'] = makeBouton();
elements['error-banner'] = { textContent: '', hidden: true };
elements['recapCard'] = { hidden: true, innerHTML: '' };
// Onglets de résultats
elements['tab-summary'] = makeBouton();
elements['tab-summary'].attrs['aria-selected'] = 'true';
elements['tab-detail'] = makeBouton();
elements['tab-detail'].attrs['aria-selected'] = 'false';
elements['tab-detail'].tabIndex = -1;
elements['panel-summary'] = { hidden: false };
elements['panel-detail'] = { hidden: true };
// Onglets « Autres simulations »
elements['tab-random'] = makeBouton();
elements['tab-random'].attrs['aria-selected'] = 'true';
elements['tab-perso'] = makeBouton();
elements['tab-perso'].attrs['aria-selected'] = 'false';
elements['tab-perso'].tabIndex = -1;
elements['panel-random'] = { hidden: false };
elements['panel-perso'] = { hidden: true };
elements['formula-details'] = { open: false, listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; } };
for (const id of ['resultsTable', 'optimalResultTable', 'randomCaseTable', 'persoResultTable']) {
    elements[id] = makeTable();
}

const creationsScript = [];
let configMathJaxPoseeAuChargement = false;
global.document = {
    getElementById: (id) => elements[id],
    createElement: (tag) => {
        const el = { tagName: tag, async: false, src: '' };
        creationsScript.push(el);
        return el;
    },
    head: {
        appendChild: () => {
            configMathJaxPoseeAuChargement = !!(global.window && global.window.MathJax && global.window.MathJax.tex);
        }
    }
};

const app = require('../script.js');

function setValeur(id, valeur) {
    elements[id].value = String(valeur);
}

function resetValeurs() {
    for (const id of Object.keys(VALEURS_PAR_DEFAUT)) {
        elements[id].value = VALEURS_PAR_DEFAUT[id];
    }
    elements['optimisation_cout'].checked = true;
    elements['optimisation_bilan'].checked = false;
    elements['error-banner'].textContent = '';
    elements['error-banner'].hidden = true;
    elements['recapCard'].hidden = true;
    elements['recapCard'].innerHTML = '';
    elements['calculate-button'].disabled = false;
    elements['calculate-button'].textContent = 'Calculer';
    elements['formula-details'].open = false;
    elements['panel-summary'].hidden = false;
    elements['panel-detail'].hidden = true;
    elements['tab-summary'].attrs['aria-selected'] = 'true';
    elements['tab-summary'].tabIndex = 0;
    elements['tab-detail'].attrs['aria-selected'] = 'false';
    elements['tab-detail'].tabIndex = -1;
    elements['panel-random'].hidden = false;
    elements['panel-perso'].hidden = true;
    elements['tab-random'].attrs['aria-selected'] = 'true';
    elements['tab-random'].tabIndex = 0;
    elements['tab-perso'].attrs['aria-selected'] = 'false';
    elements['tab-perso'].tabIndex = -1;
    creationsScript.length = 0;
    configMathJaxPoseeAuChargement = false;
    for (const id of ['resultsTable', 'optimalResultTable', 'randomCaseTable', 'persoResultTable']) {
        elements[id].innerHTML = '';
        elements[id].rows = [];
        elements[id]._tbody.innerHTML = '';
        elements[id].scrollAppele = false;
    }
    global.localStorage.clear();
}

function contientNaN() {
    return ['resultsTable', 'optimalResultTable', 'randomCaseTable'].some((id) => elements[id].innerHTML.includes('NaN'))
        || elements['persoResultTable']._tbody.innerHTML.includes('NaN')
        || elements['recapCard'].innerHTML.includes('NaN')
        || elements['error-banner'].textContent.includes('NaN')
        || elements['resultsTable'].rows.some((r) => r.cells.some((c) => String(c.innerText).includes('NaN')))
        || elements['optimalResultTable'].rows.some((r) => r.cells.some((c) => String(c.innerText).includes('NaN')));
}

test('calculateRandomCase sans calcul préalable : message au lieu d’un crash', () => {
    resetValeurs();
    app.calculateRandomCase();
    assert.ok(elements['randomCaseTable'].innerHTML.includes("Lancez d'abord un calcul"));
});

test('calculate — cas nominal du formulaire : résultats affichés sans NaN, labels posés', () => {
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
    assert.strictEqual(elements['optimalResultTable'].rows.length, 1, 'une seule ligne (données) dans le tableau optimal');
    assert.ok(!elements['optimalResultTable'].innerHTML.includes('<th'), 'pas de ligne d’en-tête dans le tableau optimal');
    const cellule = elements['resultsTable'].rows[0].cells[0];
    assert.strictEqual(cellule.dataset.label, "Durée de l'emprunt (années)", 'data-label posé pour le mode carte');
    assert.ok(elements['resultsTable'].rows[0].cells[1].innerText.includes('€'), 'montants formatés en €');
    assert.ok(!contientNaN(), 'aucun NaN affiché');
});

test('calculate — carte récap remplie avec les 4 chiffres clés', () => {
    resetValeurs();
    app.calculate();
    assert.strictEqual(elements['recapCard'].hidden, false);
    const html = elements['recapCard'].innerHTML;
    assert.ok(html.includes('recap-item'), 'blocs récap présents');
    assert.ok(html.includes('ans'), 'durée affichée');
    assert.ok(html.includes('€'), 'montants en €');
    assert.ok(html.includes('Coût total'), 'objectif affiché (mode coût)');
    assert.ok(!html.includes('NaN'));
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

test('calculate — taux d’effort nul avec salaire nul : bandeau « Aucun plan », pas de crash', () => {
    resetValeurs();
    setValeur('taux_effort_max', '0');
    setValeur('salaire_annuel', '0');
    app.calculate();
    assert.strictEqual(app.getResults().length, 0);
    assert.ok(elements['error-banner'].hidden === false);
    assert.ok(elements['error-banner'].textContent.includes('Aucun plan'));
    assert.strictEqual(elements['optimalResultTable'].rows[0].cells[0].innerText, 'Aucun résultat');
    assert.ok(elements['resultsTable'].rows[0].cells[0].innerText.includes('Aucun résultat'));
    assert.strictEqual(elements['recapCard'].hidden, true, 'carte récap masquée');
    assert.ok(!contientNaN());
});

test('calculate — champ vide (NaN) : bandeau « paramètres invalides »', () => {
    resetValeurs();
    setValeur('montant_initial', '');
    app.calculate();
    assert.ok(elements['error-banner'].textContent.includes('invalides'));
    assert.strictEqual(app.getResults().length, 0);
});

test('calculate — saisie avec virgule (2,5) acceptée grâce à parseNombre', () => {
    resetValeurs();
    setValeur('taux_rendement', '2,5');
    app.calculate();
    assert.ok(app.getResults().length > 0);
    assert.ok(!contientNaN());
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

test('calculate — optimisation par le bilan via la radio segmented', () => {
    resetValeurs();
    elements['optimisation_bilan'].checked = true;
    elements['optimisation_cout'].checked = false;
    app.calculate();
    const results = app.getResults();
    assert.ok(results.length > 0);
    assert.strictEqual(elements['optimalResultTable'].rows.length, 1);
    assert.ok(elements['recapCard'].innerHTML.includes('Bilan'), 'objectif Bilan affiché dans le récap');
    assert.ok(!contientNaN());
    elements['optimisation_bilan'].checked = false;
    elements['optimisation_cout'].checked = true;
});

test('calculateRandomCase après calcul : tableau rempli en €, x borné, pas de NaN', () => {
    resetValeurs();
    app.calculate();
    app.calculateRandomCase();
    const html = elements['randomCaseTable'].innerHTML;
    assert.ok(html.includes('<td'), 'ligne de résultat affichée');
    assert.ok(html.includes('€'), 'montants formatés en €');
    assert.ok(!html.includes('NaN'));
    const tds = [...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
    assert.strictEqual(tds.length, 8, 'huit cellules de résultat');
    assert.ok(!html.includes('<th'), 'plus de ligne d’en-tête dans le tableau aléatoire');
    assert.ok(html.includes('data-label="Durée de l\'emprunt (années)"'), 'titres présents dans les data-label (mode carte)');
});

test('calculateRandomCase — paramètres invalides : message', () => {
    resetValeurs();
    app.calculate();
    setValeur('montant_actuel', 'abc');
    app.calculateRandomCase();
    assert.ok(elements['randomCaseTable'].innerHTML.includes('invalides'));
});

test('calculatePerso — cas nominal : ligne affichée en €, libellés dans les data-label, sans NaN', () => {
    resetValeurs();
    app.calculatePerso();
    const html = elements['persoResultTable']._tbody.innerHTML;
    assert.ok(html.includes('<td'), 'ligne de résultat affichée');
    assert.ok(html.includes('€'));
    assert.ok(!html.includes('NaN'));
    assert.ok(html.includes('data-label="Durée de l\'emprunt (années)"'), 'libellés présents dans les data-label (mode carte)');
    assert.ok(!html.includes('<th'), 'pas de ligne d’en-tête');
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

test('calculatePerso — taux d’emprunt nul : mensualité linéaire formatée', () => {
    resetValeurs();
    setValeur('taux_interet_emprunt', '0');
    setValeur('montant_rachat_perso', '20000');
    setValeur('duree_emprunt_perso', '10');
    app.calculatePerso();
    const html = elements['persoResultTable']._tbody.innerHTML;
    assert.ok(!html.includes('NaN'));
    assert.ok(html.includes(app.fmtEUR.format(160000 / 120)), 'mensualité = 160000/120 formatée en €');
});

test('onCalculateClick — bouton désactivé puis réactivé, scroll vers le résultat', async () => {
    resetValeurs();
    await app.onCalculateClick();
    assert.strictEqual(elements['calculate-button'].disabled, false);
    assert.strictEqual(elements['calculate-button'].textContent, 'Calculer');
    assert.ok(app.getResults().length > 0);
    assert.strictEqual(elements['optimalResultTable'].scrollAppele, true, 'scrollIntoView appelé');
});

test('persistance — sauvegarderParametres / restaurerParametres via localStorage', () => {
    resetValeurs();
    setValeur('montant_initial', '77777');
    elements['optimisation_bilan'].checked = true;
    app.sauvegarderParametres();
    setValeur('montant_initial', '1');
    elements['optimisation_bilan'].checked = false;
    app.restaurerParametres();
    assert.strictEqual(elements['montant_initial'].value, '77777', 'valeur restaurée');
    assert.strictEqual(elements['optimisation_bilan'].checked, true, 'radio restaurée');
});

test('reinitialiserFormulaire — retour aux valeurs par défaut, résultats vidés, stockage nettoyé', () => {
    resetValeurs();
    app.calculate();
    setValeur('montant_initial', '99999');
    app.sauvegarderParametres();
    app.reinitialiserFormulaire();
    assert.strictEqual(elements['montant_initial'].value, '50000');
    assert.strictEqual(elements['optimisation_cout'].checked, true);
    assert.strictEqual(elements['optimisation_bilan'].checked, false);
    assert.strictEqual(app.getResults().length, 0);
    assert.strictEqual(elements['optimalResultTable'].rows[0].cells[0].innerText, 'Aucun résultat');
    assert.strictEqual(global.localStorage.getItem('bankalc:montant_initial'), null, 'stockage nettoyé');
});

test('bouton reset — le listener click réinitialise le formulaire', () => {
    resetValeurs();
    setValeur('montant_achat', '555555');
    elements['reset-button'].listeners['click']();
    assert.strictEqual(elements['montant_achat'].value, '180000');
});

test('formules — MathJax injecté au premier toggle du <details>, config posée avant (évite le crash MathJax._)', () => {
    resetValeurs();
    global.window = {};
    const details = elements['formula-details'];
    // Le <details> reste fermé : rien ne se charge
    details.open = false;
    details.listeners['toggle']();
    assert.strictEqual(creationsScript.length, 0, 'pas de chargement tant que le details est fermé');
    // Première ouverture : config posée PUIS script injecté
    details.open = true;
    details.listeners['toggle']();
    assert.strictEqual(creationsScript.length, 1, 'un seul script injecté');
    assert.ok(creationsScript[0].src.includes('mathjax@3'), 'CDN MathJax v3');
    assert.strictEqual(creationsScript[0].async, true);
    assert.ok(global.window.MathJax.tex.packages['[+]'], 'config tex posée');
    assert.strictEqual(configMathJaxPoseeAuChargement, true, 'config posée AVANT appendChild (sinon MathJax._.components plante)');
    // Re-toggle : pas de double chargement
    details.listeners['toggle']();
    assert.strictEqual(creationsScript.length, 1, 'pas de rechargement');
    delete global.window;
    details.open = false;
});

test('onglets — état initial, clic, et navigation clavier (flèches/Home/End) avec aria-selected et focus', () => {
    resetValeurs();
    const tabS = elements['tab-summary'];
    const tabD = elements['tab-detail'];
    const panelS = elements['panel-summary'];
    const panelD = elements['panel-detail'];
    // État initial posé par initialiserOnglets au chargement
    assert.strictEqual(panelS.hidden, false, 'panneau résumé visible');
    assert.strictEqual(panelD.hidden, true, 'panneau détail caché');
    assert.strictEqual(tabS.getAttribute('aria-selected'), 'true');
    // Clic sur l'onglet « Simulation détaillée »
    tabD.listeners['click']();
    assert.strictEqual(panelD.hidden, false);
    assert.strictEqual(panelS.hidden, true);
    assert.strictEqual(tabD.getAttribute('aria-selected'), 'true');
    assert.strictEqual(tabS.getAttribute('aria-selected'), 'false');
    assert.strictEqual(tabD.tabIndex, 0, 'onglet actif tabulable');
    assert.strictEqual(tabS.tabIndex, -1, 'onglet inactif retiré de la tabulation');
    // ArrowLeft depuis le 2e onglet -> retour au 1er, avec focus
    tabD.listeners['keydown']({ key: 'ArrowLeft' });
    assert.strictEqual(panelS.hidden, false);
    assert.strictEqual(panelD.hidden, true);
    assert.strictEqual(tabS.focusAppele, true, 'focus déplacé au clavier');
    // ArrowRight depuis le 1er onglet -> boucle sur le 2e
    tabS.listeners['keydown']({ key: 'ArrowRight' });
    assert.strictEqual(panelD.hidden, false);
    // Home / End
    tabD.listeners['keydown']({ key: 'Home' });
    assert.strictEqual(panelS.hidden, false);
    tabS.listeners['keydown']({ key: 'End' });
    assert.strictEqual(panelD.hidden, false);
    // Touche sans action
    tabD.listeners['keydown']({ key: 'a' });
    assert.strictEqual(panelD.hidden, false, 'touche neutre ignorée');
});

test('onglets « Autres simulations » — cas aléatoire actif par défaut, bascule vers perso au clic et au clavier', () => {
    resetValeurs();
    const tabR = elements['tab-random'];
    const tabP = elements['tab-perso'];
    const panelR = elements['panel-random'];
    const panelP = elements['panel-perso'];
    assert.strictEqual(panelR.hidden, false, 'cas aléatoire visible par défaut');
    assert.strictEqual(panelP.hidden, true);
    tabP.listeners['click']();
    assert.strictEqual(panelP.hidden, false, 'panneau perso visible après clic');
    assert.strictEqual(panelR.hidden, true);
    assert.strictEqual(tabP.getAttribute('aria-selected'), 'true');
    assert.strictEqual(tabR.getAttribute('aria-selected'), 'false');
    tabP.listeners['keydown']({ key: 'ArrowLeft' });
    assert.strictEqual(panelR.hidden, false, 'ArrowLeft revient au cas aléatoire');
    assert.strictEqual(tabR.focusAppele, true);
    // Les deux groupes sont indépendants : le groupe « Résultats » n'a pas bougé
    assert.strictEqual(elements['panel-summary'].hidden, false);
    assert.strictEqual(elements['panel-detail'].hidden, true);
});

test('fmtEUR — formatage français des montants', () => {
    const formate = app.fmtEUR.format(180000);
    assert.ok(formate.includes('180'), 'montant présent');
    assert.ok(formate.includes('€'), 'symbole € présent');
    assert.ok(formate.includes('000'), 'séparateur de milliers présent');
});

test('lireParametres — validation des bornes et lecture de la radio', () => {
    resetValeurs();
    assert.strictEqual(app.lireParametres().valide, true);
    assert.strictEqual(app.lireParametres().params.optimiserBilan, false);
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
    resetValeurs();
    setValeur('taux_rendement', '2,5'); // virgule acceptée
    assert.strictEqual(app.lireParametres().params.tauxRendement, 0.025);
});
