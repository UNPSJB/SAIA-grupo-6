import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import {
  BannerError,
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";
import { useProveedorABM } from "../../hooks/useProveedorABM";
import { useProveedores } from "../../hooks/useProveedores";
import type { Proveedor } from "../../types/proveedor";
import { ProveedorTable } from "../ProveedorTable";

const PAGE_SIZE = 10;

export function ProveedorPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const { proveedores, loading, error, cargarProveedores } = useProveedores(verInactivos);
  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useProveedorABM();
  const {
    paginados: proveedoresPaginados,
    totalFiltrados,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(proveedores, verInactivos, PAGE_SIZE);

  const [proveedorAEliminar, setProveedorAEliminar] = useState<Proveedor | null>(null);
  const [proveedorAReactivar, setProveedorAReactivar] = useState<Proveedor | null>(null);

  const handleEdit = (proveedor: Proveedor) => navigate(`/proveedores/${proveedor.id}/editar`);
  const handleDeleteRequest = (proveedor: Proveedor) => setProveedorAEliminar(proveedor);
  const handleCloseDeleteDialog = () => {
    if (!procesando) setProveedorAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!proveedorAEliminar) return;
    try {
      await borrar(proveedorAEliminar.id);
      setProveedorAEliminar(null);
      await cargarProveedores();
    } catch {
      setProveedorAEliminar(null);
    }
  };

  const handleReactivarRequest = (proveedor: Proveedor) => setProveedorAReactivar(proveedor);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setProveedorAReactivar(null);
  };

  const handleConfirmReactivar = async () => {
    if (!proveedorAReactivar) return;
    try {
      await reactivar(proveedorAReactivar.id, {
        nombre: proveedorAReactivar.nombre,
        matricula: proveedorAReactivar.matricula,
      });
      setProveedorAReactivar(null);
      await cargarProveedores();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={verInactivos ? "Proveedores dados de baja" : "Gestión de proveedores"}
        description="Alta, modificación y baja de los proveedores de insumos químicos."
        actions={
          <Button colorPalette="brand" onClick={() => navigate("/proveedores/nuevo")}>
            + Agregar
          </Button>
        }
      />

      {errorEliminar && <BannerError>{errorEliminar}</BannerError>}
      {error && <BannerError>{error}</BannerError>}

      <ToggleInactivos
        checked={verInactivos}
        onChange={(checked: boolean) => {
          setVerInactivos(checked);
          setPage(1);
        }}
        children="Ver dados de baja"
      />

      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          <ProveedorTable
            proveedores={proveedoresPaginados}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={handleReactivarRequest}
          />

          {hayVariasPaginas && (
            <Paginacion
              count={totalFiltrados}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={proveedorAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el proveedor <strong>{proveedorAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={proveedorAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el proveedor ${proveedorAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
