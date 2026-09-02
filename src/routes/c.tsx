import { createFileRoute, redirect } from "@tanstack/react-router";
import { CustomerApp } from "@/components/customer/customer-app";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/c")({ component: CustomerHome });

function CustomerHome() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <main className="grid min-h-dvh place-items-center text-sm">در حال بارگذاری…</main>;
  if (!user) return <RedirectToCustomerSignIn />;
  if (!user.email.endsWith("@customer.toranj.ir")) return <RedirectToCustomerSignIn />;
  return <CustomerApp />;
}

function RedirectToCustomerSignIn() {
  if (typeof window !== "undefined") {
    window.location.replace("/customer-login");
  }
  return <main className="grid min-h-dvh place-items-center text-sm">در حال انتقال به ورود مشتری…</main>;
}
