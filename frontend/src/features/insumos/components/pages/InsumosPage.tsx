import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box, Button, Heading, HStack, Spinner } from "@chakra-ui/react";
import { InsumoTable } from "../InsumoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useInsumos } from "../../hooks/useInsumos";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import type { Insumo } from "../../types/insumo";
import { BannerError, Paginacion, ToggleInactivos } from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function InsumosPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { insumos, loading, error, cargarInsumos } = useInsumos(verInactivos);
  const { borrar, reactivar, loading: procesando } = useInsumoABM();
  const {
    paginados: insumosPaginados,
    totalPaginas,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(insumos, verInactivos, PAGE_SIZE);

  const [insumoAEliminar, setInsumoAEliminar] = useState<Insumo | null>(null);
  const [insumoAReactivar, setInsumoAReactivar] = useState<Insumo | null>(null);

  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
  };

  const handleEdit = (insumo: Insumo) =>
    navigate(`/insumos/${insumo.id}/editar`);
  const handleDeleteRequest = (insumo: Insumo) =>
    setInsumoAEliminar(insumo);
  const handleCloseDeleteDialog = () => {
    if (!procesando) setInsumoAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!insumoAEliminar) return;
    try {
      await borrar(insumoAEliminar.id);
      setInsumoAEliminar(null);
      await cargarInsumos();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  const handleReactivarRequest = (insumo: Insumo) =>
    setInsumoAReactivar(insumo);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setInsumoAReactivar(null);
  };

  const handleConfirmReactivar = async () => {
    if (!insumoAReactivar) return;
    try {
      await reactivar(insumoAReactivar.id, {
        nombre: insumoAReactivar.nombre,
        unidad_medida_id: insumoAReactivar.unidad_medida_id,
      });
      setInsumoAReactivar(null);
      await cargarInsumos();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          {verInactivos ? "Insumos Dados de Baja" : "Gestión de Insumos"}
        </Heading>
        <Button
          colorPalette="brand"
          fontSize="md"
          fontWeight="bold"
          rounded="md"
          px="5"
          py="2.5"
          onClick={() => navigate("/insumos/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>


      <ToggleInactivos
        checked={verInactivos}
        
         onChange={handleToggleInactivos}
         children="Ver dados de baja"
      />

      {error && <BannerError>{error}</BannerError>}
      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          <InsumoTable
            insumos={insumosPaginados}
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
        isOpen={insumoAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el insumo{" "}
            <strong>{insumoAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={insumoAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el insumo ${insumoAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}