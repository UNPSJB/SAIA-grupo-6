import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import {
  listarIngredientesParaReceta,
  listarRecetas,
  listarVersiones,
} from "../services/recetaService";
import type { IngredienteOpcion, Receta, VersionResumen } from "../types/receta";

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

export function useIngredientesParaReceta() {
  const cargar = useCallback(() => listarIngredientesParaReceta(), []);
  const { items, loading, error } = useLista<IngredienteOpcion[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los ingredientes",
  });
  return { ingredientes: items, loading, error };
}
