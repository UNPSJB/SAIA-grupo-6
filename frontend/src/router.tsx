/* eslint-disable react-refresh/only-export-components -- este archivo es el mapa de rutas: mezcla componentes con las declaraciones lazy() y el router. */
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet, useParams } from "react-router-dom";
import { Box, Flex, Spinner, Heading, Stack, Text } from "@chakra-ui/react";

// La pantalla de login NO es lazy a propósito: es lo primero que ve quien
// entra, y pedirla después de pintar el bundle agrega un round trip visible.
import { Login } from "./features/Login";

// Las páginas usan export nombrado, no default (que es lo que pide
// `React.lazy`), así que cada chunk se adapta con un `.then`. Antes de esto
// las 35 páginas entraban al bundle inicial.

import Navbar from "./common/components/Navbar";
import { ANCHO_COLAPSADO } from "./common/components/menuEntradas"; 
import { RequireAuth, RequireRole } from "./common/components/RequireAuth";          
import { BarraSuperior } from "./common/components/BarraSuperior";
import { useAuth } from "./common/context/useAuth";
import { useTablasResponsivas } from "./common/hooks/useTablasResponsivas";
import { useLocation } from "react-router-dom";


// 0. Panel principal
const InicioPage = lazy(() =>
  import("./features/dashboard/components/pages/InicioPage").then((mod) => ({ default: mod.InicioPage })),
);

