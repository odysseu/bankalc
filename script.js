'use strict';

// Couche DOM de Bankalc. Les fonctions de calcul pures vivent dans calculs.js
// (chargé avant ce fichier dans index.html ; en global dans le navigateur).

const fmtEUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const PARAMETRES = [
    'montant_initial', 'montant_actuel', 'taux_rendement', 'abattement_fiscal',
    'montant_achat', 'taux_interet_emprunt', 'salaire_annuel', 'taux_effort_max',
    'montant_rachat_perso', 'duree_emprunt_perso'
];

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

const LABELS_COLONNES = [
    "Durée de l'emprunt (années)",
    "Part de l'assurance vie",
    "Montant du prêt",
    "Échéance mensuelle",
    "Intérêts payés",
    "Impôts sur la plus-value",
    "Coût total",
    "Valeur future de l'assurance vie",
    "Bilan"
];

const LABELS_COLONNES_ALEATOIRE = [
    "Durée de l'emprunt (années)",
    "Part de l'assurance vie",
    "Montant du prêt",
    "Intérêts payés",
    "Impôts sur la plus-value",
    "Coût total",
    "Valeur future de l'assurance vie",
    "Bilan"
];

let results = [];

// --- Persistance des saisies (localStorage) ---

function stockageDisponible() {
    return typeof localStorage !== 'undefined';
}

function sauvegarderParametres() {
    if (!stockageDisponible()) {
        return;
    }
    for (const id of PARAMETRES) {
        const el = document.getElementById(id);
        if (el) {
            localStorage.setItem('bankalc:' + id, el.value);
        }
    }
    const bilan = document.getElementById('optimisation_bilan');
    if (bilan) {
        localStorage.setItem('bankalc:optimisation', bilan.checked ? 'bilan' : 'cout');
    }
}

function restaurerParametres() {
    if (!stockageDisponible()) {
        return;
    }
    for (const id of PARAMETRES) {
        const el = document.getElementById(id);
        const saved = localStorage.getItem('bankalc:' + id);
        if (el && saved !== null) {
            el.value = saved;
        }
    }
    if (localStorage.getItem('bankalc:optimisation') === 'bilan') {
        document.getElementById('optimisation_bilan').checked = true;
        document.getElementById('optimisation_cout').checked = false;
    }
}

function reinitialiserFormulaire() {
    if (stockageDisponible()) {
        for (const id of PARAMETRES) {
            localStorage.removeItem('bankalc:' + id);
        }
        localStorage.removeItem('bankalc:optimisation');
    }
    for (const id of PARAMETRES) {
        const el = document.getElementById(id);
        if (el) {
            el.value = VALEURS_PAR_DEFAUT[id];
        }
    }
    document.getElementById('optimisation_cout').checked = true;
    document.getElementById('optimisation_bilan').checked = false;
    results = [];
    afficherErreur('');
    displayRecap(null);
    displayOptimalResult(null);
    displayResults([]);
    const aleatoire = document.getElementById('randomCaseTable');
    if (aleatoire) {
        aleatoire.innerHTML = '';
    }
    const perso = document.getElementById('persoResultTable');
    if (perso) {
        perso.querySelector('tbody').innerHTML = '';
    }
}

// --- Lecture et validation des paramètres ---

function lireParametres() {
    const get = (id) => parseNombre(document.getElementById(id).value);
    const params = {
        montantInitial: get('montant_initial'),
        montantActuel: get('montant_actuel'),
        tauxRendement: get('taux_rendement') / 100,
        abattementFiscal: get('abattement_fiscal'),
        montantAchat: get('montant_achat'),
        tauxInteretEmprunt: get('taux_interet_emprunt') / 100,
        salaireAnnuel: get('salaire_annuel'),
        tauxEffortMax: get('taux_effort_max') / 100,
        optimiserBilan: document.getElementById('optimisation_bilan').checked
    };
    const champs = ['montantInitial', 'montantActuel', 'tauxRendement', 'abattementFiscal', 'montantAchat', 'tauxInteretEmprunt', 'salaireAnnuel', 'tauxEffortMax'];
    const invalide = champs.some((champ) => !Number.isFinite(params[champ]));
    const horsLimites =
        params.montantInitial < 0 ||
        params.montantActuel < 0 ||
        params.abattementFiscal < 0 ||
        params.montantAchat < 0 ||
        params.salaireAnnuel < 0 ||
        params.tauxRendement < -1 ||
        params.tauxInteretEmprunt < 0 ||
        params.tauxEffortMax < 0 || params.tauxEffortMax > 1;
    return { params, valide: !invalide && !horsLimites };
}

