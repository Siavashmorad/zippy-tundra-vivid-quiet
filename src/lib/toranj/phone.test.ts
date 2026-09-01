import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayPhone, normalizeIranPhone, parseContactLines, toEnglishDigits } from "./phone";

describe("toranj phone", () => {
  it("normalizes local, plus, and persian digits", () => {
    assert.equal(normalizeIranPhone("09121234567"), "09121234567");
    assert.equal(normalizeIranPhone("+989121234567"), "09121234567");
    assert.equal(normalizeIranPhone("00989121234567"), "09121234567");
    assert.equal(normalizeIranPhone("۹۱۲۱۲۳۴۵۶۷"), "09121234567");
    assert.equal(normalizeIranPhone("9121234567"), "09121234567");
    assert.equal(normalizeIranPhone("123"), null);
  });

  it("formats display and parses contact lines without duplicates", () => {
    assert.equal(displayPhone("09121234567"), "0912 123 4567");
    assert.equal(toEnglishDigits("۱۲۳"), "123");
    const parsed = parseContactLines("علی رضایی 09121234567\nعلی رضایی +989121234567\nمریم ۰۹۳۵۱۱۱۲۲۳۳");
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.phone, "09121234567");
    assert.equal(parsed[0]?.firstName, "علی");
    assert.equal(parsed[1]?.phone, "09351112233");
  });
});
