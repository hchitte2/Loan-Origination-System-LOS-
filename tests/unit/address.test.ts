import { describe, expect, it } from "vitest";
import {
  ADDRESS_EXAMPLE,
  ADDRESS_MAX_LENGTH,
  formatAddress,
  parseAddress,
} from "../../src/lib/address";

/**
 * The New loan form takes one address field and `loans` stores four columns, so the parse
 * is the seam. It is strict on purpose: filing a loan under the wrong city is worse than
 * asking someone to retype it.
 */
describe("parseAddress", () => {
  it("reads the shape the form asks for", () => {
    expect(parseAddress(ADDRESS_EXAMPLE)).toEqual({
      street: "48 Juniper Way",
      city: "Austin",
      state: "TX",
      zip: "78704",
    });
  });

  it("accepts a comma before the state and normalises the state to upper case", () => {
    expect(parseAddress("1200 Ridgeway Dr, Nashville, tn 37201")).toEqual({
      street: "1200 Ridgeway Dr",
      city: "Nashville",
      state: "TN",
      zip: "37201",
    });
  });

  it("accepts ZIP+4 and shrugs off extra whitespace", () => {
    expect(
      parseAddress("  9 Orchard St ,  Raleigh   NC   27601-1234 "),
    ).toEqual({
      street: "9 Orchard St",
      city: "Raleigh",
      state: "NC",
      zip: "27601-1234",
    });
  });

  it.each([
    ["no comma", "48 Juniper Way Austin TX 78704"],
    ["no zip", "48 Juniper Way, Austin TX"],
    ["no state", "48 Juniper Way, Austin 78704"],
    ["a spelled-out state", "48 Juniper Way, Austin Texas 78704"],
    ["a four-digit zip", "48 Juniper Way, Austin TX 7870"],
    ["a street only", "48 Juniper Way"],
    ["nothing", ""],
    ["a third comma", "48 Juniper Way, Apt 2, Austin, TX 78704"],
  ])("refuses %s", (_name, value) => {
    expect(parseAddress(value)).toBeNull();
  });

  it("round-trips through formatAddress", () => {
    const parsed = parseAddress("412 Maple Ave, Austin TX 78704");
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(formatAddress(parsed)).toBe("412 Maple Ave, Austin TX 78704");
    expect(parseAddress(formatAddress(parsed))).toEqual(parsed);
  });
});

describe("parseAddress is linear, not backtracking", () => {
  it("refuses anything past the length bound without matching", () => {
    expect(parseAddress(`a,${" ".repeat(ADDRESS_MAX_LENGTH)}b`)).toBeNull();
  });

  it("answers the worst in-bounds input in well under a millisecond", () => {
    // The single-pattern version this replaced took 23 s on 500 spaces and 135 ms on the
    // longest input the bound allows. Anything near that here means the parse regressed
    // to a shape with adjacent quantifiers over overlapping classes.
    const worst = `a,${" ".repeat(ADDRESS_MAX_LENGTH - 4)}b`;
    const start = performance.now();
    for (let i = 0; i < 1000; i += 1) parseAddress(worst);
    const perCall = (performance.now() - start) / 1000;
    expect(perCall).toBeLessThan(1);
  });
});
