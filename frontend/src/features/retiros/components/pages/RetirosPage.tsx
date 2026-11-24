import { normalizar } from "../../../../common/utils/texto";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BotonExportar } from "../../../exportacion";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonAgregar,
  BotonCancelar,
  EstadoCargando,
  EstadoVacio,
  PieTabla,
} from "../../../../components/ui/patrones";
import { LuRefreshCw } from "react-icons/lu";
import { useLista } from "../../../../common/hooks/useLista";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { RetirosTable } from "../RetirosTable";
import { ModalIniciarRetiro } from "../ModalIniciarRetiro";
import { formatoFecha } from "../../../../common/utils/fechas";
import { notificarCambioIncidentes } from "../../../incidente/eventoIncidentes";
import type { FiltrosGestion } from "../../../incidente/hooks/useFiltrosGestion";
import type { EstadoIncidente } from "../../../incidente/types/incidente";
import { listarRetiros } from "../../services/retiroService";
import type { RetiroResumen } from "../../types/retiro";
import { useEstadoNavegacion } from "../../../../common/hooks/useEstadoNavegacion";

const PAGE_SIZE = 10;

type FiltroOrigen = "" | "INSUMO" | "RECLAMO" | "MANUAL";

/**
 * Pestaña "Retiros de lotes" de Gestión de incidentes
 * (`/incidentes?tab=retiros`). `/retiros` redirige acá.
 */
export function TabRetiros({ gestion }: { gestion: FiltrosGestion }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeRegistrar = puedeAdministrar(user);

  const [busqueda, setBusqueda] = useEstadoNavegacion("RetirosPage.busqueda", "");
  // Un retiro en curso es un incidente abierto.
  const { estado: filtroEstado, setEstado: setFiltroEstado, enPeriodo } = gestion;
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>("");
  const [modalNuevo, setModalNuevo] = useState(false);

  const cargar = useCallback(() => listarRetiros(), []);

  const {
    items: retiros,
    loading,
    error,
    recargar,
  } = useLista<RetiroResumen[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los retiros",
    preferirMensajeDelBackend: true,
  });

  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda);
    return retiros.filter((r) => {
      if (filtroEstado && (r.estado === "CERRADO") !== (filtroEstado === "cerrado")) return false;
      if (!enPeriodo(r.fecha_retiro)) return false;

      if (filtroOrigen) {
        const detalleTexto = r.detalle || "";
        const motivoTexto = r.motivo || "";
        const esInsumo =
          r.origen === "INSUMO" ||
          motivoTexto.toLowerCase().includes("insumo") ||
          detalleTexto.includes("[Insumo:") ||
          motivoTexto.includes("[Insumo:");

        const esReclamo =
          !esInsumo &&
          (r.origen === "RECLAMO" ||
            motivoTexto.toLowerCase().includes("reclamo") ||
            motivoTexto === "Reclamos de clientes");

        const esManual = !esInsumo && !esReclamo;

        if (filtroOrigen === "INSUMO" && !esInsumo) return false;
        if (filtroOrigen === "RECLAMO" && !esReclamo) return false;
        if (filtroOrigen === "MANUAL" && !esManual) return false;
      }

      if (texto) {
        return (
          normalizar(r.lote_codigo).includes(texto) ||
          normalizar(r.lote_producto_nombre).includes(texto) ||
          normalizar(r.motivo).includes(texto) ||
          (r.detalle && normalizar(r.detalle).includes(texto))
        );
      }

      return true;
    });
  }, [retiros, busqueda, filtroEstado, filtroOrigen, enPeriodo]);

  const { paginados, page, setPage } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${busqueda}|${filtroEstado}|${filtroOrigen}|${gestion.desde}|${gestion.hasta}`
  );

  const hayFiltros =
    busqueda.trim() !== "" || filtroOrigen !== "" || gestion.hayFiltros;

  const limpiarTodo = () => {
    setBusqueda("");
    setFiltroOrigen("");
    gestion.limpiar();
  };

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda.trim(),
      onQuitar: () => setBusqueda(""),
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      valor:
        filtroEstado === "abierto"
          ? "En curso"
          : filtroEstado === "cerrado"
          ? "Cerrado"
          : "",
      onQuitar: () => setFiltroEstado(""),
    },
    {
      clave: "origen",
      etiqueta: "Origen",
      valor:
        filtroOrigen === "INSUMO"
          ? "Insumo defectuoso"
          : filtroOrigen === "RECLAMO"
          ? "Reclamo de cliente"
          : filtroOrigen === "MANUAL"
          ? "Manual"
          : "",
      onQuitar: () => setFiltroOrigen(""),
    },
    gestion.chipPeriodo,
  ]);

  return (
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Código de lote, producto o motivo..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Estado"
              valor={filtroEstado}
              onCambio={(valor) => setFiltroEstado(valor as EstadoIncidente | "")}
              opciones={[
                { valor: "abierto", etiqueta: "En curso" },
                { valor: "cerrado", etiqueta: "Cerrado" },
              ]}
              todos="Todos los estados"
              minW="160px"
            />
            <FiltroSelect
              label="Origen"
              valor={filtroOrigen}
              onCambio={(valor) => setFiltroOrigen(valor as FiltroOrigen)}
              opciones={[
                { valor: "INSUMO", etiqueta: "Insumo defectuoso" },
                { valor: "RECLAMO", etiqueta: "Reclamo de cliente" },
                { valor: "MANUAL", etiqueta: "Manual" },
              ]}
              todos="Todos los orígenes"
              minW="180px"
            />
          </>
        }
        herramientas={
          <>
            {/* Dentro de una pestaña, el alta va en la barra. */}
            {puedeRegistrar && (
              <BotonAgregar onClick={() => setModalNuevo(true)}>Nuevo retiro</BotonAgregar>
            )}
            {puedeRegistrar && (
              <BotonExportar
                nombreTabla="retiros"
                disabled={filtrados.length === 0}
                datos={() => ({
                  titulo: "Retiros de lotes",
                  nombre: "retiros",
                  encabezados: ["Fecha", "Producto", "Lote", "Motivo", "Notificados", "Estado"],
                  filas: filtrados.map((r) => [
                    formatoFecha(r.fecha_retiro),
                    r.lote_producto_nombre,
                    r.lote_codigo,
                    r.motivo,
                    r.total_afectados === 0
                      ? "Sin afectados"
                      : `${r.notificados} de ${r.total_afectados}`,
                    r.estado === "CERRADO" ? "Cerrado" : "En curso",
                  ]),
                })}
              />
            )}
            <BotonCancelar onClick={() => void recargar()}>
              <LuRefreshCw aria-hidden />
              Actualizar
            </BotonCancelar>
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando pagina>Cargando retiros...</EstadoCargando>}

      {!loading && !error && filtrados.length === 0 && (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay retiros que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>
            Todavía no hay retiros de lotes registrados.
          </EstadoVacio>
        )
      )}

      {!loading && !error && filtrados.length > 0 && (
        <>
          <RetirosTable
            retiros={paginados}
            pie={
              <PieTabla
                count={filtrados.length}
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                unidad={filtrados.length === 1 ? "retiro" : "retiros"}
              />
            }
            onVerDetalle={(id) => navigate(`/retiros/${id}`)}
            onSearchChange={setBusqueda}
          />
        </>
      )}

      <ModalIniciarRetiro
        isOpen={modalNuevo}
        onClose={() => setModalNuevo(false)}
        onRetiroIniciado={() => {
          void recargar();
          // El retiro abre un incidente: el gráfico lo cuenta.
          notificarCambioIncidentes();
        }}
      />
    </>
  );
}
