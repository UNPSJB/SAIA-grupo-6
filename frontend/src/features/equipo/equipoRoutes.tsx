import type { RouteObject } from "react-router-dom";
import { EquiposPage } from "./components/pages/equipoPage";
import { EquipoCreatePage } from "./components/pages/equipoCreatePage";
import { EquipoEditPage } from "./components/pages/equipoEditPage";

// Agregar este array al array de `children` (o `routes`) de tu router principal
export const insumoRoutes: RouteObject[] = [
  { path: "insumos", element: <EquiposPage /> },
  { path: "insumos/nuevo", element: <EquipoCreatePage /> },
  { path: "insumos/:id/editar", element: <EquipoEditPage /> },
];
