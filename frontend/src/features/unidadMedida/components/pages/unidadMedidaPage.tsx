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
} from "@chakra-ui/react";
import { UnidadMedidaTable } from "../unidadMedidaTable";
import { DeleteUnidadMedidaDialog } from "../DeleteUnidadMedidaDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useUnidadesMedida } from "../../hooks/useUnidadesMedida";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import type { UnidadMedida } from "../../types/unidadMedida";

const TEAL = "#468189";
const PAGE_SIZE = 10;

export function UnidadMedidaPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const [page, setPage] = useState(1);

  const { unidades, loading, error, cargarUnidades } = useUnidadesMedida(verInactivos);
  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useUnidadMedidaABM();

  const [unidadAEliminar, setUnidadAEliminar] = useState<UnidadMedida | null>(null);
  const [unidadAReactivar, setUnidadAReactivar] = useState<UnidadMedida | null>(null);

  const unidadesPaginadas = useMemo(() => {
    const filtrados = unidades.filter((u) => (verInactivos ? !u.activo : u.activo));
    const start = (page - 1) * PAGE_SIZE;
    return filtrados.slice(start, start + PAGE_SIZE);
  }, [unidades, page, verInactivos]);

  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
  };

  const handleEdit = (unidad: UnidadMedida) => navigate(`/unidades-medida/${unidad.id}/editar`);
  const handleDeleteRequest = (unidad: UnidadMedida) => setUnidadAEliminar(unidad);
  const handleCloseDeleteDialog = () => { if (!procesando) setUnidadAEliminar(null); };

  const handleConfirmDelete = async () => {
    if (!unidadAEliminar) return;
    try {
      await borrar(unidadAEliminar.id);
      setUnidadAEliminar(null);
      await cargarUnidades();
    } catch {
      // Cerrar el diálogo y mostrar el error
      setUnidadAEliminar(null);
    }
  };

  const handleReactivarRequest = (unidad: UnidadMedida) => setUnidadAReactivar(unidad);
  const handleCloseReactivarDialog = () => { if (!procesando) setUnidadAReactivar(null); };

  const handleConfirmReactivar = async () => {
    if (!unidadAReactivar) return;
    try {
      await reactivar(unidadAReactivar.id, {
        nombre: unidadAReactivar.nombre,
        simbolo: unidadAReactivar.simbolo,
      });
      setUnidadAReactivar(null);
      await cargarUnidades();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos ? "Unidades de Medida Dados de Baja" : "Gestión de Unidades de Medida"}
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
          onClick={() => navigate("/unidades-medida/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {/* Cartel rojo de error (cuando se intenta eliminar una unidad en uso) */}
      {errorEliminar && (
        <Box
          style={{
            backgroundColor: "#f8d7da",
            color: "#721c24",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "20px",
            border: "1px solid #f5c6cb",
            fontWeight: "bold",
          }}
        >
          ⚠️ {errorEliminar}
        </Box>
      )}

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
          <UnidadMedidaTable
            unidades={unidadesPaginadas}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={handleReactivarRequest}
          />

          {unidades.filter((u) => (verInactivos ? !u.activo : u.activo)).length > PAGE_SIZE && (
            <Pagination.Root
              count={unidades.filter((u) => (verInactivos ? !u.activo : u.activo)).length}
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

      <DeleteUnidadMedidaDialog
        isOpen={unidadAEliminar !== null}
        unidad={unidadAEliminar}
        isLoading={procesando}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={unidadAReactivar !== null}
        mensaje={`¿Estás seguro que deseas reactivar la unidad de medida ${unidadAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
