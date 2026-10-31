import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";

import { useEquipos } from "../../../equipo/hooks/useEquipos";
import { usePlanesCalibracionMantenimientoPaginados } from "../../hooks/usePlanesCalibracionMantenimientoPaginados";
import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoTable } from "../PlanCalibracionMantenimientoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import type {
  PlanCalibracionMantenimiento,
  TipoPlanCalibracionMantenimiento,
} from "../../types/planCalibracionMantenimiento";
import type { ColumnaOrdenPlanCalibracion } from "../../services/planCalibracionMantenimientoService";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
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
  BotonAgregar,
  EstadoCargando,
  PageHeader,
  Paginacion,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

const TIPOS_PLAN: {
  value: TipoPlanCalibracionMantenimiento;
  label: string;
}[] = [
  { value: "calibracion", label: "Calibración" },
  { value: "mantenimiento", label: "Mantenimiento" },
];

const ETIQUETAS_ORDEN: Record<ColumnaOrdenPlanCalibracion, string> = {
  equipo: "Equipo",
  tipo: "Tipo",
  intervencion: "Última intervención",
  periodicidad: "Periodicidad",
  vencimiento: "Próximo vencimiento",
};

export function PlanCalibracionMantenimientoPage() {
  const navigate = useNavigate();

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [tipo, setTipo] = useState<TipoPlanCalibracionMantenimiento | "">("");
  const [equipoId, setEquipoId] = useState("");
  const orden = useOrdenTabla<
    ColumnaOrdenPlanCalibracion,
    "vencimiento_asc"
  >("vencimiento_asc", "vencimiento");

  const {
    planes,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading: cargandoPlanes,
    error: errorPlanes,
    cargarPlanes,
  } = usePlanesCalibracionMantenimientoPaginados(
    {
      buscar: busquedaAplicada,
      tipo,
      equipoId: equipoId ? Number(equipoId) : undefined,
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  // Solo para resolver el nombre de equipo de cada fila: la lista completa de
  // equipos es chiquita y el backend no la incluye en cada plan.
  const {
    equipos,
    loading: cargandoEquipos,
    error: errorEquipos,
  } = useEquipos(true);
  const { borrar, loading: procesando } = usePlanCalibracionMantenimientoABM();

  const [planAEliminar, setPlanAEliminar] =
    useState<PlanCalibracionMantenimiento | null>(null);

  const nombresEquipos = new Map(
    equipos.map((equipo) => [equipo.id, equipo.nombre]),
  );

  const limpiarTodo = () => {
    setBusqueda("");
    setTipo("");
    setEquipoId("");
    orden.reiniciar();
  };

  const hayFiltros =
    busqueda.trim() !== "" ||
    tipo !== "" ||
    equipoId !== "" ||
    !orden.esPorDefecto;

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
      valor: TIPOS_PLAN.find((t) => t.value === tipo)?.label ?? tipo,
      onQuitar: () => setTipo(""),
    },
    {
      clave: "equipo",
      etiqueta: "Equipo",
      valor: equipos.find((e) => String(e.id) === equipoId)?.nombre ?? equipoId,
      onQuitar: () => setEquipoId(""),
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
      visible: !orden.esPorDefecto && orden.columna !== null,
      onQuitar: orden.reiniciar,
    },
  ]);

  const handleEdit = (plan: PlanCalibracionMantenimiento) => {
    navigate(`/planes-calibracion-mantenimiento/${plan.id}/editar`);
  };

  const handleCloseDialog = () => {
    if (!procesando) setPlanAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!planAEliminar) return;
    try {
      await borrar(planAEliminar.id);
      setPlanAEliminar(null);
      await cargarPlanes();
    } catch {
      // El hook de mutación expone el estado de error a esta página.
    }
  };

  const loading = cargandoPlanes || cargandoEquipos;
  const error = errorPlanes || errorEquipos;

  return (
    <Box p="5">
      <PageHeader
        title="Planes de calibración y mantenimiento"
        description="Periodicidad de calibración y de mantenimiento por equipo, con su próximo vencimiento."
        actions={
          <BotonAgregar
            onClick={() => navigate("/planes-calibracion-mantenimiento/nuevo")}
          >
            Agregar
          </BotonAgregar>
        }
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por equipo o tipo..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Tipo"
              valor={tipo}
              onCambio={(valor) =>
                setTipo(valor as TipoPlanCalibracionMantenimiento | "")
              }
              opciones={TIPOS_PLAN.map((t) => ({
                valor: t.value,
                etiqueta: t.label,
              }))}
              todos="Todos"
              minW="170px"
            />
            <FiltroSelect
              label="Equipo"
              valor={equipoId}
              onCambio={setEquipoId}
              opciones={equipos.map((equipo) => ({
                valor: String(equipo.id),
                etiqueta: equipo.nombre,
              }))}
            />
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando>Cargando planes...</EstadoCargando>}
      {!loading && !error && (
        <>
          {hayFiltros && planes.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay planes que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <PlanCalibracionMantenimientoTable
              planes={planes}
              nombresEquipos={nombresEquipos}
              orden={orden}
              onEdit={handleEdit}
              onDelete={setPlanAEliminar}
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
        isOpen={planAEliminar !== null}
        titulo="Eliminar plan"
        mensaje={
          planAEliminar
            ? `¿Está seguro que desea eliminar el plan ${planAEliminar.tipo === "calibracion" ? "de calibración" : "de mantenimiento"}?`
            : ""
        }
        textoConfirmar="Sí, eliminar"
        isLoading={procesando}
        onCancel={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}
