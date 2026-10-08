import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box, Button, Heading, HStack, Spinner } from "@chakra-ui/react";
import { InsumoQuimicoTable } from "../InsumoQuimicoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useInsumosQuimicos } from "../../hooks/useInsumosQuimicos";
import { useInsumoQuimicoABM } from "../../hooks/useInsumoQuimicoABM";
import type { InsumoQuimico } from "../../types/insumoQuimico";
import { BannerError, Paginacion, ToggleInactivos } from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function InsumosQuimicosPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { insumos, loading, error, cargarInsumos } =
    useInsumosQuimicos(verInactivos);
  const { borrar, reactivar, loading: procesando } = useInsumoQuimicoABM();
  const {
    paginados: insumosPaginados,
    totalPaginas,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(insumos, verInactivos, PAGE_SIZE);

  const [insumoAEliminar, setInsumoAEliminar] =
    useState<InsumoQuimico | null>(null);
  const [insumoAReactivar, setInsumoAReactivar] =
    useState<InsumoQuimico | null>(null);

  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
  };

  const handleEdit = (insumo: InsumoQuimico) =>
    navigate(`/insumos-quimicos/${insumo.id}/editar`);
  const handleDeleteRequest = (insumo: InsumoQuimico) =>
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

  const handleReactivarRequest = (insumo: InsumoQuimico) =>
    setInsumoAReactivar(insumo);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setInsumoAReactivar(null);
  };

  const handleConfirmReactivar = async () => {
    if (!insumoAReactivar) return;
    try {
      await reactivar(insumoAReactivar.id, {
        nombre: insumoAReactivar.nombre,
        tipo: insumoAReactivar.tipo,
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
          {verInactivos
            ? "Insumos Químicos Dados de Baja"
            : "Gestión de Insumos Químicos"}
        </Heading>
        <Button
          colorPalette="brand"
          fontSize="md"
          fontWeight="bold"
          rounded="md"
          px="5"
          py="2.5"
          onClick={() => navigate("/insumos-quimicos/nuevo")}
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
          <InsumoQuimicoTable
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
            ¿Está seguro que desea eliminar el insumo químico{" "}
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
        mensaje={`¿Está seguro que desea reactivar el insumo químico ${insumoAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
