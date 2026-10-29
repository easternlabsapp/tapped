// Classifies a health-based violation as urgent or long-term for a short-stay
// traveler. Judgement calls live HERE, in one place, so they are easy to tune.
//   b = bacteria (coliform / E. coli)            -> urgent
//   n = nitrate / nitrite                        -> urgent
//   t = water-treatment failure (pathogens)      -> urgent
//   g = general / long-term-exposure contaminant -> not urgent for a short visit
// Anything we cannot place (blank codes, new rules) is "g".

const BACTERIA = new Set(["3000", "3100", "3014", "8000"]);
const NITRATE = new Set(["1040", "1041", "1038"]);
const TREATMENT = new Set(["0100", "0200", "0300", "0700", "0800"]);
// Treatment-rule violations that are long-term or administrative, not an active failure.
const TREATMENT_EXCEPTIONS = /uncovered reservoir|public education|notification|certified operator/i;

/** @returns {"b"|"n"|"t"|"g"} */
export function classifyViolation({ contaminantCode, violationName }) {
  const code = String(contaminantCode ?? "").trim();
  if (BACTERIA.has(code)) return "b";
  if (NITRATE.has(code)) return "n";
  if (TREATMENT.has(code) && !TREATMENT_EXCEPTIONS.test(violationName ?? "")) return "t";
  return "g";
}

export const URGENT_CLASSES = new Set(["b", "n", "t"]);
