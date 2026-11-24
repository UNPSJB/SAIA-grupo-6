import { normalizar } from "../../../../common/utils/texto";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuRefreshCw } from "react-icons/lu";
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
  BannerExito,
  BotonAgregar,
  BotonCancelar,
  EstadoCargando,
  EstadoVacio,
  Paginacion,
} from "../../../../components/ui/patrones";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar, puedeOperar } from "../../../../common/api/permissions";
import { formatoFecha } from "../../../../common/utils/fechas";
import { BotonExportar } from "../../../exportacion";
import { notificarCambioIncidentes, escucharCambioIncidentes } from "../../../incidente/eventoIncidentes";
import { useNotificacionesListener } from "../../../notificaciones/hooks/useNotificacionesListener";
import type { FiltrosGestion } from "../../../incidente/hooks/useFiltrosGestion";
import { useReclamos } from "../../hooks/useReclamos";
import { ReclamosTable } from "../ReclamosTable";
import { ModalCerrarReclamo } from "../ModalCerrarReclamo";
import { ModalNuevoReclamo } from "../ModalNuevoReclamo";
import type { ReclamoResumen } from "../../types/reclamo";
import { useEstadoNavegacion } from "../../../../common/hooks/useEstadoNavegacion";

const PAGE_SIZE = 10;

/** Filtro de plazo: todos, solo en plazo o solo fuera de plazo. */
type FiltroPlazo = "" | "en" | "fuera";

/**
 * Pestaña "Reclamos de clientes" de Gestión de incidentes
 * (`/incidentes?tab=reclamos`). `/reclamos` redirige acá.
 */