function afficherErreur(message) {
    const banner = document.getElementById('error-banner');
    if (!banner) {
        return;
    }
    banner.textContent = message || '';
    banner.hidden = !message;
}

// --- Calcul principal ---

function calculate() {
    results = [];

    const { params, valide } = lireParametres();
    if (!valide) {
        afficherErreur('Paramètres invalides : veuillez saisir des nombres valides (montants >= 0, taux d\'emprunt >= 0, taux d\'effort entre 0 et 100 %).');
        displayRecap(null);
        displayOptimalResult(null);
        displayResults([]);
        return;
    }
    afficherErreur('');
    sauvegarderParametres();

    const tauxImposition = calculateTauxImposition(params.salaireAnnuel);
    const salaireMensuel = params.salaireAnnuel / 12;
    const effortMaxMensuel = salaireMensuel * params.tauxEffortMax;
    const optimiserBilan = params.optimiserBilan;

    let optimalResult = null;
    let bestValue = optimiserBilan ? -Infinity : Infinity;

    for (let dureeEmprunt = 1; dureeEmprunt <= 25; dureeEmprunt++) {
        const result = calculateOptimalX(params.montantInitial, params.montantActuel, params.tauxRendement, params.montantAchat, params.tauxInteretEmprunt, params.abattementFiscal, tauxImposition, dureeEmprunt, optimiserBilan);
        if (!result) {
            continue;
        }
        const pretOptimal = params.montantAchat - result.partAssurVieUtilisee;
        const mensualite = calculateMensualite(pretOptimal, params.tauxInteretEmprunt, dureeEmprunt);
        if (mensualite <= effortMaxMensuel) {
            const ligne = {
                dureeEmprunt,
                partAssurVieUtilisee: result.partAssurVieUtilisee,
                pret: pretOptimal,
                coutTotal: result.coutTotal,
                interetsPayes: result.interetsPayes,
                impotPlusValue: result.impotPlusValue,
                mensualite,
                valeurFutureAssuranceVie: result.valeurFutureAssuranceVie,
                bilan: result.bilan
            };
            results.push(ligne);
            const currentValue = optimiserBilan ? ligne.bilan : ligne.coutTotal;
            if ((optimiserBilan && currentValue > bestValue) || (!optimiserBilan && currentValue < bestValue)) {
                bestValue = currentValue;
                optimalResult = ligne;
            }
        }
    }
    if (optimalResult === null) {
        afficherErreur("Aucun plan ne respecte le taux d'effort maximal : essayez une durée plus longue ou un taux d'effort plus élevé.");
    }
    displayRecap(optimalResult, optimiserBilan);
    displayOptimalResult(optimalResult);
    displayResults(results);
}

// --- Onglets (pattern WAI-ARIA) : groupe « Résultats » et groupe « Autres simulations » ---
const GROUPES_ONGLETS = [
    { tabs: ['tab-summary', 'tab-detail'], panels: ['panel-summary', 'panel-detail'] },
    { tabs: ['tab-random', 'tab-perso'], panels: ['panel-random', 'panel-perso'] }
];

