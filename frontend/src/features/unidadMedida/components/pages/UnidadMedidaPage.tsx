import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { UnidadMedidaTable } from "../UnidadMedidaTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useUnidadesMedida } from "../../hooks/useUnidadesMedida";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import type { UnidadMedida } from "../../types/unidadMedida";
import type { ColumnaOrdenUnidadMedida } from "../../services/unidadMedidaService";
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

export function UnidadMedidaPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const orden = useOrdenTabla<ColumnaOrdenUnidadMedida, "nombre_asc">(
    "nombre_asc"
  );

  const {
    unidades,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarUnidades,
  } = useUnidadesMedida(
    {
      incluirInactivos: verInactivos,
      buscar: busquedaAplicada,
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useUnidadMedidaABM();

  const [unidadAEliminar, setUnidadAEliminar] = useState<UnidadMedida | null>(null);
  const [unidadAReactivar, setUnidadAReactivar] = useState<UnidadMedida | null>(null);


  const handleToggleInactivos = (checked: boolean) => {
    // El hook de listado vuelve solo a la página 1 cuando cambia el filtro.
    setVerInactivos(checked);
  };

  const limpiarTodo = () => {
    setBusqueda("");
    orden.reiniciar();
  };

  const hayFiltros = busqueda.trim() !== "";

  const ETIQUETAS_ORDEN: Record<ColumnaOrdenUnidadMedida, string> = {
    nombre: "Nombre",
    simbolo: "Símbolo",
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
      <PageHeader
        title={
          verInactivos
            ? "Unidades de medida dadas de baja"
            : "Gestión de unidades de medida"
        }
        description="Catálogo de unidades con las que se miden los insumos."
        actions={
          <Button
            colorPalette="brand"
            onClick={() => navigate("/unidades-medida/nuevo")}
          >
            + Agregar
          </Button>
        }
      />

      {/* Cartel rojo de error (cuando se intenta eliminar una unidad en uso) */}
      {errorEliminar && <BannerError>{errorEliminar}</BannerError>}

      <ToggleInactivos
        checked={verInactivos}
        onChange={handleToggleInactivos}
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por nombre o símbolo..."
          />
        }
        filtros={null}
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <Spinner color="brand.500" />}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && (
        <>
          {hayFiltros && unidades.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay unidades de medida que coincidan con los filtros
              aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <UnidadMedidaTable
              unidades={unidades}
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
