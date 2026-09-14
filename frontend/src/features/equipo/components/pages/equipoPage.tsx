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
import { EquipoTable } from "../equipoTable";
import { DeleteEquipoDialog } from "../DeleteEquipoDialog";
import { useEquipos } from "../../hooks/useEquipos";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import type { Equipo } from "../../types/equipo";

const TEAL = "#468189";
const PAGE_SIZE = 10;

export function EquiposPage() {
  const navigate = useNavigate();
  const { equipos, loading, error, cargarEquipos } = useEquipos();
  const { borrar, loading: borrando } = useEquipoABM();

  const [equipoAEliminar, setEquipoAEliminar] = useState<Equipo | null>(null);
  const [page, setPage] = useState(1);

  const equiposPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return equipos.slice(start, start + PAGE_SIZE);
  }, [equipos, page]);

  const handleEdit = (equipo: Equipo) => {
    navigate(`/equipos/${equipo.id}/editar`);
  };

  const handleDeleteRequest = (equipo: Equipo) => {
    setEquipoAEliminar(equipo);
  };

  const handleCloseDialog = () => {
    if (borrando) return;
    setEquipoAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!equipoAEliminar) return;

    try {
      await borrar(equipoAEliminar.id);
      setEquipoAEliminar(null);
      await cargarEquipos();
    } catch {
      // El error ya queda reflejado en useEquipoABM().error
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        {/* size="md" = 24px, como el <h2> por defecto del navegador */}
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Gestión de Equipos
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
          onClick={() => navigate("/equipos/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {loading && <Spinner />}

      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <EquipoTable
            equipos={equiposPaginados}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />

          {equipos.length > PAGE_SIZE && (
            <Pagination.Root
              count={equipos.length}
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

      <DeleteEquipoDialog
        isOpen={equipoAEliminar !== null}
        equipo={equipoAEliminar}
        isLoading={borrando}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}
