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
import { Pagina } from "../../../../components/ui/plantillas";
import { BotonesExportar } from "../../../../features/exportacion";

const PAGE_SIZE = 10;

export function InsumosPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [unidadId, setUnidadId] = useState("");
  const [tipo, setTipo] = useState<TipoInsumo | "">("");
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
    orden.reiniciar();
  };

  const hayFiltros = busqueda.trim() !== "" || unidadId !== "" || tipo !== "";

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
    <Pagina
      titulo={
        verInactivos
          ? "Insumos y productos dados de baja"
          : "Gestión de insumos y productos"
      }
      descripcion="Alta, modificación y baja de insumos y productos del laboratorio."
      acciones={
        <BotonAgregar onClick={() => navigate("/insumos/nuevo")}>Nuevo insumo</BotonAgregar>
      }
    >
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
            <ToggleInactivos
              enBarra
              checked={verInactivos}
              onChange={handleToggleInactivos}
              children="Ver dados de baja"
            />
            <BotonesExportar
              nombreTabla="insumos"
              filtros={{
                activo: String(!verInactivos),
                buscar: busquedaAplicada,
                tipo: tipo || undefined,
                unidad_id: unidadId || undefined,
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
    </Pagina>
  );
}
