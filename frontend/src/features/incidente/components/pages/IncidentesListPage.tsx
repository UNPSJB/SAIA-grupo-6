import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  ButtonGroup,
  Heading,
  HStack,
  IconButton,
  Pagination,
  Spinner,
  Text,
  Field,
  NativeSelect,
} from "@chakra-ui/react";
import { IncidenteTable } from "../IncidenteTable";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { useIncidentes } from "../../hooks/useIncidentes";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { ESTADOS_INCIDENTE, TIPOS_INCIDENTE, estadoLabel } from "../../types/incidente";
import type { Incidente, TipoIncidente, EstadoIncidente } from "../../types/incidente";
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
  const [page, setPage] = useState(1);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoIncidente | "">("");

  const { incidentes, loading, error, cargarIncidentes } = useIncidentes(filtroEstado);
  const { cerrar, reabrir, loading: procesando } = useIncidenteABM();

  const [incidenteACerrar, setIncidenteACerrar] = useState<Incidente | null>(null);
  const { valor: mensajeAviso, avisar } = useAvisoTemporal<string>(3500);

  const incidentesFiltrados = useMemo(() => {
    // El estado ya viene filtrado del backend; el tipo se filtra acá porque es
    // un filtro de la tabla y no condensa la respuesta.
    if (!filtroTipo) return incidentes;
    return incidentes.filter((i) => i.tipo === filtroTipo);
  }, [incidentes, filtroTipo]);

  const incidentesPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return incidentesFiltrados.slice(start, start + PAGE_SIZE);
  }, [incidentesFiltrados, page]);

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroTipo(e.target.value as TipoIncidente | "");
    setPage(1);
  };

  const handleEstadoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroEstado(e.target.value as EstadoIncidente | "");
    setPage(1);
  };

  const handleCerrarRequest = (incidente: Incidente) => setIncidenteACerrar(incidente);
  const handleCloseDialog = () => { if (!procesando) setIncidenteACerrar(null); };

  const handleConfirmCerrar = async (observacionCierre: string) => {
    if (!incidenteACerrar) return;
    const id = incidenteACerrar.id;
    try {
      await cerrar(id, observacionCierre);
      setIncidenteACerrar(null);
      await cargarIncidentes();
      avisar(`Incidente #${id} cerrado. La resolución quedó registrada.`);
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  const handleReabrir = async (incidente: Incidente) => {
    try {
      await reabrir(incidente.id);
      await cargarIncidentes();
      avisar(`Incidente #${incidente.id} reabierto.`);
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  // Sin filtros el mensaje es "no hay nada registrado"; con filtros hay que
  // decir que el filtro no arrojó resultados, que es otra situación.
  const hayFiltros = filtroEstado !== "" || filtroTipo !== "";
  const etiquetaTipo = TIPOS_INCIDENTE.find((t) => t.value === filtroTipo)?.label;

  let mensajeVacio = "Todavía no se registraron incidentes.";
  if (hayFiltros) {
    const partes: string[] = [];
    if (filtroEstado) partes.push(`en estado ${estadoLabel(filtroEstado)}`);
    if (etiquetaTipo) partes.push(`de tipo ${etiquetaTipo}`);
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
          + Registrar Incidente
        </Button>
      </HStack>

      {/* Filtros */}
      <Box
        bg="white"
        p="20px"
        borderRadius="10px"
        boxShadow="0 2px 6px rgba(0,0,0,0.05)"
        mb="25px"
      >
        <HStack gap="20px" flexWrap="wrap" align="flex-end">
          <Box minW="200px">
            <Field.Root>
              <Box as="label" display="block" fontSize="14px" fontWeight="bold" mb="6px" color={TEXTO_SECUNDARIO}>
                ESTADO
              </Box>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={filtroEstado}
                  onChange={handleEstadoChange}
                  style={estiloSelect}
                >
                  <option value="">Todos los estados</option>
                  {ESTADOS_INCIDENTE.map((estado) => (
                    <option key={estado.value} value={estado.value}>
                      {estado.label}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </Box>

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
            onCerrar={handleCerrarRequest}
            onReabrir={handleReabrir}
            onVer={(inc) => navigate(`/incidentes/${inc.id}`)}
            showActions={true}
            mensajeVacio={mensajeVacio}
          />

          {incidentesFiltrados.length > PAGE_SIZE && (
            <Pagination.Root
              // Chakra espera el total de PAGINAS, no de incidentes: si se pasa
              // la cantidad de filas sale un botón por cada incidente.
              count={Math.ceil(incidentesFiltrados.length / PAGE_SIZE)}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={(e) => setPage(e.page)}
              mt="16px"
            >
              <HStack justify="center">
                <ButtonGroup variant="ghost" size="sm">
                  <Pagination.Items
                    render={(pageItem) => {
                      const isSelected = pageItem.value === page;
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
        onClose={handleCloseDialog}
        onConfirm={handleConfirmCerrar}
      />
    </Box>
  );
}