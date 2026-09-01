import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOrderLines } from "./parse-items";

describe("parseOrderLines", () => {
  it("parses persian produce lists", () => {
    const items = parseOrderLines("گوجه — ۲ کیلو\nسیب — ۳ کیلو\nموز — ۱ کیلو\nتخم‌مرغ — ۲ بسته (ترک)");
    assert.equal(items.length, 4);
    assert.equal(items[0]?.name, "گوجه");
    assert.equal(items[0]?.weight, 2);
    assert.equal(items[0]?.unit, "kg");
    assert.equal(items[3]?.unit, "pack");
    assert.equal(items[3]?.quantity, 2);
    assert.equal(items[3]?.notes, "ترک");
  });
});
