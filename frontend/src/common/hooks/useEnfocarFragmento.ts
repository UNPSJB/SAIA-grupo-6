import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useEnfocarFragmento(listo: boolean) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!listo || !hash) return;
    const destino = document.getElementById(hash.slice(1));
    destino?.scrollIntoView?.({ block: "center" });
    const control = destino?.matches("input, select, textarea, button, a, [tabindex]")
      ? destino
      : destino?.querySelector<HTMLElement>("input, select, textarea");
    control?.focus({ preventScroll: true });
  }, [hash, listo]);
}
