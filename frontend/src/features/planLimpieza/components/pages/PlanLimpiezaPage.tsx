import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
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
import { PlanLimpiezaTable } from "../PlanLimpiezaTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePlanesLimpieza } from "../../hooks/usePlanesLimpieza";
import { usePlanLimpiezaABM } from "../../hooks/usePlanLimpiezaABM";
import { useOpcionesPlanLimpieza } from "../../hooks/useOpcionesPlanLimpieza";
import type { PlanLimpieza } from "../../types/planLimpieza";
import { PELIGRO, TEAL, TEXTO_SECUNDARIO } from "../../../../common/theme/tokens";

const PAGE_SIZE = 10;

export function PlanLimpiezaPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { planes, loading, error, cargarPlanes } =
    usePlanesLimpieza(verInactivos);
  const { equipos } = useOpcionesPlanLimpieza();
  const {
    paginados: planesPaginados,
    totalPaginas,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(planes, verInactivos, PAGE_SIZE);
  const { borrar, reactivar, loading: procesando } = usePlanLimpiezaABM();

  const [planAEliminar, setPlanAEliminar] = useState<PlanLimpieza | null>(null);
  const [planAReactivar, setPlanAReactivar] = useState<PlanLimpieza | null>(
    null,
  );


  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
  };

  const handleEdit = (plan: PlanLimpieza) =>
    navigate(`/planes-limpieza/${plan.id}/editar`);
  const handleDeleteRequest = (plan: PlanLimpieza) => setPlanAEliminar(plan);
  const handleCloseDialog = () => {
    if (!procesando) setPlanAEliminar(null);
  };

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

  const handleReactivarRequest = (plan: PlanLimpieza) =>
    setPlanAReactivar(plan);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setPlanAReactivar(null);
  };
  const handleConfirmReactivar = async () => {
    if (!planAReactivar) return;
    try {
      await reactivar(planAReactivar.id, {
        nombre: planAReactivar.nombre,
        tareas: planAReactivar.tareas.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          frecuencia: t.frecuencia,
          descripcion: t.descripcion ?? undefined,
        })),
        equipo_id: planAReactivar.equipo_id,
        autor_id: planAReactivar.autor_id,
      });
      setPlanAReactivar(null);
      await cargarPlanes();
    } catch {
      // El error queda reflejado en usePlanLimpiezaABM().error
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos
            ? "Planes de Limpieza Dados de Baja"
            : "Planes de Limpieza"}
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
          onClick={() => navigate("/planes-limpieza/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      <HStack justify="flex-end" mb="20px">
        <Switch.Root
          checked={verInactivos}
          onCheckedChange={(e) => handleToggleInactivos(e.checked)}
          colorPalette="gray"
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label
            style={{
              fontSize: "14px",
              color: verInactivos ? PELIGRO : TEXTO_SECUNDARIO,
              fontWeight: verInactivos ? "bold" : "normal",
            }}
          >
            Ver dados de baja
          </Switch.Label>
        </Switch.Root>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <PlanLimpiezaTable
            planes={planesPaginados}
            equipos={equipos}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={handleReactivarRequest}
          />

          {hayVariasPaginas && (
            <Pagination.Root
              count={totalPaginas}
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

      <ConfirmDialog
        isOpen={planAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el plan{" "}
            <strong>{planAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={planAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el plan "${planAReactivar?.nombre}"?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
