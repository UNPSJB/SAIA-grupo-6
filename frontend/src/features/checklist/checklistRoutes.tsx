import type { RouteObject } from "react-router-dom";
import { ChecklistPage } from "./components/pages/ChecklistPage";

export const checklistRoutes: RouteObject[] = [
  { path: "checklist", element: <ChecklistPage /> },
];
