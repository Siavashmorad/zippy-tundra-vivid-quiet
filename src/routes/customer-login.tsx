import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ToranjMark } from "@/components/brand/toranj-mark";
import { normalizeIranPhone } from "@/lib/toranj/phone";
import { faErr } from "@/lib/toranj/errors";

export const Route = createFileRoute("/customer-login")({ component: CustomerLogin });
const LAST_KEY = "toranj.customer.lastAccount";

function CustomerLogin() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try { const saved = localStorage.getItem(LAST_KEY); if (saved) setPhone(saved); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isPending && user) void navigate({ to: "/c" });
  }, [isPending, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const normalized = normalizeIranPhone(phone);
      if (!normalized) throw new Error("شماره موبایل معتبر نیست.");
      if (password.length < 8) throw new Error("رمز عبور باید حداقل ۸ نویسه باشد.");
      const email = `${normalized}@customer.toranj.ir`;
      if (mode === "up") {
        if (!firstName.trim() || !lastName.trim()) throw new Error("نام و نام خانوادگی را وارد کنید.");
        const result = await authClient.signUp.email({ email, password, name: `${firstName.trim()} ${lastName.trim()}` });
        if (result.error) throw new Error(result.error.message ?? "ثبت‌نام ناموفق بود.");
      } else {
        const result = await authClient.signIn.email({ email, password, rememberMe: true });
        if (result.error) throw new Error(result.error.message ?? "ورود ناموفق بود.");
      }
      try { localStorage.setItem(LAST_KEY, normalized); } catch { /* ignore */ }
      await authClient.getSession();
      navigate({ to: "/c" });
    } catch (e) {
      setError(e instanceof Error ? e.message : faErr(e));
    } finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10"><div className="mb-8 text-center"><div className="mx-auto grid size-16 place-items-center rounded-[1.6rem] bg-emerald-600 text-white shadow-card"><ToranjMark className="size-10" /></div><h1 className="mt-5 text-2xl font-semibold">مشتری ترنج</h1><p className="mt-1 text-sm text-ink-soft">ثبت سفارش مستقیم از ترنج</p></div><div className="rounded-[1.75rem] bg-surface p-5 shadow-card"><div className="mb-5 grid grid-cols-2 rounded-xl bg-paper-2 p-1"><button type="button" className={`rounded-lg py-2.5 text-sm ${mode === "in" ? "bg-surface shadow-card" : "text-ink-soft"}`} onClick={() => setMode("in")}>ورود</button><button type="button" className={`rounded-lg py-2.5 text-sm ${mode === "up" ? "bg-surface shadow-card" : "text-ink-soft"}`} onClick={() => setMode("up")}>ثبت‌نام</button></div><form className="space-y-3" onSubmit={submit}>{mode === "up" && <><input className="h-12 w-full rounded-xl border border-line bg-paper px-3" placeholder="نام" value={firstName} onChange={(e) => setFirstName(e.target.value)} /><input className="h-12 w-full rounded-xl border border-line bg-paper px-3" placeholder="نام خانوادگی" value={lastName} onChange={(e) => setLastName(e.target.value)} /></>}<input className="h-12 w-full rounded-xl border border-line bg-paper px-3" placeholder="شماره موبایل" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /><input className="h-12 w-full rounded-xl border border-line bg-paper px-3" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder="رمز عبور (حداقل ۸ نویسه)" value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">{error}</p>}<button disabled={busy} className="h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60">{busy ? "لطفاً صبر کنید…" : mode === "up" ? "ثبت‌نام مشتری" : "ورود به حساب"}</button></form></div></main>;
}
