import { Login } from './features/Login';

import { createBrowserRouter, Outlet } from "react-router-dom";
import Navbar from "./common/components/Navbar";
import { RequireAuth, RequireRole } from "./common/components/RequireAuth";

// 1. Importaciones del módulo de Personal
import { PersonalPage } from "./features/personal/components/pages/PersonalPage";
import { PersonalCreatePage } from "./features/personal/components/pages/PersonalCreatePage";
import { PersonalEditPage } from "./features/personal/components/pages/PersonalEditPage";
import { PersonalDetailPage } from "./features/personal/components/pages/PersonalDetailPage";

// 2. Importaciones del módulo de Insumos
import { InsumosPage } from "./features/insumos/components/pages/insumosPage";
import { InsumoCreatePage } from "./features/insumos/components/pages/insumoCreatePage";
import { InsumoEditPage } from "./features/insumos/components/pages/insumoEditPage";

// 3. Importaciones del módulo de Equipos
import { EquiposPage } from "./features/equipo/components/pages/equipoPage";
import { EquipoCreatePage } from "./features/equipo/components/pages/equipoCreatePage";
import { EquipoEditPage } from "./features/equipo/components/pages/equipoEditPage";

// Importación de Elementos de Limpieza
import { ElementosLimpiezaPage } from "./features/elementoLimpieza/components/pages/elementoLimpiezaPage";
import { ElementoLimpiezaCreatePage } from "./features/elementoLimpieza/components/pages/elementoLimpiezaCreatePage";
import { ElementoLimpiezaEditPage } from "./features/elementoLimpieza/components/pages/elementoLimpiezaEditPage";

// 4. Importaciones del módulo de Planes de Limpieza
import { PlanLimpiezaPage } from "./features/planLimpieza/components/pages/PlanLimpiezaPage";
import { PlanLimpiezaCreatePage } from "./features/planLimpieza/components/pages/PlanLimpiezaCreatePage";
import { PlanLimpiezaEditPage } from "./features/planLimpieza/components/pages/PlanLimpiezaEditPage";

// 5. Importaciones del módulo de Checklist
import { ChecklistPage } from "./features/checklist/components/pages/ChecklistPage";
import { HistorialChecklistPage } from "./features/checklist/components/pages/HistorialChecklistPage";
import { ConsumoInsumosPage } from "./features/checklist/components/pages/ConsumoInsumosPage";

// 6. Importaciones del módulo de Insumos Químicos
import { InsumosQuimicosPage } from "./features/insumoQuimico/components/pages/insumosQuimicosPage";
import { InsumoQuimicoCreatePage } from "./features/insumoQuimico/components/pages/insumoQuimicoCreatePage";
import { InsumoQuimicoEditPage } from "./features/insumoQuimico/components/pages/insumoQuimicoEditPage";

// Importaciones del módulo de Notificaciones
import { NotificacionesPage } from "./features/notificaciones/components/pages/NotificacionesPage";

// 7. Importaciones del módulo de Unidad de Medida
import { UnidadMedidaPage } from "./features/unidadMedida/components/pages/unidadMedidaPage";
import { UnidadMedidaCreatePage } from "./features/unidadMedida/components/pages/UnidadMedidaCreatePage";
import { UnidadMedidaEditPage } from "./features/unidadMedida/components/pages/UnidadMedidaEditPage";

// Layout principal que mantiene el menú a la izquierda
function LayoutPrincipal() {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#f4f7f6",
      }}
    >
      <Navbar />
      <div style={{ flex: 1, padding: "15px 30px", overflowY: "auto" }}>
        <Outlet />
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <LayoutPrincipal />,
        children: [
          {
            path: "/",
            element: (
              <div style={{ textAlign: "center", marginTop: "50px" }}>
                <h1>Panel Principal - SAIA</h1>
                <p>Seleccioná una opción en el menú lateral para comenzar.</p>
              </div>
            ),
          },
          // --- RUTAS DE CHECKLIST (operar o administrar) ---
          {
            element: <RequireRole permiso="puede_operar" />,
            children: [
              { path: "/checklist", element: <ChecklistPage /> },
            ],
          },
          // --- RUTAS DE HISTORIAL Y NOTIFICACIONES (solo administrar) ---
          {
            element: <RequireRole permiso="puede_administrar" />,
            children: [
              // --- RUTAS DE PERSONAL ---
              { path: "/personal", element: <PersonalPage /> },
              { path: "/personal/nuevo", element: <PersonalCreatePage /> },
              { path: "/personal/:id/editar", element: <PersonalEditPage /> },
              { path: "/personal/detalle/:id", element: <PersonalDetailPage /> },
              // --- RUTAS DE INSUMOS ---
              { path: "/insumos", element: <InsumosPage /> },
              { path: "/insumos/nuevo", element: <InsumoCreatePage /> },
              { path: "/insumos/:id/editar", element: <InsumoEditPage /> },
              // --- RUTAS DE EQUIPOS ---
              { path: "/equipos", element: <EquiposPage /> },
              { path: "/equipos/nuevo", element: <EquipoCreatePage /> },
              { path: "/equipos/:id/editar", element: <EquipoEditPage /> },
              // --- RUTAS DE ELEMENTOS DE LIMPIEZA ---
              { path: "/elementos-limpieza", element: <ElementosLimpiezaPage /> },
              { path: "/elementos-limpieza/nuevo", element: <ElementoLimpiezaCreatePage /> },
              { path: "/elementos-limpieza/:id/editar", element: <ElementoLimpiezaEditPage /> },
              // --- RUTAS DE PLANES DE LIMPIEZA ---
              { path: "/planes-limpieza", element: <PlanLimpiezaPage /> },
              { path: "/planes-limpieza/nuevo", element: <PlanLimpiezaCreatePage /> },
              { path: "/planes-limpieza/:id/editar", element: <PlanLimpiezaEditPage /> },
              { path: "/checklist/historial", element: <HistorialChecklistPage /> },
              { path: "/consumo-productos", element: <ConsumoInsumosPage /> },
              { path: "/notificaciones", element: <NotificacionesPage /> },
              // --- RUTAS DE INSUMOS QUÍMICOS ---
              { path: "/insumos-quimicos", element: <InsumosQuimicosPage /> },
              { path: "/insumos-quimicos/nuevo", element: <InsumoQuimicoCreatePage /> },
              { path: "/insumos-quimicos/:id/editar", element: <InsumoQuimicoEditPage /> },
              // --- RUTAS DE UNIDAD DE MEDIDA ---
              { path: "/unidades-medida", element: <UnidadMedidaPage /> },
              { path: "/unidades-medida/nuevo", element: <UnidadMedidaCreatePage /> },
              { path: "/unidades-medida/:id/editar", element: <UnidadMedidaEditPage /> },
            ],
          },
          // --- 403 y 404 ---
          { path: "/sin-permisos", element: <SinPermisosPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

function NotFoundPage() {
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>404</h1>
      <p>La página que buscás no existe.</p>
    </div>
  );
}

function SinPermisosPage() {
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>No tenés permisos</h1>
      <p>
        Tu usuario no tiene el permiso necesario para ver esta sección.
        Comunicate con un administrador si necesitás acceso.
      </p>
    </div>
  );
}
