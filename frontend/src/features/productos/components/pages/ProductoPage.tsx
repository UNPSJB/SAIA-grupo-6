import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Spinner } from "@chakra-ui/react";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
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
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";
import { useProductoABM } from "../../hooks/useProductoABM";
import { useProductos } from "../../hooks/useProductos";
import type { Producto } from "../../types/producto";
import { ProductoTable } from "../ProductoTable";

const PAGE_SIZE = 10;

export function ProductoPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);

  const { productos, loading, error, cargarProductos } = useProductos(
    verInactivos,
    busquedaAplicada,
  );
  const { borrar, reactivar, loading: procesando, error: errorABM } = useProductoABM();
  const {
    paginados,
    totalFiltrados,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(productos, verInactivos, PAGE_SIZE);

  const [aEliminar, setAEliminar] = useState<Producto | null>(null);
  const [aReactivar, setAReactivar] = useState<Producto | null>(null);

  const limpiarTodo = () => {
    setBusqueda("");
    setPage(1);
  };

  const chips = chipsDeFiltros([
    { clave: "busqueda", etiqueta: "Búsqueda", valor: busqueda, recortar: true, onQuitar: limpiarTodo },
  ]);

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      await borrar(aEliminar.id);
      setAEliminar(null);
      await cargarProductos();
    } catch {
      setAEliminar(null);
    }
  };

  const confirmarReactivar = async () => {
    if (!aReactivar) return;
    try {
      await reactivar(aReactivar.id);
      setAReactivar(null);
      await cargarProductos();
    } catch {
      // El hook expone el error.
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={verInactivos ? "Productos dados de baja" : "Gestión de productos"}
        description="Productos que se elaboran. Cada uno tiene una receta con versiones."
        actions={
          <BotonAgregar onClick={() => navigate("/productos/nuevo")}>Agregar</BotonAgregar>
        }
      />

      {errorABM && <BannerError>{errorABM}</BannerError>}
      {error && <BannerError>{error}</BannerError>}

      <ToggleInactivos
        checked={verInactivos}
        onChange={(checked: boolean) => {
          setVerInactivos(checked);
          setPage(1);
        }}
      >
        Ver dados de baja
      </ToggleInactivos>

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={(valor) => {
              setBusqueda(valor);
              setPage(1);
            }}
            placeholder="Buscar por nombre..."
          />
        }
        filtros={null}
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          {busqueda.trim() !== "" && productos.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay productos que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <ProductoTable
              productos={paginados}
              onEdit={(p) => navigate(`/productos/${p.id}/editar`)}
              onDelete={setAEliminar}
              onReactivar={setAReactivar}
            />
          )}

          {hayVariasPaginas && (
            <Paginacion count={totalFiltrados} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={aEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el producto <strong>{aEliminar?.nombre}</strong>?
          </>
        }
        mensaje="El producto se da de baja: sus lotes y su receta se conservan."
        isLoading={procesando}
        onCancel={() => !procesando && setAEliminar(null)}
        onConfirm={confirmarEliminar}
      />

      <ConfirmarReactivacionDialog
        isOpen={aReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el producto ${aReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={() => !procesando && setAReactivar(null)}
        onConfirm={confirmarReactivar}
      />
    </Box>
  );
}
