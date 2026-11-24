import { useEffect, useState } from "react";
import { getEstablecimientoElegido, setEstablecimientoElegido } from "../../../common/api/apiClient";
import { EVENTO_ESTABLECIMIENTOS, listarEstablecimientos } from "../services/establecimientoService";
import type { Establecimiento } from "../types/establecimiento";

/** Sede en la que trabaja el super admin cuando todavía no eligió ninguna. */
const ID_PRINCIPAL = 1;

/**
 * Sedes activas y en cuál trabaja el super admin. Si la que tenía elegida se
 * dio de baja, vuelve a la principal.
 *
 * Con `activo: false` no pide nada: el resto de los usuarios tiene su sede fija.
 */
export function useSedes(activo: boolean) {
  const [sedes, setSedes] = useState<Establecimiento[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const elegida = getEstablecimientoElegido() ?? ID_PRINCIPAL;

  // Una sede creada, renombrada o dada de baja se refleja sin recargar la app.
  useEffect(() => {
    if (!activo) return;
    const recargar = () => setVersion((v) => v + 1);
    window.addEventListener(EVENTO_ESTABLECIMIENTOS, recargar);
    return () => window.removeEventListener(EVENTO_ESTABLECIMIENTOS, recargar);
  }, [activo]);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    listarEstablecimientos()
      .then((lista) => {
        if (!vigente) return;
        setSedes(lista);
        setError(false);
        // La sede guardada pudo darse de baja: se vuelve a la principal.
        if (lista.length > 0 && !lista.some((e) => e.id === elegida)) {
          setEstablecimientoElegido(null);
          window.location.assign("/");
        }
      })
      .catch(() => {
        if (vigente) setError(true);
      });
    return () => {
      vigente = false;
    };
  }, [activo, elegida, version]);

  return { sedes, elegida, error };
}
