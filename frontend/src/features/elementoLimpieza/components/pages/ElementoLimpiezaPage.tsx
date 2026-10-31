import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { ElementoLimpiezaTable } from "../ElementoLimpiezaTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useElementosLimpieza } from "../../hooks/useElementosLimpieza";
import { useElementoLimpiezaABM } from "../../hooks/useElementoLimpiezaABM";
import type { ElementoLimpieza } from "../../types/elementoLimpieza";
import type { ColumnaOrdenElemento } from "../../services/elementoLimpiezaService";
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
  BotonAgregar,
  EstadoCargando,
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function ElementosLimpiezaPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const orden = useOrdenTabla<ColumnaOrdenElemento, "nombre_asc">("nombre_asc");

  const {
    elementosLimpieza,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarElementosLimpieza,
  } = useElementosLimpieza(
    {
      incluirInactivos: verInactivos,
      buscar: busquedaAplicada,
      orden: orden.orden,
    },
    PAGE_SIZE
  );

  const { borrar, reactivar, loading: procesando } = useElementoLimpiezaABM();

  const [elementoAEliminar, setElementoAEliminar] =
    useState<ElementoLimpieza | null>(null);
  const [elementoAReactivar, setElementoAReactivar] =
    useState<ElementoLimpieza | null>(null);

  const handleToggleInactivos = (checked: boolean) => {
    // El hook de listado vuelve solo a la página 1 cuando cambia el filtro.
    setVerInactivos(checked);
  };

  const limpiarTodo = () => {
    setBusqueda("");
    orden.reiniciar();
  };

  const hayFiltros = busqueda.trim() !== "";

  const ETIQUETAS_ORDEN: Record<ColumnaOrdenElemento, string> = {
    nombre: "Nombre",
    ultimo_recambio: "Último recambio",
    frecuencia: "Frecuencia",
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

  const handleConfirmReactivar = async () => {
    if (!elementoAReactivar) return;
    try {
      await reactivar(elementoAReactivar.id);
      setElementoAReactivar(null);
      await cargarElementosLimpieza();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  const handleEdit = (elemento: ElementoLimpieza) => {
    navigate(`/elementos-limpieza/${elemento.id}/editar`);
  };

  const handleDeleteRequest = (elemento: ElementoLimpieza) => {
    setElementoAEliminar(elemento);
  };

  const handleCloseDeleteDialog = () => {
    if (procesando) return;
    setElementoAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!elementoAEliminar) return;
    try {
      await borrar(elementoAEliminar.id);
      setElementoAEliminar(null);
      await cargarElementosLimpieza();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={
          verInactivos
            ? "Elementos de limpieza dados de baja"
            : "Gestión de elementos de limpieza"
        }
        description="Productos de limpieza con su frecuencia de recambio."
        actions={
          <BotonAgregar onClick={() => navigate("/elementos-limpieza/nuevo")}>
            Agregar
          </BotonAgregar>
        }
      />

      <ToggleInactivos
        checked={verInactivos}
        onChange={handleToggleInactivos}
        children="Ver dados de baja"
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por nombre..."
          />
        }
        filtros={null}
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando>Cargando elementos...</EstadoCargando>}

      {!loading && !error && (
        <>
          {hayFiltros && elementosLimpieza.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay elementos de limpieza que coincidan con los filtros
              aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <ElementoLimpiezaTable
              elementos={elementosLimpieza}
              orden={orden}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onReactivar={(elemento) => setElementoAReactivar(elemento)}
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
        isOpen={elementoAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el elemento{" "}
            <strong>{elementoAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={elementoAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el elemento de limpieza ${elementoAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={() => {
          if (!procesando) setElementoAReactivar(null);
        }}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
