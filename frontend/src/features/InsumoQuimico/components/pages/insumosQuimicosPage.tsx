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
import { InsumoQuimicoTable } from "../insumoQuimicoTable";
import { DeleteInsumoQuimicoDialog } from "../DeleteInsumoQuimicoDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useInsumosQuimicos } from "../../hooks/useInsumosQuimicos";
import { useInsumoQuimicoABM } from "../../hooks/useInsumoQuimicoABM";
import type { InsumoQuimico } from "../../types/insumoQuimico";

const TEAL = "#468189";
const PAGE_SIZE = 10;

export function InsumosQuimicosPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const [page, setPage] = useState(1);

  const { insumos, loading, error, cargarInsumos } = useInsumosQuimicos(verInactivos);
  const { borrar, reactivar, loading: procesando } = useInsumoQuimicoABM();

  const [insumoAEliminar, setInsumoAEliminar] = useState<InsumoQuimico | null>(null);
  const [insumoAReactivar, setInsumoAReactivar] = useState<InsumoQuimico | null>(null);

  const insumosPaginados = useMemo(() => {
    const filtrados = insumos.filter((i) => (verInactivos ? !i.activo : i.activo));
    const start = (page - 1) * PAGE_SIZE;
    return filtrados.slice(start, start + PAGE_SIZE);
  }, [insumos, page, verInactivos]);

  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
  };

  const handleEdit = (insumo: InsumoQuimico) => navigate(`/insumos-quimicos/${insumo.id}/editar`);
  const handleDeleteRequest = (insumo: InsumoQuimico) => setInsumoAEliminar(insumo);
  const handleCloseDeleteDialog = () => { if (!procesando) setInsumoAEliminar(null); };

  const handleConfirmDelete = async () => {
    if (!insumoAEliminar) return;
    try {
      await borrar(insumoAEliminar.id);
      setInsumoAEliminar(null);
      await cargarInsumos();
    } catch {}
  };

  const handleReactivarRequest = (insumo: InsumoQuimico) => setInsumoAReactivar(insumo);
  const handleCloseReactivarDialog = () => { if (!procesando) setInsumoAReactivar(null); };

  const handleConfirmReactivar = async () => {
    if (!insumoAReactivar) return;
    try {
      await reactivar(insumoAReactivar.id, {
        nombre: insumoAReactivar.nombre,
        tipo: insumoAReactivar.tipo,
        unidad_medida: insumoAReactivar.unidad_medida,
      });
      setInsumoAReactivar(null);
      await cargarInsumos();
    } catch {}
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos ? "Insumos Químicos Dados de Baja" : "Gestión de Insumos Químicos"}
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
          onClick={() => navigate("/insumos-quimicos/nuevo")}
        >
          + Agregar 
        </Button>
      </HStack>

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
          <InsumoQuimicoTable
            insumos={insumosPaginados}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={handleReactivarRequest}
          />

          {insumos.filter((i) => (verInactivos ? !i.activo : i.activo)).length > PAGE_SIZE && (
            <Pagination.Root
              count={insumos.filter((i) => (verInactivos ? !i.activo : i.activo)).length}
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

      <DeleteInsumoQuimicoDialog
        isOpen={insumoAEliminar !== null}
        insumo={insumoAEliminar}
        isLoading={procesando}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={insumoAReactivar !== null}
        mensaje={`¿Estás seguro que deseas reactivar el insumo químico ${insumoAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
