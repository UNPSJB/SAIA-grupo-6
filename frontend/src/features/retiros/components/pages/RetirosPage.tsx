import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BotonExportar } from "../../../exportacion";
import { Pagina } from "../../../../components/ui/plantillas";
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
import { listarRetiros } from "../../services/retiroService";
import type { RetiroResumen } from "../../types/retiro";

const PAGE_SIZE = 10;

type FiltroEstado = "" | "EN_CURSO" | "CERRADO";
type FiltroOrigen = "" | "INSUMO" | "RECLAMO" | "MANUAL";

export function RetirosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeRegistrar = puedeAdministrar(user);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("");
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>("");
  const [modalNuevo, setModalNuevo] = useState(false);

  const cargar = useCallback(
    () => listarRetiros({ estado: filtroEstado || undefined }),
    [filtroEstado]
  );

  const {
    items: retiros,
    loading,
    error,
    recargar,
  } = useLista<RetiroResumen[]>({
    cargar,
    dependencias: [filtroEstado],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los retiros",
    preferirMensajeDelBackend: true,
  });

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return retiros.filter((r) => {
      if (filtroEstado && r.estado !== filtroEstado) return false;

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
          r.lote_codigo.toLowerCase().includes(texto) ||
          r.lote_producto_nombre.toLowerCase().includes(texto) ||
          r.motivo.toLowerCase().includes(texto) ||
          (r.detalle && r.detalle.toLowerCase().includes(texto))
        );
      }

      return true;
    });
  }, [retiros, busqueda, filtroEstado, filtroOrigen]);

  const { paginados, page, setPage } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${busqueda}|${filtroEstado}|${filtroOrigen}`
  );

  const hayFiltros =
    busqueda.trim() !== "" || filtroEstado !== "" || filtroOrigen !== "";

  const limpiarTodo = () => {
    setBusqueda("");
    setFiltroEstado("");
    setFiltroOrigen("");
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
        filtroEstado === "EN_CURSO"
          ? "En curso"
          : filtroEstado === "CERRADO"
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
  ]);

  return (
    <Pagina
      titulo="Retiros de lotes"
      descripcion="Retiros de lote del mercado: lote, producto, motivo, estado y progreso de notificaciones."
      acciones={
        puedeRegistrar ? (
          <>
            <BotonAgregar onClick={() => setModalNuevo(true)}>
              Nuevo retiro
            </BotonAgregar>
            <ModalIniciarRetiro
              isOpen={modalNuevo}
              onClose={() => setModalNuevo(false)}
              onRetiroIniciado={recargar}
            />
          </>
        ) : undefined
      }
    >
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
              onCambio={(valor) => setFiltroEstado(valor as FiltroEstado)}
              opciones={[
                { valor: "EN_CURSO", etiqueta: "En curso" },
                { valor: "CERRADO", etiqueta: "Cerrado" },
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
            {puedeRegistrar && (
              <BotonExportar
                nombreTabla="retiros"
                vista="retiros"
                filtros={{ estado: filtroEstado || undefined, buscar: busqueda.trim() || undefined }}
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
    </Pagina>
  );
}
