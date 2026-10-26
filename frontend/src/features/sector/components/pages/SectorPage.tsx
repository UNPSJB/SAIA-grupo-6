import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { SectorTable } from "../SectorTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useSectores } from "../../hooks/useSectores";
import { useSectorABM } from "../../hooks/useSectorABM";
import type { Sector } from "../../types/sector";
import {
  BannerError,
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function SectorPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const { sectores, loading, error, cargarSectores } = useSectores(verInactivos);
  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useSectorABM();
  const {
    paginados: sectoresPaginados,
    totalFiltrados,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(sectores, verInactivos, PAGE_SIZE);

  const [sectorAEliminar, setSectorAEliminar] = useState<Sector | null>(null);
  const [sectorAReactivar, setSectorAReactivar] = useState<Sector | null>(null);

  const handleEdit = (sector: Sector) => navigate(`/sectores/${sector.id}/editar`);
  const handleDeleteRequest = (sector: Sector) => setSectorAEliminar(sector);
  const handleCloseDeleteDialog = () => { if (!procesando) setSectorAEliminar(null); };

  const handleConfirmDelete = async () => {
    if (!sectorAEliminar) return;
    try {
      await borrar(sectorAEliminar.id);
      setSectorAEliminar(null);
      await cargarSectores();
    } catch {
      setSectorAEliminar(null);
    }
  };

  const handleReactivarRequest = (sector: Sector) => setSectorAReactivar(sector);
  const handleCloseReactivarDialog = () => { if (!procesando) setSectorAReactivar(null); };

  const handleConfirmReactivar = async () => {
    if (!sectorAReactivar) return;
    try {
      await reactivar(sectorAReactivar.id, {
        nombre: sectorAReactivar.nombre,
        descripcion: sectorAReactivar.descripcion,
      });
      setSectorAReactivar(null);
      await cargarSectores();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={verInactivos ? "Sectores dados de baja" : "Gestión de sectores"}
        description="Alta, modificación y baja de los sectores de la planta."
        actions={
          <Button colorPalette="brand" onClick={() => navigate("/sectores/nuevo")}>
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
          <SectorTable
            sectores={sectoresPaginados}
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
        isOpen={sectorAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el sector{" "}
            <strong>{sectorAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={sectorAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el sector ${sectorAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}