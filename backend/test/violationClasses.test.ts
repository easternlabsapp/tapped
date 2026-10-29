import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module shared with the index build script
import { classifyViolation } from "../scripts/violation-classes.mjs";

const cls = (contaminantCode: string, violationName = ""): string => classifyViolation({ contaminantCode, violationName });

describe("classifyViolation", () => {
  it("bacteria", () => {
    for (const code of ["3000", "3100", "3014", "8000"]) expect(cls(code)).toBe("b");
  });
  it("nitrate / nitrite", () => {
    for (const code of ["1040", "1041", "1038"]) expect(cls(code, "MCL, Single Sample")).toBe("n");
  });
  it("treatment failures", () => {
    expect(cls("0200", "Failure to Filter (SWTR)")).toBe("t");
    expect(cls("0300", "Single Turbidity Exceed (Enhanced Filtration)")).toBe("t");
    expect(cls("0700", "Failure To Address Deficiency")).toBe("t");
  });
  it("long-running or administrative treatment items are not urgent (NYC's open uncovered reservoir)", () => {
    expect(cls("0800", "Treatment Technique Uncovered Reservoir")).toBe("g");
    expect(cls("0200", "Public Education")).toBe("g");
  });
  it("long-term contaminants are general", () => {
    expect(cls("2950", "MCL, Average")).toBe("g"); // TTHM
    expect(cls("1005", "MCL, Average")).toBe("g"); // arsenic
    expect(cls("4010", "MCL, Average")).toBe("g"); // radium
    expect(cls("5000", "OCCT/SOWT Study/Recommendation")).toBe("g"); // lead and copper rule
  });
  it("unknown or blank codes default to general", () => {
    expect(cls("5200")).toBe("g");
    expect(cls("")).toBe("g");
    expect(cls("9999")).toBe("g");
  });
});