export function TabReclamos({ gestion }: { gestion: FiltrosGestion }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeRegistrar = puedeOperar(user);
  const esAdmin = puedeAdministrar(user);

  const [busqueda, setBusqueda] = useEstadoNavegacion("ReclamosPage.busqueda", "");
  const { estado: filtroEstado, setEstado: setFiltroEstado, enPeriodo } = gestion;
  const [filtroPlazo, setFiltroPlazo] = useState<FiltroPlazo>("");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [aCerrar, setACerrar] = useState<ReclamoResumen | null>(null);
  const { valor: mensajeAviso, avisar } = useAvisoTemporal<string>(3500);

  const { reclamos, loading, error, recargarReclamos } = useReclamos();
  const { notificarCambio } = useNotificacionesListener();

  // El estado de un reclamo es el de su incidente: si cambia, se vuelve a pedir.
  useEffect(() => {
    return escucharCambioIncidentes(() => {
      void recargarReclamos();
    });
  }, [recargarReclamos]);

  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda);
    return reclamos.filter(
      (r) =>
        (!filtroEstado || r.incidente_estado === filtroEstado) &&
        enPeriodo(r.fecha_reclamo) &&
        (!filtroPlazo ||
          (filtroPlazo === "fuera" ? r.fuera_de_plazo : !r.fuera_de_plazo)) &&
        (!texto ||
          normalizar(r.cliente_nombre).includes(texto) ||
          normalizar(r.lote_numero).includes(texto) ||
          normalizar(r.producto_nombre).includes(texto) ||
          normalizar(r.motivo_label).includes(texto))
    );
  }, [reclamos, busqueda, filtroEstado, filtroPlazo, enPeriodo]);

  const { paginados, page, setPage, hayVariasPaginas } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${busqueda}|${filtroEstado}|${filtroPlazo}|${gestion.desde}|${gestion.hasta}`
  );

  const hayFiltros =
    busqueda.trim() !== "" || filtroPlazo !== "" || gestion.hayFiltros;

  const limpiarTodo = () => {
    setBusqueda("");
    setFiltroPlazo("");
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
          ? "Abierto"
          : filtroEstado === "cerrado"
          ? "Cerrado"
          : "",
      onQuitar: () => setFiltroEstado(""),
    },
    {
      clave: "plazo",
      etiqueta: "Plazo",
      valor:
        filtroPlazo === "en"
          ? "En plazo"
          : filtroPlazo === "fuera"
          ? "Fuera de plazo"
          : "",
      onQuitar: () => setFiltroPlazo(""),
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
            placeholder="Cliente, producto, lote o motivo..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Estado"
              valor={filtroEstado}
              onCambio={(valor) =>
                setFiltroEstado(valor as "" | "abierto" | "cerrado")
              }
              opciones={[
                { valor: "abierto", etiqueta: "Abierto" },
                { valor: "cerrado", etiqueta: "Cerrado" },
              ]}
              todos="Todos los estados"
              minW="160px"
            />
            <FiltroSelect
              label="Plazo"
              valor={filtroPlazo}
              onCambio={(valor) => setFiltroPlazo(valor as FiltroPlazo)}
              opciones={[
                { valor: "en", etiqueta: "En plazo" },
                { valor: "fuera", etiqueta: "Fuera de plazo" },
              ]}
              todos="Todos los plazos"
              minW="160px"
            />
          </>
        }
        herramientas={
          <>
            {/* Dentro de una pestaña, el alta va en la barra. */}
            {puedeRegistrar && (
              <BotonAgregar onClick={() => setModalNuevo(true)}>Nuevo reclamo</BotonAgregar>
            )}
            {/* Exportar es de administración (el backend lo exige). */}
            {esAdmin && (
              <BotonExportar
                nombreTabla="los reclamos"
                disabled={filtrados.length === 0}
                datos={() => ({
                  titulo: "Reclamos de clientes",
                  nombre: "reclamos",
                  encabezados: ["Fecha", "Cliente", "Producto", "Lote", "Entrega", "Motivo", "Plazo", "Estado"],
                  filas: filtrados.map((r) => [
                    formatoFecha(r.fecha_reclamo),
                    r.cliente_nombre,
                    r.producto_nombre,
                    r.lote_numero,
                    formatoFecha(r.fecha_entrega),
                    r.motivo_label,
                    `${r.fuera_de_plazo ? "Fuera de plazo" : "En plazo"} (${r.dias_desde_entrega} ${r.dias_desde_entrega === 1 ? "día" : "días"})`,
                    r.incidente_estado === "cerrado" ? "Cerrado" : "Abierto",
                  ]),
                })}
              />
            )}
            <BotonCancelar onClick={() => void recargarReclamos()}>
              <LuRefreshCw aria-hidden />
              Actualizar
            </BotonCancelar>
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {mensajeAviso && <BannerExito>{mensajeAviso}</BannerExito>}
      {loading && <EstadoCargando pagina>Cargando reclamos...</EstadoCargando>}

      {!loading && !error && filtrados.length === 0 && (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay reclamos que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>
            Todavía no hay reclamos de clientes registrados.
          </EstadoVacio>
        )
      )}

      {!loading && !error && filtrados.length > 0 && (
        <>
          <ReclamosTable
            reclamos={paginados}
            onVerDetalle={(id) => navigate(`/reclamos/${id}`)}
            onCerrar={esAdmin ? setACerrar : undefined}
          />
          {hayVariasPaginas && (
            <Paginacion
              count={filtrados.length}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <ModalCerrarReclamo
        reclamo={aCerrar}
        onClose={() => setACerrar(null)}
        onCerrado={(reclamo) => {
          setACerrar(null);
          // Su incidente también se cerró; el aviso recarga esta lista.
          notificarCambioIncidentes();
          notificarCambio();
          avisar(`Reclamo #${reclamo.id} cerrado. La resolución quedó registrada.`);
        }}
      />

      <ModalNuevoReclamo
        isOpen={modalNuevo}
        salidaInicial={null}
        onClose={() => setModalNuevo(false)}
        onReclamoRegistrado={(reclamo) => {
          setModalNuevo(false);
          void recargarReclamos();
          // El alta abre un incidente: que Gestión y el tablero se refresquen.
          notificarCambioIncidentes();
          avisar(
            `Reclamo #${reclamo.id} registrado. Se abrió el incidente #${reclamo.incidente_id}.`
          );
        }}
      />
    </>
  );
}
