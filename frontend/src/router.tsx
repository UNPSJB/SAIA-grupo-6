/* eslint-disable react-refresh/only-export-components -- este archivo es el mapa de rutas: mezcla componentes con las declaraciones lazy() y el router. */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import { Flex, Spinner, Heading, Stack, Text } from "@chakra-ui/react";

// La pantalla de login NO es lazy a propósito: es lo primero que ve quien
// entra, y pedirla después de pintar el bundle agrega un round trip visible.
import { Login } from "./features/Login";

// Las páginas usan export nombrado, no default (que es lo que pide
// `React.lazy`), así que cada chunk se adapta con un `.then`. Antes de esto
// las 35 páginas entraban al bundle inicial.

import Navbar from "./common/components/Navbar";
import { RequireAuth, RequireRole } from "./common/components/RequireAuth";

// 0. Panel principal
const InicioPage = lazy(() =>
  import("./features/dashboard/components/pages/InicioPage").then((mod) => ({ default: mod.InicioPage })),
);

// 1. Personal
const PersonalPage = lazy(() =>
  import("./features/personal/components/pages/PersonalPage").then((mod) => ({ default: mod.PersonalPage })),
);
const PersonalCreatePage = lazy(() =>
  import("./features/personal/components/pages/PersonalCreatePage").then((mod) => ({ default: mod.PersonalCreatePage })),
);
const PersonalEditPage = lazy(() =>
  import("./features/personal/components/pages/PersonalEditPage").then((mod) => ({ default: mod.PersonalEditPage })),
);
const PersonalDetailPage = lazy(() =>
  import("./features/personal/components/pages/PersonalDetailPage").then((mod) => ({ default: mod.PersonalDetailPage })),
);

// 2. Insumos
const InsumosPage = lazy(() =>
  import("./features/insumos/components/pages/InsumosPage").then((mod) => ({ default: mod.InsumosPage })),
);
const InsumoCreatePage = lazy(() =>
  import("./features/insumos/components/pages/InsumoCreatePage").then((mod) => ({ default: mod.InsumoCreatePage })),
);
const InsumoEditPage = lazy(() =>
  import("./features/insumos/components/pages/InsumoEditPage").then((mod) => ({ default: mod.InsumoEditPage })),
);

// 3. Equipos
const EquiposPage = lazy(() =>
  import("./features/equipo/components/pages/EquipoPage").then((mod) => ({ default: mod.EquiposPage })),
);
const EquipoCreatePage = lazy(() =>
  import("./features/equipo/components/pages/EquipoCreatePage").then((mod) => ({ default: mod.EquipoCreatePage })),
);
const EquipoEditPage = lazy(() =>
  import("./features/equipo/components/pages/EquipoEditPage").then((mod) => ({ default: mod.EquipoEditPage })),
);

// Elementos de Limpieza
const ElementosLimpiezaPage = lazy(() =>
  import("./features/elementoLimpieza/components/pages/ElementoLimpiezaPage").then((mod) => ({ default: mod.ElementosLimpiezaPage })),
);
const ElementoLimpiezaCreatePage = lazy(() =>
  import("./features/elementoLimpieza/components/pages/ElementoLimpiezaCreatePage").then((mod) => ({ default: mod.ElementoLimpiezaCreatePage })),
);
const ElementoLimpiezaEditPage = lazy(() =>
  import("./features/elementoLimpieza/components/pages/ElementoLimpiezaEditPage").then((mod) => ({ default: mod.ElementoLimpiezaEditPage })),
);

// 4. Planes de Limpieza
const PlanLimpiezaPage = lazy(() =>
  import("./features/planLimpieza/components/pages/PlanLimpiezaPage").then((mod) => ({ default: mod.PlanLimpiezaPage })),
);
const PlanLimpiezaCreatePage = lazy(() =>
  import("./features/planLimpieza/components/pages/PlanLimpiezaCreatePage").then((mod) => ({ default: mod.PlanLimpiezaCreatePage })),
);
const PlanLimpiezaEditPage = lazy(() =>
  import("./features/planLimpieza/components/pages/PlanLimpiezaEditPage").then((mod) => ({ default: mod.PlanLimpiezaEditPage })),
);

