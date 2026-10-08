import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box, Button, Heading, HStack, Spinner } from "@chakra-ui/react";
import { UnidadMedidaTable } from "../UnidadMedidaTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useUnidadesMedida } from "../../hooks/useUnidadesMedida";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import type { UnidadMedida } from "../../types/unidadMedida";
import {
  BannerError,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function UnidadMedidaPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { unidades, loading, error, cargarUnidades } = useUnidadesMedida(verInactivos);
  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useUnidadMedidaABM();
  const {
    paginados: unidadesPaginadas,
    totalPaginas,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(unidades, verInactivos, PAGE_SIZE);

  const [unidadAEliminar, setUnidadAEliminar] = useState<UnidadMedida | null>(null);
  const [unidadAReactivar, setUnidadAReactivar] = useState<UnidadMedida | null>(null);


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
    <Box p="5">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          {verInactivos ? "Unidades de Medida Dados de Baja" : "Gestión de Unidades de Medida"}
        </Heading>
        <Button
          colorPalette="brand"
          fontSize="md"
          fontWeight="bold"
          rounded="md"
          px="5"
          py="2.5"
          onClick={() => navigate("/unidades-medida/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {/* Cartel rojo de error (cuando se intenta eliminar una unidad en uso) */}
      {errorEliminar && <BannerError>{errorEliminar}</BannerError>}

      <ToggleInactivos
        checked={verInactivos}
        onChange={handleToggleInactivos}
        children="Ver dadas de baja"
      />

      {loading && <Spinner color="brand.500" />}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && (
        <>
          <UnidadMedidaTable
            unidades={unidadesPaginadas}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={handleReactivarRequest}
          />

          {hayVariasPaginas && (
            <Paginacion
              count={totalPaginas}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={unidadAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar la unidad de medida{" "}
            <strong>{unidadAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={unidadAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar la unidad de medida ${unidadAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
