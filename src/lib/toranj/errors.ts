export class ToranjError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ToranjError";
    this.status = status;
  }
}

export function toFaError(err: unknown): string {
  if (err instanceof ToranjError) return err.message;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (!msg || msg === "Unauthorized" || /unauthorized/i.test(msg)) {
    return "برای ادامه وارد حساب شوید.";
  }
  if (/failed to fetch|networkerror|load failed|network/i.test(msg)) {
    return "اتصال اینترنت برقرار نیست. دوباره تلاش کنید.";
  }
  if (/duplicate|unique|already exists/i.test(msg)) {
    return "این مورد قبلاً ثبت شده است.";
  }
  if (/timeout|timed out/i.test(msg)) {
    return "پاسخ سرور طول کشید. دوباره تلاش کنید.";
  }
  if (/internal|econnrefused|500/i.test(msg)) {
    return "سرور در دسترس نیست. کمی بعد دوباره تلاش کنید.";
  }
  if (/[\u0600-\u06FF]/.test(msg)) return msg;
  return "خطایی رخ داد. دوباره تلاش کنید.";
}

export function fail(message: string, status = 400): never {
  throw new ToranjError(message, status);
}