function initialiserOnglets() {
    for (const groupe of GROUPES_ONGLETS) {
        const onglets = groupe.tabs
            .map((id, i) => ({ tab: document.getElementById(id), panel: document.getElementById(groupe.panels[i]) }))
            .filter((o) => o.tab && o.panel);
        if (onglets.length === 0) {
            continue;
        }
        const activer = (index, avecFocus = false) => {
            onglets.forEach((o, i) => {
                const actif = i === index;
                o.tab.setAttribute('aria-selected', actif ? 'true' : 'false');
                o.tab.tabIndex = actif ? 0 : -1;
                o.panel.hidden = !actif;
                if (actif && avecFocus && typeof o.tab.focus === 'function') {
                    o.tab.focus();
                }
            });
        };
        onglets.forEach((o, i) => {
            o.tab.addEventListener('click', () => activer(i));
            o.tab.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') {
                    activer((i + 1) % onglets.length, true);
                } else if (e.key === 'ArrowLeft') {
                    activer((i - 1 + onglets.length) % onglets.length, true);
                } else if (e.key === 'Home') {
                    activer(0, true);
                } else if (e.key === 'End') {
                    activer(onglets.length - 1, true);
                }
            });
        });
        activer(0);
    }
}

// Wrapper du bouton « Calculer » : laisse le navigateur peindre l'état « en cours »
// avant le calcul synchrone, puis ramène la vue sur le résultat (utile sur mobile,
// où le clavier virtuel a déplacé la page).
function onCalculateClick() {
    const btn = document.getElementById('calculate-button');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Calcul en cours…';
    }
    return new Promise((resolve) => {
        setTimeout(() => {
            calculate();
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Calculer';
            }
            const table = document.getElementById('optimalResultTable');
            if (table && typeof table.scrollIntoView === 'function') {
                table.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            resolve();
        }, 30);
    });
}

// --- Affichage ---

function enTeteTableau(labels) {
    return `<tr>${labels.map((l) => `<th scope="col">${l}</th>`).join('')}</tr>`;
}

function ligneValeurs(row, valeurs) {
    valeurs.forEach((texte, i) => {
        const cell = row.insertCell(i);
        cell.innerText = texte;
        if (cell.dataset) {
            cell.dataset.label = LABELS_COLONNES[i];
        }
    });
}

function ligneVide(table, label) {
    const row = table.insertRow();
    const cell = row.insertCell(0);
    cell.colSpan = LABELS_COLONNES.length;
    cell.innerText = label;
}

function displayRecap(result, optimiserBilan) {
    const card = document.getElementById('recapCard');
    if (!card) {
        return;
    }
    if (!result) {
        card.hidden = true;
        card.innerHTML = '';
        return;
    }
    card.hidden = false;
    const objectif = optimiserBilan ? 'Bilan' : 'Coût total';
    const valeurObjectif = optimiserBilan ? result.bilan : result.coutTotal;
    card.innerHTML = `
        <div class="recap-item"><span class="recap-label">Durée du prêt</span><span class="recap-value">${result.dureeEmprunt} ans</span></div>
        <div class="recap-item"><span class="recap-label">Racheté sur l'assurance-vie</span><span class="recap-value">${fmtEUR.format(result.partAssurVieUtilisee)}</span></div>
        <div class="recap-item"><span class="recap-label">Mensualité</span><span class="recap-value">${fmtEUR.format(result.mensualite)}/mois</span></div>
        <div class="recap-item"><span class="recap-label">${objectif}</span><span class="recap-value">${fmtEUR.format(valeurObjectif)}</span></div>
    `;
}

function displayResults(lignes) {
    const table = document.getElementById('resultsTable');
    table.innerHTML = enTeteTableau(LABELS_COLONNES);
    if (!lignes || lignes.length === 0) {
        ligneVide(table, 'Aucun résultat');
        return;
    }
    lignes.forEach((result) => {
        ligneValeurs(table.insertRow(), [
            String(result.dureeEmprunt),
            fmtEUR.format(result.partAssurVieUtilisee),
            fmtEUR.format(result.pret),
            fmtEUR.format(result.mensualite),
            fmtEUR.format(result.interetsPayes),
            fmtEUR.format(result.impotPlusValue),
            fmtEUR.format(result.coutTotal),
            fmtEUR.format(result.valeurFutureAssuranceVie),
            fmtEUR.format(result.bilan)
        ]);
    });
}

