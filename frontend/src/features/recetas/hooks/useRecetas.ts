import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import {
  listarInsumosParaReceta,
  listarRecetas,
  listarVersiones,
} from "../services/recetaService";
import type { InsumoOpcion, Receta, VersionResumen } from "../types/receta";

export function useRecetas() {
  const cargar = useCallback(() => listarRecetas(), []);
  const { items, loading, error, recargar } = useLista<Receta[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las recetas",
  });
  return { recetas: items, loading, error, recargar };
}

export function useVersiones(recetaId: number) {
  const cargar = useCallback(() => listarVersiones(recetaId), [recetaId]);
  const { items, loading, error } = useLista<VersionResumen[]>({
    cargar,
    dependencias: [recetaId],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las versiones",
  });
  return { versiones: items, loading, error };
}

export function useInsumosParaReceta() {
  const cargar = useCallback(() => listarInsumosParaReceta(), []);
  const { items, loading, error } = useLista<InsumoOpcion[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los insumos",
  });
  return { insumos: items, loading, error };
}
