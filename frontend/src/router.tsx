/* eslint-disable react-refresh/only-export-components */
import { Login } from "./features/Login";

import { createBrowserRouter, Outlet } from "react-router-dom";

import Navbar from "./common/components/Navbar";
import { RequireAuth, RequireRole } from "./common/components/RequireAuth";

// 1. Personal
import { PersonalPage } from "./features/personal/components/pages/PersonalPage";
import { PersonalCreatePage } from "./features/personal/components/pages/PersonalCreatePage";
import { PersonalEditPage } from "./features/personal/components/pages/PersonalEditPage";
import { PersonalDetailPage } from "./features/personal/components/pages/PersonalDetailPage";

// 2. Insumos
import { InsumosPage } from "./features/insumos/components/pages/insumosPage";
import { InsumoCreatePage } from "./features/insumos/components/pages/insumoCreatePage";
import { InsumoEditPage } from "./features/insumos/components/pages/insumoEditPage";

// 3. Equipos
import { EquiposPage } from "./features/equipo/components/pages/equipoPage";
import { EquipoCreatePage } from "./features/equipo/components/pages/equipoCreatePage";
import { EquipoEditPage } from "./features/equipo/components/pages/equipoEditPage";

// Elementos de Limpieza
import { ElementosLimpiezaPage } from "./features/elementoLimpieza/components/pages/elementoLimpiezaPage";
import { ElementoLimpiezaCreatePage } from "./features/elementoLimpieza/components/pages/elementoLimpiezaCreatePage";
import { ElementoLimpiezaEditPage } from "./features/elementoLimpieza/components/pages/elementoLimpiezaEditPage";

// 4. Planes de Limpieza
import { PlanLimpiezaPage } from "./features/planLimpieza/components/pages/PlanLimpiezaPage";
import { PlanLimpiezaCreatePage } from "./features/planLimpieza/components/pages/PlanLimpiezaCreatePage";
import { PlanLimpiezaEditPage } from "./features/planLimpieza/components/pages/PlanLimpiezaEditPage";

// Planes de Calibración/Mantenimiento
import { PlanCalibracionMantenimientoPage } from "./features/planCalibracionMantenimiento/components/pages/PlanCalibracionMantenimientoPage";
import { PlanCalibracionMantenimientoCreatePage } from "./features/planCalibracionMantenimiento/components/pages/PlanCalibracionMantenimientoCreatePage";
import { PlanCalibracionMantenimientoEditPage } from "./features/planCalibracionMantenimiento/components/pages/PlanCalibracionMantenimientoEditPage";

// 5. Checklist
import { ChecklistPage } from "./features/checklist/components/pages/ChecklistPage";
import { HistorialChecklistPage } from "./features/checklist/components/pages/HistorialChecklistPage";
import { ConsumoInsumosPage } from "./features/checklist/components/pages/ConsumoInsumosPage";

// 6. Insumos Químicos
import { InsumosQuimicosPage } from "./features/insumoQuimico/components/pages/insumosQuimicosPage";
import { InsumoQuimicoCreatePage } from "./features/insumoQuimico/components/pages/insumoQuimicoCreatePage";
import { InsumoQuimicoEditPage } from "./features/insumoQuimico/components/pages/insumoQuimicoEditPage";

// Notificaciones
import { NotificacionesPage } from "./features/notificaciones/components/pages/NotificacionesPage";

// 7. Unidad de Medida
import { UnidadMedidaPage } from "./features/unidadMedida/components/pages/unidadMedidaPage";
import { UnidadMedidaCreatePage } from "./features/unidadMedida/components/pages/UnidadMedidaCreatePage";
import { UnidadMedidaEditPage } from "./features/unidadMedida/components/pages/UnidadMedidaEditPage";// Layout principal que mantiene el menú a la izquierda
// 8. Importamos del modulo Aptitud
import { AptitudPage } from "./features/aptitud/components/pages/AptitudPage";
import { AptitudCreatePage } from "./features/aptitud/components/pages/AptitudCreatePage";
import { AptitudEditPage } from "./features/aptitud/components/pages/AptitudEditPage";