function displayOptimalResult(result) {
    const table = document.getElementById('optimalResultTable');
    // Pas de ligne d'en-tête : la ligne de données suffit (les intitulés figurent
    // dans la carte récap et dans les data-label des cellules en mode mobile).
    table.innerHTML = '';
    if (!result) {
        ligneVide(table, 'Aucun résultat');
        return;
    }
    ligneValeurs(table.insertRow(), [
        String(result.dureeEmprunt),
        fmtEUR.format(result.partAssurVieUtilisee),
        fmtEUR.format(result.pret),
        fmtEUR.format(result.mensualite),
        fmtEUR.format(result.interetsPayes),
        fmtEUR.format(result.impotPlusValue),
        fmtEUR.format(result.coutTotal),
        fmtEUR.format(result.valeurFutureAssuranceVie),
        fmtEUR.format(result.bilan)
    ]);
}

function calculateRandomCase() {
    const table = document.getElementById('randomCaseTable');
    if (!results || results.length === 0) {
        table.innerHTML = `<tr><td colspan="8">Lancez d'abord un calcul avant de comparer avec un cas aléatoire.</td></tr>`;
        return;
    }

    const { params, valide } = lireParametres();
    if (!valide) {
        table.innerHTML = `<tr><td colspan="8">Paramètres invalides.</td></tr>`;
        return;
    }

    const minDureeEmprunt = Math.min(...results.map(r => r.dureeEmprunt));
    const maxDureeEmprunt = Math.max(...results.map(r => r.dureeEmprunt));

    const dureeEmprunt = Math.floor(Math.random() * (maxDureeEmprunt - minDureeEmprunt + 1)) + minDureeEmprunt;
    const tauxImposition = calculateTauxImposition(params.salaireAnnuel);
    const rachatMaximumAssuranceVie = params.montantActuel - coutRachatAssuranceVie(params.montantActuel, params.abattementFiscal, params.montantActuel, params.montantInitial, tauxImposition);
    const maxXRandom = Math.max(0, Math.min(rachatMaximumAssuranceVie, params.montantAchat, params.montantActuel));
    const xRandom = Math.min(maxXRandom, Math.floor(Math.random() * (maxXRandom + 1)));

    const coutRachatAssurVie = coutRachatAssuranceVie(xRandom, params.abattementFiscal, params.montantActuel, params.montantInitial, tauxImposition);
    const montantEmprunte = params.montantAchat - xRandom;
    const coutTotalEmprunt = coutEmprunt(montantEmprunte, params.tauxInteretEmprunt, dureeEmprunt);

    const resteAssuranceVie = params.montantActuel - xRandom;
    const valeurFutureAssuranceVie = resteAssuranceVie * Math.pow(1 + params.tauxRendement, dureeEmprunt);

    const coutTotalRandom = coutTotalEmprunt + coutRachatAssurVie;
    const bilan = valeurFutureAssuranceVie - coutTotalRandom;

    // Pas de ligne d'en-tête : les titres vivent dans les data-label des cellules
    // (affichés via td::before en mode carte sur mobile).
    const valeursAleatoire = [
        String(dureeEmprunt),
        fmtEUR.format(xRandom),
        fmtEUR.format(montantEmprunte),
        fmtEUR.format(coutTotalEmprunt),
        fmtEUR.format(coutRachatAssurVie),
        fmtEUR.format(coutTotalRandom),
        fmtEUR.format(valeurFutureAssuranceVie),
        fmtEUR.format(bilan)
    ];
    table.innerHTML = `<tr>${valeursAleatoire.map((v, i) => `<td data-label="${LABELS_COLONNES_ALEATOIRE[i]}">${v}</td>`).join('')}</tr>`;
}

