function calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt) {
    const rMensuel = tauxInteretEmprunt / 12;
    const nMensualites = dureeEmprunt * 12;
    return (C * rMensuel) / (1 - Math.pow(1 + rMensuel, -nMensualites));
}

function calculateOptimalX(montantInitial, montantActuel, tauxRendement, montantAchat, tauxInteretEmprunt, abattementFiscal, tauxImposition, dureeEmprunt) {
    function coutTotalCombine(x) {
        const C = montantAchat - x;
        const M = calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt);
        const coutTotalEmprunt = M * dureeEmprunt * 12 - C;

        const valeurFutureAssuranceVie = (montantActuel - x) * Math.pow(1 + tauxRendement, dureeEmprunt);
        const plusValue = valeurFutureAssuranceVie - montantInitial;
        const plusValueImposable = Math.max(0, plusValue - abattementFiscal);
        const impotPlusValue = tauxImposition * plusValueImposable;

        return coutTotalEmprunt + impotPlusValue - valeurFutureAssuranceVie;
    }

    let xOptimal = 0;
    let minCost = coutTotalCombine(xOptimal);

    for (let x = 1; x <= montantAchat; x++) {
        const currentCost = coutTotalCombine(x);
        if (currentCost < minCost) {
            minCost = currentCost;
            xOptimal = x;
        }
    }

    return { xOptimal, minCost };
}

function calculate() {
    const montantInitial = parseFloat(document.getElementById('montant_initial').value);
    const montantActuel = parseFloat(document.getElementById('montant_actuel').value);
    const tauxRendement = parseFloat(document.getElementById('taux_rendement').value) / 100;
    const abattementFiscal = parseFloat(document.getElementById('abattement_fiscal').value);
    const tauxImposition = parseFloat(document.getElementById('taux_imposition').value) / 100;
    const montantAchat = parseFloat(document.getElementById('montant_achat').value);
    const tauxInteretEmprunt = parseFloat(document.getElementById('taux_interet_emprunt').value) / 100;

    const results = [];

    for (let dureeEmprunt = 0; dureeEmprunt <= 25; dureeEmprunt++) {
        const { xOptimal, minCost } = calculateOptimalX(montantInitial, montantActuel, tauxRendement, montantAchat, tauxInteretEmprunt, abattementFiscal, tauxImposition, dureeEmprunt);
        results.push({
            dureeEmprunt,
            xOptimal,
            pret: montantAchat - xOptimal,
            coutTotal: minCost
        });
    }

    displayResults(results);
}

function displayResults(results) {
    const table = document.getElementById('resultsTable');
    table.innerHTML = `
        <tr>
            <th>Durée de l'emprunt (années)</th>
            <th>Part optimale de l'assurance vie (€)</th>
            <th>Montant du prêt (€)</th>
            <th>Coût total (€)</th>
        </tr>
    `;

    results.forEach(result => {
        const row = table.insertRow();
        row.insertCell(0).innerHTML = result.dureeEmprunt;
        row.insertCell(1).innerHTML = result.xOptimal.toFixed(2);
        row.insertCell(2).innerHTML = result.pret.toFixed(2);
        row.insertCell(3).innerHTML = result.coutTotal.toFixed(2);
    });
}
