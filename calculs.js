'use strict';

// Logique de calcul pure (sans DOM), testable sous Node.
// Dans le navigateur, ce fichier est chargé avant script.js et expose
// ses fonctions en globales.

// Parse une saisie utilisateur en nombre : accepte la virgule française ("2,5").
function parseNombre(valeur) {
    if (typeof valeur !== 'string') {
        return NaN;
    }
    const normalisee = valeur.trim().replace(',', '.');
    if (normalisee === '') {
        return NaN;
    }
    return parseFloat(normalisee);
}

function calculateMensualite(C, tauxInteretEmprunt, dureeEmprunt) {
    const nMensualites = dureeEmprunt * 12;
    if (!Number.isFinite(C) || !Number.isFinite(tauxInteretEmprunt) || nMensualites <= 0) {
        return 0;
    }
    const rMensuel = tauxInteretEmprunt / 12;
    // Taux nul : pas d'intérêts, on rembourse le capital en ligne droite.
    if (rMensuel === 0) {
        return C / nMensualites;
    }
    return (C * rMensuel) / (1 - 1 / Math.pow(1 + rMensuel, nMensualites));
}

function calculateTauxImposition(salaireAnnuel) {
    if (!Number.isFinite(salaireAnnuel) || salaireAnnuel <= 0) {
        return 0;
    }
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
    return 0.45;
}

function coutRachatAssuranceVie(x, abattementFiscal, montantActuel, montantInitial, tauxImposition) {
    // Garde-fou : si le capital actuel est nul, il n'y a aucune plus-value (évite 0/0).
    const ratioPlusValue = montantActuel > 0 ? (montantActuel - montantInitial) / montantActuel : 0;
    const plusValueImposableRetrait = Math.max(0, x * ratioPlusValue - abattementFiscal);
    const imposition = 0.172 + Math.min(tauxImposition, 0.075); // Prélèvements sociaux (CSG + CRDS) + prélèvement forfaitaire
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
    // Valeur future du capital restant : (VA - x) * (1 + r)^n, conforme à la formule affichée.
    const valeurFutureAssuranceVie = resteAssuranceVie * Math.pow(1 + tauxRendement, dureeEmprunt);
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
    const rachatMaximumAssuranceVie = montantActuel - coutRachatAssuranceVie(montantActuel, abattementFiscal, montantActuel, montantInitial, tauxImposition);
    // On ne peut racheter ni plus que le capital actuel, ni plus que le coût de l'achat,
    // ni plus que l'apport net maximal après impôt sur le rachat total.
    const maxX = Math.max(0, Math.min(montantAchat, rachatMaximumAssuranceVie, montantActuel));
    if (!Number.isFinite(maxX)) {
        return null;
    }

    const evaluer = (x) => {
        const result = coutOperation(x, abattementFiscal, montantActuel, montantInitial, tauxImposition, tauxRendement, montantAchat, tauxInteretEmprunt, dureeEmprunt);
        return { x, result, valeur: optimiserBilan ? result.bilan : result.coutTotal };
    };
    const meilleur = (a, b) => {
        if (!a) return b;
        if (!b) return a;
        if (optimiserBilan) return b.valeur > a.valeur ? b : a;
        return b.valeur < a.valeur ? b : a;
    };

    // Passe grossière avec un pas adaptatif : évite des milliards d'itérations
    // quand les sommes sont très élevées (ex. achat à 1 Md€).
    const step = Math.max(1, Math.ceil(maxX / 100000));
    let best = null;
    for (let x = 0; x <= maxX; x += step) {
        best = meilleur(best, evaluer(x));
    }
    // Passe fine autour du meilleur grossier (la fonction objectif est convexe/concave,
    // l'optimum est forcément dans [best.x - step, best.x + step]).
    if (step > 1) {
        const borneInf = Math.max(0, best.x - step);
        const borneSup = Math.min(maxX, best.x + step);
        for (let x = borneInf; x <= borneSup; x += 1) {
            best = meilleur(best, evaluer(x));
        }
    }
    return best ? best.result : null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseNombre,
        calculateMensualite,
        calculateTauxImposition,
        coutRachatAssuranceVie,
        coutEmprunt,
        coutOperation,
        calculateOptimalX
    };
}