// 0.bis. Mi perfil: la ficha propia (datos de /auth/me), sin permisos extra
const MiPerfilPage = lazy(() =>
  import("./features/personal/components/pages/MiPerfilPage").then((mod) => ({ default: mod.MiPerfilPage })),
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

// Lotes de producción
const LotesPage = lazy(() =>
  import("./features/lotes/components/pages/LotesPage").then((mod) => ({ default: mod.LotesPage })),
);
const LoteCreatePage = lazy(() =>
  import("./features/lotes/components/pages/LoteCreatePage").then((mod) => ({ default: mod.LoteCreatePage })),
);
const LoteDetallePage = lazy(() =>
  import("./features/lotes/components/pages/LoteDetallePage").then((mod) => ({ default: mod.LoteDetallePage })),
);

// Trazabilidad: productos, recetas versionadas, lotes de insumo y consultas
const ProductoPage = lazy(() =>
  import("./features/productos/components/pages/ProductoPage").then((mod) => ({ default: mod.ProductoPage })),
);
const ProductoCreatePage = lazy(() =>
  import("./features/productos/components/pages/ProductoCreatePage").then((mod) => ({ default: mod.ProductoCreatePage })),
);
const ProductoEditPage = lazy(() =>
  import("./features/productos/components/pages/ProductoEditPage").then((mod) => ({ default: mod.ProductoEditPage })),
);
const RecetasPage = lazy(() =>
  import("./features/recetas/components/pages/RecetasPage").then((mod) => ({ default: mod.RecetasPage })),
);
const RecetaCreatePage = lazy(() =>
  import("./features/recetas/components/pages/RecetaCreatePage").then((mod) => ({ default: mod.RecetaCreatePage })),
);
const RecetaDetallePage = lazy(() =>
  import("./features/recetas/components/pages/RecetaDetallePage").then((mod) => ({ default: mod.RecetaDetallePage })),
);
const AditivosPage = lazy(() =>
  import("./features/aditivos/components/pages/AditivosPage").then((mod) => ({ default: mod.AditivosPage })),
);
const RecetaNuevaVersionPage = lazy(() =>
  import("./features/recetas/components/pages/RecetaNuevaVersionPage").then((mod) => ({ default: mod.RecetaNuevaVersionPage })),
);
const StockInsumosPage = lazy(() =>
  import("./features/lotesInsumo/components/pages/StockInsumosPage").then((mod) => ({ default: mod.StockInsumosPage })),
);
const LoteInsumoCreatePage = lazy(() =>
  import("./features/lotesInsumo/components/pages/LoteInsumoCreatePage").then((mod) => ({ default: mod.LoteInsumoCreatePage })),
);
const TrazabilidadLoteInsumoPage = lazy(() =>
  import("./features/trazabilidad/components/pages/TrazabilidadLoteInsumoPage").then((mod) => ({ default: mod.TrazabilidadLoteInsumoPage })),
);

const RecetaComposicionPage = lazy(() =>
  import("./features/recetas/components/pages/RecetaComposicionPage").then((mod) => ({ default: mod.RecetaComposicionPage })),
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
const EquipoDetailPage = lazy(() =>
  import("./features/equipo/components/pages/EquipoDetailPage").then((mod) => ({ default: mod.EquipoDetailPage })),
);
const EquipoIntervencionPage = lazy(() =>
  import("./features/equipo/components/pages/EquipoIntervencionPage").then((mod) => ({ default: mod.EquipoIntervencionPage })),
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
const GestionStockPage = lazy(() =>
  import("./features/insumoQuimico/components/pages/GestionStockPage").then((mod) => ({ default: mod.GestionStockPage })),
);
const StockActualTab = lazy(() =>
  import("./features/insumoQuimico/components/StockActualTab").then((mod) => ({ default: mod.StockActualTab })),
);
const MovimientosStockTab = lazy(() =>
  import("./features/insumoQuimico/components/MovimientosStockTab").then((mod) => ({ default: mod.MovimientosStockTab })),
);
const LotesStockTab = lazy(() =>
  import("./features/insumoQuimico/components/LotesStockTab").then((mod) => ({ default: mod.LotesStockTab })),
);

// Proveedores
const ProveedorPage = lazy(() =>
  import("./features/proveedores/components/pages/ProveedorPage").then((mod) => ({ default: mod.ProveedorPage })),
);
const ProveedorCreatePage = lazy(() =>
  import("./features/proveedores/components/pages/ProveedorCreatePage").then((mod) => ({ default: mod.ProveedorCreatePage })),
);
const ProveedorEditPage = lazy(() =>
  import("./features/proveedores/components/pages/ProveedorEditPage").then((mod) => ({ default: mod.ProveedorEditPage })),
);

// Notificaciones
const NotificacionesPage = lazy(() =>
  import("./features/notificaciones/components/pages/NotificacionesPage").then((mod) => ({ default: mod.NotificacionesPage })),
);

// Configuración: ajustes del sistema, desde el menú de usuario (solo administradores)
const ConfiguracionPage = lazy(() =>
  import("./features/configuracion/components/pages/ConfiguracionPage").then((mod) => ({ default: mod.ConfiguracionPage })),
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

//  Sector
const SectorPage = lazy(() =>
  import("./features/sector/components/pages/SectorPage").then((mod) => ({ default: mod.SectorPage })),
);
const SectorCreatePage = lazy(() =>
  import("./features/sector/components/pages/SectorCreatePage").then((mod) => ({ default: mod.SectorCreatePage })),
);
const SectorEditPage = lazy(() =>
  import("./features/sector/components/pages/SectorEditPage").then((mod) => ({ default: mod.SectorEditPage })),
);

// Auditoría
const AuditoriaPage = lazy(() =>
  import("./features/auditoria/components/pages/AuditoriaPage").then((mod) => ({ default: mod.AuditoriaPage })),
);

// Vista pública: configuración administrativa y página provisional anónima.
const VistaPublicaSettingsPage = lazy(() =>
  import("./features/vistaPublica/components/pages/VistaPublicaSettingsPage").then((mod) => ({
    default: mod.VistaPublicaSettingsPage,
  })),
);
const VistaPublicaPage = lazy(() =>
  import("./features/vistaPublica/components/pages/VistaPublicaPage").then((mod) => ({
    default: mod.VistaPublicaPage,
  })),
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

const VencimientosPage = lazy(() =>
  import("./features/vencimientos/components/pages/VencimientosPage").then((mod) => ({
    default: mod.VencimientosPage,
  })),
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
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [menuColapsado, setMenuColapsado] = useState(true);
  const contenidoRef = useRef<HTMLDivElement>(null);
  useTablasResponsivas(contenidoRef);

  // El panel es overlay: al navegar vuelve a plegarse solo.
  const [pathnamePrevio, setPathnamePrevio] = useState(pathname);
  if (pathname !== pathnamePrevio) {
    setPathnamePrevio(pathname);
    setMenuColapsado(true);
  }

  // Esc pliega el menú.
  useEffect(() => {
    if (menuColapsado) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuColapsado(true);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [menuColapsado]);

  return (
    <Flex h="100vh" overflow="hidden" bg="brand.50">
      {/* Overlay: no ocupa lugar en el flex (ver Navbar). */}
      <Navbar colapsado={menuColapsado} onAlternarMenu={() => setMenuColapsado((prev) => !prev)} />

      {/* Fondo oscuro: un clic afuera pliega el menú. Va debajo de la barra (zIndex 30). */}
      {!menuColapsado && (
        <Box
          position="fixed"
          inset={0}
          zIndex={20}
          bg="blackAlpha.400"
          aria-hidden
          onClick={() => setMenuColapsado(true)}
        />
      )}

      <Flex flex={1} ml={ANCHO_COLAPSADO} minW={0} direction="column" overflow="hidden">
        <BarraSuperior />
        {/* Banner: recordar al usuario que debe cambiar su contraseña temporal */}
        {user?.debe_cambiar_password && (
          <Box
            mb="4"
            p="3"
            bg="orange.50"
            borderWidth="1px"
            borderColor="orange.300"
            rounded="md"
            w="full"
          >
            <Text fontSize="sm" fontWeight="bold" color="orange.800">
              ⚠️ Debés cambiar tu contraseña
            </Text>
            <Text fontSize="xs" color="orange.700" mt="1">
              Iniciaste sesión con una contraseña temporal. Por seguridad, cambiála
              desde "Mi perfil" antes de seguir usando el sistema.
            </Text>
          </Box>
        )}
        {/*
          `main`: el contenido de cada pantalla. En celular el margen lateral
          baja de 30px a 8px (las páginas ya suman el suyo), y las tablas de
          adentro se muestran como tarjetas (ver `useTablasResponsivas`).
        */}
        <Flex
          as="main"
          ref={contenidoRef}
          data-contenido=""
          flex={1}
          minH={0}
          px={{ base: "2", md: "30px" }}
          py={{ base: "2", md: "15px" }}
          overflowY="auto"
          direction="column"
        >
          <Outlet />
        </Flex>
      </Flex>
    </Flex>
  );
}

/**
 * Redirección de una ruta vieja con `:id` a la pantalla que la reemplazó, para
 * no romper enlaces guardados ni los de notificaciones ya enviadas.
 */
function RedirigirConId({ a }: { a: (id: string) => string }) {
  const { id = "" } = useParams<{ id: string }>();
  return <Navigate to={a(id)} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/publico/:codigo",
    element: (
      <ConSuspense>
        <VistaPublicaPage />
      </ConSuspense>
    ),
  },
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

          // Mi perfil: la ficha de la persona logueada. No va bajo
          // `RequireRole`: los datos salen de /auth/me y le sirven a todos
          // los roles, operadores incluidos.
          {
            path: "/mi-perfil",
            element: (
              <ConSuspense>
                <MiPerfilPage />
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
              // E9: quien opera consulta la receta vigente (solo lectura), la
              // escala a su lote e inicia el lote; también completa el
              // checklist y registra consumos. Cancelar queda para administración.
              {
                path: "/recetas",
                element: (
                  <ConSuspense>
                    <RecetasPage />
                  </ConSuspense>
                ),
              },
              {
                path: "/recetas/:id",
                element: (
                  <ConSuspense>
                    <RecetaDetallePage />
                  </ConSuspense>
                ),
              },
              // Escalar una receta era la misma calculadora que "Nuevo lote" y
              // terminaba en "Iniciar lote con estas cantidades": se unificó.
              {
                path: "/recetas/:id/escalar",
                element: <RedirigirConId a={(id) => `/lotes/nuevo?receta=${id}`} />,
              },
              {
                path: "/lotes/nuevo",
                element: (
                  <ConSuspense>
                    <LoteCreatePage />
                  </ConSuspense>
                ),
              },
              {
                path: "/lotes",
                element: (
                  <ConSuspense>
                    <LotesPage />
                  </ConSuspense>
                ),
              },
              {
                path: "/lotes/:id",
                element: (
                  <ConSuspense>
                    <LoteDetallePage />
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
              {
                path: "/equipos/detalle/:id",
                element: (
                <ConSuspense>
                  <EquipoDetailPage />
                </ConSuspense>
              ),
              },
              {
                path: "/equipos/:id/intervencion",
                element: (
                <ConSuspense>
                  <EquipoIntervencionPage />
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

              // ---------------- SECTORES ----------------
              {
                path: "/sectores",
                element: (
                <ConSuspense>
                  <SectorPage />
                </ConSuspense>
              ),
              },
              {
                path: "/sectores/nuevo",
                element: (
                <ConSuspense>
                  <SectorCreatePage />
                </ConSuspense>
              ),
              },
              {
                path: "/sectores/:id/editar",
                element: (
                <ConSuspense>
                  <SectorEditPage />
                </ConSuspense>
              ),
              },

              // ---------------- AUDITORÍA ----------------
              {
                path: "/auditoria",
                element: (
                <ConSuspense>
                  <AuditoriaPage />
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

              // ---------------- PRODUCTOS Y RECETAS ----------------
              {
                path: "/aditivos",
                element: (
                  <ConSuspense>
                    <AditivosPage />
                  </ConSuspense>
                ),
              },
              {
                path: "/productos",
                element: (
                  <ConSuspense>
                    <ProductoPage />
                  </ConSuspense>
                ),
              },
              {
                path: "/productos/nuevo",
                element: (
                  <ConSuspense>
                    <ProductoCreatePage />
                  </ConSuspense>
                ),
              },
              {
                path: "/productos/:id/editar",
                element: (
                  <ConSuspense>
                    <ProductoEditPage />
                  </ConSuspense>
                ),
              },
              {
                path: "/recetas/nueva",
                element: (
                  <ConSuspense>
                    <RecetaCreatePage />
                  </ConSuspense>
                ),
              },
              {
                path: "/recetas/:id/nueva-version",
                element: (
                  <ConSuspense>
                    <RecetaNuevaVersionPage />
                  </ConSuspense>
                ),
              },

                 {
                path: "/recetas/versiones/:versionId/composicion",
                element: (
                  <ConSuspense>
                    <RecetaComposicionPage />
                  </ConSuspense>
                ),
              },              

              // ---------------- LOTES DE INSUMO Y TRAZABILIDAD ----------------
              {
                path: "/stock-insumos",
                element: (
                  <ConSuspense>
                    <StockInsumosPage />
                  </ConSuspense>
                ),
              },
              {
                path: "/lotes-insumo/nuevo",
                element: (
                  <ConSuspense>
                    <LoteInsumoCreatePage />
                  </ConSuspense>
                ),
              },
              // La pantalla de inicio de Trazabilidad era un selector de lotes:
              // hoy se busca el lote en su lista y la trazabilidad está en la ficha.
              {
                path: "/trazabilidad",
                element: <Navigate to="/lotes" replace />,
              },
              // La trazabilidad hacia atrás vive ahora en la ficha del lote.
              {
                path: "/trazabilidad/lotes-producto/:id",
                element: <RedirigirConId a={(id) => `/lotes/${id}`} />,
              },
              {
                path: "/trazabilidad/lotes-insumo/:id",
                element: (
                  <ConSuspense>
                    <TrazabilidadLoteInsumoPage />
                  </ConSuspense>
                ),
              },
              {
                path: "/consumo-productos",
                element: <Navigate to="/gestion-stock/consumos" replace />,
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

              // ---------------- CONFIGURACIÓN ----------------
              {
                path: "/configuracion",
                element: (
                <ConSuspense>
                  <ConfiguracionPage />
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
              {
                path: "/gestion-stock",
                element: (
                  <ConSuspense>
                    <GestionStockPage />
                  </ConSuspense>
                ),
                children: [
                  {
                    index: true,
                    element: <Navigate to="/gestion-stock/stock" replace />,
                  },
                  {
                    path: "stock",
                    element: (
                      <ConSuspense>
                        <StockActualTab />
                      </ConSuspense>
                    ),
                  },
                  {
                    path: "movimientos",
                    element: (
                      <ConSuspense>
                        <MovimientosStockTab />
                      </ConSuspense>
                    ),
                  },
                  {
                    path: "lotes",
                    element: (
                      <ConSuspense>
                        <LotesStockTab />
                      </ConSuspense>
                    ),
                  },
                  {
                    path: "consumos",
                    element: (
                      <ConSuspense>
                        <ConsumoInsumosPage />
                      </ConSuspense>
                    ),
                  },
                ],
              },

              // ---------------- PROVEEDORES ----------------
              {
                path: "/proveedores",
                element: (
                  <ConSuspense>
                    <ProveedorPage />
                  </ConSuspense>
                ),
              },
              {
                path: "/proveedores/nuevo",
                element: (
                  <ConSuspense>
                    <ProveedorCreatePage />
                  </ConSuspense>
                ),
              },
              {
                path: "/proveedores/:id/editar",
                element: (
                  <ConSuspense>
                    <ProveedorEditPage />
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

              // ---------------- VISTA PÚBLICA ----------------
              {
                path: "/vista-publica",
                element: (
                  <ConSuspense>
                    <VistaPublicaSettingsPage />
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
               // ---------------- Vencimientos ----------------
               {
                path: "/vencimientos",
                element: (
                <ConSuspense>
                  <VencimientosPage />
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
