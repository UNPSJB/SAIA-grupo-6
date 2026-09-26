import type { RouteObject } from "react-router-dom";
import { ChecklistPage } from "./components/pages/ChecklistPage";
import { HistorialChecklistPage } from "./components/pages/HistorialChecklistPage";

export const checklistRoutes: RouteObject[] = [
  { path: "checklist", element: <ChecklistPage /> },
  { path: "checklist/historial", element: <HistorialChecklistPage /> },
];
