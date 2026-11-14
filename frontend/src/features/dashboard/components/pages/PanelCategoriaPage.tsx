import type { ReactElement } from "react";
import { Navigate, useParams } from "react-router-dom";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { GRUPOS, esVisibleEntrada } from "../../../../common/components/menuEntradas";
import { useAuth } from "../../../../common/context/useAuth";
import { Pagina } from "../../../../components/ui/plantillas";
import { PanelCalidad } from "../paneles/PanelCalidad";
import { PanelEquipos } from "../paneles/PanelEquipos";
import { PanelInventario } from "../paneles/PanelInventario";
import { PanelLimpieza } from "../paneles/PanelLimpieza";
import { PanelPersonas } from "../paneles/PanelPersonas";
import { PanelProduccion } from "../paneles/PanelProduccion";

/** Texto bajo el título de cada panel. */
const DESCRIPCION: Record<string, string> = {
  produccion: "Lotes en curso, producción reciente y estado de recetas y productos.",
  inventario: "Stock de materia prima, vencimientos de lotes recibidos y proveedores.",
  limpieza: "Cumplimiento del checklist, stock de químicos y recambio de elementos.",
  equipos: "Estado de calibración y mantenimiento, y distribución de los equipos.",
  calidad: "Incidentes, tiempos de cierre y vencimientos que piden atención.",
  personas: "Personal por rol y estado de sus aptitudes.",
};

/**
 * Panel de una categoría del menú (`/resumen/:categoria`): es lo que se ve al
 * elegir "Producción", "Inventario", etc. en la barra, antes de entrar a una
 * de sus pantallas.
 *
 * La categoría sale de `GRUPOS`: si el usuario no ve ninguna pantalla de esa
 * categoría (un operador en Inventario) tampoco ve su panel, y vuelve al
 * inicio. Dentro de cada panel, los bloques de administración se piden solo
 * si el usuario administra.
 */
export function PanelCategoriaPage() {
  const { categoria = "" } = useParams<{ categoria: string }>();
  const { user } = useAuth();

  const grupo = GRUPOS.find((g) => g.id === categoria);
  const visible = grupo?.entradas.some((e) => esVisibleEntrada(e, user)) ?? false;
  if (!grupo || !visible) return <Navigate to="/" replace />;

  const administra = puedeAdministrar(user);

  const paneles: Record<string, ReactElement> = {
    produccion: <PanelProduccion administra={administra} />,
    inventario: <PanelInventario />,
    limpieza: <PanelLimpieza administra={administra} />,
    equipos: <PanelEquipos />,
    calidad: <PanelCalidad administra={administra} />,
    personas: <PanelPersonas />,
  };
  const panel = paneles[grupo.id];
  if (!panel) return <Navigate to="/" replace />;

  return (
    <Pagina titulo={grupo.label} descripcion={DESCRIPCION[grupo.id] ?? grupo.ayuda}>
      {panel}
    </Pagina>
  );
}
