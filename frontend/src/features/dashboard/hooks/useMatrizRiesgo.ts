import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerCriticidadDashboard } from "../../notificaciones/services/notificacionService";
import { listarCorregidasRecientes } from "../../planesAccion/services/planAccionService";
import { MATRIZ_VACIA, calcularMatrizRiesgo, type MatrizRiesgo } from "../types/matrizRiesgo";

export interface MatricesRiesgo {
  /** Riesgo real: todas las situaciones abiertas, con o sin plan. */
  real: MatrizRiesgo;
  /** Riesgo tratado: sin lo que un plan verificado tiene bajo control. */
  tratado: MatrizRiesgo;
  /** Si los planes son eficaces: sin lo verificado ni lo que ya está en un
   *  plan activo. Estimación del mejor caso. */
  proyectado: MatrizRiesgo;
  /** Cómo estaría hoy SIN lo que los planes corrigieron en los últimos 30
   *  días: el real más esas situaciones, con el último riesgo que tenían. */
  sinPlanes: MatrizRiesgo;
  /** Cuántas situaciones corrigieron los planes en los últimos 30 días. */
  corregidas: number;
}

const MATRICES_VACIAS: MatricesRiesgo = {
  real: MATRIZ_VACIA,
  tratado: MATRIZ_VACIA,
  proyectado: MATRIZ_VACIA,
  sinPlanes: MATRIZ_VACIA,
  corregidas: 0,
};

export interface OpcionesMatricesRiesgo {
  /** Pide también lo que los planes corrigieron (solo la tarjeta de planes). */
  conCorregidas?: boolean;
}

/**
 * Matrices de riesgo (real y tratada). Salen de `/notificaciones/criticidad`
 * (el mismo pedido que arma el banner de Notificaciones), que es solo para
 * quien administra: con `habilitado` en false no se pide nada.
 */
export function useMatrizRiesgo(
  habilitado: boolean,
  { conCorregidas = false }: OpcionesMatricesRiesgo = {},
) {
  const cargar = useCallback(
    () =>
      habilitado
        ? Promise.all([
            obtenerCriticidadDashboard(),
            conCorregidas ? listarCorregidasRecientes() : Promise.resolve([]),
          ]).then(([datos, corregidas]) => {
            // Lo que la grilla de situaciones sueltas no muestra: los elementos
            // en riesgo alto y lo que exige un plan de acción.
            const obligacion = {
              elementosAltoSinPlan: datos.elementos_alto_sin_plan ?? 0,
              planesRequeridos: datos.planes_requeridos ?? 0,
            };
            return {
              real: {
                ...calcularMatrizRiesgo(datos.alertas, { incluirControladas: true }),
                ...obligacion,
                elementosAlto: datos.elementos.filter((e) => e.nivel === "alto").length,
              },
              tratado: {
                ...calcularMatrizRiesgo(datos.alertas),
                ...obligacion,
                elementosAlto: datos.elementos.filter((e) => e.nivel_tratado === "alto").length,
              },
              proyectado: {
                ...calcularMatrizRiesgo(datos.alertas, { excluirEnPlanActivo: true }),
                ...obligacion,
              },
              // Lo corregido vuelve a la grilla en la celda que ocupaba.
              sinPlanes: {
                ...calcularMatrizRiesgo(
                  [
                    ...datos.alertas,
                    ...corregidas.map((c) => ({
                      impacto: c.impacto,
                      probabilidad: c.probabilidad,
                      puntaje: c.puntaje,
                      plan_tratamiento_id: null,
                      plan_activo_id: null,
                    })),
                  ],
                  { incluirControladas: true },
                ),
                ...obligacion,
              },
              corregidas: corregidas.length,
            };
          })
        : Promise.resolve(MATRICES_VACIAS),
    [habilitado, conCorregidas],
  );

  const { items, loading, error, recargar } = useLista<MatricesRiesgo>({
    cargar,
    dependencias: [habilitado, conCorregidas],
    valorInicial: MATRICES_VACIAS,
    mensajeError: "No se pudo cargar la matriz de riesgo",
  });

  return {
    matriz: items.tratado,
    real: items.real,
    proyectado: items.proyectado,
    sinPlanes: items.sinPlanes,
    corregidas: items.corregidas,
    loading,
    error,
    recargar,
  };
}
