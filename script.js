function calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt) {
    const rMensuel = tauxInteretEmprunt / 12;
    const nMensualites = dureeEmprunt * 12;
    return  (C * rMensuel) / (1 - 1/(Math.pow(1 + rMensuel, nMensualites)));
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
            return tranche.taux;
        }
    }
}

function calculateCoutRetraitAssuranceVie(x, abattementFiscal, montantActuel, montantInitial, tauxImposition) {
        const plusValueRetrait = x - abattementFiscal;
        const plusValueImposableRetrait = Math.max(0, plusValueRetrait);
        const pourcentPlusValue = Math.max(0, (montantActuel - montantInitial) / montantActuel);
        const coutRetraitAssuranceVie = tauxImposition * pourcentPlusValue * plusValueImposableRetrait;
        return coutRetraitAssuranceVie;
}

function calculateOptimalX(montantInitial, montantActuel, tauxRendement, montantAchat, tauxInteretEmprunt, abattementFiscal, tauxImposition, dureeEmprunt) {
    function coutTotalCombine(x) {
        const coutRetraitAssuranceVie = calculateCoutRetraitAssuranceVie(x, abattementFiscal, montantActuel, montantInitial, tauxImposition)

        // Coût d'emprunter (montantAchat - x) euros sur la période d'emprunt
        const C = montantAchat - x;
        const M = calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt);
        const totalPaye = M * dureeEmprunt * 12;
        const coutTotalEmprunt = totalPaye - C; // Total des intérêts payés

        // Plus-value générée par le reste de l'assurance vie sur la période d'emprunt
        const resteAssuranceVie = montantActuel - x;
        const valeurFutureAssuranceVie = resteAssuranceVie * Math.pow(1 + tauxRendement, dureeEmprunt);
        const coutRetraitFutureAssurance = calculateCoutRetraitAssuranceVie(valeurFutureAssuranceVie, abattementFiscal, montantActuel, montantInitial, tauxImposition)

        // Coût total combiné
        const coutTotal = coutRetraitAssuranceVie + coutTotalEmprunt; // + coutRetraitFutureAssurance;

        return {
            coutTotal: coutTotal,
            interetsPayes: coutTotalEmprunt,
            impotPlusValue: coutRetraitAssuranceVie, // + coutRetraitFutureAssurance
            coutRetraitFutureAssurance: coutRetraitFutureAssurance
        };
    }

    let xOptimal = 0;
    let minCost = coutTotalCombine(xOptimal).coutTotal;

    for (let x = 1; x <= Math.min(montantAchat, (montantActuel-abattementFiscal)); x++) {
        const currentCost = coutTotalCombine(x).coutTotal;
        if (currentCost < minCost) {
            minCost = currentCost;
            xOptimal = x;
        }
    }

    const { coutTotal, interetsPayes, impotPlusValue, coutRetraitFutureAssurance } = coutTotalCombine(xOptimal);
    return { xOptimal, coutTotal, interetsPayes, impotPlusValue, coutRetraitFutureAssurance };
}
let results = []; // Déclarer results en dehors de la fonction pour un accès global

function calculate() {
    results = []; // Réinitialiser results à chaque calcul
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
        const { xOptimal, coutTotal, interetsPayes, impotPlusValue, coutRetraitFutureAssurance } = calculateOptimalX(montantInitial, montantActuel, tauxRendement, montantAchat, tauxInteretEmprunt, abattementFiscal, tauxImposition, dureeEmprunt);
        const pret = montantAchat - xOptimal;
        const mensualite = calculateMensualite(pret, tauxInteretEmprunt, dureeEmprunt);

        if (mensualite <= effortMaxMensuel) {
            results.push({
                dureeEmprunt,
                xOptimal,
                pret,
                coutTotal,
                interetsPayes,
                impotPlusValue,
                mensualite
            });

            if (coutTotal < minCost) {
                minCost = coutTotal;
                optimalResult = {
                    dureeEmprunt,
                    xOptimal,
                    pret,
                    coutTotal,
                    interetsPayes,
                    impotPlusValue,
                    mensualite
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
        </tr>
    `;

    results.forEach(result => {
        const row = table.insertRow();
        row.insertCell(0).innerHTML = result.dureeEmprunt;
        row.insertCell(1).innerHTML = result.xOptimal.toFixed(2);
        row.insertCell(2).innerHTML = result.pret.toFixed(2);
        row.insertCell(3).innerHTML = result.mensualite.toFixed(2);
        row.insertCell(4).innerHTML = result.interetsPayes.toFixed(2);
        row.insertCell(5).innerHTML = result.impotPlusValue.toFixed(2);
        row.insertCell(6).innerHTML = result.coutTotal.toFixed(2);
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
        </tr>
        <tr>
            <td>${result.dureeEmprunt}</td>
            <td>${result.xOptimal.toFixed(2)}</td>
            <td>${result.pret.toFixed(2)}</td>
            <td>${result.mensualite.toFixed(2)}</td>
            <td>${result.interetsPayes.toFixed(2)}</td>
            <td>${result.impotPlusValue.toFixed(2)}</td>
            <td>${result.coutTotal.toFixed(2)}</td>
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

    // Choisir une valeur aléatoire pour le rachat entre 4600 et 101400
    const xRandom = Math.floor(Math.random() * (101400 - 4600 + 1)) + 4600;

    // Calculer les détails pour le cas aléatoire
    const coutRetraitAssuranceVie = calculateCoutRetraitAssuranceVie(xRandom, abattementFiscal, montantActuel, montantInitial, tauxImposition);

    const C = montantAchat - xRandom;
    const M = calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt);
    const totalPaye = M * dureeEmprunt * 12;
    const coutTotalEmprunt = totalPaye - C;

    
    const resteAssuranceVie = montantActuel - xRandom;
    const valeurFutureAssuranceVie = resteAssuranceVie * Math.pow(1 + tauxRendement, dureeEmprunt);
    const impotPlusValueFutur = calculateCoutRetraitAssuranceVie(xRandom, abattementFiscal, valeurFutureAssuranceVie, montantInitial, tauxImposition);

    const coutTotalRandom = coutTotalEmprunt + coutRetraitAssuranceVie; // + impotPlusValueFutur;

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
        </tr>
        <tr>
            <td>${dureeEmprunt}</td>
            <td>${xRandom.toFixed(2)}</td>
            <td>${C.toFixed(2)}</td>
            <td>${coutTotalEmprunt.toFixed(2)}</td>
            <td>${impotPlusValueFutur.toFixed(2)}</td>
            <td>${coutTotalRandom.toFixed(2)}</td>
        </tr>
    `;
}