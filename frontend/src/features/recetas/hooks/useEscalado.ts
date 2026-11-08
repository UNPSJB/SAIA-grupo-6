import { useEffect, useState } from "react";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import { escalarReceta } from "../services/recetaService";
import type { ModoEscalado, RecetaEscalada } from "../types/receta";

interface Resultado {
  clave: string;
  datos: RecetaEscalada | null;
  error: string | null;
}

/**
 * Escala la versión vigente de una receta mientras se escribe la cantidad o
 * el factor. Es una vista de cálculo: el backend no modifica nada.
 *
 * El resultado se guarda junto con la clave del pedido que lo produjo, así
 * "cargando" y "sin resultado" se derivan sin tocar el estado en el efecto.
 */
export function useEscalado(recetaId: number | null, modo: ModoEscalado, valor: string) {
  const valorAplicado = useValorDebounced(valor, 350);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const numero = Number(valorAplicado.replace(",", "."));
  const valido = recetaId !== null && Number.isFinite(numero) && numero > 0;
  const clave = valido ? `${recetaId}|${modo}|${numero}` : "";

  useEffect(() => {
    if (!clave || recetaId === null) return;
    let vigente = true;
    escalarReceta(recetaId, modo, String(numero))
      .then((datos) => {
        if (vigente) setResultado({ clave, datos, error: null });
      })
      .catch((err) => {
        if (vigente) {
          setResultado({
            clave,
            datos: null,
            error: err instanceof Error ? err.message : "No se pudo escalar la receta.",
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, [clave, recetaId, modo, numero]);

  const actual = resultado && resultado.clave === clave ? resultado : null;
  return {
    escalado: valido ? (actual?.datos ?? null) : null,
    error: valido ? (actual?.error ?? null) : null,
    loading: valido && actual === null,
    valido,
  };
}
