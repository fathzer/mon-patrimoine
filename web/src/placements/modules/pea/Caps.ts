import type { PeaType } from './module.js';

/** Maximum deposits for a single PEA plan. */
export const PEA_CAP = 150_000;

/** Maximum deposits for a single PEA-PME plan. */
export const PEA_PME_CAP = 225_000;

/** Maximum combined PEA + PEA-PME deposits per titulaire (account holder). */
export const COMBINED_CAP = 225_000;

/**
 * Generates all ways to assign `numPlans` plans to `numPartners` partners,
 * where each partner receives at most `maxPerPartner` plans.
 * Returns an array of assignments; each assignment maps plan indices to
 * partner indices.
 */
function generateAssignments(numPlans: number, numPartners: number, maxPerPartner: number): number[][] {
  if (numPlans === 0) return [[]];
  const results: number[][] = [];
  const counts = new Array(numPartners).fill(0);

  function recurse(assigned: number[]): void {
    if (assigned.length === numPlans) {
      results.push([...assigned]);
      return;
    }
    for (let p = 0; p < numPartners; p++) {
      if (counts[p] < maxPerPartner) {
        assigned.push(p);
        counts[p]++;
        recurse(assigned);
        assigned.pop();
        counts[p]--;
      }
    }
  }
  recurse([]);
  return results;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export interface PeaCapWarning {
  message: string;
}

/**
 * Checks whether the per-plan deposit cap is respected for a given plan.
 */
export function checkPerPlanCap(peaType: PeaType, deposits: number): PeaCapWarning | null {
  const cap = peaType === 'pea_pme' ? PEA_PME_CAP : PEA_CAP;
  if (deposits > cap) {
    const label = peaType === 'pea_pme' ? 'PEA-PME' : 'PEA';
    return { message: `Le plafond de versement d'un ${label} est de ${cap.toLocaleString('fr-FR')} €.` };
  }
  return null;
}

/**
 * Checks whether there exists a valid assignment of PEA and PEA-PME plans
 * to account holders such that each holder's combined deposits do not
 * exceed {@link COMBINED_CAP}.
 *
 * For a single person, all plans belong to one holder.
 * For a couple, each holder can have at most 1 PEA and 1 PEA-PME; the
 * function tries all possible ownership combinations.
 *
 * @param peaDeposits   Deposits of all PEA plans.
 * @param peaPmeDeposits Deposits of all PEA-PME plans.
 * @param isCouple      Whether the fiscal household is a couple.
 * @returns A warning if no valid assignment exists, otherwise null.
 */
export function checkCombinedCap(
  peaDeposits: number[],
  peaPmeDeposits: number[],
  isCouple: boolean
): PeaCapWarning | null {
  const numPartners = isCouple ? 2 : 1;

  const peaAssignments = generateAssignments(peaDeposits.length, numPartners, 1);
  const pmeAssignments = generateAssignments(peaPmeDeposits.length, numPartners, 1);

  for (const peaAssign of peaAssignments) {
    for (const pmeAssign of pmeAssignments) {
      let valid = true;
      for (let p = 0; p < numPartners; p++) {
        const peaSum = sum(peaDeposits.filter((_, i) => peaAssign[i] === p));
        const pmeSum = sum(peaPmeDeposits.filter((_, i) => pmeAssign[i] === p));
        if (peaSum + pmeSum > COMBINED_CAP) {
          valid = false;
          break;
        }
      }
      if (valid) return null;
    }
  }

  return {
    message: `Le total des versements PEA + PEA-PME dépasse le plafond de ${COMBINED_CAP.toLocaleString('fr-FR')} € par titulaire.`
  };
}
