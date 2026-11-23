import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@chakra-ui/react";
import { IngredienteTable } from "../IngredienteTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useIngredientes } from "../../hooks/useIngredientes";
import { useIngredienteABM } from "../../hooks/useIngredienteABM";
import type { Ingrediente } from "../../types/ingrediente";
import type { ColumnaOrdenIngrediente } from "../../services/ingredienteService";
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
import { TabClases } from "../../../aditivos/components/pages/AditivosPage";
import { TabAlergenos } from "../../../alergenos/components/TabAlergenos";
import { BotonExportar } from "../../../../features/exportacion";
import { useProveedores } from "../../../proveedores/hooks/useProveedores";
import { useEstadoNavegacion } from "../../../../common/hooks/useEstadoNavegacion";
import { PanelBase } from "../../../nutricion/components/pages/ParametrosNutricionPage";

const PAGE_SIZE = 10;

/** Pestaña "Ingredientes": el catálogo de ingredientes y productos. */
function TabIngredientes() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useEstadoNavegacion("IngredientesPage.verInactivos", false);

  const [busqueda, setBusqueda] = useEstadoNavegacion("IngredientesPage.busqueda", "");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [unidadId, setUnidadId] = useEstadoNavegacion("IngredientesPage.unidadId", "");
  // "" = todos, "true" = solo aditivos, "false" = solo los que no son aditivos.
  const [esAditivo, setEsAditivo] = useState<"" | "true" | "false">("");
  const [proveedorId, setProveedorId] = useEstadoNavegacion("IngredientesPage.proveedorId", "");
  const { proveedores } = useProveedores(false);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const orden = useOrdenTabla<ColumnaOrdenIngrediente, "nombre_asc">("nombre_asc");

  const {
    ingredientes,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarIngredientes,
  } = useIngredientes(
    {
      soloInactivos: verInactivos,
      buscar: busquedaAplicada,
      unidadMedidaId: unidadId ? Number(unidadId) : undefined,
      esAditivo: esAditivo === "" ? undefined : esAditivo === "true",
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  const { borrar, reactivar, loading: procesando } = useIngredienteABM();

  const [ingredienteAEliminar, setIngredienteAEliminar] = useState<Ingrediente | null>(null);
  const [ingredienteAReactivar, setIngredienteAReactivar] = useState<Ingrediente | null>(null);

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
    setEsAditivo("");
    setProveedorId("");
    orden.reiniciar();
  };

  const hayFiltros = busqueda.trim() !== "" || unidadId !== "" || esAditivo !== "" || proveedorId !== "";

  const ETIQUETAS_ORDEN: Record<ColumnaOrdenIngrediente, string> = {
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
      clave: "aditivo",
      etiqueta: "Aditivo",
      valor: esAditivo === "true" ? "Solo aditivos" : esAditivo === "false" ? "Sin aditivos" : "",
      onQuitar: () => setEsAditivo(""),
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

  const handleEdit = (ingrediente: Ingrediente) =>
    navigate(`/ingredientes/${ingrediente.id}/editar`);
  const handleDeleteRequest = (ingrediente: Ingrediente) =>
    setIngredienteAEliminar(ingrediente);
  const handleCloseDeleteDialog = () => {
    if (!procesando) setIngredienteAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!ingredienteAEliminar) return;
    try {
      await borrar(ingredienteAEliminar.id);
      setIngredienteAEliminar(null);
      await cargarIngredientes();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  const handleReactivarRequest = (ingrediente: Ingrediente) =>
    setIngredienteAReactivar(ingrediente);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setIngredienteAReactivar(null);
  };

  const handleConfirmReactivar = async () => {
    if (!ingredienteAReactivar) return;
    try {
      await reactivar(ingredienteAReactivar.id, {
        nombre: ingredienteAReactivar.nombre,
        unidad_medida_id: ingredienteAReactivar.unidad_medida_id,
      });
      setIngredienteAReactivar(null);
      await cargarIngredientes();
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
              label="Aditivo"
              valor={esAditivo}
              onCambio={(valor) => setEsAditivo(valor as "" | "true" | "false")}
              opciones={[
                { valor: "true", etiqueta: "Solo aditivos" },
                { valor: "false", etiqueta: "Sin aditivos" },
              ]}
              todos="Todos"
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
            <BotonAgregar onClick={() => navigate("/ingredientes/nuevo")}>Nuevo ingrediente</BotonAgregar>
            <ToggleInactivos
              enBarra
              checked={verInactivos}
              onChange={handleToggleInactivos}
              children="Ver dados de baja"
            />
            <BotonExportar
              nombreTabla="ingredientes"
              filtros={{
                activo: String(!verInactivos),
                buscar: busquedaAplicada,
                es_aditivo: esAditivo || undefined,
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
          {hayFiltros && ingredientes.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay ingredientes ni productos que coincidan con los filtros
              aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <IngredienteTable
              ingredientes={ingredientes}
              orden={orden}
              onEdit={handleEdit}
              onNutricion={(ingrediente) => navigate(`/ingredientes/${ingrediente.id}/nutricion`)}
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
        isOpen={ingredienteAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el ingrediente{" "}
            <strong>{ingredienteAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={ingredienteAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el ingrediente ${ingredienteAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </>
  );
}

/**
 * Ingredientes, con las clases funcionales y los alérgenos como sub-opciones.
 * Un aditivo es un ingrediente más (con `es_aditivo`, su clase e INS): ya no
 * hay una pestaña ni una lista aparte de aditivos. `/aditivos` redirige a la
 * pestaña de clases funcionales.
 */
export function IngredientesPage() {
  return (
    <Pagina
      titulo="Ingredientes"
      descripcion="Alta, modificación y baja de ingredientes (aditivos incluidos), sus clases funcionales, el catálogo de alérgenos y las bases de composición (SARA 1 u otras)."
    >
      <PestanasPagina
        pestanas={[
          { valor: "ingredientes", etiqueta: "Ingredientes", contenido: <TabIngredientes /> },
          { valor: "clases", etiqueta: "Clases funcionales", contenido: <TabClases /> },
          { valor: "alergenos", etiqueta: "Alérgenos", contenido: <TabAlergenos /> },
          { valor: "base", etiqueta: "Base de composición", contenido: <PanelBase /> },
        ]}
      />
    </Pagina>
  );
}