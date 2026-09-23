import type { RouteObject } from "react-router-dom";
import { InsumosQuimicosPage } from "./components/pages/insumosQuimicosPage";
import { InsumoQuimicoCreatePage } from "./components/pages/insumoQuimicoCreatePage";
import { InsumoQuimicoEditPage } from "./components/pages/insumoQuimicoEditPage";

export const insumoQuimicoRoutes: RouteObject[] = [
  { path: "insumos-quimicos", element: <InsumosQuimicosPage /> },
  { path: "insumos-quimicos/nuevo", element: <InsumoQuimicoCreatePage /> },
  { path: "insumos-quimicos/:id/editar", element: <InsumoQuimicoEditPage /> },
];