import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { InsumoQuimicoTable } from "../InsumoQuimicoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useInsumosQuimicos } from "../../hooks/useInsumosQuimicos";
import { useInsumoQuimicoABM } from "../../hooks/useInsumoQuimicoABM";
import {
  TIPOS_QUIMICOS,
  type InsumoQuimico,
  type TipoQuimico,
} from "../../types/insumoQuimico";
import type { ColumnaOrdenInsumoQuimico } from "../../services/insumoQuimicoService";
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
  BannerError,
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function InsumosQuimicosPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [tipo, setTipo] = useState("");
  const [unidadId, setUnidadId] = useState("");
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const orden = useOrdenTabla<ColumnaOrdenInsumoQuimico, "nombre_asc">(
    "nombre_asc"
  );

  const {
    insumos,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarInsumos,
  } = useInsumosQuimicos(
    {
      incluirInactivos: verInactivos,
      buscar: busquedaAplicada,
      tipo: tipo ? (tipo as TipoQuimico) : undefined,
      unidadMedidaId: unidadId ? Number(unidadId) : undefined,
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  const { borrar, reactivar, loading: procesando } = useInsumoQuimicoABM();

  const [insumoAEliminar, setInsumoAEliminar] =
    useState<InsumoQuimico | null>(null);
  const [insumoAReactivar, setInsumoAReactivar] =
    useState<InsumoQuimico | null>(null);

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
    setTipo("");
    setUnidadId("");
    orden.reiniciar();
  };

  const hayFiltros =
    busqueda.trim() !== "" || tipo !== "" || unidadId !== "";

  const ETIQUETAS_ORDEN: Record<ColumnaOrdenInsumoQuimico, string> = {
    nombre: "Nombre",
    tipo: "Tipo",
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
      valor: TIPOS_QUIMICOS.find((opcion) => opcion.value === tipo)?.label ?? tipo,
      onQuitar: () => setTipo(""),
    },
    {
      clave: "unidad",
      etiqueta: "Unidad",
      valor:
        unidades.find((unidad) => String(unidad.id) === unidadId)?.nombre ??
        unidadId,
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

  const handleEdit = (insumo: InsumoQuimico) =>
    navigate(`/insumos-quimicos/${insumo.id}/editar`);
  const handleDeleteRequest = (insumo: InsumoQuimico) =>
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

  const handleReactivarRequest = (insumo: InsumoQuimico) =>
    setInsumoAReactivar(insumo);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setInsumoAReactivar(null);
  };

  const handleConfirmReactivar = async () => {
    if (!insumoAReactivar) return;
    try {
      await reactivar(insumoAReactivar.id, {
        nombre: insumoAReactivar.nombre,
        tipo: insumoAReactivar.tipo,
        unidad_medida_id: insumoAReactivar.unidad_medida_id,
      });
      setInsumoAReactivar(null);
      await cargarInsumos();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={
          verInactivos
            ? "Insumos químicos dados de baja"
            : "Gestión de insumos químicos"
        }
        description="Alta, modificación y baja de los productos químicos del laboratorio."
        actions={
          <Button
            colorPalette="brand"
            onClick={() => navigate("/insumos-quimicos/nuevo")}
          >
            + Agregar
          </Button>
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
            placeholder="Buscar por nombre, tipo o unidad..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Tipo"
              valor={tipo}
              onCambio={setTipo}
              opciones={TIPOS_QUIMICOS.map((opcion) => ({
                valor: opcion.value,
                etiqueta: opcion.label,
              }))}
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
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          {hayFiltros && insumos.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay insumos químicos que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <InsumoQuimicoTable
              insumos={insumos}
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
        isOpen={insumoAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el insumo químico{" "}
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
        mensaje={`¿Está seguro que desea reactivar el insumo químico ${insumoAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
