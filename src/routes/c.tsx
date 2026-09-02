import { createFileRoute } from "@tanstack/react-router";
import { CustomerApp } from "@/components/customer/customer-app";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/c")({
  component: CustomerHome,
});

function CustomerHome() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center text-sm text-ink-soft">
        در حال بارگذاری…
      </main>
    );
  }
  if (!user) return <RedirectToCustomerSignIn />;
  return <CustomerApp />;
}

function RedirectToCustomerSignIn() {
  if (typeof window !== "undefined") {
    window.location.replace("/customer-login");
  }
  return (
    <main className="grid min-h-dvh place-items-center text-sm text-ink-soft">
      در حال انتقال به ورود مشتری…
    </main>
  );
}