// 8. Incidentes
import { IncidentesListPage } from "./features/incidente/components/pages/IncidentesListPage";
import { IncidenteDetailPage } from "./features/incidente/components/pages/IncidenteDetailPage";
import { ReportarIncidentePage } from "./features/incidente/components/pages/ReportarIncidentePage";

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

      <div
        style={{
          flex: 1,
          padding: "15px 30px",
          overflowY: "auto",
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
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
              <div
                style={{
                  textAlign: "center",
                  marginTop: "50px",
                }}
              >
                <h1>Panel Principal - SAIA</h1>
                <p>
                  Seleccioná una opción en el menú lateral para comenzar.
                </p>
              </div>
            ),
          },

          // =====================================================
          // RUTAS PARA USUARIOS CON PERMISO DE OPERAR
          // =====================================================
          {
            element: <RequireRole permiso="puede_operar" />,

            children: [
              {
                path: "/checklist",
                element: <ChecklistPage />,
              },
              {
                path: "/incidentes/reportar",
                element: <ReportarIncidentePage />,
              },
              {
                path: "/incidentes/:id",
                element: <IncidenteDetailPage />,
              },
            ],
          },

          // =====================================================
          // RUTAS PARA ADMINISTRADORES
          // =====================================================
          {
            element: <RequireRole permiso="puede_administrar" />,

            children: [
              // ---------------- PERSONAL ----------------
              {
                path: "/personal",
                element: <PersonalPage />,
              },
              {
                path: "/personal/nuevo",
                element: <PersonalCreatePage />,
              },
              {
                path: "/personal/:id/editar",
                element: <PersonalEditPage />,
              },
              {
                path: "/personal/detalle/:id",
                element: <PersonalDetailPage />,
              },

              // ---------------- INSUMOS ----------------
              {
                path: "/insumos",
                element: <InsumosPage />,
              },
              {
                path: "/insumos/nuevo",
                element: <InsumoCreatePage />,
              },
              {
                path: "/insumos/:id/editar",
                element: <InsumoEditPage />,
              },

              // ---------------- EQUIPOS ----------------
              {
                path: "/equipos",
                element: <EquiposPage />,
              },
              {
                path: "/equipos/nuevo",
                element: <EquipoCreatePage />,
              },
              {
                path: "/equipos/:id/editar",
                element: <EquipoEditPage />,
              },

              // ---------------- ELEMENTOS DE LIMPIEZA ----------------
              {
                path: "/elementos-limpieza",
                element: <ElementosLimpiezaPage />,
              },
              {
                path: "/elementos-limpieza/nuevo",
                element: <ElementoLimpiezaCreatePage />,
              },
              {
                path: "/elementos-limpieza/:id/editar",
                element: <ElementoLimpiezaEditPage />,
              },

              // ---------------- PLANES DE LIMPIEZA ----------------
              {
                path: "/planes-limpieza",
                element: <PlanLimpiezaPage />,
              },
              {
                path: "/planes-limpieza/nuevo",
                element: <PlanLimpiezaCreatePage />,
              },
              {
                path: "/planes-limpieza/:id/editar",
                element: <PlanLimpiezaEditPage />,
              },

              // ---------------- PLANES DE CALIBRACIÓN/MANTENIMIENTO ----------------
              {
                path: "/planes-calibracion-mantenimiento",
                element: <PlanCalibracionMantenimientoPage />,
              },
              {
                path: "/planes-calibracion-mantenimiento/nuevo",
                element: <PlanCalibracionMantenimientoCreatePage />,
              },
              {
                path: "/planes-calibracion-mantenimiento/:id/editar",
                element: <PlanCalibracionMantenimientoEditPage />,
              },

              // ---------------- APTITUDES ----------------
              {
                path: "/aptitudes",
                element: <AptitudPage />,
              },
              {
                path: "/aptitudes/nuevo",
                element: <AptitudCreatePage />,
              },
              {
                path: "/aptitudes/:id/editar",
                element: <AptitudEditPage />,
              },

              // ---------------- CHECKLIST ----------------
              {
                path: "/checklist/historial",
                element: <HistorialChecklistPage />,
              },
              {
                path: "/consumo-productos",
                element: <ConsumoInsumosPage />,
              },

              // ---------------- NOTIFICACIONES ----------------
              {
                path: "/notificaciones",
                element: <NotificacionesPage />,
              },

              // ---------------- INSUMOS QUÍMICOS ----------------
              {
                path: "/insumos-quimicos",
                element: <InsumosQuimicosPage />,
              },
              {
                path: "/insumos-quimicos/nuevo",
                element: <InsumoQuimicoCreatePage />,
              },
              {
                path: "/insumos-quimicos/:id/editar",
                element: <InsumoQuimicoEditPage />,
              },

              // ---------------- UNIDAD DE MEDIDA ----------------
              {
                path: "/unidades-medida",
                element: <UnidadMedidaPage />,
              },
              {
                path: "/unidades-medida/nuevo",
                element: <UnidadMedidaCreatePage />,
              },
              {
                path: "/unidades-medida/:id/editar",
                element: <UnidadMedidaEditPage />,
              },

              // ---------------- INCIDENTES ----------------
              {
                path: "/incidentes",
                element: <IncidentesListPage />,
              },
            ],
          },

          // =====================================================
          // ERRORES
          // =====================================================
          {
            path: "/sin-permisos",
            element: <SinPermisosPage />,
          },

          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]);


function NotFoundPage() {
  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "50px",
      }}
    >
      <h1>404</h1>
      <p>La página que buscás no existe.</p>
    </div>
  );
}

function SinPermisosPage() {
  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "50px",
      }}
    >
      <h1>No tenés permisos</h1>

      <p>
        Tu usuario no tiene el permiso necesario para ver esta sección.
        Comunicate con un administrador si necesitás acceso.
      </p>
    </div>
  );
}
