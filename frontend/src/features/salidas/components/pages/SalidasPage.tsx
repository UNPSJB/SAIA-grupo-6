import { normalizar } from "../../../../common/utils/texto";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BotonExportar } from "../../../exportacion";
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
  BotonAgregar,
  BotonCancelar,
  EstadoCargando,
  EstadoVacio,
  PieTabla,
} from "../../../../components/ui/patrones";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { useAuth } from "../../../../common/context/useAuth";
import { hoyISO } from "../../../../common/utils/fechas";
import {
  puedeAdministrar,
  puedeOperar,
} from "../../../../common/api/permissions";
import { useSalidas } from "../../hooks/useSalidas";
import {
  ESTADOS_SALIDA,
  type EstadoSalida,
} from "../../types/salida";
import { ModalReservarLote } from "../ModalReservarLote";
import { ModalDespacharSalida } from "../ModalDespacharSalida";
import { ModalEntregarSalida } from "../ModalEntregarSalida";
import { ModalCancelarSalida } from "../ModalCancelarSalida";
import { ModalRechazarSalida } from "../ModalRechazarSalida";
import { ModalResolverRechazo } from "../ModalResolverRechazo";
import { ModalNuevoReclamo } from "../../../reclamos/components/ModalNuevoReclamo";
import { notificarCambioIncidentes } from "../../../incidente/eventoIncidentes";
import { SalidaTable } from "../SalidaTable";
import type { Salida } from "../../types/salida";
import { useEstadoNavegacion } from "../../../../common/hooks/useEstadoNavegacion";

const PAGE_SIZE = 10;

/**
 * Pestaña "Salidas de producto" de Lotes de producción (`/lotes?tab=salidas`).
 * Antes era una entrada aparte del menú de Producción, aunque cada salida es
 * una parte de un lote: ahora es una sub-opción del listado de lotes.
 * `/salidas` redirige acá.
 */
