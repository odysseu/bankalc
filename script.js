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
    let tauxMinimum = 0;
    for (const tranche of tranches) {
        if (salaireAnnuel <= tranche.seuil) {
            tauxMinimum = tranche.taux;
            break;
        }
    }
    return Math.min(tauxMinimum, 0.197); // 7.5% + 12.2% de CSG/CRDS
}

function coutRachatAssuranceVie(x, abattementFiscal, montantActuel, montantInitial, tauxImposition) {
    const plusValueRetrait = x - abattementFiscal;
    const plusValueImposableRetrait = Math.max(0, plusValueRetrait);
    const pourcentPlusValue = Math.max(0, (montantActuel - montantInitial) / montantInitial);
    const coutRachatAssurVie = tauxImposition * pourcentPlusValue * plusValueImposableRetrait;
    return coutRachatAssurVie;
}

function coutEmprunt(x, montantAchat, tauxInteretEmprunt, dureeEmprunt) {
    const capitalEmprunte = montantAchat - x;
    const mensualite = calculateMensualite(capitalEmprunte, tauxInteretEmprunt, dureeEmprunt);
    const totalPaye = mensualite * dureeEmprunt * 12;
    return totalPaye - capitalEmprunte; // Total des intérêts payés
}

function coutOperation(x, abattementFiscal, montantActuel, montantInitial, tauxImposition, tauxRendement, montantAchat, tauxInteretEmprunt, dureeEmprunt) {
    const coutRachatAssurVie = coutRachatAssuranceVie(x, abattementFiscal, montantActuel, montantInitial, tauxImposition);
    const coutEmpr = coutEmprunt(x, montantAchat, tauxInteretEmprunt, dureeEmprunt);
    const resteAssuranceVie = montantActuel - x;
    const valeurFutureAssuranceVie = resteAssuranceVie * (Math.pow(1 + tauxRendement, dureeEmprunt) - 1);
    const coutTotal = coutRachatAssurVie + coutEmpr;
    return {
        partAssurVieUtilisee: x,
        coutTotal: coutTotal,
        interetsPayes: coutEmpr,
        impotPlusValue: coutRachatAssurVie,
        valeurFutureAssuranceVie: valeurFutureAssuranceVie
    };
}

function calculateOptimalX(montantInitial, montantActuel, tauxRendement, montantAchat, tauxInteretEmprunt, abattementFiscal, tauxImposition, dureeEmprunt) {
    let xOptimal = 0;
    let minCoutOperation = coutOperation(0, abattementFiscal, montantActuel, montantInitial, tauxImposition, tauxRendement, montantAchat, tauxInteretEmprunt, dureeEmprunt);
    const rachatMaximumAssuranceVie = montantActuel - coutRachatAssuranceVie(montantActuel, abattementFiscal, montantActuel, montantInitial, tauxImposition);

    for (let x = 1; x <= Math.min(montantAchat, rachatMaximumAssuranceVie); x++) {
        const coutOpe = coutOperation(x, abattementFiscal, montantActuel, montantInitial, tauxImposition, tauxRendement, montantAchat, tauxInteretEmprunt, dureeEmprunt);
        if (coutOpe.coutTotal < minCoutOperation.coutTotal) {
            minCoutOperation = coutOpe;
            xOptimal = x;
        }
    }
    return { ...minCoutOperation, xOptimal };
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
    let optimalResult = null;
    let minCost = Infinity;

    for (let dureeEmprunt = 1; dureeEmprunt <= 25; dureeEmprunt++) {
        const result = calculateOptimalX(montantInitial, montantActuel, tauxRendement, montantAchat, tauxInteretEmprunt, abattementFiscal, tauxImposition, dureeEmprunt);
        const pretOptimal = montantAchat - result.xOptimal;
        const bilan = result.valeurFutureAssuranceVie - result.coutTotal;
        const mensualite = calculateMensualite(pretOptimal, tauxInteretEmprunt, dureeEmprunt);

        if (mensualite <= effortMaxMensuel) {
            results.push({
                dureeEmprunt: dureeEmprunt,
                partAssurVieUtilisee: result.partAssurVieUtilisee,
                pret: montantAchat - result.partAssurVieUtilisee,
                coutTotal: result.coutTotal,
                interetsPayes: result.interetsPayes,
                impotPlusValue: result.impotPlusValue,
                mensualite: mensualite,
                valeurFutureAssuranceVie: result.valeurFutureAssuranceVie,
                bilan: bilan
            });

            if (result.coutTotal < minCost) {
                minCost = result.coutTotal;
                optimalResult = {
                    dureeEmprunt,
                    xOptimal: result.xOptimal,
                    pret: montantAchat - result.partAssurVieUtilisee,
                    coutTotal: result.coutTotal,
                    interetsPayes: result.interetsPayes,
                    impotPlusValue: result.impotPlusValue,
                    mensualite: mensualite,
                    valeurFutureAssuranceVie: result.valeurFutureAssuranceVie,
                    bilan: bilan
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
            <td>${result.xOptimal.toFixed(2)}</td>
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
    const xRandom = Math.floor(Math.random() * montantActuel);

    // Calculer les détails pour le cas aléatoire
    const coutRachatAssurVie = coutRachatAssuranceVie(xRandom, abattementFiscal, montantActuel, montantInitial, tauxImposition);

    const montantPret = montantAchat - xRandom;
    // const M = calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt);
    // const totalPaye = M * dureeEmprunt * 12;
    const coutTotalEmprunt = coutEmprunt(xRandom, montantAchat, tauxInteretEmprunt, dureeEmprunt);

    
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
            <td>${montantPret.toFixed(2)}</td>
            <td>${coutTotalEmprunt.toFixed(2)}</td>
            <td>${coutRachatAssurVie.toFixed(2)}</td>
            <td>${coutTotalRandom.toFixed(2)}</td>
            <td>${valeurFutureAssuranceVie.toFixed(2)}</td>
            <td>${bilan.toFixed(2)}</td>
        </tr>
    `;
}
