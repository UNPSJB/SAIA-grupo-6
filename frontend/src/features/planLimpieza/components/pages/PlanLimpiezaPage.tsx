import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, ButtonGroup, Heading, HStack, IconButton, Pagination, Spinner, Text } from "@chakra-ui/react";
import { PlanLimpiezaTable } from "../PlanLimpiezaTable";
import { DeletePlanLimpiezaDialog } from "../DeletePlanLimpiezaDialog";
import { usePlanesLimpieza } from "../../hooks/usePlanesLimpieza";
import { usePlanLimpiezaABM } from "../../hooks/usePlanLimpiezaABM";
import { useOpcionesPlanLimpieza } from "../../hooks/useOpcionesPlanLimpieza";
import type { PlanLimpieza } from "../../types/planLimpieza";

const TEAL = "#468189";
const PAGE_SIZE = 10;

export function PlanLimpiezaPage() {
  const navigate = useNavigate();
  const { planes, loading, error, cargarPlanes } = usePlanesLimpieza();
  const { equipos } = useOpcionesPlanLimpieza();
  const { borrar, loading: borrando } = usePlanLimpiezaABM();

  const [planAEliminar, setPlanAEliminar] = useState<PlanLimpieza | null>(null);
  const [page, setPage] = useState(1);

  const planesPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return planes.slice(start, start + PAGE_SIZE);
  }, [planes, page]);

  const handleEdit = (plan: PlanLimpieza) => navigate(`/planes-limpieza/${plan.id}/editar`);
  const handleDeleteRequest = (plan: PlanLimpieza) => setPlanAEliminar(plan);
  const handleCloseDialog = () => { if (!borrando) setPlanAEliminar(null); };

  const handleConfirmDelete = async () => {
    if (!planAEliminar) return;
    try {
      await borrar(planAEliminar.id);
      setPlanAEliminar(null);
      await cargarPlanes();
    } catch {
      // El error queda reflejado en usePlanLimpiezaABM().error
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">Planes de Limpieza</Heading>
        <Button bg={TEAL} color="white" fontSize="16px" fontWeight="bold" borderRadius="6px" px="20px" py="10px" _hover={{ bg: TEAL }} onClick={() => navigate("/planes-limpieza/nuevo")}>
          + Agregar
        </Button>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <PlanLimpiezaTable planes={planesPaginados} equipos={equipos} onEdit={handleEdit} onDelete={handleDeleteRequest} />

          {planes.length > PAGE_SIZE && (
            <Pagination.Root count={planes.length} pageSize={PAGE_SIZE} page={page} onPageChange={(e) => setPage(e.page)} mt="16px">
              <HStack justify="center">
                <ButtonGroup variant="ghost" size="sm">
                  <Pagination.Items render={(pageItem) => {
                      const isSelected = pageItem.value === page;
                      return (
                        <IconButton aria-label={`Página ${pageItem.value}`} bg={isSelected ? TEAL : "transparent"} color={isSelected ? "white" : TEAL} border={isSelected ? "none" : `1px solid ${TEAL}`} _hover={{ bg: isSelected ? TEAL : `${TEAL}1A` }}>
                          {pageItem.value}
                        </IconButton>
                      );
                  }} />
                </ButtonGroup>
              </HStack>
            </Pagination.Root>
          )}
        </>
      )}

      <DeletePlanLimpiezaDialog isOpen={planAEliminar !== null} plan={planAEliminar} isLoading={borrando} onClose={handleCloseDialog} onConfirm={handleConfirmDelete} />
    </Box>
  );
}
