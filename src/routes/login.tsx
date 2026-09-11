import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, captureAuthResponseToken, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ToranjMark } from "@/components/brand/toranj-mark";
import { normalizeIranPhone } from "@/lib/toranj/phone";
import { phoneToSellerEmail } from "@/lib/toranj/format";
import { toFaError as faErr } from "@/lib/toranj/errors";

export const Route = createFileRoute("/login")({ component: Login });
const homeSearch = { tab: undefined as undefined, order: undefined as undefined, customer: undefined as undefined };
const LAST_ACCOUNT_KEY = "toranj.seller.lastAccount";

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_ACCOUNT_KEY);
      if (saved) setPhoneOrEmail(saved);
    } catch { /* storage blocked */ }
  }, []);

  useEffect(() => {
    if (!isPending && user) void navigate({ to: "/", search: homeSearch });
  }, [isPending, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const raw = phoneOrEmail.trim();
      const phone = normalizeIranPhone(raw);
      const email = raw.includes("@") ? raw : phone ? phoneToSellerEmail(phone) : "";
      if (!email) throw new Error("شماره موبایل یا ایمیل معتبر وارد کنید.");
      if (password.length < 8) throw new Error("رمز عبور باید حداقل ۸ نویسه باشد.");
      if (mode === "up") {
        if (!name.trim()) throw new Error("نام فروشنده را وارد کنید.");
        const result = await authClient.signUp.email(
          { email, password, name: name.trim() },
          { onSuccess: captureAuthResponseToken },
        );
        if (result.error) throw new Error(result.error.message ?? "ثبت‌نام ناموفق بود.");
      } else {
        const result = await authClient.signIn.email(
          { email, password, rememberMe: true },
          { onSuccess: captureAuthResponseToken },
        );
        if (result.error) throw new Error(result.error.message ?? "ورود ناموفق بود.");
      }
      try { window.localStorage.setItem(LAST_ACCOUNT_KEY, raw); } catch { /* ignore */ }
      let session = await authClient.getSession();
      if (!session.data?.user) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        session = await authClient.getSession();
      }
      if (!session.data?.user) throw new Error("ورود انجام شد اما نشست حساب دریافت نشد. لطفاً یک‌بار دیگر تلاش کنید.");
      void navigate({ to: "/", search: homeSearch });
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
    <div className="mb-8 text-center"><div className="mx-auto grid size-16 place-items-center rounded-[1.6rem] bg-brand text-brand-fg shadow-card"><ToranjMark className="size-10" /></div><h1 className="mt-5 text-2xl font-semibold tracking-tight">فروشنده ترنج</h1><p className="mt-1 text-sm text-ink-soft">سوپر میوه تره‌بار ترنج</p></div>
    <div className="rounded-[1.75rem] bg-surface p-5 shadow-card">
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-paper-2 p-1"><button type="button" className={`rounded-lg py-2.5 text-sm font-medium ${mode === "in" ? "bg-surface shadow-card" : "text-ink-soft"}`} onClick={() => setMode("in")}>ورود</button><button type="button" className={`rounded-lg py-2.5 text-sm font-medium ${mode === "up" ? "bg-surface shadow-card" : "text-ink-soft"}`} onClick={() => setMode("up")}>ثبت‌نام</button></div>
      <form className="space-y-3" onSubmit={onSubmit}>
        {mode === "up" && <label className="block"><span className="mb-1.5 block text-sm font-medium">نام فروشنده</span><input className="h-12 w-full rounded-xl border border-line bg-paper px-3" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="مثلاً محمودی" /></label>}
        <label className="block"><span className="mb-1.5 block text-sm font-medium">شماره موبایل یا ایمیل</span><input className="h-12 w-full rounded-xl border border-line bg-paper px-3" value={phoneOrEmail} onChange={(e) => setPhoneOrEmail(e.target.value)} autoComplete="username" inputMode="email" placeholder="۰۹۱۲۱۲۳۴۵۶۷" dir="ltr" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-medium">رمز عبور</span><input className="h-12 w-full rounded-xl border border-line bg-paper px-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder="حداقل ۸ نویسه" /></label>
        <p className="text-xs text-ink-faint">پس از ورود موفق، نشست این دستگاه حفظ می‌شود و تا خروج دستی نیازی به ورود دوباره نیست.</p>
        {error ? <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">{error}</p> : null}
        <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-brand text-sm font-semibold text-brand-fg disabled:opacity-60">{busy ? "لطفاً صبر کنید…" : mode === "up" ? "ایجاد حساب فروشنده" : "ورود به فروشگاه"}</button>
      </form>
      {authEnabled ? <div className="mt-5 space-y-2"><p className="text-center text-xs text-ink-faint">یا ورود سریع</p>{GROK_PROVIDERS.map((p) => <button key={p.providerId} type="button" className="h-11 w-full rounded-xl border border-line bg-paper text-sm font-medium" onClick={() => void signIn(p.providerId, { callbackURL: "/", errorCallbackURL: "/login" }).catch((err) => setError(faErr(err)))}>ادامه با {p.label === "Google" ? "گوگل" : "ایکس"}</button>)}</div> : null}
    </div>
  </main>;
}

function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid origin|INVALID_ORIGIN/i.test(msg)) return "درخواست از مبدأ مجاز نیست. لطفاً صفحه را تازه‌سازی کنید و دوباره تلاش کنید.";
  if (/database|neon|connection|pglite|503/i.test(msg)) return "ارتباط با پایگاه‌داده برقرار نشد. تنظیمات سرور را بررسی کنید.";
  if (/invalid email or password|invalid password|unauthorized/i.test(msg)) return "شماره یا رمز عبور نادرست است.";
  if (/already exists|registered|user already/i.test(msg)) return "این حساب قبلاً ثبت شده است. وارد شوید.";
  if (/password/i.test(msg) && /8|length|short/i.test(msg)) return "رمز عبور باید حداقل ۸ نویسه باشد.";
  return faErr(err);
}
