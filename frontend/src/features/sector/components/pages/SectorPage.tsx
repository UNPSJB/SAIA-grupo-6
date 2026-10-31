import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { SectorTable } from "../SectorTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useSectoresPaginadas } from "../../hooks/useSectoresPaginadas";
import { useSectorABM } from "../../hooks/useSectorABM";
import type { Sector } from "../../types/sector";
import type { ColumnaOrdenSector } from "../../services/sectorService";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
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

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const orden = useOrdenTabla<ColumnaOrdenSector, "nombre_asc">("nombre_asc");

  const {
    sectores,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarSectores,
  } = useSectoresPaginadas(
    {
      incluirInactivos: verInactivos,
      buscar: busquedaAplicada,
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useSectorABM();

  const [sectorAEliminar, setSectorAEliminar] = useState<Sector | null>(null);
  const [sectorAReactivar, setSectorAReactivar] = useState<Sector | null>(null);

  const limpiarTodo = () => {
    setBusqueda("");
    orden.reiniciar();
  };

  const hayFiltros = busqueda.trim() !== "";

  const ETIQUETAS_ORDEN: Record<ColumnaOrdenSector, string> = {
    nombre: "Nombre",
    descripcion: "Descripción",
  };

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => setBusqueda(""),
    },
    {
      clave: "orden",
      etiqueta: "Orden",
      valor:
        orden.columna !== null
          ? `${ETIQUETAS_ORDEN[orden.columna]} ${
              orden.direccion === "asc" ? "↑" : "↓"
            }`
          : "",
      visible: orden.columna !== null,
      onQuitar: orden.reiniciar,
    },
  ]);

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
          // El hook de listado vuelve solo a la página 1 cuando cambia el filtro.
          setVerInactivos(checked);
        }}
        children="Ver dados de baja"
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por nombre o descripción..."
          />
        }
        filtros={null}
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          {hayFiltros && sectores.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay sectores que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <SectorTable
              sectores={sectores}
              orden={orden}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onReactivar={handleReactivarRequest}
            />
          )}

          {hayVariasPaginas && (
            <Paginacion
              count={total}
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
