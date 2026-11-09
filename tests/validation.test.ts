import { describe, expect, it } from "vitest";
import { validateVariants } from "@/lib/services/orders";

describe("colour/size matrix validation", () => {
  it("accepts a matrix that sums to the PO quantity", () => {
    expect(
      validateVariants(
        [
          { colour: "Navy", size: "S", quantity: 500 },
          { colour: "Navy", size: "M", quantity: 1000 },
          { colour: "White", size: "S", quantity: 500 },
          { colour: "White", size: "M", quantity: 1000 },
        ],
        3000,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects an empty matrix", () => {
    const result = validateVariants([], 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("at least one");
  });

  it("rejects a matrix that does not match the PO quantity", () => {
    const result = validateVariants([{ colour: "Navy", size: "M", quantity: 900 }], 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("900");
      expect(result.error).toContain("1,000");
    }
  });

  it("rejects duplicate colour/size combinations regardless of case", () => {
    const result = validateVariants(
      [
        { colour: "Navy", size: "M", quantity: 500 },
        { colour: "navy", size: "m", quantity: 500 },
      ],
      1000,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Duplicate");
  });

  it("rejects missing colour or size values", () => {
    expect(validateVariants([{ colour: " ", size: "M", quantity: 100 }], 100).ok).toBe(false);
    expect(validateVariants([{ colour: "Navy", size: "", quantity: 100 }], 100).ok).toBe(false);
  });

  it("rejects negative and fractional quantities", () => {
    expect(validateVariants([{ colour: "Navy", size: "M", quantity: -1 }], 100).ok).toBe(false);
    expect(validateVariants([{ colour: "Navy", size: "M", quantity: 50.5 }], 100).ok).toBe(false);
  });

  it("allows a zero-quantity placeholder line when the total still matches", () => {
    expect(
      validateVariants(
        [
          { colour: "Navy", size: "S", quantity: 1000 },
          { colour: "Navy", size: "XL", quantity: 0 },
        ],
        1000,
      ),
    ).toEqual({ ok: true });
  });
});
