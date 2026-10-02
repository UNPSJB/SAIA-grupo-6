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
  Switch,
  Text,
  Field,
  NativeSelect,
} from "@chakra-ui/react";
import { IncidenteTable } from "../incidenteTable";
import { DeleteIncidenteDialog } from "../DeleteIncidenteDialog";
import { useIncidentes } from "../../hooks/useIncidentes";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { TIPOS_INCIDENTE } from "../../types/incidente";
import type { Incidente, TipoIncidente } from "../../types/incidente";

const TEAL = "#468189";
const PAGE_SIZE = 10;

const estiloInput = {
  backgroundColor: "#fff",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "2px solid #90BEBB",
  fontSize: "15px",
  color: "#333",
};

const estiloSelect = {
  ...estiloInput,
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
  height: "auto" as const,
  lineHeight: "normal" as const,
};

export function IncidentePage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const [page, setPage] = useState(1);
  const [filtroTipo, setFiltroTipo] = useState<string>("");

  const { incidentes, loading, error, cargarIncidentes } = useIncidentes(verInactivos);
  const { borrar, loading: procesando } = useIncidenteABM();

  const [incidenteAEliminar, setIncidenteAEliminar] = useState<Incidente | null>(null);

  const incidentesFiltrados = useMemo(() => {
    let filtrados = incidentes.filter((i) => (verInactivos ? !i.activo : i.activo));
    if (filtroTipo) {
      filtrados = filtrados.filter((i) => i.tipo === filtroTipo);
    }
    return filtrados;
  }, [incidentes, verInactivos, filtroTipo]);

  const incidentesPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return incidentesFiltrados.slice(start, start + PAGE_SIZE);
  }, [incidentesFiltrados, page]);

  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
  };

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroTipo(e.target.value as TipoIncidente | "");
    setPage(1);
  };

  const handleDeleteRequest = (incidente: Incidente) => setIncidenteAEliminar(incidente);
  const handleCloseDeleteDialog = () => { if (!procesando) setIncidenteAEliminar(null); };

  const handleConfirmDelete = async () => {
    if (!incidenteAEliminar) return;
    try {
      await borrar(incidenteAEliminar.id);
      setIncidenteAEliminar(null);
      await cargarIncidentes();
    } catch {}
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos ? "Incidentes Dados de Baja" : "Gestión de Incidentes"}
        </Heading>
        <Button
          bg={TEAL}
          color="white"
          fontSize="16px"
          fontWeight="bold"
          borderRadius="6px"
          px="20px"
          py="10px"
          _hover={{ bg: "#37666d" }}
          onClick={() => navigate("/incidentes/nuevo")}
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
              <Box as="label" display="block" fontSize="14px" fontWeight="bold" mb="6px" color="#555">
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

      <HStack justify="flex-end" mb="20px">
        <Switch.Root checked={verInactivos} onCheckedChange={(e) => handleToggleInactivos(e.checked)} colorPalette="gray">
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label style={{ fontSize: "14px", color: verInactivos ? "#d9534f" : "#555", fontWeight: verInactivos ? "bold" : "normal" }}>
            Ver dados de baja
          </Switch.Label>
        </Switch.Root>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <IncidenteTable
            incidentes={incidentesPaginados}
            onDelete={handleDeleteRequest}
          />

          {incidentesFiltrados.length > PAGE_SIZE && (
            <Pagination.Root
              count={incidentesFiltrados.length}
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

      <DeleteIncidenteDialog
        isOpen={incidenteAEliminar !== null}
        incidente={incidenteAEliminar}
        isLoading={procesando}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}
