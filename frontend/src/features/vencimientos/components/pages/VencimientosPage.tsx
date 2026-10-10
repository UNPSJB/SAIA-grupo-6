import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, Heading, Input, Spinner, Table, Text } from "@chakra-ui/react";
import { obtenerVencimientos } from "../../services/vencimientoService";
import { TIPOS_VENCIMIENTO } from "../../types/vencimiento";
import type {
  EstadoVencimiento,
  TipoVencimiento,
  VencimientoConsolidado,
} from "../../types/vencimiento";
import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import {
  ERROR_BORDE,
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SUAVE,
} from "../../../../common/theme/tokens";

type Orden = "URGENCIA" | "VIGENTES_PRIMERO";

// Qué estado va primero según el orden elegido.
const RANGO_ESTADO: Record<Orden, Record<EstadoVencimiento, number>> = {
  URGENCIA: { VENCIDO: 0, PROXIMO: 1, VIGENTE: 2 },
  VIGENTES_PRIMERO: { VIGENTE: 0, PROXIMO: 1, VENCIDO: 2 },
};

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

// Minúsculas y sin tildes, para que "calibracion" encuentre "Calibración".
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Todo lo que se ve en una fila, junto, para buscar en cualquier campo.
function textoBuscable(v: VencimientoConsolidado) {
  return normalizar(
    [
      TIPOS_VENCIMIENTO.find((t) => t.value === v.tipo)?.label ?? v.tipo,
      v.detalle,
      v.sujeto,
      formatoFechaOCorta(v.fecha_vencimiento),
      v.fecha_vencimiento,
      ESTILO_ESTADO[v.estado].etiqueta,
      textoDias(v),
    ].join(" ")
  );
}

export function VencimientosPage() {
  const navigate = useNavigate();
  const [vencimientos, setVencimientos] = useState<VencimientoConsolidado[]>([]);
  const [tipo, setTipo] = useState<TipoVencimiento | "">("");
  const [persona, setPersona] = useState(""); // id de la persona, o "" = todas
  const [aptitud, setAptitud] = useState(""); // nombre de la aptitud, o "" = todas
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("URGENCIA");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await obtenerVencimientos(tipo || undefined);
        if (!cancelado) setVencimientos(data);
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
  }, [tipo]);

  // Opciones de los selectores: las personas y aptitudes que realmente tienen vencimientos.
  const personas = useMemo(() => {
    const porId = new Map<number, string>();
    vencimientos.forEach((v) => porId.set(v.sujeto_id, v.sujeto));
    return [...porId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [vencimientos]);

  const aptitudes = useMemo(
    () => [...new Set(vencimientos.map((v) => v.detalle))].sort((a, b) => a.localeCompare(b)),
    [vencimientos]
  );

  // Filtrar + buscar + ordenar, todo en el navegador sobre la lista ya cargada.
  const visibles = useMemo(() => {
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
    const rango = RANGO_ESTADO[orden];

    return vencimientos
      .filter((v) => !persona || String(v.sujeto_id) === persona)
      .filter((v) => !aptitud || v.detalle === aptitud)
      .filter((v) => {
        if (terminos.length === 0) return true;
        const texto = textoBuscable(v);
        return terminos.every((t) => texto.includes(t));
      })
      .sort((a, b) => rango[a.estado] - rango[b.estado] || a.dias_restantes - b.dias_restantes);
  }, [vencimientos, persona, aptitud, busqueda, orden]);

  const hayFiltros = persona !== "" || aptitud !== "" || busqueda !== "";

  const limpiarFiltros = () => {
    setPersona("");
    setAptitud("");
    setBusqueda("");
  };

  // Al cambiar el tipo se reinician los filtros de persona y aptitud, porque
  // los ids de personas y de equipos podrían coincidir.
  const cambiarTipo = (nuevo: TipoVencimiento | "") => {
    setTipo(nuevo);
    setPersona("");
    setAptitud("");
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>
      <Heading as="h2" size="md" mb="20px">
        📅 Vencimientos
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
            onChange={(e) => setBusqueda(e.target.value)}
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
                onChange={(e) => setPersona(e.target.value)}
                style={estiloSelect}
              >
                <option value="">Todas</option>
                {personas.map(([id, nombre]) => (
                  <option key={id} value={id}>
                    {nombre}
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
                onChange={(e) => setAptitud(e.target.value)}
                style={estiloSelect}
              >
                <option value="">Todos</option>
                {aptitudes.map((nombre) => (
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
            onChange={(e) => setOrden(e.target.value as Orden)}
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
          }}
        >
          ⚠️ {error}
        </Box>
      )}

      {loading ? (
        <Spinner />
      ) : vencimientos.length === 0 && !error ? (
        <Box p="30px" textAlign="center" bg="#f8f9fa" borderRadius="8px">
          <Text fontSize="18px" color={EXITO} fontWeight="bold">
            ✅ No hay vencimientos cargados
          </Text>
          <Text color={GRIS_MEDIO}>
            Cuando cargues vencimientos de personal o planes de calibración/mantenimiento, van a aparecer acá.
          </Text>
        </Box>
      ) : visibles.length === 0 && !error ? (
        <Box p="30px" textAlign="center" bg="#f8f9fa" borderRadius="8px">
          <Text fontSize="18px" color={TEXTO_SUAVE} fontWeight="bold">
            No hay resultados con esos filtros
          </Text>
          <Text color={GRIS_MEDIO}>Probá con otra búsqueda o limpiá los filtros.</Text>
        </Box>
      ) : (
        <>
          <Text style={{ color: GRIS_MEDIO, fontSize: "14px", marginBottom: "8px" }}>
            Mostrando {visibles.length} de {vencimientos.length}
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
                {visibles.map((v) => {
                  const estilo = ESTILO_ESTADO[v.estado];
                  return (
                    <Table.Row key={v.id_vencimiento} _hover={{ bg: "#f7fafc" }}>
                      <Table.Cell>
                        <Badge bg="#e9d8fd" color="#553c9a" px="2" py="1" borderRadius="md" fontWeight="bold">
                          {TIPOS_VENCIMIENTO.find((t) => t.value === v.tipo)?.label ?? v.tipo}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontWeight="bold" color="#2d3748">{v.detalle}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="14px" color="#4a5568">{v.sujeto}</Text>
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
                        <Button
                          size="sm"
                          bg="#3182ce"
                          color="white"
                          _hover={{ bg: "#2b6cb0" }}
                          fontWeight="bold"
                          borderRadius="6px"
                          onClick={() => navigate(v.link_destino)}
                        >
                          Ver
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        </>
      )}
    </Box>
  );
}