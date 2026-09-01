export function nid(prefix: string): string {
  const raw = crypto.randomUUID().replaceAll("-", "");
  return `${prefix}_${raw.slice(0, 20)}`;
}

export function makeShopCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length]!;
  return `TRNJ-${out}`;
}
