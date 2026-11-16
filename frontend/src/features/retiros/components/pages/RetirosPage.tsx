import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pagina } from "../../../../components/ui/plantillas";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonAgregar,
  BotonCancelar,
  EstadoCargando,
  EstadoVacio,
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

export function RetirosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeRegistrar = puedeAdministrar(user);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("");
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
    return retiros.filter(
      (r) =>
        (!filtroEstado || r.estado === filtroEstado) &&
        (!texto ||
          r.lote_codigo.toLowerCase().includes(texto) ||
          r.lote_producto_nombre.toLowerCase().includes(texto) ||
          r.motivo.toLowerCase().includes(texto))
    );
  }, [retiros, busqueda, filtroEstado]);

  const { paginados } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${busqueda}|${filtroEstado}`
  );

  const hayFiltros = busqueda.trim() !== "" || filtroEstado !== "";

  const limpiarTodo = () => {
    setBusqueda("");
    setFiltroEstado("");
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
              minW="200px"
            />
          </>
        }
        herramientas={
          <BotonCancelar onClick={() => void recargar()}>
            <LuRefreshCw aria-hidden />
            Actualizar
          </BotonCancelar>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando>Cargando retiros...</EstadoCargando>}

      {!loading && !error && filtrados.length === 0 && (
        hayFiltros ? (
          <EstadoVacio>
            No hay retiros que coincidan con los filtros aplicados.
          </EstadoVacio>
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
            onVerDetalle={(id) => navigate(`/retiros/${id}`)}
          />
        </>
      )}
    </Pagina>
  );
}
