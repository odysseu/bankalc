function calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt) {
    const rMensuel = tauxInteretEmprunt / 12;
    const nMensualites = dureeEmprunt * 12;
    return (C * rMensuel) / (1 - 1 / Math.pow(1 + rMensuel, nMensualites));
}

function calculateTauxImposition(salaireAnnuel) {
    const tranches = [
        { seuil: 11497, taux: 0 },
        { seuil: 29315, taux: 0.11 },
        { seuil: 83823, taux: 0.30 },
        { seuil: 180294, taux: 0.41 },
        { seuil: Infinity, taux: 0.45 }
    ];
    for (const tranche of tranches) {
        if (salaireAnnuel <= tranche.seuil) {
            return Math.min(tranche.taux, 0.197);
        }
    }
    return 0.197;
}

document.getElementById('optimiser_bilan').addEventListener('change', function () {
    const label = document.getElementById('optimisation-label');
    label.textContent = this.checked ? "Bilan" : "Coût des impôts";
});

function coutRachatAssuranceVie(x, abattementFiscal, montantActuel, montantInitial, tauxImposition) {
    const plusValueImposableRetrait = Math.max(0, x * ((montantActuel - montantInitial) / montantActuel) - abattementFiscal);
    const imposition = 0.172 + Math.min(tauxImposition, 0.075); // Prélèvement sociaux (CSG + CRDS) + prélèvement forfaitaire
    return imposition * plusValueImposableRetrait;
}

function coutEmprunt(x, tauxInteretEmprunt, dureeEmprunt) {
    const mensualite = calculateMensualite(x, tauxInteretEmprunt, dureeEmprunt);
    return mensualite * dureeEmprunt * 12 - x;
}

function coutOperation(x, abattementFiscal, montantActuel, montantInitial, tauxImposition, tauxRendement, montantAchat, tauxInteretEmprunt, dureeEmprunt) {
    const coutRachat = coutRachatAssuranceVie(x, abattementFiscal, montantActuel, montantInitial, tauxImposition);
    const coutEmpr = coutEmprunt(montantAchat - x, tauxInteretEmprunt, dureeEmprunt);
    const resteAssuranceVie = montantActuel - x;
    const valeurFutureAssuranceVie = resteAssuranceVie * (Math.pow(1 + tauxRendement, dureeEmprunt) - 1);
    const bilan = valeurFutureAssuranceVie - (coutRachat + coutEmpr);
    return {
        partAssurVieUtilisee: x,
        coutTotal: coutRachat + coutEmpr,
        interetsPayes: coutEmpr,
        impotPlusValue: coutRachat,
        valeurFutureAssuranceVie,
        bilan
    };
}

function calculateOptimalX(montantInitial, montantActuel, tauxRendement, montantAchat, tauxInteretEmprunt, abattementFiscal, tauxImposition, dureeEmprunt, optimiserBilan = false) {
    let optimalResult = null;
    let bestValue = optimiserBilan ? -Infinity : Infinity;
    const rachatMaximumAssuranceVie = montantActuel - coutRachatAssuranceVie(montantActuel, abattementFiscal, montantActuel, montantInitial, tauxImposition);
    const maxX = Math.min(montantAchat, rachatMaximumAssuranceVie);

    for (let x = 0; x <= maxX; x += 1) {
        const result = coutOperation(x, abattementFiscal, montantActuel, montantInitial, tauxImposition, tauxRendement, montantAchat, tauxInteretEmprunt, dureeEmprunt);
        const currentValue = optimiserBilan ? result.bilan : result.coutTotal;
        if ((optimiserBilan && currentValue > bestValue) || (!optimiserBilan && currentValue < bestValue)) {
            bestValue = currentValue;
            optimalResult = result;
            optimalResult.partAssurVieUtilisee = x;
        }
    }
    return optimalResult;
}

let results = [];

