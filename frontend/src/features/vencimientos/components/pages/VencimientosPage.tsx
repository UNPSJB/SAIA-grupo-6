import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, Heading, Input, Spinner, Table, Text } from "@chakra-ui/react";
import {
  obtenerOpcionesVencimientos,
  obtenerVencimientosPaginados,
  type VencimientosOpciones,
} from "../../services/vencimientoService";
import { TIPOS_VENCIMIENTO } from "../../types/vencimiento";
import type {
  EstadoVencimiento,
  TipoVencimiento,
  VencimientoConsolidado,
} from "../../types/vencimiento";
import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import { Paginacion, BotonAccion, TextoTruncado } from "../../../../components/ui/patrones";
import { LuCalendarClock, LuCircleCheck, LuTriangleAlert } from "react-icons/lu";
import {
  ERROR_BORDE,
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SUAVE,
} from "../../../../common/theme/tokens";

/** Tamaño de página de todos los listados de la app. */
const PAGE_SIZE = 10;

type Orden = "URGENCIA" | "VIGENTES_PRIMERO";

const ESTILO_ESTADO: Record<
  EstadoVencimiento,
  { etiqueta: string; fondo: string; texto: string }
> = {
  VENCIDO: { etiqueta: "VENCIDO", fondo: "#fed7d7", texto: "#c53030" },
  PROXIMO: { etiqueta: "PRÓXIMO A VENCER", fondo: "#feebc8", texto: "#c05621" },
  VIGENTE: { etiqueta: "VIGENTE", fondo: "#c6f6d5", texto: "#276749" },
};

