import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { AptitudTable } from "../AptitudTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useAptitudes } from "../../hooks/useAptitudes";
import { useAptitudABM } from "../../hooks/useAptitudABM";
import type { Aptitud } from "../../types/aptitud";
import {
  BannerError,
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function AptitudPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const { aptitudes, loading, error, cargarAptitudes } = useAptitudes(verInactivos);
  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useAptitudABM();
  // Filtro de baja lógica + paginación en memoria, igual que el resto de los
  // catálogos (equipos, personal, insumos, ...): la tabla recibía la lista
  // entera y crecía sin límite hacia abajo.
  const {
    paginados: aptitudesPaginadas,
    totalFiltrados,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(aptitudes, verInactivos, PAGE_SIZE);

  const [aptitudAEliminar, setAptitudAEliminar] = useState<Aptitud | null>(null);
  const [aptitudAReactivar, setAptitudAReactivar] = useState<Aptitud | null>(null);

  const handleEdit = (aptitud: Aptitud) => navigate(`/aptitudes/${aptitud.id}/editar`);
  const handleDeleteRequest = (aptitud: Aptitud) => setAptitudAEliminar(aptitud);
  const handleCloseDeleteDialog = () => { if (!procesando) setAptitudAEliminar(null); };

  const handleConfirmDelete = async () => {
    if (!aptitudAEliminar) return;
    try {
      await borrar(aptitudAEliminar.id);
      setAptitudAEliminar(null);
      await cargarAptitudes();
    } catch {
      setAptitudAEliminar(null);
    }
  };

  const handleReactivarRequest = (aptitud: Aptitud) => setAptitudAReactivar(aptitud);
  const handleCloseReactivarDialog = () => { if (!procesando) setAptitudAReactivar(null); };

  const handleConfirmReactivar = async () => {
    if (!aptitudAReactivar) return;
    try {
      await reactivar(aptitudAReactivar.id, {
        nombre: aptitudAReactivar.nombre,
        descripcion: aptitudAReactivar.descripcion,
      });
      setAptitudAReactivar(null);
      await cargarAptitudes();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={verInactivos ? "Aptitudes dadas de baja" : "Gestión de aptitudes"}
        description="Alta, modificación y baja de las aptitudes del laboratorio."
        actions={
          <Button colorPalette="brand" onClick={() => navigate("/aptitudes/nuevo")}>
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
          // Al cambiar el filtro la página 1 siempre es válida: evita quedar
          // parado en una página que ya no existe.
          setPage(1);
        }}
        children="Ver dadas de baja"
      />

      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          <AptitudTable
            aptitudes={aptitudesPaginadas}
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
        isOpen={aptitudAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar la aptitud{" "}
            <strong>{aptitudAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={aptitudAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar la aptitud ${aptitudAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
