import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HStack, Table } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { BotonExportar } from "../../exportacion";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../components/ui/filtros";
import {
  BannerError,
  BotonAccion,
  BotonCancelar,
  CantidadConUnidad,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  EtiquetaEstado,
  FilaClickeable,
  FilaEncabezado,
  PieTabla,
  TarjetaTabla,
  TextoTruncado,
} from "../../../components/ui/patrones";
import { useAuth } from "../../../common/context/useAuth";
import { puedeAdministrar } from "../../../common/api/permissions";
import { useEstadoNavegacion } from "../../../common/hooks/useEstadoNavegacion";
import { usePaginas } from "../../../common/hooks/usePaginas";
import { formatoFecha, hoyISO } from "../../../common/utils/fechas";
import { normalizar } from "../../../common/utils/texto";
import { notificarCambioIncidentes } from "../../incidente/eventoIncidentes";
import type { FiltrosGestion } from "../../incidente/hooks/useFiltrosGestion";
import type { EstadoIncidente } from "../../incidente/types/incidente";
import { useNotificacionesListener } from "../../notificaciones/hooks/useNotificacionesListener";
import { useSalidas } from "../hooks/useSalidas";
import type { Salida } from "../types/salida";
import { ModalResolverRechazo } from "./ModalResolverRechazo";

const PAGE_SIZE = 10;

type Destino = "" | "REINGRESADA" | "DESECHADA";

const PENDIENTE = { etiqueta: "Decisión pendiente", tono: "alerta" } as const;
const DESTINOS: { valor: Exclude<Destino, "">; etiqueta: string; tono: "ok" | "peligro" }[] = [
  { valor: "REINGRESADA", etiqueta: "Reingresada al lote", tono: "ok" },
  { valor: "DESECHADA", etiqueta: "Desechada", tono: "peligro" },
];

const ESTADOS: { valor: EstadoIncidente; etiqueta: string }[] = [
  { valor: "abierto", etiqueta: "Pendiente" },
  { valor: "cerrado", etiqueta: "Resuelto" },
];

/** Qué se decidió con la mercadería, o que falta decidirlo. */
const destinoDe = (salida: Salida) =>
  DESTINOS.find((d) => d.valor === salida.disposicion) ?? PENDIENTE;

/**
 * Pestaña "Rechazos de entregas" de Gestión de incidentes: las salidas que el
 * cliente rechazó, con el motivo y qué se decidió hacer con la mercadería. Se
 * registran desde Salidas de producto, al despachar.
 */
