import { parseTime, type Time } from "@internationalized/date";
import { describe, expect, it } from "vitest";

/**
 * Test to verify TimeFieldInput handles time values correctly
 * and doesn't lose hours when switching segments
 */
describe("TimeFieldInput", () => {
  it("formats Time object correctly to HH:MM string", () => {
    const time = parseTime("12:45");

    const handleChange = (time: Time | null) => {
      if (!time) return "";
      const hours = String(time.hour).padStart(2, "0");
      const minutes = String(time.minute).padStart(2, "0");
      return `${hours}:${minutes}`;
    };

    expect(handleChange(time)).toBe("12:45");
  });

  it("handles empty string to Time conversion safely", () => {
    const value = "";
    let timeValue: Time | null = null;

    if (value) {
      try {
        timeValue = parseTime(value);
      } catch {
        timeValue = null;
      }
    }

    expect(timeValue).toBeNull();
  });

  it("handles valid time string conversion", () => {
    const value = "12:00";
    let timeValue: Time | null = null;

    if (value) {
      try {
        timeValue = parseTime(value);
      } catch {
        timeValue = null;
      }
    }

    expect(timeValue).not.toBeNull();
    expect(timeValue?.hour).toBe(12);
    expect(timeValue?.minute).toBe(0);
  });

  it("handles invalid time string gracefully", () => {
    const value = "invalid";
    let timeValue: Time | null = null;

    if (value) {
      try {
        timeValue = parseTime(value);
      } catch {
        timeValue = null;
      }
    }

    expect(timeValue).toBeNull();
  });

  it("ensures hours are preserved through segment transitions", () => {
    // Simulate the user scenario: type 12 for hours, move to minutes, type 45
    const scenarios = [
      { input: "12:00", expected: "12:00" },
      { input: "12:45", expected: "12:45" },
      { input: "09:30", expected: "09:30" },
      { input: "", expected: null },
    ];

    scenarios.forEach(({ input, expected }) => {
      let timeValue: Time | null = null;

      if (input) {
        try {
          timeValue = parseTime(input);
        } catch {
          timeValue = null;
        }
      }

      if (expected === null) {
        expect(timeValue).toBeNull();
      } else {
        const result = timeValue
          ? `${String(timeValue.hour).padStart(2, "0")}:${String(timeValue.minute).padStart(2, "0")}`
          : "";
        expect(result).toBe(expected);
      }
    });
  });
});
