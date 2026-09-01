import { toEnglishDigits } from "./phone.ts";

export type ParsedItem = {
  name: string;
  weight: number | null;
  quantity: number | null;
  unit: string;
  notes: string;
};

const UNIT_MAP: Record<string, string> = {
  کیلو: "kg",
  کيلو: "kg",
  kg: "kg",
  kilo: "kg",
  بسته: "pack",
  pack: "pack",
  عدد: "piece",
  دانه: "piece",
  piece: "piece",
  جعبه: "box",
  کارتن: "box",
  box: "box",
};

export function parseOrderLines(text: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const en = toEnglishDigits(line);
    const noteMatch = en.match(/[(|（](.+?)[)|）]\s*$/);
    const notes = noteMatch?.[1]?.trim() ?? "";
    const base = noteMatch ? en.slice(0, noteMatch.index).trim() : en;
    const match = base.match(
      /^(.*?)(?:\s*[-–—:،,]\s*|\s+)(\d+(?:\.\d+)?)\s*(کیلو|کيلو|kg|kilo|بسته|pack|عدد|دانه|piece|جعبه|کارتن|box)?\s*$/i,
    );
    if (match) {
      const unitKey = (match[3] ?? "kg").toLowerCase();
      const unit = UNIT_MAP[unitKey] ?? UNIT_MAP[match[3] ?? ""] ?? "kg";
      const n = Number(match[2]);
      const name = match[1]!.replace(/[-–—:،,]+$/g, "").trim();
      if (!name) continue;
      out.push({
        name,
        weight: unit === "kg" ? n : null,
        quantity: unit === "kg" ? null : n,
        unit,
        notes,
      });
    } else {
      out.push({ name: base.replace(/[-–—:،,]+$/g, "").trim(), weight: null, quantity: null, unit: "kg", notes });
    }
  }
  return out;
}
