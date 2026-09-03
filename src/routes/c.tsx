import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { CustomerApp } from "@/components/customer/customer-app";
import { CustomerMessenger } from "@/components/customer/customer-messenger";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { setupNativePush } from "@/lib/toranj/native-push";

export const Route = createFileRoute("/c")({ component: CustomerHome });

function CustomerHome() {
  const { user, isPending } = useCurrentUserState();
  useEffect(() => {
    if (isPending || !user) return;
    let cleanup: (() => void) | undefined;
    void setupNativePush("customer").then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, [isPending, user]);
  if (isPending) return <main className="grid min-h-dvh place-items-center text-sm text-ink-soft">در حال بارگذاری…</main>;
  if (!user) return <RedirectToCustomerSignIn />;
  return <><CustomerApp /><CustomerMessenger /></>;
}

function RedirectToCustomerSignIn() {
  if (typeof window !== "undefined") window.location.replace("/customer-login");
  return <main className="grid min-h-dvh place-items-center text-sm text-ink-soft">در حال انتقال به ورود مشتری…</main>;
}