// Planes de Calibración/Mantenimiento
const PlanCalibracionMantenimientoPage = lazy(() =>
  import("./features/planCalibracionMantenimiento/components/pages/PlanCalibracionMantenimientoPage").then((mod) => ({ default: mod.PlanCalibracionMantenimientoPage })),
);
const PlanCalibracionMantenimientoCreatePage = lazy(() =>
  import("./features/planCalibracionMantenimiento/components/pages/PlanCalibracionMantenimientoCreatePage").then((mod) => ({ default: mod.PlanCalibracionMantenimientoCreatePage })),
);
const PlanCalibracionMantenimientoEditPage = lazy(() =>
  import("./features/planCalibracionMantenimiento/components/pages/PlanCalibracionMantenimientoEditPage").then((mod) => ({ default: mod.PlanCalibracionMantenimientoEditPage })),
);

// 5. Checklist
const ChecklistPage = lazy(() =>
  import("./features/checklist/components/pages/ChecklistPage").then((mod) => ({ default: mod.ChecklistPage })),
);
const HistorialChecklistPage = lazy(() =>
  import("./features/checklist/components/pages/HistorialChecklistPage").then((mod) => ({ default: mod.HistorialChecklistPage })),
);
const ConsumoInsumosPage = lazy(() =>
  import("./features/checklist/components/pages/ConsumoInsumosPage").then((mod) => ({ default: mod.ConsumoInsumosPage })),
);

// 9. Documentos
const DocumentosPage = lazy(() =>
  import("./features/documentos/pages/documentosPages").then((mod) => ({ default: mod.DocumentosPage })),
);
const DocumentoCreatePage = lazy(() =>
  import("./features/documentos/pages/documentoCreatePage").then((mod) => ({ default: mod.DocumentoCreatePage })),
);
const DocumentoNuevaVersionPage = lazy(() =>
  import("./features/documentos/pages/documentoNuevaVersionPage").then((mod) => ({ default: mod.DocumentoNuevaVersionPage })),
);
const DocumentoHistorialPage = lazy(() =>
  import("./features/documentos/pages/documentoHistorialPage").then((mod) => ({ default: mod.DocumentoHistorialPage })),
);
const ConsultaDocumentosPage = lazy(() =>
  import("./features/documentos/pages/consultaDocumentosPage").then((mod) => ({ default: mod.ConsultaDocumentosPage })),
);

// 6. Insumos Químicos
const InsumosQuimicosPage = lazy(() =>
  import("./features/insumoQuimico/components/pages/InsumosQuimicosPage").then((mod) => ({ default: mod.InsumosQuimicosPage })),
);
const InsumoQuimicoCreatePage = lazy(() =>
  import("./features/insumoQuimico/components/pages/InsumoQuimicoCreatePage").then((mod) => ({ default: mod.InsumoQuimicoCreatePage })),
);
const InsumoQuimicoEditPage = lazy(() =>
  import("./features/insumoQuimico/components/pages/InsumoQuimicoEditPage").then((mod) => ({ default: mod.InsumoQuimicoEditPage })),
);

// Notificaciones
const NotificacionesPage = lazy(() =>
  import("./features/notificaciones/components/pages/NotificacionesPage").then((mod) => ({ default: mod.NotificacionesPage })),
);

// 7. Unidad de Medida
const UnidadMedidaPage = lazy(() =>
  import("./features/unidadMedida/components/pages/UnidadMedidaPage").then((mod) => ({ default: mod.UnidadMedidaPage })),
);
const UnidadMedidaCreatePage = lazy(() =>
  import("./features/unidadMedida/components/pages/UnidadMedidaCreatePage").then((mod) => ({ default: mod.UnidadMedidaCreatePage })),
);
const UnidadMedidaEditPage = lazy(() =>
  import("./features/unidadMedida/components/pages/UnidadMedidaEditPage").then(
    (mod) => ({ default: mod.UnidadMedidaEditPage }),
  ),
);
// 8. Importamos del modulo Aptitud
const AptitudPage = lazy(() =>
  import("./features/aptitud/components/pages/AptitudPage").then((mod) => ({ default: mod.AptitudPage })),
);
const AptitudCreatePage = lazy(() =>
  import("./features/aptitud/components/pages/AptitudCreatePage").then((mod) => ({ default: mod.AptitudCreatePage })),
);
const AptitudEditPage = lazy(() =>
  import("./features/aptitud/components/pages/AptitudEditPage").then((mod) => ({ default: mod.AptitudEditPage })),
);

