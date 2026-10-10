import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  ButtonGroup,
  Field,
  Heading,
  HStack,
  IconButton,
  NativeSelect,
  Pagination,
  Spinner,
  Switch,
  Text,
} from "@chakra-ui/react";
import { IncidenteTable } from "../IncidenteTable";
import { IncidentesPorTipoPanel } from "../IncidentesPorTipoPanel";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { ReabrirIncidenteDialog } from "../ReabrirIncidenteDialog";
import { useIncidentes } from "../../hooks/useIncidentes";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import { TIPOS_INCIDENTE } from "../../types/incidente";
import type { Incidente } from "../../types/incidente";
import {
  EXITO_FONDO_CLARO,
  EXITO_TEXTO,
  TEAL,
  TEAL_OSCURO,
  TEXTO_SECUNDARIO,
  estiloInputCompacto,
} from "../../../../common/theme/tokens";

const PAGE_SIZE = 10;

const estiloSelect = {
  ...estiloInputCompacto,
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
  height: "auto" as const,
  lineHeight: "normal" as const,
};

export function IncidentesListPage() {
  const navigate = useNavigate();

  // HU "Ver incidentes abiertos": por defecto se listan solo los que todavía
  // no tienen una acción correctiva registrada (estado abierto).
  const [verSoloAbiertos, setVerSoloAbiertos] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);

  // El estado se filtra en el backend: "abierto" trae solo los pendientes;
  // "" (destildado el switch) trae abiertos y cerrados.
  const { incidentes, loading, error, cargarIncidentes } = useIncidentes(
    verSoloAbiertos ? "abierto" : "",
  );

  const { cerrar, reabrir, loading: procesando } = useIncidenteABM();

  const [incidenteACerrar, setIncidenteACerrar] = useState<Incidente | null>(null);
  const [incidenteAReabrir, setIncidenteAReabrir] = useState<Incidente | null>(null);
  const { valor: mensajeAviso, avisar } = useAvisoTemporal<string>(3500);

  // Filtros de tipo/búsqueda y orden por antigüedad: el más viejo primero,
  // para que los que llevan más tiempo sin resolverse queden arriba.
  const incidentesProcesados = useMemo(() => {
    let resultado = incidentes;
    if (filtroTipo) {
      resultado = resultado.filter((i) => i.tipo === filtroTipo);
    }
    if (busqueda.trim()) {
      // Normaliza acentos: "López" y "lopez" son lo mismo para la búsqueda.
      const normalizar = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const termino = normalizar(busqueda.trim());
      resultado = resultado.filter(
        (i) =>
          normalizar(i.titulo).includes(termino) ||
          normalizar(i.descripcion).includes(termino) ||
          normalizar(i.usuario_nombre ?? "").includes(termino),
      );
    }
    return [...resultado].sort(
      (a, b) =>
        new Date(a.fecha_reporte).getTime() - new Date(b.fecha_reporte).getTime(),
    );
  }, [incidentes, filtroTipo, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(incidentesProcesados.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPaginas);

  const incidentesPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * PAGE_SIZE;
    return incidentesProcesados.slice(inicio, inicio + PAGE_SIZE);
  }, [incidentesProcesados, paginaActual]);

  const handleToggle = (checked: boolean) => {
    setVerSoloAbiertos(checked);
    setPage(1);
  };

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroTipo(e.target.value);
    setPage(1);
  };

  const handleCerrar = async (observacion: string) => {
    if (!incidenteACerrar) return;
    const id = incidenteACerrar.id;
    try {
      await cerrar(id, observacion);
      setIncidenteACerrar(null);
      await cargarIncidentes();
      avisar(`Incidente #${id} cerrado. La resolución quedó registrada.`);
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  const handleReabrir = async (motivo: string) => {
    if (!incidenteAReabrir) return;
    const id = incidenteAReabrir.id;
    try {
      await reabrir(id, motivo);
      setIncidenteAReabrir(null);
      await cargarIncidentes();
      avisar(`Incidente #${id} reabierto. El motivo quedó registrado en el historial.`);
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  // Sin filtros el mensaje es "no hay nada registrado"; con filtros hay que
  // decir que el filtro no arrojó resultados, que es otra situación.
  const hayFiltros = filtroTipo !== "" || busqueda.trim() !== "";
  const etiquetaTipo = TIPOS_INCIDENTE.find((t) => t.value === filtroTipo)?.label;

  let mensajeVacio = verSoloAbiertos
    ? "No hay incidentes abiertos sin acción correctiva registrada."
    : "Todavía no se registraron incidentes.";
  if (hayFiltros) {
    const partes: string[] = [];
    if (etiquetaTipo) partes.push(`de tipo ${etiquetaTipo}`);
    if (busqueda.trim()) partes.push(`que coincidan con "${busqueda.trim()}"`);
    mensajeVacio = `No hay incidentes ${partes.join(" ")}.`;
  }

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Gestión de Incidentes
        </Heading>
        <Button
          bg={TEAL}
          color="white"
          fontSize="16px"
          fontWeight="bold"
          borderRadius="6px"
          px="20px"
          py="10px"
          _hover={{ bg: TEAL_OSCURO }}
          onClick={() => navigate("/incidentes/reportar")}
        >
          + Reportar Incidente
        </Button>
      </HStack>

      {/* Indicador E7: incidentes por tipo */}
      <IncidentesPorTipoPanel />

      {/* Filtros */}
      <Box
        bg="white"
        p="20px"
        borderRadius="10px"
        boxShadow="0 2px 6px rgba(0,0,0,0.05)"
        mb="25px"
      >
        <HStack gap="20px" flexWrap="wrap" align="flex-end" justify="space-between">
          <HStack gap="20px" flexWrap="wrap" align="flex-end">
            <Box minW="200px">
              <Field.Root>
                <Box as="label" display="block" fontSize="14px" fontWeight="bold" mb="6px" color={TEXTO_SECUNDARIO}>
                  TIPO
                </Box>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={filtroTipo}
                    onChange={handleTipoChange}
                    style={estiloSelect}
                  >
                    <option value="">Todos los tipos</option>
                    {TIPOS_INCIDENTE.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            </Box>

            <Box minW="250px" flex="1">
              <Field.Root>
                <Box as="label" display="block" fontSize="14px" fontWeight="bold" mb="6px" color={TEXTO_SECUNDARIO}>
                  BÚSQUEDA
                </Box>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
                  placeholder="Buscar por título, descripción o reportado por..."
                  style={{
                    ...estiloSelect,
                    padding: "10px 12px",
                    fontSize: "14px",
                    width: "100%",
                  }}
                />
              </Field.Root>
            </Box>
          </HStack>

          <Switch.Root
            checked={verSoloAbiertos}
            onCheckedChange={(e) => handleToggle(e.checked)}
            colorPalette="teal"
          >
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label
              style={{
                fontSize: "14px",
                color: verSoloAbiertos ? TEAL_OSCURO : TEXTO_SECUNDARIO,
                fontWeight: verSoloAbiertos ? "bold" : "normal",
              }}
            >
              Ver solo incidentes abiertos
            </Switch.Label>
          </Switch.Root>
        </HStack>
      </Box>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {mensajeAviso && (
        <Box
          mb="16px"
          p="12px 16px"
          borderRadius="8px"
          style={{
            backgroundColor: EXITO_FONDO_CLARO,
            border: "1px solid #c6f6d5",
          }}
        >
          <Text fontSize="14px" color={EXITO_TEXTO} fontWeight="bold">
            {mensajeAviso}
          </Text>
        </Box>
      )}

      {!loading && !error && (
        <>
          <IncidenteTable
            incidentes={incidentesPaginados}
            onCerrar={setIncidenteACerrar}
            onReabrir={setIncidenteAReabrir}
            onVer={(incidente) => navigate(`/incidentes/${incidente.id}`)}
            showActions={true}
            mensajeVacio={mensajeVacio}
          />

          {totalPaginas > 1 && (
            <Pagination.Root
              count={totalPaginas}
              pageSize={PAGE_SIZE}
              page={paginaActual}
              onPageChange={(e) => setPage(e.page)}
              mt="16px"
            >
              <HStack justify="center">
                <ButtonGroup variant="ghost" size="sm">
                  <Pagination.Items
                    render={(pageItem) => {
                      const isSelected = pageItem.value === paginaActual;
                      return (
                        <IconButton
                          key={pageItem.value}
                          aria-label={`Página ${pageItem.value}`}
                          bg={isSelected ? TEAL : "transparent"}
                          color={isSelected ? "white" : TEAL}
                          border={isSelected ? "none" : `1px solid ${TEAL}`}
                          _hover={{ bg: isSelected ? TEAL : `${TEAL}1A` }}
                        >
                          {pageItem.value}
                        </IconButton>
                      );
                    }}
                  />
                </ButtonGroup>
              </HStack>
            </Pagination.Root>
          )}
        </>
      )}

      <CerrarIncidenteDialog
        isOpen={incidenteACerrar !== null}
        incidente={incidenteACerrar}
        isLoading={procesando}
        onClose={() => setIncidenteACerrar(null)}
        onConfirm={handleCerrar}
      />

      <ReabrirIncidenteDialog
        isOpen={incidenteAReabrir !== null}
        incidente={incidenteAReabrir}
        isLoading={procesando}
        onClose={() => setIncidenteAReabrir(null)}
        onConfirm={handleReabrir}
      />
    </Box>
  );
}
