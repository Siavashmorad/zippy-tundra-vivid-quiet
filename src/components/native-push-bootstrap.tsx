import { useEffect } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { setupNativePush } from "@/lib/toranj/native-push";

/**
 * Register the device with FCM only after Better Auth has resolved a signed-in
 * user. The registration event calls an authenticated server function; starting
 * push setup before login caused the token registration retries to expire while
 * the user was still signing in.
 */
export function NativePushBootstrap() {
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    const role = import.meta.env.VITE_TORANJ_APP_ROLE;
    if ((role !== "seller" && role !== "customer") || isPending || !user) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void setupNativePush(role).then((dispose) => {
      if (cancelled) dispose();
      else cleanup = dispose;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [isPending, user?.id]);

  return null;
}
