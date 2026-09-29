import type { RouteObject } from "react-router-dom";
import { UnidadMedidaPage } from "./components/pages/unidadMedidaPage";
import { UnidadMedidaCreatePage } from "./components/pages/UnidadMedidaCreatePage";
import { UnidadMedidaEditPage } from "./components/pages/UnidadMedidaEditPage";

export const unidadMedidaRoutes: RouteObject[] = [
  { path: "unidades-medida", element: <UnidadMedidaPage /> },
  { path: "unidades-medida/nuevo", element: <UnidadMedidaCreatePage /> },
  { path: "unidades-medida/:id/editar", element: <UnidadMedidaEditPage /> },
];