const estiloSelect = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e0",
  backgroundColor: "white",
} as const;

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
  const [persona, setPersona] = useState(""); // id de la persona, o "" = todas
  const [aptitud, setAptitud] = useState(""); // nombre de la aptitud, o "" = todas
  const [busqueda, setBusqueda] = useState("");
  // El fetch usa la búsqueda con debounce: sin esto, cada tecla pedía una
  // página al servidor. El input (y "Limpiar filtros") actualizan
  // `busqueda`; el efecto de carga depende de `busquedaAplicada`.
  const busquedaAplicada = useValorDebounced(busqueda);
  const [orden, setOrden] = useState<Orden>("URGENCIA");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Opciones de los selectores de persona y aptitud: ahora vienen de un
  // endpoint liviano en vez de derivarse de la tabla completa.
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
          personaId: persona !== "" ? Number(persona) : undefined,
          aptitud: aptitud || undefined,
          buscar: busquedaAplicada,
          orden,
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
  }, [tipo, persona, aptitud, busquedaAplicada, orden, page]);

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

  const hayFiltros = persona !== "" || aptitud !== "" || busqueda !== "";

  const limpiarFiltros = () => {
    cambiarFiltro(() => {
      setPersona("");
      setAptitud("");
      setBusqueda("");
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

  return (
    <Box style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>
      <Heading as="h2" size="md" mb="20px" display="flex" alignItems="center" gap="2">
        <LuCalendarClock aria-hidden />
        Vencimientos
      </Heading>

      {/* BUSCADOR, FILTROS Y ORDEN */}
      <Box
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <Box style={{ flex: 1, minWidth: "220px" }}>
          <Text style={{ fontWeight: "bold", color: TEXTO_SUAVE, marginBottom: "4px" }}>Buscar</Text>
          <Input
            value={busqueda}
            onChange={(e) => cambiarFiltro(() => setBusqueda(e.target.value))}
            placeholder="Persona, equipo, detalle, fecha, estado..."
            bg="white"
          />
        </Box>

        <Box>
          <Text style={{ fontWeight: "bold", color: TEXTO_SUAVE, marginBottom: "4px" }}>Tipo</Text>
          <select
            value={tipo}
            onChange={(e) => cambiarTipo(e.target.value as TipoVencimiento | "")}
            style={estiloSelect}
          >
            <option value="">Todos</option>
            {TIPOS_VENCIMIENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Box>

        {/* Estos dos filtros solo tienen sentido para vencimientos de personal. */}
        {tipo === "PERSONAL" && (
          <>
            <Box>
              <Text style={{ fontWeight: "bold", color: TEXTO_SUAVE, marginBottom: "4px" }}>
                Persona
              </Text>
              <select
                value={persona}
                onChange={(e) => cambiarFiltro(() => setPersona(e.target.value))}
                style={estiloSelect}
              >
                <option value="">Todas</option>
                {opciones.personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Box>

            <Box>
              <Text style={{ fontWeight: "bold", color: TEXTO_SUAVE, marginBottom: "4px" }}>
                Seleccioná aptitud
              </Text>
              <select
                value={aptitud}
                onChange={(e) => cambiarFiltro(() => setAptitud(e.target.value))}
                style={estiloSelect}
              >
                <option value="">Todos</option>
                {opciones.aptitudes.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </Box>
          </>
        )}

        <Box>
          <Text style={{ fontWeight: "bold", color: TEXTO_SUAVE, marginBottom: "4px" }}>Ordenar</Text>
          <select
            value={orden}
            onChange={(e) => cambiarFiltro(() => setOrden(e.target.value as Orden))}
            style={estiloSelect}
          >
            <option value="URGENCIA">Vencidos → Próximos → Vigentes</option>
            <option value="VIGENTES_PRIMERO">Vigentes → Próximos → Vencidos</option>
          </select>
        </Box>

        {hayFiltros && (
          <Button
            onClick={limpiarFiltros}
            height="auto"
            minW="auto"
            style={{
              padding: "9px 14px",
              borderRadius: "6px",
              border: "1px solid #cbd5e0",
              backgroundColor: "#fff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </Box>

      {error && (
        <Box
          style={{
            backgroundColor: ERROR_FONDO,
            color: ERROR_TEXTO,
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "20px",
            border: `1px solid ${ERROR_BORDE}`,
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <LuTriangleAlert size={16} aria-hidden style={{ flexShrink: 0 }} />
          {error}
        </Box>
      )}

      {loading ? (
        <Spinner />
      ) : items.length === 0 && !error ? (
        hayFiltros ? (
          <Box p="30px" textAlign="center" bg="#f8f9fa" borderRadius="8px">
            <Text fontSize="18px" color={TEXTO_SUAVE} fontWeight="bold">
              No hay resultados con esos filtros
            </Text>
            <Text color={GRIS_MEDIO}>Probá con otra búsqueda o limpiá los filtros.</Text>
          </Box>
        ) : (
          <Box p="30px" textAlign="center" bg="#f8f9fa" borderRadius="8px">
            <Text
              fontSize="18px"
              color={EXITO}
              fontWeight="bold"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap="2"
            >
              <LuCircleCheck aria-hidden />
              No hay vencimientos cargados
            </Text>
            <Text color={GRIS_MEDIO}>
              Cuando cargues vencimientos de personal o planes de calibración/mantenimiento, van a aparecer acá.
            </Text>
          </Box>
        )
      ) : (
        <>
          <Text style={{ color: GRIS_MEDIO, fontSize: "14px", marginBottom: "8px" }}>
            Mostrando {items.length} de {total}
          </Text>
          <Box
            bg="white"
            borderRadius="10px"
            boxShadow="0 4px 15px rgba(0,0,0,0.05)"
            overflow="hidden"
            border="1px solid #e2e8f0"
          >
            <Table.Root variant="outline" size="md">
              <Table.Header bg="#f8fafc">
                <Table.Row>
                  {["Tipo", "Detalle", "Persona / Equipo", "Vencimiento", "Estado"].map((titulo) => (
                    <Table.ColumnHeader
                      key={titulo}
                      color={TEXTO_SUAVE}
                      fontWeight="bold"
                      textTransform="uppercase"
                      fontSize="12px"
                    >
                      {titulo}
                    </Table.ColumnHeader>
                  ))}
                  <Table.ColumnHeader
                    color={TEXTO_SUAVE}
                    fontWeight="bold"
                    textTransform="uppercase"
                    fontSize="12px"
                    textAlign="center"
                  >
                    Acción
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map((v) => {
                  const estilo = ESTILO_ESTADO[v.estado];
                  return (
                    <Table.Row key={v.id_vencimiento} _hover={{ bg: "#f7fafc" }}>
                      <Table.Cell>
                        <Badge bg="#e9d8fd" color="#553c9a" px="2" py="1" borderRadius="md" fontWeight="bold">
                          {TIPOS_VENCIMIENTO.find((t) => t.value === v.tipo)?.label ?? v.tipo}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <TextoTruncado
                          fontWeight="bold"
                          color="#2d3748"
                          texto={v.detalle}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <TextoTruncado fontSize="14px" color="#4a5568" texto={v.sujeto} />
                      </Table.Cell>
                      <Table.Cell>
                        <Text
                          fontSize="14px"
                          color={v.estado === "VENCIDO" ? ERROR_TEXTO : TEXTO_SUAVE}
                          fontWeight={v.estado === "VENCIDO" ? "bold" : "normal"}
                        >
                          {formatoFechaOCorta(v.fecha_vencimiento)}
                        </Text>
                        <Text fontSize="12px" color="#718096">{textoDias(v)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge bg={estilo.fondo} color={estilo.texto} px="2" py="1" borderRadius="md" fontWeight="bold">
                          {estilo.etiqueta}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        <BotonAccion
                          accion="ver"
                          label="Ver"
                          onClick={() => navigate(v.link_destino)}
                        />
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Box>

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