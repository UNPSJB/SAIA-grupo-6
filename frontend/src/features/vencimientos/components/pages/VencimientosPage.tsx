import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Text } from "@chakra-ui/react";
import {
  obtenerOpcionesVencimientos,
  obtenerVencimientosPaginados,
  type ColumnaOrdenVencimiento,
  type VencimientosOpciones,
} from "../../services/vencimientoService";
import {
  ESTADOS_VENCIMIENTO,
  TIPOS_VENCIMIENTO,
} from "../../types/vencimiento";
import type {
  EstadoVencimiento,
  TipoVencimiento,
  VencimientoConsolidado,
} from "../../types/vencimiento";
import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EncabezadoOrdenable,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  PageHeader,
  Paginacion,
  Tarjeta,
  TextoTruncado,
} from "../../../../components/ui/patrones";
import { Table } from "@chakra-ui/react";
import { LuCalendarClock, LuCircleCheck } from "react-icons/lu";
import { ERROR_TEXTO, GRIS_MEDIO, TEXTO_SUAVE } from "../../../../common/theme/tokens";

/** Tamaño de página de todos los listados de la app. */
const PAGE_SIZE = 10;

const ESTILO_ESTADO: Record<
  EstadoVencimiento,
  { etiqueta: string; fondo: string; texto: string }
> = {
  VENCIDO: { etiqueta: "VENCIDO", fondo: "#fed7d7", texto: "#c53030" },
  PROXIMO: { etiqueta: "PRÓXIMO A VENCER", fondo: "#feebc8", texto: "#c05621" },
  VIGENTE: { etiqueta: "VIGENTE", fondo: "#c6f6d5", texto: "#276749" },
};

const ETIQUETAS_ORDEN: Record<ColumnaOrdenVencimiento, string> = {
  tipo: "Tipo",
  vencimiento: "Vencimiento",
  estado: "Estado",
};

function textoDias(v: VencimientoConsolidado) {
  if (v.dias_restantes < 0) return `Venció hace ${-v.dias_restantes} día(s)`;
  if (v.dias_restantes === 0) return "Vence hoy";
  return `Vence en ${v.dias_restantes} día(s)`;
}

