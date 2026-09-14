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
} from "@chakra-ui/react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { InsumoTable } from "../insumoTable";
import { DeleteInsumoDialog } from "../DeleteInsumoDialog";
import { useInsumos } from "../../hooks/useInsumos";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import type { Insumo } from "../../types/insumo";

const TEAL = "#468189";
const PAGE_SIZE = 10;

export function InsumosPage() {
  const navigate = useNavigate();
  const { insumos, loading, error, cargarInsumos } = useInsumos();
  const { borrar, loading: borrando } = useInsumoABM();

  const [insumoAEliminar, setInsumoAEliminar] = useState<Insumo | null>(null);
  const [page, setPage] = useState(1);

  const insumosPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return insumos.slice(start, start + PAGE_SIZE);
  }, [insumos, page]);

  const handleEdit = (insumo: Insumo) => {
    navigate(`/insumos/${insumo.id}/editar`);
  };

  const handleDeleteRequest = (insumo: Insumo) => {
    setInsumoAEliminar(insumo);
  };

  const handleCloseDialog = () => {
    if (borrando) return;
    setInsumoAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!insumoAEliminar) return;

    try {
      await borrar(insumoAEliminar.id);
      setInsumoAEliminar(null);
      await cargarInsumos();
    } catch {
      // El error ya queda reflejado en useInsumoABM().error
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Gestión de Insumos
        </Heading>
        <Button
          bg={TEAL}
          color="white"
          fontSize="16px"
          fontWeight="bold"
          borderRadius="6px"
          px="20px"
          py="10px"
          _hover={{ bg: TEAL }}
          onClick={() => navigate("/insumos/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {loading && <Spinner />}

      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <InsumoTable
            insumos={insumosPaginados}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />

          {insumos.length > PAGE_SIZE && (
            <Pagination.Root
              count={insumos.length}
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
                          _hover={{
                            bg: isSelected ? TEAL : `${TEAL}1A`,
                          }}
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

      <DeleteInsumoDialog
        isOpen={insumoAEliminar !== null}
        insumo={insumoAEliminar}
        isLoading={borrando}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}