function calculatePerso() {
    const table = document.getElementById('persoResultTable');
    const { params, valide } = lireParametres();
    const x = parseNombre(document.getElementById('montant_rachat_perso').value);
    const dureeEmprunt = parseInt(document.getElementById('duree_emprunt_perso').value, 10);

    const invalide = !valide || !Number.isFinite(x) || !Number.isFinite(dureeEmprunt) ||
        x < 0 || x > params.montantActuel || x > params.montantAchat || dureeEmprunt < 1;
    if (invalide) {
        table.querySelector('tbody').innerHTML = `<tr><td colspan="9">Paramètres invalides : le rachat doit être compris entre 0 et le capital actuel (et ne pas dépasser le coût de l'achat), et la durée doit être d'au moins 1 an.</td></tr>`;
        return;
    }

    const tauxImposition = calculateTauxImposition(params.salaireAnnuel);
    const result = coutOperation(x, params.abattementFiscal, params.montantActuel, params.montantInitial, tauxImposition, params.tauxRendement, params.montantAchat, params.tauxInteretEmprunt, dureeEmprunt);
    const pret = params.montantAchat - x;
    const mensualite = calculateMensualite(pret, params.tauxInteretEmprunt, dureeEmprunt);

    // Pas de ligne d'en-tête : les libellés vivent dans les data-label des cellules
    // (affichés via td::before en mode carte sur mobile).
    const valeursPerso = [
        String(dureeEmprunt),
        fmtEUR.format(x),
        fmtEUR.format(pret),
        fmtEUR.format(mensualite),
        fmtEUR.format(result.interetsPayes),
        fmtEUR.format(result.impotPlusValue),
        fmtEUR.format(result.coutTotal),
        fmtEUR.format(result.valeurFutureAssuranceVie),
        fmtEUR.format(result.bilan)
    ];
    table.querySelector('tbody').innerHTML = `<tr>${valeursPerso.map((v, i) => `<td data-label="${LABELS_COLONNES[i]}">${v}</td>`).join('')}</tr>`;
}

// --- Chargement différé de MathJax (formules) ---
// La config window.MathJax doit être posée AVANT d'injecter le script CDN :
// sinon on écraserait l'objet interne de MathJax (MathJax._) et on provoquerait
// un « Cannot read properties of undefined (reading 'components') ».
// MathJax n'est chargé qu'à la première ouverture du <details> des formules :
// la calculatrice reste utilisable (et rapide) si le CDN est indisponible.
function chargerMathJaxAuPremierAffichage() {
    const details = document.getElementById('formula-details');
    if (!details || typeof document.createElement !== 'function' || !document.head) {
        return;
    }
    let charge = false;
    details.addEventListener('toggle', () => {
        if (!details.open || charge) {
            return;
        }
        charge = true;
        if (typeof window !== 'undefined') {
            window.MathJax = window.MathJax || {};
            window.MathJax.tex = { packages: { '[+]': ['class'] } };
        }
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.min.js';
        document.head.appendChild(script);
    });
}

// --- Initialisation navigateur ---

if (typeof document !== 'undefined') {
    chargerMathJaxAuPremierAffichage();
    initialiserOnglets();
    for (const id of PARAMETRES) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', sauvegarderParametres);
        }
    }
    const radioCout = document.getElementById('optimisation_cout');
    const radioBilan = document.getElementById('optimisation_bilan');
    if (radioCout) {
        radioCout.addEventListener('change', sauvegarderParametres);
    }
    if (radioBilan) {
        radioBilan.addEventListener('change', sauvegarderParametres);
    }
    const reset = document.getElementById('reset-button');
    if (reset) {
        reset.addEventListener('click', reinitialiserFormulaire);
    }
    restaurerParametres();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fmtEUR,
        calculate,
        onCalculateClick,
        calculateRandomCase,
        calculatePerso,
        displayResults,
        displayOptimalResult,
        displayRecap,
        lireParametres,
        afficherErreur,
        sauvegarderParametres,
        restaurerParametres,
        reinitialiserFormulaire,
        chargerMathJaxAuPremierAffichage,
        initialiserOnglets,
        getResults: () => results
    };
}