function calculate() {
    results = [];

    const montantInitial = parseFloat(document.getElementById('montant_initial').value);
    const montantActuel = parseFloat(document.getElementById('montant_actuel').value);
    const tauxRendement = parseFloat(document.getElementById('taux_rendement').value) / 100;
    const abattementFiscal = parseFloat(document.getElementById('abattement_fiscal').value);
    const montantAchat = parseFloat(document.getElementById('montant_achat').value);
    const tauxInteretEmprunt = parseFloat(document.getElementById('taux_interet_emprunt').value) / 100;
    const salaireAnnuel = parseFloat(document.getElementById('salaire_annuel').value);
    const tauxEffortMax = parseFloat(document.getElementById('taux_effort_max').value) / 100;
    const tauxImposition = calculateTauxImposition(salaireAnnuel);
    const salaireMensuel = salaireAnnuel / 12;
    const effortMaxMensuel = salaireMensuel * tauxEffortMax;
    const optimiserBilan = document.getElementById('optimiser_bilan').checked;

    let optimalResult = null;
    let bestValue = optimiserBilan ? -Infinity : Infinity;

    for (let dureeEmprunt = 1; dureeEmprunt <= 25; dureeEmprunt++) {
        const result = calculateOptimalX(montantInitial, montantActuel, tauxRendement, montantAchat, tauxInteretEmprunt, abattementFiscal, tauxImposition, dureeEmprunt, optimiserBilan);
        const pretOptimal = montantAchat - result.partAssurVieUtilisee;
        const mensualite = calculateMensualite(pretOptimal, tauxInteretEmprunt, dureeEmprunt);
        if (mensualite <= effortMaxMensuel) {
            results.push({
                dureeEmprunt,
                partAssurVieUtilisee: result.partAssurVieUtilisee,
                pret: pretOptimal,
                coutTotal: result.coutTotal,
                interetsPayes: result.interetsPayes,
                impotPlusValue: result.impotPlusValue,
                mensualite,
                valeurFutureAssuranceVie: result.valeurFutureAssuranceVie,
                bilan: result.bilan
            });
            const currentValue = optimiserBilan ? result.bilan : result.coutTotal;
            if ((optimiserBilan && currentValue > bestValue) || (!optimiserBilan && currentValue < bestValue)) {
                bestValue = currentValue;
                optimalResult = {
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
            }
        }
    }
    displayOptimalResult(optimalResult);
    displayResults(results);
}

function displayResults(results) {
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
    results.forEach(result => {
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

function displayOptimalResult(result) {
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
        <tr>
            <td>${result.dureeEmprunt}</td>
            <td>${result.partAssurVieUtilisee.toFixed(2)}</td>
            <td>${result.pret.toFixed(2)}</td>
            <td>${result.mensualite.toFixed(2)}</td>
            <td>${result.interetsPayes.toFixed(2)}</td>
            <td>${result.impotPlusValue.toFixed(2)}</td>
            <td>${result.coutTotal.toFixed(2)}</td>
            <td>${result.valeurFutureAssuranceVie.toFixed(2)}</td>
            <td>${result.bilan.toFixed(2)}</td>
        </tr>
    `;
}

function calculateRandomCase() {
    const montantInitial = parseFloat(document.getElementById('montant_initial').value);
    const montantActuel = parseFloat(document.getElementById('montant_actuel').value);
    const tauxRendement = parseFloat(document.getElementById('taux_rendement').value) / 100;
    const abattementFiscal = parseFloat(document.getElementById('abattement_fiscal').value);
    const montantAchat = parseFloat(document.getElementById('montant_achat').value);
    const tauxInteretEmprunt = parseFloat(document.getElementById('taux_interet_emprunt').value) / 100;
    const salaireAnnuel = parseFloat(document.getElementById('salaire_annuel').value);
    const tauxImposition = calculateTauxImposition(salaireAnnuel);

    // Calculer les valeurs minimales et maximales de dureeEmprunt à partir de results
    const minDureeEmprunt = Math.min(...results.map(r => r.dureeEmprunt));
    const maxDureeEmprunt = Math.max(...results.map(r => r.dureeEmprunt));

    // Choisir une année aléatoire entre minDureeEmprunt et maxDureeEmprunt
    const dureeEmprunt = Math.floor(Math.random() * (maxDureeEmprunt - minDureeEmprunt + 1)) + minDureeEmprunt;
    const rachatMaximumAssuranceVie = montantActuel - coutRachatAssuranceVie(montantActuel, abattementFiscal, montantActuel, montantInitial, tauxImposition);
    const xRandom = Math.floor(Math.random() * rachatMaximumAssuranceVie);

    // Calculer les détails pour le cas aléatoire
    const coutRachatAssurVie = coutRachatAssuranceVie(xRandom, abattementFiscal, montantActuel, montantInitial, tauxImposition);
    // const M = calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt);
    // const totalPaye = M * dureeEmprunt * 12;
    const montantEmprunte = montantAchat - xRandom;
    const coutTotalEmprunt = coutEmprunt(montantEmprunte, tauxInteretEmprunt, dureeEmprunt);


    const resteAssuranceVie = montantActuel - xRandom;
    const valeurFutureAssuranceVie = resteAssuranceVie * (Math.pow(1 + tauxRendement, dureeEmprunt) - 1);
    // const impotPlusValueFutur = coutRetraitAssuranceVie(xRandom, abattementFiscal, valeurFutureAssuranceVie, montantInitial, tauxImposition);

    const coutTotalRandom = coutTotalEmprunt + coutRachatAssurVie; // + impotPlusValueFutur;
    const bilan = valeurFutureAssuranceVie - coutTotalRandom;

    // Afficher les résultats du cas aléatoire
    const table = document.getElementById('randomCaseTable');
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
    const montantInitial = parseFloat(document.getElementById('montant_initial').value);
    const montantActuel = parseFloat(document.getElementById('montant_actuel').value);
    const tauxRendement = parseFloat(document.getElementById('taux_rendement').value) / 100;
    const abattementFiscal = parseFloat(document.getElementById('abattement_fiscal').value);
    const montantAchat = parseFloat(document.getElementById('montant_achat').value);
    const tauxInteretEmprunt = parseFloat(document.getElementById('taux_interet_emprunt').value) / 100;
    const salaireAnnuel = parseFloat(document.getElementById('salaire_annuel').value);
    const tauxImposition = calculateTauxImposition(salaireAnnuel);

    const x = parseFloat(document.getElementById('montant_rachat_perso').value);
    const dureeEmprunt = parseInt(document.getElementById('duree_emprunt_perso').value);

    // Calculs
    const result = coutOperation(x, abattementFiscal, montantActuel, montantInitial, tauxImposition, tauxRendement, montantAchat, tauxInteretEmprunt, dureeEmprunt);
    const pret = montantAchat - x;
    const mensualite = calculateMensualite(pret, tauxInteretEmprunt, dureeEmprunt);

    // Affichage
    const table = document.getElementById('persoResultTable');
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
