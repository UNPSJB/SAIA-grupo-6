import type { RouteObject } from "react-router-dom";
import { InsumosPage } from "./components/pages/insumosPage";
import { InsumoCreatePage } from "./components/pages/insumoCreatePage";
import { InsumoEditPage } from "./components/pages/insumoEditPage";

// Agregar este array al array de `children` (o `routes`) de tu router principal
export const insumoRoutes: RouteObject[] = [
  { path: "insumos", element: <InsumosPage /> },
  { path: "insumos/nuevo", element: <InsumoCreatePage /> },
  { path: "insumos/:id/editar", element: <InsumoEditPage /> },
];