export function TabRechazos({ gestion }: { gestion: FiltrosGestion }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const { notificarCambio } = useNotificacionesListener();

  const [busqueda, setBusqueda] = useEstadoNavegacion("TabRechazos.busqueda", "");
  // Un rechazo sin decidir es un incidente abierto.
  const { estado, setEstado, enPeriodo } = gestion;
  const [destino, setDestino] = useEstadoNavegacion<Destino>("TabRechazos.destino", "");
  const [aResolver, setAResolver] = useState<Salida | null>(null);

  const { salidas, loading, error, recargarSalidas } = useSalidas({ estado: "RECHAZADA" });

  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda);
    return salidas
      .filter(
        (s) =>
          (!estado || (s.disposicion !== null) === (estado === "cerrado")) &&
          (!destino || s.disposicion === destino) &&
          enPeriodo(s.fecha_rechazo) &&
          (!texto ||
            normalizar(s.lote_numero).includes(texto) ||
            normalizar(s.producto_nombre).includes(texto) ||
            normalizar(s.cliente_nombre).includes(texto) ||
            normalizar(s.motivo_rechazo_label).includes(texto))
      )
      .sort(
        (a, b) =>
          (b.fecha_rechazo ?? "").localeCompare(a.fecha_rechazo ?? "") || b.id - a.id
      );
  }, [salidas, estado, destino, busqueda, enPeriodo]);

  const { paginados, page, setPage } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${busqueda}|${estado}|${destino}|${gestion.desde}|${gestion.hasta}`
  );

  const hayFiltros = busqueda.trim() !== "" || destino !== "" || gestion.hayFiltros;
  const limpiarTodo = () => {
    setBusqueda("");
    setDestino("");
    gestion.limpiar();
  };

  // Solo los resueltos tienen destino: con "Pendiente" la tabla quedaría vacía.
  const elegirDestino = (nuevo: Destino) => {
    setDestino(nuevo);
    if (nuevo && estado === "abierto") setEstado("");
  };
  const elegirEstado = (nuevo: EstadoIncidente | "") => {
    setEstado(nuevo);
    if (nuevo === "abierto") setDestino("");
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
      valor: ESTADOS.find((e) => e.valor === estado)?.etiqueta ?? "",
      onQuitar: () => setEstado(""),
    },
    {
      clave: "destino",
      etiqueta: "Destino",
      valor: DESTINOS.find((d) => d.valor === destino)?.etiqueta ?? "",
      onQuitar: () => setDestino(""),
    },
    gestion.chipPeriodo,
  ]);

  return (
    <>
      <ModalResolverRechazo
        isOpen={aResolver !== null}
        salidaId={aResolver?.id ?? 0}
        loteNumero={aResolver?.lote_numero ?? ""}
        productoNombre={aResolver?.producto_nombre ?? ""}
        clienteNombre={aResolver?.cliente_nombre ?? ""}
        cantidad={aResolver?.cantidad ?? ""}
        unidadMedida={aResolver?.unidad_medida ?? ""}
        motivoRechazoLabel={aResolver?.motivo_rechazo_label ?? null}
        detalleRechazo={aResolver?.detalle_rechazo ?? null}
        fechaRechazo={aResolver?.fecha_rechazo ?? null}
        rechazadaPorNombre={aResolver?.rechazada_por_nombre ?? null}
        incidenteFotoUrl={aResolver?.incidente_foto_url ?? null}
        loteVencido={!!aResolver?.fecha_vencimiento && aResolver.fecha_vencimiento < hoyISO()}
        loteRetirado={!!aResolver?.lote_retirado}
        onClose={() => setAResolver(null)}
        onRechazoResuelto={() => {
          setAResolver(null);
          // Resolver el rechazo también cierra su incidente.
          notificarCambioIncidentes();
          notificarCambio();
          void recargarSalidas();
        }}
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Lote, producto, cliente o motivo..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Estado"
              valor={estado}
              onCambio={(valor) => elegirEstado(valor as EstadoIncidente | "")}
              opciones={ESTADOS}
              todos="Todos los estados"
              minW="160px"
            />
            <FiltroSelect
              label="Destino"
              valor={destino}
              onCambio={(valor) => elegirDestino(valor as Destino)}
              opciones={DESTINOS.map(({ valor, etiqueta }) => ({ valor, etiqueta }))}
              todos="Todos los destinos"
              minW="190px"
            />
          </>
        }
        herramientas={
          <>
            {/* Exportar es de administración (el backend lo exige). */}
            {esAdmin && (
              <BotonExportar
                nombreTabla="los rechazos"
                disabled={filtrados.length === 0}
                datos={() => ({
                  titulo: "Rechazos de entregas",
                  nombre: "rechazos",
                  encabezados: ["Fecha", "Producto", "Lote", "Cliente", "Cantidad", "Motivo", "Destino"],
                  filas: filtrados.map((s) => [
                    formatoFecha(s.fecha_rechazo),
                    s.producto_nombre,
                    s.lote_numero,
                    s.cliente_nombre,
                    `${s.cantidad} ${s.unidad_medida}`,
                    s.motivo_rechazo_label ?? "-",
                    destinoDe(s).etiqueta,
                  ]),
                })}
              />
            )}
            <BotonCancelar onClick={() => void recargarSalidas()}>
              <LuRefreshCw aria-hidden />
              Actualizar
            </BotonCancelar>
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando pagina>Cargando rechazos...</EstadoCargando>}

      {!loading && !error && filtrados.length === 0 && (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay rechazos que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>Ningún cliente rechazó una entrega.</EstadoVacio>
        )
      )}

      {!loading && !error && filtrados.length > 0 && (
        <TarjetaTabla
          pie={
            <PieTabla
              count={filtrados.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              unidad={filtrados.length === 1 ? "rechazo" : "rechazos"}
            />
          }
        >
          <Table.Root variant="outline" w="100%" minW="1040px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro width="10%">Fecha</EncabezadoOscuro>
                <EncabezadoOscuro width="20%">Producto / Lote</EncabezadoOscuro>
                <EncabezadoOscuro width="16%">Cliente</EncabezadoOscuro>
                <EncabezadoOscuro numero width="11%">Cantidad</EncabezadoOscuro>
                <EncabezadoOscuro>Motivo</EncabezadoOscuro>
                <EncabezadoOscuro center width="16%">Destino</EncabezadoOscuro>
                <EncabezadoOscuro center width="10%">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {paginados.map((salida) => {
                const decision = destinoDe(salida);
                const verDetalle = () =>
                  navigate(`/salidas/${salida.id}/detalle`, { state: { from: "rechazos" } });
                return (
                  <FilaClickeable key={salida.id} onAbrir={verDetalle}>
                    <Celda whiteSpace="nowrap">{formatoFecha(salida.fecha_rechazo)}</Celda>
                    <Celda>
                      <DatoPrincipal titulo={salida.producto_nombre} codigo={salida.lote_numero} />
                    </Celda>
                    <Celda>{salida.cliente_nombre}</Celda>
                    <Celda numero>
                      <CantidadConUnidad valor={salida.cantidad} unidad={salida.unidad_medida} />
                    </Celda>
                    <Celda>
                      <TextoTruncado texto={salida.motivo_rechazo_label ?? "-"} />
                    </Celda>
                    <Celda center>
                      <EtiquetaEstado tono={decision.tono}>{decision.etiqueta}</EtiquetaEstado>
                    </Celda>
                    <Celda center>
                      <HStack justify="center" gap="2" flexWrap="wrap">
                        <BotonAccion accion="ver" label="Ver detalle" onClick={verDetalle} />
                        {esAdmin && salida.disposicion === null && (
                          <BotonAccion
                            accion="disposicion"
                            label="Resolver rechazo"
                            onClick={() => setAResolver(salida)}
                          />
                        )}
                      </HStack>
                    </Celda>
                  </FilaClickeable>
                );
              })}
            </Table.Body>
          </Table.Root>
        </TarjetaTabla>
      )}
    </>
  );
}
