import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@chakra-ui/react";
import { InsumoTable } from "../InsumoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useInsumos } from "../../hooks/useInsumos";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import type { Insumo, TipoInsumo } from "../../types/insumo";
import type { ColumnaOrdenInsumo } from "../../services/insumoService";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import { listarUnidadesMedida } from "../../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../../unidadMedida/types/unidadMedida";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BotonAgregar,
  BannerError,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";
import { Pagina, PestanasPagina } from "../../../../components/ui/plantillas";
import { TabAditivos, TabClases } from "../../../aditivos/components/pages/AditivosPage";
import { BotonExportar } from "../../../../features/exportacion";
import { useProveedores } from "../../../proveedores/hooks/useProveedores";

const PAGE_SIZE = 10;

/** Pestaña "Insumos": el catálogo de insumos y productos. */
function TabInsumos() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [unidadId, setUnidadId] = useState("");
  const [tipo, setTipo] = useState<TipoInsumo | "">("");
  const [proveedorId, setProveedorId] = useState("");
  const { proveedores } = useProveedores(false);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const orden = useOrdenTabla<ColumnaOrdenInsumo, "nombre_asc">("nombre_asc");

  const {
    insumos,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarInsumos,
  } = useInsumos(
    {
      soloInactivos: verInactivos,
      buscar: busquedaAplicada,
      unidadMedidaId: unidadId ? Number(unidadId) : undefined,
      tipo: tipo || undefined,
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  const { borrar, reactivar, loading: procesando } = useInsumoABM();

  const [insumoAEliminar, setInsumoAEliminar] = useState<Insumo | null>(null);
  const [insumoAReactivar, setInsumoAReactivar] = useState<Insumo | null>(null);

  // Unidades para el select de filtro: es el catálogo completo (pocas filas),
  // no la página de la tabla.
  useEffect(() => {
    const cargarUnidades = async () => {
      try {
        setUnidades(await listarUnidadesMedida(false));
      } catch (err) {
        console.error("Error al cargar unidades de medida:", err);
      }
    };
    void cargarUnidades();
  }, []);

  const handleToggleInactivos = (checked: boolean) => {
    // El hook de listado vuelve solo a la página 1 cuando cambia el filtro.
    setVerInactivos(checked);
  };

  const limpiarTodo = () => {
    setBusqueda("");
    setUnidadId("");
    setTipo("");
    setProveedorId("");
    orden.reiniciar();
  };

  const hayFiltros = busqueda.trim() !== "" || unidadId !== "" || tipo !== "" || proveedorId !== "";

  const ETIQUETAS_ORDEN: Record<ColumnaOrdenInsumo, string> = {
    nombre: "Nombre",
    unidad: "Unidad",
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
      clave: "tipo",
      etiqueta: "Tipo",
      valor: tipo === "aditivo" ? "Aditivos" : tipo === "ingrediente" ? "Ingredientes" : "",
      onQuitar: () => setTipo(""),
    },
    {
      clave: "proveedor",
      etiqueta: "Proveedor",
      valor: proveedores.find((p) => String(p.id) === proveedorId)?.nombre ?? "",
      onQuitar: () => setProveedorId(""),
    },
    {
      clave: "unidad",
      etiqueta: "Unidad",
      valor: unidades.find((u) => String(u.id) === unidadId)?.nombre ?? unidadId,
      onQuitar: () => setUnidadId(""),
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
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por nombre o unidad..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Tipo"
              valor={tipo}
              onCambio={(valor) => setTipo(valor as TipoInsumo | "")}
              opciones={[
                { valor: "ingrediente", etiqueta: "Ingredientes" },
                { valor: "aditivo", etiqueta: "Aditivos" },
              ]}
              todos="Todos los tipos"
            />
            <FiltroSelect
              label="Proveedor"
              valor={proveedorId}
              onCambio={setProveedorId}
              opciones={proveedores.map((proveedor) => ({ valor: String(proveedor.id), etiqueta: proveedor.nombre }))}
              todos="Todos"
            />
            <FiltroSelect
              label="Unidad de medida"
              valor={unidadId}
              onCambio={setUnidadId}
              opciones={unidades.map((unidad) => ({
                valor: String(unidad.id),
                etiqueta: `${unidad.nombre} (${unidad.simbolo})`,
              }))}
              todos="Todas"
            />
          </>
        }
        herramientas={
          <>
            {/* Dentro de una pestaña, el alta va en la barra (como en Aditivos). */}
            <BotonAgregar onClick={() => navigate("/insumos/nuevo")}>Nuevo insumo</BotonAgregar>
            <ToggleInactivos
              enBarra
              checked={verInactivos}
              onChange={handleToggleInactivos}
              children="Ver dados de baja"
            />
            <BotonExportar
              nombreTabla="insumos"
              filtros={{
                activo: String(!verInactivos),
                buscar: busquedaAplicada,
                tipo: tipo || undefined,
                unidad_id: unidadId || undefined,
                proveedor_id: proveedorId || undefined,
              }}
            />
          </>
        }
      />

     

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          {hayFiltros && insumos.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay insumos ni productos que coincidan con los filtros
              aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <InsumoTable
              insumos={insumos}
              orden={orden}
              onEdit={handleEdit}
              onNutricion={(insumo) => navigate(`/insumos/${insumo.id}/nutricion`)}
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
    </>
  );
}

/**
 * Insumos, con los aditivos como sub-opción: antes "Aditivos" era una entrada
 * aparte del menú de Inventario, aunque un aditivo es un tipo de insumo. Ahora
 * son pestañas de esta pantalla, con la misma lengüeta y barrido que el resto
 * de las sub-pestañas (`PestanasPagina`). `/aditivos` redirige acá.
 */
export function InsumosPage() {
  return (
    <Pagina
      titulo="Insumos"
      descripcion="Alta, modificación y baja de insumos y productos del laboratorio, y la lista de referencia de aditivos."
    >
      <PestanasPagina
        pestanas={[
          { valor: "insumos", etiqueta: "Insumos", contenido: <TabInsumos /> },
          { valor: "aditivos", etiqueta: "Aditivos", contenido: <TabAditivos /> },
          { valor: "clases", etiqueta: "Clases funcionales", contenido: <TabClases /> },
        ]}
      />
    </Pagina>
  );
}