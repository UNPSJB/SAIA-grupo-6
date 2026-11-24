import type { ReactElement } from "react";
import { Navigate, useParams } from "react-router-dom";
import { GRUPOS, destinoCategoria, esVisibleEntrada, vePaneles } from "../../../../common/components/menuEntradas";
import { useAuth } from "../../../../common/context/useAuth";
import { Box } from "@chakra-ui/react";
import { BannerPanel } from "../BannerPanel";
import type { CategoriaPanel } from "../../types/paneles";
import { PanelCalidad } from "../paneles/PanelCalidad";
import { PanelEquipos } from "../paneles/PanelEquipos";
import { PanelInventario } from "../paneles/PanelInventario";
import { PanelLimpieza } from "../paneles/PanelLimpieza";
import { PanelPersonas } from "../paneles/PanelPersonas";
import { PanelProduccion } from "../paneles/PanelProduccion";

/** Texto bajo el título de cada panel. */
const DESCRIPCION: Record<string, string> = {
  produccion: "Lotes elaborados, salidas de producto, retiros y estado del catálogo.",
  inventario: "Stock de materia prima, vencimientos de lotes y movimiento del depósito.",
  limpieza: "Cumplimiento del checklist, estado de los planes y reposición de químicos.",
  equipos: "Equipos en servicio, sus incidentes y el estado de calibración y mantenimiento.",
  calidad: "Incidentes, tiempos de resolución, reclamos de clientes y vencimientos.",
  personas: "Personal y sus aptitudes, cumplimiento de tareas, clientes y transportistas.",
};

/**
 * Panel de una categoría del menú (`/resumen/:categoria`): es lo que se ve al
 * elegir "Producción", "Inventario", etc. en la barra, antes de entrar a una
 * de sus pantallas.
 *
 * La categoría sale de `GRUPOS`: si el usuario no ve ninguna pantalla de esa
 * categoría (un operador en Inventario) tampoco ve su panel, y vuelve al
 * inicio. Los datos de cada panel vienen de un único endpoint agregado
 * (`/paneles/{categoria}`), que ya recorta lo que es solo de administración.
 */
export function PanelCategoriaPage() {
  const { categoria = "" } = useParams<{ categoria: string }>();
  const { user } = useAuth();

  const grupo = GRUPOS.find((g) => g.id === categoria);
  const visible = grupo?.entradas.some((e) => esVisibleEntrada(e, user)) ?? false;
  if (!grupo || !visible) return <Navigate to="/" replace />;
  // Quien solo opera no ve los paneles de indicadores: va a la primera
  // pantalla de la categoría (su cumplimiento lo ve en el Inicio).
  if (!vePaneles(user)) return <Navigate to={destinoCategoria(grupo, user)} replace />;

  const paneles: Record<string, ReactElement> = {
    produccion: <PanelProduccion />,
    inventario: <PanelInventario />,
    limpieza: <PanelLimpieza />,
    equipos: <PanelEquipos />,
    calidad: <PanelCalidad />,
    personas: <PanelPersonas />,
  };
  const panel = paneles[grupo.id];
  if (!panel) return <Navigate to="/" replace />;

  return (
    // Sin margen propio (a diferencia de `Pagina`): solo el de `main`, igual
    // que el Inicio, así el banner queda a la misma distancia de la barra.
    <Box w="100%">
      <BannerPanel
        categoria={grupo.id as CategoriaPanel}
        titulo={grupo.label}
        descripcion={DESCRIPCION[grupo.id] ?? grupo.ayuda}
        icono={grupo.icon}
      />
      {panel}
    </Box>
  );
}
