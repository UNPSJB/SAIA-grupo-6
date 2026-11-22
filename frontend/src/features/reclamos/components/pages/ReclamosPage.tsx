import { normalizar } from "../../../../common/utils/texto";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuRefreshCw } from "react-icons/lu";
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
import { useReclamos } from "../../hooks/useReclamos";
import { ReclamosTable } from "../ReclamosTable";
import { ModalNuevoReclamo } from "../ModalNuevoReclamo";

const PAGE_SIZE = 10;

/** Filtro de plazo: todos, solo en plazo o solo fuera de plazo. */
type FiltroPlazo = "" | "en" | "fuera";

export function ReclamosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeRegistrar = puedeOperar(user);
  const esAdmin = puedeAdministrar(user);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "abierto" | "cerrado">(
    ""
  );
  const [filtroPlazo, setFiltroPlazo] = useState<FiltroPlazo>("");
  const [modalNuevo, setModalNuevo] = useState(false);
  const { valor: mensajeAviso, avisar } = useAvisoTemporal<string>(3500);

  const { reclamos, loading, error, recargarReclamos } = useReclamos();

  // Cuando se cierra o reabre un incidente desde E6, el estado de la columna
  // "Estado" de los reclamos queda viejo: se vuelve a pedir la lista.
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
        (!filtroPlazo ||
          (filtroPlazo === "fuera" ? r.fuera_de_plazo : !r.fuera_de_plazo)) &&
        (!texto ||
          normalizar(r.cliente_nombre).includes(texto) ||
          normalizar(r.lote_numero).includes(texto) ||
          normalizar(r.producto_nombre).includes(texto) ||
          normalizar(r.motivo_label).includes(texto))
    );
  }, [reclamos, busqueda, filtroEstado, filtroPlazo]);

  const { paginados, page, setPage, hayVariasPaginas } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${busqueda}|${filtroEstado}|${filtroPlazo}`
  );

  const hayFiltros =
    busqueda.trim() !== "" || filtroEstado !== "" || filtroPlazo !== "";

  const limpiarTodo = () => {
    setBusqueda("");
    setFiltroEstado("");
    setFiltroPlazo("");
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
  ]);

  return (
    <Pagina
      titulo="Reclamos de clientes"
      descripcion="Reclamos registrados sobre entregas ya realizadas, con su plazo de referencia y el incidente asociado."
      acciones={
        puedeRegistrar ? (
          <>
            <BotonAgregar onClick={() => setModalNuevo(true)}>
              Nuevo reclamo
            </BotonAgregar>
            <ModalNuevoReclamo
              isOpen={modalNuevo}
              salidaInicial={null}
              onClose={() => setModalNuevo(false)}
              onReclamoRegistrado={(reclamo) => {
                setModalNuevo(false);
                void recargarReclamos();
                // El alta abre un incidente: que E6 y el tablero se refresquen.
                notificarCambioIncidentes();
                avisar(
                  `Reclamo #${reclamo.id} registrado. Se abrió el incidente #${reclamo.incidente_id}.`
                );
              }}
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
            onVerIncidente={(id) => navigate(`/incidentes/${id}`)}
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
    </Pagina>
  );
}