export function TabSalidas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeRegistrarRechazo = puedeOperar(user);
  const puedeResolverRechazo = puedeAdministrar(user);

  const [busqueda, setBusqueda] = useEstadoNavegacion("SalidasPage.busqueda", "");
  const [estado, setEstado] = useEstadoNavegacion<EstadoSalida | "">("SalidasPage.estado", "");

  const { salidas, loading, error, recargarSalidas } = useSalidas({
    estado: estado || undefined,
  });

  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda);
    return salidas.filter(
      (s) =>
        (!estado || s.estado === estado) &&
        (!texto ||
          normalizar(s.lote_numero).includes(texto) ||
          normalizar(s.producto_nombre).includes(texto) ||
          normalizar(s.cliente_nombre).includes(texto))
    );
  }, [salidas, estado, busqueda]);

  const { paginados, page, setPage } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${busqueda}|${estado}`
  );

  const hayFiltros = busqueda.trim() !== "" || estado !== "";
  const limpiarTodo = () => {
    setBusqueda("");
    setEstado("");
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
      valor: ESTADOS_SALIDA.find((e) => e.valor === estado)?.etiqueta ?? "",
      onQuitar: () => setEstado(""),
    },
  ]);

  // Modales
  const [modalReservar, setModalReservar] = useState(false);
  const [lotePreseleccionado, setLotePreseleccionado] = useState<number | null>(
    null
  );
  const [modalDespachar, setModalDespachar] = useState<{
    open: boolean;
    salida: Salida | null;
  }>({ open: false, salida: null });
  const [modalEntregar, setModalEntregar] = useState<{
    open: boolean;
    salida: Salida | null;
  }>({ open: false, salida: null });
  const [modalCancelar, setModalCancelar] = useState<{
    open: boolean;
    salida: Salida | null;
  }>({ open: false, salida: null });
  const [modalRechazar, setModalRechazar] = useState<{
    open: boolean;
    salida: Salida | null;
  }>({ open: false, salida: null });
  const [modalResolver, setModalResolver] = useState<{
    open: boolean;
    salida: Salida | null;
  }>({ open: false, salida: null });
  const [modalReclamo, setModalReclamo] = useState<{
    open: boolean;
    salida: Salida | null;
  }>({ open: false, salida: null });

  return (
    <>
          <ModalReservarLote
            isOpen={modalReservar}
            loteIdInicial={lotePreseleccionado}
            onClose={() => setModalReservar(false)}
            onReservaRegistrada={() => {
              setModalReservar(false);
              void recargarSalidas();
            }}
          />
          <ModalDespacharSalida
            isOpen={modalDespachar.open}
            salidaId={modalDespachar.salida?.id ?? 0}
            loteNumero={modalDespachar.salida?.lote_numero ?? ""}
            productoNombre={modalDespachar.salida?.producto_nombre ?? ""}
            clienteNombre={modalDespachar.salida?.cliente_nombre ?? ""}
            clienteContacto={modalDespachar.salida?.cliente_contacto ?? null}
            clienteDomicilio={modalDespachar.salida?.cliente_domicilio ?? null}
            cantidad={modalDespachar.salida?.cantidad ?? ""}
            unidadMedida={modalDespachar.salida?.unidad_medida ?? ""}
            fechaReserva={modalDespachar.salida?.fecha_reserva ?? ""}
            loteVencido={
              !!modalDespachar.salida?.fecha_vencimiento &&
              modalDespachar.salida.fecha_vencimiento <
                new Date().toISOString().split("T")[0]
            }
            onClose={() => setModalDespachar({ open: false, salida: null })}
            onDespachoRegistrado={() => {
              setModalDespachar({ open: false, salida: null });
              void recargarSalidas();
            }}
          />
          <ModalEntregarSalida
            isOpen={modalEntregar.open}
            salidaId={modalEntregar.salida?.id ?? 0}
            loteNumero={modalEntregar.salida?.lote_numero ?? ""}
            productoNombre={modalEntregar.salida?.producto_nombre ?? ""}
            clienteNombre={modalEntregar.salida?.cliente_nombre ?? ""}
            cantidad={modalEntregar.salida?.cantidad ?? ""}
            unidadMedida={modalEntregar.salida?.unidad_medida ?? ""}
            formaEntrega={modalEntregar.salida?.forma_entrega ?? ""}
            fechaDespacho={modalEntregar.salida?.fecha_despacho ?? ""}
            despachadoEn={modalEntregar.salida?.despachado_en ?? null}
            onClose={() => setModalEntregar({ open: false, salida: null })}
            onEntregaRegistrada={() => {
              setModalEntregar({ open: false, salida: null });
              void recargarSalidas();
            }}
          />
          <ModalCancelarSalida
            isOpen={modalCancelar.open}
            salidaId={modalCancelar.salida?.id ?? 0}
            loteNumero={modalCancelar.salida?.lote_numero ?? ""}
            productoNombre={modalCancelar.salida?.producto_nombre ?? ""}
            clienteNombre={modalCancelar.salida?.cliente_nombre ?? ""}
            cantidad={modalCancelar.salida?.cantidad ?? ""}
            unidadMedida={modalCancelar.salida?.unidad_medida ?? ""}
            onClose={() => setModalCancelar({ open: false, salida: null })}
            onCancelacionRegistrada={() => {
              setModalCancelar({ open: false, salida: null });
              void recargarSalidas();
            }}
          />
          <ModalRechazarSalida
            isOpen={modalRechazar.open}
            salidaId={modalRechazar.salida?.id ?? 0}
            loteNumero={modalRechazar.salida?.lote_numero ?? ""}
            productoNombre={modalRechazar.salida?.producto_nombre ?? ""}
            clienteNombre={modalRechazar.salida?.cliente_nombre ?? ""}
            cantidad={modalRechazar.salida?.cantidad ?? ""}
            unidadMedida={modalRechazar.salida?.unidad_medida ?? ""}
            fechaDespacho={modalRechazar.salida?.fecha_despacho ?? ""}
            despachadoEn={modalRechazar.salida?.despachado_en ?? null}
            onClose={() => setModalRechazar({ open: false, salida: null })}
            onRechazoRegistrado={() => {
              setModalRechazar({ open: false, salida: null });
              void recargarSalidas();
            }}
          />
          <ModalResolverRechazo
            isOpen={modalResolver.open}
            salidaId={modalResolver.salida?.id ?? 0}
            loteNumero={modalResolver.salida?.lote_numero ?? ""}
            productoNombre={modalResolver.salida?.producto_nombre ?? ""}
            clienteNombre={modalResolver.salida?.cliente_nombre ?? ""}
            cantidad={modalResolver.salida?.cantidad ?? ""}
            unidadMedida={modalResolver.salida?.unidad_medida ?? ""}
            motivoRechazoLabel={
              modalResolver.salida?.motivo_rechazo_label ?? null
            }
            detalleRechazo={modalResolver.salida?.detalle_rechazo ?? null}
            fechaRechazo={modalResolver.salida?.fecha_rechazo ?? null}
            rechazadaPorNombre={
              modalResolver.salida?.rechazada_por_nombre ?? null
            }
            incidenteFotoUrl={
              modalResolver.salida?.incidente_foto_url ?? null
            }
            loteVencido={
              !!modalResolver.salida?.fecha_vencimiento &&
              modalResolver.salida.fecha_vencimiento < hoyISO()
            }
            loteRetirado={!!modalResolver.salida?.lote_retirado}
            onClose={() => setModalResolver({ open: false, salida: null })}
            onRechazoResuelto={() => {
              setModalResolver({ open: false, salida: null });
              void recargarSalidas();
            }}
          />
          <ModalNuevoReclamo
            isOpen={modalReclamo.open}
            salidaInicial={modalReclamo.salida}
            onClose={() => setModalReclamo({ open: false, salida: null })}
            onReclamoRegistrado={() => {
              setModalReclamo({ open: false, salida: null });
              void recargarSalidas();
              notificarCambioIncidentes();
            }}
          />
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Lote, producto o cliente..."
          />
        }
        filtros={
          <FiltroSelect
            label="Estado"
            valor={estado}
            onCambio={(v) => setEstado(v as EstadoSalida | "")}
            opciones={ESTADOS_SALIDA.map((e) => ({
              valor: e.valor,
              etiqueta: e.etiqueta,
            }))}
            todos="Todos los estados"
            minW="180px"
          />
        }
        herramientas={
          <>
            {/* Dentro de una pestaña, el alta va en la barra. Reservar es una
                decisión comercial: solo quien administra. */}
            {puedeResolverRechazo && (
              <BotonAgregar
                onClick={() => {
                  setLotePreseleccionado(null);
                  setModalReservar(true);
                }}
              >
                Nueva reserva
              </BotonAgregar>
            )}
            {puedeResolverRechazo && (
              <BotonExportar
                nombreTabla="salidas"
                vista="salidas"
                filtros={{ estado: estado || undefined, buscar: busqueda.trim() || undefined }}
              />
            )}
            <BotonCancelar onClick={recargarSalidas}>
              <LuRefreshCw aria-hidden />
              Actualizar
            </BotonCancelar>
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando pagina>Cargando salidas...</EstadoCargando>}

      {!loading && !error && filtrados.length === 0 && (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay salidas que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>Todavía no hay salidas de producto registradas.</EstadoVacio>
        )
      )}

      {!loading && !error && filtrados.length > 0 && (
        <>
          <SalidaTable
            salidas={paginados}
            pie={
              <PieTabla
                count={filtrados.length}
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                unidad={filtrados.length === 1 ? "salida" : "salidas"}
              />
            }
            onVerDetalle={(salidaId) => {
              setLotePreseleccionado(null);
              navigate(`/salidas/${salidaId}/detalle`);
            }}
            onDespachar={(salidaId) => {
              const salida = paginados.find((s) => s.id === salidaId);
              if (salida) {
                setModalDespachar({ open: true, salida });
              }
            }}
            onCancelar={
              puedeResolverRechazo
                ? (salidaId) => {
                    const salida = paginados.find((s) => s.id === salidaId);
                    if (salida) {
                      setModalCancelar({ open: true, salida });
                    }
                  }
                : undefined
            }
            onEntregar={(salidaId) => {
              const salida = paginados.find((s) => s.id === salidaId);
              if (salida) {
                setModalEntregar({ open: true, salida });
              }
            }}
            onRechazar={
              puedeRegistrarRechazo
                ? (salidaId) => {
                    const salida = paginados.find((s) => s.id === salidaId);
                    if (salida) {
                      setModalRechazar({ open: true, salida });
                    }
                  }
                : undefined
            }
            onResolver={
              puedeResolverRechazo
                ? (salidaId) => {
                    const salida = paginados.find((s) => s.id === salidaId);
                    if (salida) {
                      setModalResolver({ open: true, salida });
                    }
                  }
                : undefined
            }
            onReclamar={
              puedeRegistrarRechazo
                ? (salidaId) => {
                    const salida = paginados.find((s) => s.id === salidaId);
                    if (salida) {
                      setModalReclamo({ open: true, salida });
                    }
                  }
                : undefined
            }
          />
        </>
      )}
    </>
  );
}
