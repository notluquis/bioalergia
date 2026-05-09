import { describe, expect, it } from "vitest";

import {
  MISSING_CLASSIFICATION_FILTERS,
  MISSING_QUERY_TO_SERVICE_FILTER,
  isMissingClassificationFilterKey,
  toTestMetadata,
} from "../calendar-reclassify.ts";

describe("calendar-reclassify (pure helpers)", () => {
  // ──────────────────────────────────────────────────────────────────────────
  describe("MISSING_CLASSIFICATION_FILTERS", () => {
    it("has six filters", () => {
      expect(MISSING_CLASSIFICATION_FILTERS).toHaveLength(6);
    });

    it("contains missingCategory", () => {
      expect(MISSING_CLASSIFICATION_FILTERS.some((f) => f.key === "missingCategory")).toBe(true);
    });

    it("contains missingAmountExpected", () => {
      expect(MISSING_CLASSIFICATION_FILTERS.some((f) => f.key === "missingAmountExpected")).toBe(
        true,
      );
    });

    it("contains missingAmountPaid", () => {
      expect(MISSING_CLASSIFICATION_FILTERS.some((f) => f.key === "missingAmountPaid")).toBe(true);
    });

    it("contains missingAttended", () => {
      expect(MISSING_CLASSIFICATION_FILTERS.some((f) => f.key === "missingAttended")).toBe(true);
    });

    it("contains missingDosage", () => {
      expect(MISSING_CLASSIFICATION_FILTERS.some((f) => f.key === "missingDosage")).toBe(true);
    });

    it("contains missingTreatmentStage", () => {
      expect(MISSING_CLASSIFICATION_FILTERS.some((f) => f.key === "missingTreatmentStage")).toBe(
        true,
      );
    });

    it("every entry has a non-empty label", () => {
      for (const filter of MISSING_CLASSIFICATION_FILTERS) {
        expect(filter.label.length).toBeGreaterThan(0);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("MISSING_QUERY_TO_SERVICE_FILTER", () => {
    it("maps missingAmountExpected to amountExpected", () => {
      expect(MISSING_QUERY_TO_SERVICE_FILTER.missingAmountExpected).toBe("amountExpected");
    });

    it("maps missingAmountPaid to amountPaid", () => {
      expect(MISSING_QUERY_TO_SERVICE_FILTER.missingAmountPaid).toBe("amountPaid");
    });

    it("maps missingAttended to attended", () => {
      expect(MISSING_QUERY_TO_SERVICE_FILTER.missingAttended).toBe("attended");
    });

    it("maps missingCategory to category", () => {
      expect(MISSING_QUERY_TO_SERVICE_FILTER.missingCategory).toBe("category");
    });

    it("maps missingDosage to dosageValue", () => {
      expect(MISSING_QUERY_TO_SERVICE_FILTER.missingDosage).toBe("dosageValue");
    });

    it("maps missingTreatmentStage to treatmentStage", () => {
      expect(MISSING_QUERY_TO_SERVICE_FILTER.missingTreatmentStage).toBe("treatmentStage");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("isMissingClassificationFilterKey", () => {
    it("returns true for all valid keys", () => {
      expect(isMissingClassificationFilterKey("missingCategory")).toBe(true);
      expect(isMissingClassificationFilterKey("missingAmountExpected")).toBe(true);
      expect(isMissingClassificationFilterKey("missingAmountPaid")).toBe(true);
      expect(isMissingClassificationFilterKey("missingAttended")).toBe(true);
      expect(isMissingClassificationFilterKey("missingDosage")).toBe(true);
      expect(isMissingClassificationFilterKey("missingTreatmentStage")).toBe(true);
    });

    it("returns false for unknown strings", () => {
      expect(isMissingClassificationFilterKey("missingFoo")).toBe(false);
      expect(isMissingClassificationFilterKey("")).toBe(false);
      expect(isMissingClassificationFilterKey("MISSINGCATEGORY")).toBe(false);
      expect(isMissingClassificationFilterKey("manage")).toBe(false);
    });

    it("returns false for partial key strings", () => {
      expect(isMissingClassificationFilterKey("missing")).toBe(false);
      expect(isMissingClassificationFilterKey("Category")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("toTestMetadata", () => {
    it("returns null for null input", () => {
      expect(toTestMetadata(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(toTestMetadata(undefined)).toBeNull();
    });

    it("returns null for non-object primitives", () => {
      expect(toTestMetadata("string")).toBeNull();
      expect(toTestMetadata(42)).toBeNull();
      expect(toTestMetadata(true)).toBeNull();
    });

    it("returns null when any required boolean field is missing", () => {
      expect(
        toTestMetadata({
          firstReading: true,
          patchTest: false,
          secondReading: false,
          skinTest: true,
          // thirdReading is missing
        }),
      ).toBeNull();
    });

    it("returns null when a field is not boolean", () => {
      expect(
        toTestMetadata({
          firstReading: 1, // number instead of boolean
          patchTest: false,
          secondReading: false,
          skinTest: false,
          thirdReading: false,
        }),
      ).toBeNull();
    });

    it("returns null when a field is null", () => {
      expect(
        toTestMetadata({
          firstReading: null,
          patchTest: false,
          secondReading: false,
          skinTest: false,
          thirdReading: false,
        }),
      ).toBeNull();
    });

    it("returns the TestMetadata object when all fields are valid booleans", () => {
      const input = {
        firstReading: true,
        patchTest: false,
        secondReading: true,
        skinTest: false,
        thirdReading: false,
      };
      expect(toTestMetadata(input)).toEqual(input);
    });

    it("returns the TestMetadata object with all-false values", () => {
      const input = {
        firstReading: false,
        patchTest: false,
        secondReading: false,
        skinTest: false,
        thirdReading: false,
      };
      expect(toTestMetadata(input)).toEqual(input);
    });

    it("returns the TestMetadata object with all-true values", () => {
      const input = {
        firstReading: true,
        patchTest: true,
        secondReading: true,
        skinTest: true,
        thirdReading: true,
      };
      expect(toTestMetadata(input)).toEqual(input);
    });

    it("ignores extra properties in the input object", () => {
      const input = {
        firstReading: false,
        patchTest: true,
        secondReading: false,
        skinTest: true,
        thirdReading: false,
        extra: "ignored",
      };
      const result = toTestMetadata(input);
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty("extra");
      expect(result).toEqual({
        firstReading: false,
        patchTest: true,
        secondReading: false,
        skinTest: true,
        thirdReading: false,
      });
    });

    it("returns null for empty object", () => {
      expect(toTestMetadata({})).toBeNull();
    });

    it("returns null for arrays", () => {
      expect(toTestMetadata([])).toBeNull();
    });
  });
});
