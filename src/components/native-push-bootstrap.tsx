import { useEffect } from "react";
import { setupNativePush } from "@/lib/toranj/native-push";

export function NativePushBootstrap() {
  useEffect(() => {
    const role = import.meta.env.VITE_TORANJ_APP_ROLE;
    if (role !== "seller" && role !== "customer") return;

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
  }, []);

  return null;
}
