'use strict';

// Couche DOM de Bankalc. Les fonctions de calcul pures vivent dans calculs.js
// (chargé avant ce fichier dans index.html ; en global dans le navigateur).

let results = [];

function lireParametres() {
    const get = (id) => parseFloat(document.getElementById(id).value);
    const params = {
        montantInitial: get('montant_initial'),
        montantActuel: get('montant_actuel'),
        tauxRendement: get('taux_rendement') / 100,
        abattementFiscal: get('abattement_fiscal'),
        montantAchat: get('montant_achat'),
        tauxInteretEmprunt: get('taux_interet_emprunt') / 100,
        salaireAnnuel: get('salaire_annuel'),
        tauxEffortMax: get('taux_effort_max') / 100
    };
    const champs = Object.keys(params);
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

function calculate() {
    results = [];

    const { params, valide } = lireParametres();
    if (!valide) {
        displayOptimalResult(null, "Paramètres invalides : veuillez saisir des nombres valides (montants >= 0, taux d'emprunt >= 0, taux d'effort entre 0 et 100 %).");
        displayResults([]);
        return;
    }

    const tauxImposition = calculateTauxImposition(params.salaireAnnuel);
    const salaireMensuel = params.salaireAnnuel / 12;
    const effortMaxMensuel = salaireMensuel * params.tauxEffortMax;
    const optimiserBilan = document.getElementById('optimiser_bilan').checked;

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
    displayOptimalResult(optimalResult, optimalResult === null ? "Aucun plan ne respecte le taux d'effort maximal : essayez une durée plus longue ou un taux d'effort plus élevé." : null);
    displayResults(results);
}

function displayResults(lignes) {
    const table = document.getElementById('resultsTable');
    table.innerHTML = `
        <tr>
            <th>Durée de l'emprunt (années)</th>
            <th>Part optimale de l'assurance vie (€)</th>
            <th>Montant du prêt (€)</th>
            <th>Échéance mensuelle (€)</th>
            <th>Intérêts payés (€)</th>
            <th>Impôts payés sur la plus-value (€)</th>
            <th>Coût total (€)</th>
            <th>Valeur future de l'assurance vie (€)</th>
            <th>Bilan (€)</th>
        </tr>
    `;
    if (!lignes || lignes.length === 0) {
        const row = table.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 9;
        cell.innerText = "Aucun résultat";
        return;
    }
    lignes.forEach(result => {
        const row = table.insertRow();
        row.insertCell(0).innerText = result.dureeEmprunt;
        row.insertCell(1).innerText = result.partAssurVieUtilisee.toFixed(2);
        row.insertCell(2).innerText = result.pret.toFixed(2);
        row.insertCell(3).innerText = result.mensualite.toFixed(2);
        row.insertCell(4).innerText = result.interetsPayes.toFixed(2);
        row.insertCell(5).innerText = result.impotPlusValue.toFixed(2);
        row.insertCell(6).innerText = result.coutTotal.toFixed(2);
        row.insertCell(7).innerText = result.valeurFutureAssuranceVie.toFixed(2);
        row.insertCell(8).innerText = result.bilan.toFixed(2);
    });
}

function displayOptimalResult(result, messageErreur = null) {
    const table = document.getElementById('optimalResultTable');
    table.innerHTML = `
        <tr>
            <th>Durée de l'emprunt (années)</th>
            <th>Part optimale de l'assurance vie (€)</th>
            <th>Montant du prêt (€)</th>
            <th>Échéance mensuelle (€)</th>
            <th>Intérêts payés (€)</th>
            <th>Impôts payés sur la plus-value (€)</th>
            <th>Coût total (€)</th>
            <th>Valeur future de l'assurance vie (€)</th>
            <th>Bilan (€)</th>
        </tr>
    `;
    if (messageErreur || !result) {
        const row = table.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 9;
        cell.innerText = messageErreur || "Aucun résultat";
        return;
    }
    const row = table.insertRow();
    row.insertCell(0).innerText = result.dureeEmprunt;
    row.insertCell(1).innerText = result.partAssurVieUtilisee.toFixed(2);
    row.insertCell(2).innerText = result.pret.toFixed(2);
    row.insertCell(3).innerText = result.mensualite.toFixed(2);
    row.insertCell(4).innerText = result.interetsPayes.toFixed(2);
    row.insertCell(5).innerText = result.impotPlusValue.toFixed(2);
    row.insertCell(6).innerText = result.coutTotal.toFixed(2);
    row.insertCell(7).innerText = result.valeurFutureAssuranceVie.toFixed(2);
    row.insertCell(8).innerText = result.bilan.toFixed(2);
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

    // Choisir une année aléatoire entre minDureeEmprunt et maxDureeEmprunt
    const dureeEmprunt = Math.floor(Math.random() * (maxDureeEmprunt - minDureeEmprunt + 1)) + minDureeEmprunt;
    const rachatMaximumAssuranceVie = params.montantActuel - coutRachatAssuranceVie(params.montantActuel, params.abattementFiscal, params.montantActuel, params.montantInitial, calculateTauxImposition(params.salaireAnnuel));
    const maxXRandom = Math.max(0, Math.min(rachatMaximumAssuranceVie, params.montantAchat, params.montantActuel));
    const xRandom = Math.min(maxXRandom, Math.floor(Math.random() * (maxXRandom + 1)));

    const coutRachatAssurVie = coutRachatAssuranceVie(xRandom, params.abattementFiscal, params.montantActuel, params.montantInitial, calculateTauxImposition(params.salaireAnnuel));
    const montantEmprunte = params.montantAchat - xRandom;
    const coutTotalEmprunt = coutEmprunt(montantEmprunte, params.tauxInteretEmprunt, dureeEmprunt);

    const resteAssuranceVie = params.montantActuel - xRandom;
    const valeurFutureAssuranceVie = resteAssuranceVie * Math.pow(1 + params.tauxRendement, dureeEmprunt);

    const coutTotalRandom = coutTotalEmprunt + coutRachatAssurVie;
    const bilan = valeurFutureAssuranceVie - coutTotalRandom;

    table.innerHTML = `
        <tr>
            <th>Durée de l'emprunt (années)</th>
            <th>Part de l'assurance vie (€)</th>
            <th>Montant du prêt (€)</th>
            <th>Intérêts payés (€)</th>
            <th>Impôts payés sur la plus-value (€)</th>
            <th>Coût total (€)</th>
            <th>Valeur future de l'assurance vie (€)</th>
            <th>Bilan (€)</th>
        </tr>
        <tr>
            <td>${dureeEmprunt}</td>
            <td>${xRandom.toFixed(2)}</td>
            <td>${montantEmprunte.toFixed(2)}</td>
            <td>${coutTotalEmprunt.toFixed(2)}</td>
            <td>${coutRachatAssurVie.toFixed(2)}</td>
            <td>${coutTotalRandom.toFixed(2)}</td>
            <td>${valeurFutureAssuranceVie.toFixed(2)}</td>
            <td>${bilan.toFixed(2)}</td>
        </tr>
    `;
}

function calculatePerso() {
    const table = document.getElementById('persoResultTable');
    const { params, valide } = lireParametres();
    const x = parseFloat(document.getElementById('montant_rachat_perso').value);
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

    table.querySelector('tbody').innerHTML = `
        <tr>
            <td>${dureeEmprunt}</td>
            <td>${x.toFixed(2)}</td>
            <td>${pret.toFixed(2)}</td>
            <td>${mensualite.toFixed(2)}</td>
            <td>${result.interetsPayes.toFixed(2)}</td>
            <td>${result.impotPlusValue.toFixed(2)}</td>
            <td>${result.coutTotal.toFixed(2)}</td>
            <td>${result.valeurFutureAssuranceVie.toFixed(2)}</td>
            <td>${result.bilan.toFixed(2)}</td>
        </tr>
    `;
}

if (typeof document !== 'undefined') {
    document.getElementById('optimiser_bilan').addEventListener('change', function () {
        const label = document.getElementById('optimisation-label');
        label.textContent = this.checked ? "Bilan" : "Coût des impôts";
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculate,
        calculateRandomCase,
        calculatePerso,
        displayResults,
        displayOptimalResult,
        lireParametres,
        getResults: () => results
    };
}
