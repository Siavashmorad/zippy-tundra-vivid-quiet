import { createFileRoute } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SellerApp, Splash } from "@/components/seller/seller-app";

type Tab = "orders" | "customers" | "messages";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search.tab === "customers" || search.tab === "messages" || search.tab === "orders"
        ? (search.tab as Tab)
        : undefined,
    order: typeof search.order === "string" ? search.order : undefined,
    customer: typeof search.customer === "string" ? search.customer : undefined,
  }),
  component: Home,
});

function Home() {
  const { user, isPending } = useCurrentUserState();
  const search = Route.useSearch();
  if (isPending) return <Splash />;
  if (!user) return <RedirectToSignIn />;
  return (
    <SellerApp
      user={user}
      initialTab={search.tab}
      initialOrder={search.order}
      initialCustomer={search.customer}
    />
  );
}
