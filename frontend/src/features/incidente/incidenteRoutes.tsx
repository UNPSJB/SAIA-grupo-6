import type { RouteObject } from "react-router-dom";
import { IncidentePage } from "./components/pages/IncidentePage";
import { IncidenteCreatePage } from "./components/pages/IncidenteCreatePage";
import { IncidenteDetailPage } from "./components/pages/IncidenteDetailPage";

export const incidenteRoutes: RouteObject[] = [
  { path: "incidentes", element: <IncidentePage /> },
  { path: "incidentes/nuevo", element: <IncidenteCreatePage /> },
  { path: "incidentes/:id", element: <IncidenteDetailPage /> },
];