export function VencimientosPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<VencimientoConsolidado[]>([]);
  const [total, setTotal] = useState(0);
  const [tipo, setTipo] = useState<TipoVencimiento | "">("");
  const [estado, setEstado] = useState<EstadoVencimiento | "">("");
  const [persona, setPersona] = useState(""); // id de la persona, o "" = todas
  const [aptitud, setAptitud] = useState(""); // nombre de la aptitud, o "" = todas
  const [busqueda, setBusqueda] = useState("");
  // El fetch usa la búsqueda con debounce: sin esto, cada tecla pedía una
  // página al servidor. El input actualiza `busqueda`; el efecto de carga
  // depende de `busquedaAplicada`.
  const busquedaAplicada = useValorDebounced(busqueda);

  // La tabla abre en el orden histórico de urgencia (vencidos primero), que
  // es el mismo `estado_asc`: el header de Estado ya muestra la flecha y el
  // resto de las columnas se puede clickear.
  const [page, setPage] = useState(1);
  const orden = useOrdenTabla<ColumnaOrdenVencimiento, "URGENCIA">(
    "URGENCIA",
    "estado",
    () => setPage(1)
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Opciones de los selectores de persona y aptitud: vienen de un endpoint
  // liviano en vez de derivarse de la tabla completa.
  const [opciones, setOpciones] = useState<VencimientosOpciones>({
    personas: [],
    aptitudes: [],
  });
  useEffect(() => {
    if (tipo !== "PERSONAL") return;
    let cancelado = false;
    obtenerOpcionesVencimientos()
      .then((data) => {
        if (!cancelado) setOpciones(data);
      })
      .catch(() => {
        // Sin opciones el dropdown queda vacío; no rompe la tabla.
      });
    return () => {
      cancelado = true;
    };
  }, [tipo]);

  useEffect(() => {
    let cancelado = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await obtenerVencimientosPaginados(page, PAGE_SIZE, {
          tipo: tipo || undefined,
          estado: estado || undefined,
          personaId: persona !== "" ? Number(persona) : undefined,
          aptitud: aptitud || undefined,
          buscar: busquedaAplicada,
          orden: orden.orden,
        });
        if (!cancelado) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar los vencimientos");
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, 0);
    return () => {
      cancelado = true;
      window.clearTimeout(timeoutId);
    };
  }, [tipo, estado, persona, aptitud, busquedaAplicada, orden.orden, page]);

  // Página fuera de rango: `items` vacío con `total > 0` significa que la
  // página pedida ya no existe (el filtro acortó la lista). El ajuste va
  // DURANTE el render — el mismo "recortar, no corregir con un efecto" de
  // `useListaPaginada` — porque un `useEffect` con `setPage` dispara la
  // regla `set-state-in-effect`. Con `page` en las dependencias del efecto
  // de arriba, la corrección dispara el re-fetch de la última página válida.
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total > 0 && items.length === 0 && page > totalPaginas) {
    setPage(totalPaginas);
  }

  /** Un filtro nuevo siempre arranca desde la primera página. */
  const cambiarFiltro = (aplicar: () => void) => {
    aplicar();
    setPage(1);
  };

  const hayFiltros =
    tipo !== "" ||
    estado !== "" ||
    persona !== "" ||
    aptitud !== "" ||
    busqueda.trim() !== "";

  const limpiarTodo = () => {
    cambiarFiltro(() => {
      setTipo("");
      setEstado("");
      setPersona("");
      setAptitud("");
      setBusqueda("");
      orden.reiniciar();
    });
  };

  // Al cambiar el tipo se reinician los filtros de persona y aptitud, porque
  // los ids de personas y de equipos podrían coincidir.
  const cambiarTipo = (nuevo: TipoVencimiento | "") => {
    cambiarFiltro(() => {
      setTipo(nuevo);
      setPersona("");
      setAptitud("");
    });
  };

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => cambiarFiltro(() => setBusqueda("")),
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      valor:
        ESTADOS_VENCIMIENTO.find((e) => e.value === estado)?.label ?? estado,
      onQuitar: () => cambiarFiltro(() => setEstado("")),
    },
    {
      clave: "tipo",
      etiqueta: "Tipo",
      valor: TIPOS_VENCIMIENTO.find((t) => t.value === tipo)?.label ?? tipo,
      onQuitar: () => cambiarFiltro(() => setTipo("")),
    },
    {
      clave: "persona",
      etiqueta: "Persona",
      valor:
        opciones.personas.find((p) => String(p.id) === persona)?.nombre ??
        (persona !== "" ? "Persona seleccionada" : ""),
      onQuitar: () => cambiarFiltro(() => setPersona("")),
    },
    {
      clave: "aptitud",
      etiqueta: "Aptitud",
      valor: aptitud,
      onQuitar: () => cambiarFiltro(() => setAptitud("")),
    },
    {
      clave: "orden",
      etiqueta: "Orden",
      valor:
        orden.columna !== null
          ? `${ETIQUETAS_ORDEN[orden.columna]} ${
              orden.direccion === "asc" ? "↑" : "↓"
            }`
          : "",
      visible: !orden.esPorDefecto && orden.columna !== null,
      onQuitar: orden.reiniciar,
    },
  ]);

  return (
    <Box p="5">
      <PageHeader
        title={
          <Box display="flex" alignItems="center" gap="2">
            <LuCalendarClock aria-hidden />
            Vencimientos
          </Box>
        }
        description="Vencimientos de personal, calibración/mantenimiento y documentos."
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={(valor) => cambiarFiltro(() => setBusqueda(valor))}
            placeholder="Persona, equipo, detalle, fecha, estado..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Estado"
              valor={estado}
              onCambio={(valor) =>
                cambiarFiltro(() =>
                  setEstado(valor as EstadoVencimiento | "")
                )
              }
              opciones={ESTADOS_VENCIMIENTO.map((e) => ({
                valor: e.value,
                etiqueta: e.label,
              }))}
              todos="Todos los estados"
            />
            <FiltroSelect
              label="Tipo"
              valor={tipo}
              onCambio={(valor) =>
                cambiarTipo(valor as TipoVencimiento | "")
              }
              opciones={TIPOS_VENCIMIENTO.map((t) => ({
                valor: t.value,
                etiqueta: t.label,
              }))}
              todos="Todos los tipos"
            />
            {tipo === "PERSONAL" && (
              <>
                <FiltroSelect
                  label="Persona"
                  valor={persona}
                  onCambio={(valor) =>
                    cambiarFiltro(() => setPersona(valor))
                  }
                  opciones={opciones.personas.map((p) => ({
                    valor: String(p.id),
                    etiqueta: p.nombre,
                  }))}
                  todos="Todas"
                />
                <FiltroSelect
                  label="Aptitud"
                  valor={aptitud}
                  onCambio={(valor) =>
                    cambiarFiltro(() => setAptitud(valor))
                  }
                  opciones={opciones.aptitudes.map((nombre) => ({
                    valor: nombre,
                    etiqueta: nombre,
                  }))}
                  todos="Todas"
                />
              </>
            )}
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <EstadoCargando>Cargando vencimientos...</EstadoCargando>}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && items.length === 0 && (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay vencimientos que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <Tarjeta p="8" textAlign="center">
            <Text
              fontSize="lg"
              color="green.fg"
              fontWeight="bold"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap="2"
            >
              <LuCircleCheck aria-hidden />
              No hay vencimientos cargados
            </Text>
            <Text color="fg.muted" fontSize="sm">
              Cuando cargues vencimientos de personal o planes de
              calibración/mantenimiento, van a aparecer acá.
            </Text>
          </Tarjeta>
        )
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <Text color={GRIS_MEDIO} fontSize="sm" mb="2">
            Mostrando {items.length} de {total}
          </Text>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" size="md" w="100%" minW="900px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOrdenable columna="tipo" orden={orden} ancho="media">
                    Tipo
                  </EncabezadoOrdenable>
                  <EncabezadoOscuro>Detalle</EncabezadoOscuro>
                  <EncabezadoOscuro>Persona / Equipo</EncabezadoOscuro>
                  <EncabezadoOrdenable
                    columna="vencimiento"
                    orden={orden}
                    ancho="media"
                  >
                    Vencimiento
                  </EncabezadoOrdenable>
                  <EncabezadoOrdenable columna="estado" orden={orden} ancho="media">
                    Estado
                  </EncabezadoOrdenable>
                  <EncabezadoOscuro center ancho="acciones">
                    Acción
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {items.map((v) => {
                  const estilo = ESTILO_ESTADO[v.estado];
                  return (
                    <Table.Row key={v.id_vencimiento} _hover={{ bg: "brand.50" }}>
                      <Celda>
                        <Badge
                          bg="#e9d8fd"
                          color="#553c9a"
                          px="2"
                          py="1"
                          borderRadius="md"
                          fontWeight="bold"
                          maxW="100%"
                          overflow="hidden"
                          textOverflow="ellipsis"
                        >
                          {TIPOS_VENCIMIENTO.find((t) => t.value === v.tipo)?.label ??
                            v.tipo}
                        </Badge>
                      </Celda>
                      <Celda>
                        <TextoTruncado
                          fontWeight="bold"
                          color="fg"
                          texto={v.detalle}
                        />
                      </Celda>
                      <Celda>
                        <TextoTruncado color="fg.muted" texto={v.sujeto} />
                      </Celda>
                      <Celda>
                        <Text
                          fontSize="sm"
                          color={v.estado === "VENCIDO" ? ERROR_TEXTO : TEXTO_SUAVE}
                          fontWeight={v.estado === "VENCIDO" ? "bold" : "normal"}
                        >
                          {formatoFechaOCorta(v.fecha_vencimiento)}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {textoDias(v)}
                        </Text>
                      </Celda>
                      <Celda>
                        <Badge
                          bg={estilo.fondo}
                          color={estilo.texto}
                          px="2"
                          py="1"
                          borderRadius="md"
                          fontWeight="bold"
                          maxW="100%"
                          overflow="hidden"
                          textOverflow="ellipsis"
                        >
                          {estilo.etiqueta}
                        </Badge>
                      </Celda>
                      <Celda center>
                        <BotonAccion
                          accion="ver"
                          label="Ver"
                          onClick={() => navigate(v.link_destino)}
                        />
                      </Celda>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Tarjeta>

          {totalPaginas > 1 && (
            <Paginacion
              count={total}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </Box>
  );
}