// 9. Incidentes
const IncidentesListPage = lazy(() =>
  import("./features/incidente/components/pages/IncidentesListPage").then((mod) => ({ default: mod.IncidentesListPage })),
);
const IncidenteDetailPage = lazy(() =>
  import("./features/incidente/components/pages/IncidenteDetailPage").then((mod) => ({ default: mod.IncidenteDetailPage })),
);
const ReportarIncidentePage = lazy(() =>
  import("./features/incidente/components/pages/ReportarIncidentePage").then((mod) => ({ default: mod.ReportarIncidentePage })),
);

/**
 * Cada ruta se baja en su propio chunk (ver los `lazy()` de arriba). El primer
 * render de una página llega con el chunk todavía en vuelo, así que hace falta
 * un `<Suspense>`: sin él React tira al error boundary en cada navegación.
 */
function ConSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Flex p="40px" justify="center">
          <Spinner size="lg" color="brand.500" />
        </Flex>
      }
    >
      {children}
    </Suspense>
  );
}

// Layout principal que mantiene el menú a la izquierda
function LayoutPrincipal() {
  return (
    <Flex h="100vh" overflow="hidden" bg="brand.50">
      <Navbar />

      <Flex
        flex={1}
        p="15px 30px"
        overflowY="auto"
        direction="column"
      >
        <Outlet />
      </Flex>
    </Flex>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
        <ConSuspense>
          <Login />
        </ConSuspense>
      ),
  },

  {
    element: <RequireAuth />,

    children: [
      {
        element: <LayoutPrincipal />,

        children: [
          {
            path: "/",
            // El panel es la única página con datos: la carga y los cálculos
            // viven en `InicioPage`, y acá solo se la registra como ruta.
            element: (
              <ConSuspense>
                <InicioPage />
              </ConSuspense>
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
                element: (
                <ConSuspense>
                  <ChecklistPage />
                </ConSuspense>
              ),
              },
              {
                path: "/incidentes/reportar",
                element: (
                <ConSuspense>
                  <ReportarIncidentePage />
                </ConSuspense>
              ),
              },
              {
                path: "/incidentes/:id",
                element: (
                <ConSuspense>
                  <IncidenteDetailPage />
                </ConSuspense>
              ),
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
                element: (
                <ConSuspense>
                  <PersonalPage />
                </ConSuspense>
              ),
              },
              {
                path: "/personal/nuevo",
                element: (
                <ConSuspense>
                  <PersonalCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/personal/:id/editar",
                element: (
                <ConSuspense>
                  <PersonalEditPage />
                </ConSuspense>
              ),
              },
              {
                path: "/personal/detalle/:id",
                element: (
                <ConSuspense>
                  <PersonalDetailPage />
                </ConSuspense>
              ),
              },

              // ---------------- INSUMOS ----------------
              {
                path: "/insumos",
                element: (
                <ConSuspense>
                  <InsumosPage />
                </ConSuspense>
              ),
              },
              {
                path: "/insumos/nuevo",
                element: (
                <ConSuspense>
                  <InsumoCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/insumos/:id/editar",
                element: (
                <ConSuspense>
                  <InsumoEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- EQUIPOS ----------------
              {
                path: "/equipos",
                element: (
                <ConSuspense>
                  <EquiposPage />
                </ConSuspense>
              ),
              },
              {
                path: "/equipos/nuevo",
                element: (
                <ConSuspense>
                  <EquipoCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/equipos/:id/editar",
                element: (
                <ConSuspense>
                  <EquipoEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- ELEMENTOS DE LIMPIEZA ----------------
              {
                path: "/elementos-limpieza",
                element: (
                <ConSuspense>
                  <ElementosLimpiezaPage />
                </ConSuspense>
              ),
              },
              {
                path: "/elementos-limpieza/nuevo",
                element: (
                <ConSuspense>
                  <ElementoLimpiezaCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/elementos-limpieza/:id/editar",
                element: (
                <ConSuspense>
                  <ElementoLimpiezaEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- PLANES DE LIMPIEZA ----------------
              {
                path: "/planes-limpieza",
                element: (
                <ConSuspense>
                  <PlanLimpiezaPage />
                </ConSuspense>
              ),
              },
              {
                path: "/planes-limpieza/nuevo",
                element: (
                <ConSuspense>
                  <PlanLimpiezaCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/planes-limpieza/:id/editar",
                element: (
                <ConSuspense>
                  <PlanLimpiezaEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- PLANES DE CALIBRACIÓN/MANTENIMIENTO ----------------
              {
                path: "/planes-calibracion-mantenimiento",
                element: (
                <ConSuspense>
                  <PlanCalibracionMantenimientoPage />
                </ConSuspense>
              ),
              },
              {
                path: "/planes-calibracion-mantenimiento/nuevo",
                element: (
                <ConSuspense>
                  <PlanCalibracionMantenimientoCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/planes-calibracion-mantenimiento/:id/editar",
                element: (
                <ConSuspense>
                  <PlanCalibracionMantenimientoEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- APTITUDES ----------------
              {
                path: "/aptitudes",
                element: (
                <ConSuspense>
                  <AptitudPage />
                </ConSuspense>
              ),
              },
              {
                path: "/aptitudes/nuevo",
                element: (
                <ConSuspense>
                  <AptitudCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/aptitudes/:id/editar",
                element: (
                <ConSuspense>
                  <AptitudEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- CHECKLIST ----------------
              {
                path: "/checklist/historial",
                element: (
                <ConSuspense>
                  <HistorialChecklistPage />
                </ConSuspense>
              ),
              },
              {
                path: "/consumo-productos",
                element: (
                <ConSuspense>
                  <ConsumoInsumosPage />
                </ConSuspense>
              ),
              },

              // ---------------- NOTIFICACIONES ----------------
              {
                path: "/notificaciones",
                element: (
                <ConSuspense>
                  <NotificacionesPage />
                </ConSuspense>
              ),
              },

              // ---------------- INSUMOS QUÍMICOS ----------------
              {
                path: "/insumos-quimicos",
                element: (
                <ConSuspense>
                  <InsumosQuimicosPage />
                </ConSuspense>
              ),
              },
              {
                path: "/insumos-quimicos/nuevo",
                element: (
                <ConSuspense>
                  <InsumoQuimicoCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/insumos-quimicos/:id/editar",
                element: (
                <ConSuspense>
                  <InsumoQuimicoEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- UNIDAD DE MEDIDA ----------------
              {
                path: "/unidades-medida",
                element: (
                <ConSuspense>
                  <UnidadMedidaPage />
                </ConSuspense>
              ),
              },
              {
                path: "/unidades-medida/nuevo",
                element: (
                <ConSuspense>
                  <UnidadMedidaCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/unidades-medida/:id/editar",
                element: (
                <ConSuspense>
                  <UnidadMedidaEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- INCIDENTES ----------------
              {
                path: "/incidentes",
                element: (
                <ConSuspense>
                  <IncidentesListPage />
                </ConSuspense>
              ),
              },
            ],
          },

          // =====================================================
          // DOCUMENTOS
          // =====================================================
          {
            path: "/documentos",
            element: (
              <ConSuspense>
                <DocumentosPage />
              </ConSuspense>
            ),
          },
          {
            path: "/documentos/nuevo",
            element: (
              <ConSuspense>
                <DocumentoCreatePage />
              </ConSuspense>
            ),
          },
          {
            path: "/documentos/:id/nueva-version",
            element: (
              <ConSuspense>
                <DocumentoNuevaVersionPage />
              </ConSuspense>
            ),
          },
          {
            path: "/documentos/:id/historial",
            element: (
              <ConSuspense>
                <DocumentoHistorialPage />
              </ConSuspense>
            ),
          },
          // Historia 3: consulta de la versión vigente (operadores)
          {
            path: "/consulta-documentos",
            element: (
              <ConSuspense>
                <ConsultaDocumentosPage />
              </ConSuspense>
            ),
          },

          // =====================================================
          // ERRORES
          // =====================================================
          {
            path: "/sin-permisos",
            element: (
                <ConSuspense>
                  <SinPermisosPage />
                </ConSuspense>
              ),
          },

          {
            path: "*",
            element: (
                <ConSuspense>
                  <NotFoundPage />
                </ConSuspense>
              ),
          },
        ],
      },
    ],
  },
]);


function NotFoundPage() {
  return (
    <Stack gap="2" mt="8" maxW="600px">
      <Heading as="h1" size="2xl" color="fg">
        404
      </Heading>
      <Text color="fg.muted">La página que buscás no existe.</Text>
    </Stack>
  );
}

function SinPermisosPage() {
  return (
    <Stack gap="2" mt="8" maxW="600px">
      <Heading as="h1" size="2xl" color="fg">
        No tenés permisos
      </Heading>
      <Text color="fg.muted">
        Tu usuario no tiene el permiso necesario para ver esta sección.
        Comunicate con un administrador si necesitás acceso.
      </Text>
    </Stack>
  );
}
