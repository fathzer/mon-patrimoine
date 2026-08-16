const ENDPOINT = 'https://api.fr.openfisca.org/latest/calculate';

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class Openfisca {
  static async calculate(household, rni, year = new Date().getFullYear()) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildPayload(household, rni, year))
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Openfisca request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const foyer = data?.foyers_fiscaux?.foyer;

    if (!foyer) {
      throw new Error('Openfisca response has no foyers_fiscaux.foyer');
    }

    return {
      nbptr: foyer.nbptr?.[year],
      tmi: foyer.ir_taux_marginal?.[year],
      impot: foyer.impot_revenu_restant_a_payer?.[year],
      avantageQf: foyer.avantage_qf?.[year],
      decote: foyer.decote_gain_fiscal?.[year]
    };
  }

  static _buildPayload(household, rni, year) {
    const maritalStatus = household?.maritalStatus ?? 'single';
    const childrenCount = household?.childrenCount ?? 0;
    const alternateChildrenCount = household?.alternateChildrenCount ?? 0;
    const isSingleParent = household?.isSingleParent ?? false;
    const totalChildren = childrenCount + alternateChildrenCount;

    const now = new Date();
    const individus = { moi: {} };
    const personnesACharge = [];

    for (let i = 1; i <= totalChildren; i += 1) {
      const id = `enfant${i}`;
      personnesACharge.push(id);

      const age = totalChildren - i + 1;
      const birthDate = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
      const isAlternated = i > childrenCount;
      const child = { date_naissance: { [year]: formatDate(birthDate) } };

      if (isAlternated) {
        child.garde_alternee = { [year]: true };
      }

      individus[id] = child;
    }

    const declarants = ['moi'];
    if (maritalStatus === 'married') {
      declarants.push('conjoint');
      individus.conjoint = {};
    }

    return {
      individus,
      foyers_fiscaux: {
        foyer: {
          declarants,
          personnes_a_charge: personnesACharge,
          caseT: { [year]: isSingleParent && maritalStatus === 'single' },
          rni: { [year]: rni },
          nbptr: { [year]: null },
          ir_taux_marginal: { [year]: null },
          impot_revenu_restant_a_payer: { [year]: null },
          avantage_qf: { [year]: null },
          decote_gain_fiscal: { [year]: null }
        }
      }
    };
  }
}
