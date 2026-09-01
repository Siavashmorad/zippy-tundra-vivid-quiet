const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa >= 0) return String(fa);
    const ar = AR_DIGITS.indexOf(ch);
    return ar >= 0 ? String(ar) : ch;
  });
}

/** Normalize Iranian mobiles to 09xxxxxxxxx. Returns null if invalid. */
export function normalizeIranPhone(input: string): string | null {
  let d = toEnglishDigits(input).replace(/[^\d+]/g, "");
  if (d.startsWith("+98")) d = `0${d.slice(3)}`;
  else if (d.startsWith("0098")) d = `0${d.slice(4)}`;
  else if (d.startsWith("98") && d.length >= 12) d = `0${d.slice(2)}`;
  if (d.startsWith("9") && d.length === 10) d = `0${d}`;
  if (/^09\d{9}$/.test(d)) return d;
  return null;
}

export function displayPhone(phone: string): string {
  const n = normalizeIranPhone(phone) ?? phone;
  if (/^09\d{9}$/.test(n)) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  return n;
}

export type ParsedContact = {
  firstName: string;
  lastName: string;
  phone: string;
};

export function parseContactLines(text: string): ParsedContact[] {
  const out: ParsedContact[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const english = toEnglishDigits(line);
    const match = english.match(/(\+?98|0)?9\d{9}/);
    if (!match || match.index === undefined) continue;
    const phone = normalizeIranPhone(match[0]);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    const namePart = `${english.slice(0, match.index)} ${english.slice(match.index + match[0].length)}`
      .replace(/[^\p{L}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    const parts = namePart.split(" ").filter(Boolean);
    const firstName = parts[0] ?? "مشتری";
    const lastName = parts.slice(1).join(" ");
    out.push({ firstName, lastName, phone });
  }
  return out;
}
