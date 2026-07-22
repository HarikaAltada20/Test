import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contestMatchesUserCountries } from "@/lib/contest-region-match";

describe("contestMatchesUserCountries (geo empty-country fix)", () => {
  it("allows unrestricted contests for empty countries", () => {
    assert.equal(contestMatchesUserCountries(null, []), true);
    assert.equal(contestMatchesUserCountries({}, []), true);
    assert.equal(contestMatchesUserCountries(null, null), true);
  });

  it("blocks geo-restricted contests when countries are empty", () => {
    assert.equal(
      contestMatchesUserCountries({ NA: ["United States"] }, []),
      false,
    );
    assert.equal(
      contestMatchesUserCountries({ NA: ["United States"] }, null),
      false,
    );
  });

  it("allows when any user country is in the region", () => {
    assert.equal(
      contestMatchesUserCountries(
        { NA: ["United States", "Canada"] },
        ["Canada"],
      ),
      true,
    );
  });

  it("blocks when no user country matches", () => {
    assert.equal(
      contestMatchesUserCountries({ NA: ["United States"] }, ["India"]),
      false,
    );
  });
});
