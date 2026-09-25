import type { RouteObject } from "react-router-dom";
import { ElementosLimpiezaPage } from "./components/pages/elementoLimpiezaPage";
import { ElementoLimpiezaCreatePage } from "./components/pages/elementoLimpiezaCreatePage";
import { ElementoLimpiezaEditPage } from "./components/pages/elementoLimpiezaEditPage";

export const elementoLimpiezaRoutes: RouteObject[] = [
  { path: "elementoslimpieza", element: <ElementosLimpiezaPage /> },
  { path: "elementoslimpieza/nuevo", element: <ElementoLimpiezaCreatePage /> },
  { path: "elementoslimpieza/:id/editar", element: <ElementoLimpiezaEditPage /> },
];