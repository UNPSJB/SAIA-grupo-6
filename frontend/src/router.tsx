import { createBrowserRouter } from "react-router-dom";
import Navbar from "./common/components/Navbar";

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

// 6. Importaciones del módulo de Insumos Químicos
import { InsumosQuimicosPage } from "./features/insumoQuimico/components/pages/insumosQuimicosPage";
import { InsumoQuimicoCreatePage } from "./features/insumoQuimico/components/pages/insumoQuimicoCreatePage";
import { InsumoQuimicoEditPage } from "./features/insumoQuimico/components/pages/insumoQuimicoEditPage";

// Importaciones del módulo de Notificaciones
import { NotificacionesPage } from "./features/notificaciones/components/pages/NotificacionesPage";// Layout principal que mantiene el menú a la izquierda

function LayoutPrincipal({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#f4f7f6",
      }}
    >
      <Navbar />
      <div style={{ flex: 1, padding: "30px" }}>{children}</div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <LayoutPrincipal>
        <div style={{ textAlign: "center", marginTop: "50px" }}>
          <h1>Panel Principal - SAIA</h1>
          <p>Seleccioná una opción en el menú lateral para comenzar.</p>
        </div>
      </LayoutPrincipal>
    ),
  },

  // --- RUTAS DE PERSONAL ---
  {
    path: "/personal",
    element: (
      <LayoutPrincipal>
        <PersonalPage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/personal/nuevo",
    element: (
      <LayoutPrincipal>
        <PersonalCreatePage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/personal/:id/editar",
    element: (
      <LayoutPrincipal>
        <PersonalEditPage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/personal/detalle/:id",
    element: (
      <LayoutPrincipal>
        <PersonalDetailPage />
      </LayoutPrincipal>
    ),
  },

  // --- RUTAS DE INSUMOS ---
  {
    path: "/insumos",
    element: (
      <LayoutPrincipal>
        <InsumosPage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/insumos/nuevo",
    element: (
      <LayoutPrincipal>
        <InsumoCreatePage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/insumos/:id/editar",
    element: (
      <LayoutPrincipal>
        <InsumoEditPage />
      </LayoutPrincipal>
    ),
  },

  // --- RUTAS DE EQUIPOS ---
  {
    path: "/equipos",
    element: (
      <LayoutPrincipal>
        <EquiposPage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/equipos/nuevo",
    element: (
      <LayoutPrincipal>
        <EquipoCreatePage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/equipos/:id/editar",
    element: (
      <LayoutPrincipal>
        <EquipoEditPage />
      </LayoutPrincipal>
    ),
  },

  // --- RUTAS DE ELEMENTOS DE LIMPIEZA ---
  {
    path: "/elementos-limpieza",
    element: (
      <LayoutPrincipal>
        <ElementosLimpiezaPage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/elementos-limpieza/nuevo",
    element: (
      <LayoutPrincipal>
        <ElementoLimpiezaCreatePage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/elementos-limpieza/:id/editar",
    element: (
      <LayoutPrincipal>
        <ElementoLimpiezaEditPage />
      </LayoutPrincipal>
    ),
  },

  // --- RUTAS DE PLANES DE LIMPIEZA ---
  {
    path: "/planes-limpieza",
    element: (
      <LayoutPrincipal>
        <PlanLimpiezaPage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/planes-limpieza/nuevo",
    element: (
      <LayoutPrincipal>
        <PlanLimpiezaCreatePage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/planes-limpieza/:id/editar",
    element: (
      <LayoutPrincipal>
        <PlanLimpiezaEditPage />
      </LayoutPrincipal>
    ),
  },

  // --- RUTAS DE CHECKLIST ---
  {
    path: "/checklist",
    element: (
      <LayoutPrincipal>
        <ChecklistPage />
      </LayoutPrincipal>
    ),
  },

  {
    path: "/checklist/historial",
    element: (
      <LayoutPrincipal>
        <HistorialChecklistPage />
      </LayoutPrincipal>
    ),
  },


  // --- RUTAS DE INSUMOS QUÍMICOS ---
  {
    path: "/insumos-quimicos",
    element: (
      <LayoutPrincipal>
        <InsumosQuimicosPage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/insumos-quimicos/nuevo",
    element: (
      <LayoutPrincipal>
        <InsumoQuimicoCreatePage />
      </LayoutPrincipal>
    ),
  },
  {
    path: "/insumos-quimicos/:id/editar",
    element: (
      <LayoutPrincipal>
        <InsumoQuimicoEditPage />
      </LayoutPrincipal>
    ),
  },

  // --- RUTAS DE NOTIFICACIONES ---
  {
    path: "/notificaciones",
    element: (
      <LayoutPrincipal>
        <NotificacionesPage />
      </LayoutPrincipal>
    ),
  },
]);