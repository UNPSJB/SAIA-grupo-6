import type { RouteObject } from "react-router-dom";
import { PersonalPage } from "./components/pages/PersonalPage";
import { PersonalCreatePage } from "./components/pages/PersonalCreatePage";
import { PersonalEditPage } from "./components/pages/PersonalEditPage";
import { PersonalDetailPage } from "./components/pages/PersonalDetailPage";

export const personalRoutes: RouteObject[] = [
  { path: "personal", element: <PersonalPage /> },
  { path: "personal/nuevo", element: <PersonalCreatePage /> },
  { path: "personal/:id/editar", element: <PersonalEditPage /> },
  { path: "personal/detalle/:id", element: <PersonalDetailPage /> },
];