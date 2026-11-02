# Methodology

This document specifies how Tapped converts regulatory records into a status indicator, why the rules are shaped as they are, and where they can mislead.

## Data

- **Violation records:** US EPA SDWIS, distributed by WaterViolations.org. Each record has a start date, a health-based flag, a compliance status, a contaminant code, and a violation type.
- **Data currency:** the source data runs through a fixed end date (currently **31 December 2025**). The application displays this date with every result.
- **Nature of the data:** compliance records describe whether a water system met monitoring, reporting, and treatment obligations. They are not measurements of the water delivered to a particular tap on a particular day.

## Selecting the water systems for a ZIP code

A ZIP code does not map cleanly to one water system. The source associates systems with ZIP codes by *registered address*, not by service area. Systems are therefore selected in this order of preference:

1. ZIP-listed community systems that are also registered in the ZIP's own city (a direct match; no caveat shown).
2. The largest community system registered in the ZIP's city and state (the user is shown a note that it may not be the system serving their address). Additional systems serving at least 20% of the largest system's population are included, up to three.
3. The largest community systems the source lists for the ZIP itself (up to five).
4. The nearest ZIP code (within 20 miles, up to ten distinct candidates) that satisfies option 1 or 2.

If none apply, the result is `unknown`. When several systems are scored, the worst status is reported and `multipleSystems` is set.

New York City is handled by an explicit override because its water system is registered in a different municipality.

## Status rules

All windows are measured backward from the **data end date** (the "anchor"), never from the current date. Measured from the current date, any window shorter than the data's age would contain no records and every system would appear clean.

| Status | Condition |
|---|---|
| **Red** | An open health-based violation of an urgent type, or of unknown type, that began within 12 months of the anchor |
| **Yellow** | An open health-based violation of a long-term type; or an open urgent-type violation that began more than 12 months before the anchor; or a health-based violation that began within 12 months of the anchor (open or resolved); or an open monitoring/reporting violation; or three or more monitoring/reporting violations beginning within 12 months of the anchor |
| **Green** | None of the above |
| **Unknown** | No system found |

Older health-based violations (up to five years) and one or two resolved monitoring/reporting violations do not change a green status; they are stated in the summary.

### Violation classes

Health-based violations are classified so that conditions relevant to a short stay are distinguished from long-term-exposure conditions. The mapping is defined in `backend/scripts/violation-classes.mjs`.

| Class | Contaminant codes | Treatment |
|---|---|---|
| Bacteria | 3000, 3100, 3014, 8000 | Urgent |
| Nitrate / nitrite | 1040, 1041, 1038 | Urgent |
| Water-treatment failure | 0100, 0200, 0300, 0700, 0800, excluding violations described as an uncovered reservoir, public education, notification, or certified-operator requirement | Urgent |
| All other | including arsenic, disinfection byproducts, radionuclides, fluoride, lead and copper rule items, and any unclassified code | Long-term |

**Rationale.** Bacterial contamination, nitrate (a risk to infants and during pregnancy), and treatment failures can matter within days. Most other health-based limits address exposure accumulated over years, which a short visit changes little. An open long-term violation therefore yields yellow rather than red, and the summary says so. When the violation type cannot be determined (the live API path does not report it), an open violation is treated as urgent.

**Old open urgent violations.** The source frequently leaves old entries open without closing them. A red result tells a traveler to avoid drinking the water, so it is reserved for an open urgent violation that began within 12 months of the anchor, when it is reasonable to treat it as active. An urgent-type violation that is still marked open but began earlier is reported as yellow, and the summary states the start date and that the records do not show whether it is still active. Example: Portland, Oregon has had an open "Failure to Filter" treatment-technique entry since December 2017. A violation with no recorded start date is treated as recent.

**Open violations.** A violation is open when its compliance status is `O`. This was verified against the source API's own count of active health-based violations for a sample of 14 systems (14 of 14 matched).

### Why paperwork does not decide the color alone

About 91% of violation records are monitoring, reporting, or notice violations rather than health-based exceedances. A single missed report does not show that water is unsafe, but a pattern of missed monitoring means the water was not verified, which is why open or repeated items produce yellow.

## Known limitations

1. **ZIP-to-system matching** is by registered address. Suburbs served by a neighboring city's utility (for example Towson, Maryland) may resolve to unrelated small systems or to no city utility.
2. **Absent clean systems.** The bulk files list violations only. A system with no violations on record does not appear in the bundled index and is found only through the live ZIP lookup.
3. **Some large utilities are registered under another city** and are missing or require overrides (New York City is handled; San Francisco's utility is absent from the source data).
4. **Status code semantics.** Only status `O` is treated as open; the meaning of status codes `K` and `I` is undocumented by the source and they are treated as not open.
5. **Unclassified contaminant code 5200** (no name or rule in the source, about 1,900 health-based records) is treated as long-term.
6. **Recency window boundary.** A violation that began 12 months and one day before the anchor is outside the window by design; its date is still reported as history.
7. **Not a lab result.** A green status means the records show no recent problems, not that the water has been tested clean.

## Changing the rules

- Thresholds and windows: `backend/src/scoring.ts` (bump `SCORING_VERSION` so cached responses are discarded).
- Wording: `backend/src/copy.ts`.
- Violation classes: `backend/scripts/violation-classes.mjs`, then rebuild the system index.

Rule behavior is covered by unit tests in `backend/test/scoring.test.ts`, `backend/test/copy.test.ts` and `backend/test/violationClasses.test.ts`.
