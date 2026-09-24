import type { RouteObject } from "react-router-dom";
import { PlanLimpiezaPage } from "./components/pages/PlanLimpiezaPage";
import { PlanLimpiezaCreatePage } from "./components/pages/PlanLimpiezaCreatePage";
import { PlanLimpiezaEditPage } from "./components/pages/PlanLimpiezaEditPage";

export const planLimpiezaRoutes: RouteObject[] = [
  { path: "planes-limpieza", element: <PlanLimpiezaPage /> },
  { path: "planes-limpieza/nuevo", element: <PlanLimpiezaCreatePage /> },
  { path: "planes-limpieza/:id/editar", element: <PlanLimpiezaEditPage /> },
];
