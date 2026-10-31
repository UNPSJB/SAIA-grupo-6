import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { EquipoTable } from "../EquipoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { IntervencionEquipo } from "../IntervencionEquipo";
import { HistorialCalibracionesDialog } from "../HistorialCalibracionesDialog";
import { useEquiposPaginados } from "../../hooks/useEquiposPaginados";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import type { Equipo } from "../../types/equipo";
import {
  obtenerOpcionesEquipos,
  type ColumnaOrdenEquipo,
  type OpcionesEquipos,
} from "../../services/equipoService";
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
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

const SIN_OPCIONES: OpcionesEquipos = { tipos: [], sectores: [] };

export function EquiposPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [tipo, setTipo] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [opciones, setOpciones] = useState<OpcionesEquipos>(SIN_OPCIONES);
  const orden = useOrdenTabla<ColumnaOrdenEquipo, "nombre_asc">("nombre_asc");

  const {
    equipos,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarEquipos,
  } = useEquiposPaginados(
    {
      incluirInactivos: verInactivos,
      buscar: busquedaAplicada,
      tipo,
      sectorId,
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  const { borrar, reactivar, loading: procesando } = useEquipoABM();

  const [equipoAEliminar, setEquipoAEliminar] = useState<Equipo | null>(null);
  const [equipoAReactivar, setEquipoAReactivar] = useState<Equipo | null>(null);
  const [equipoAIntervenir, setEquipoAIntervenir] = useState<Equipo | null>(null);
  const [equipoVerHistorial, setEquipoVerHistorial] = useState<Equipo | null>(null);

  // Tipos y sectores para los selects. La página se vuelve a montar al
  // volver de un alta/edición, así que el catálogo se refresca solo.
  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        setOpciones(await obtenerOpcionesEquipos());
      } catch (err) {
        console.error("Error al cargar las opciones de equipos:", err);
      }
    };
    void cargarOpciones();
  }, []);

  const limpiarTodo = () => {
    setBusqueda("");
    setTipo("");
    setSectorId("");
    orden.reiniciar();
  };

  const hayFiltros =
    busqueda.trim() !== "" || tipo !== "" || sectorId !== "";

  const ETIQUETAS_ORDEN: Record<ColumnaOrdenEquipo, string> = {
    nombre: "Nombre",
    tipo: "Tipo",
    sector: "Sector",
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
      valor: tipo,
      onQuitar: () => setTipo(""),
    },
    {
      clave: "sector",
      etiqueta: "Sector",
      valor:
        opciones.sectores.find((sector) => String(sector.id) === sectorId)
          ?.nombre ?? sectorId,
      onQuitar: () => setSectorId(""),
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
    if (!equipoAReactivar) return;
    try {
      await reactivar(equipoAReactivar.id, {
        nombre: equipoAReactivar.nombre,
        tipo: equipoAReactivar.tipo,
        sector_id: equipoAReactivar.sector_id,
        activo: true,
      });
      setEquipoAReactivar(null);
      await cargarEquipos();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  const handleEdit = (equipo: Equipo) =>
    navigate(`/equipos/${equipo.id}/editar`);
  const handleDeleteRequest = (equipo: Equipo) => setEquipoAEliminar(equipo);
  const handleCloseDeleteDialog = () => {
    if (!procesando) setEquipoAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!equipoAEliminar) return;
    try {
      await borrar(equipoAEliminar.id);
      setEquipoAEliminar(null);
      await cargarEquipos();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={
          verInactivos ? "Equipos dados de baja" : "Gestión de equipos"
        }
        description="Alta, modificación y baja de los equipos del laboratorio, con su historial de intervenciones."
        actions={
          <Button colorPalette="brand" onClick={() => navigate("/equipos/nuevo")}>
            + Agregar
          </Button>
        }
      />

      <ToggleInactivos
        checked={verInactivos}
        onChange={(checked: boolean) => {
          // El hook de listado vuelve solo a la página 1 cuando cambia el filtro.
          setVerInactivos(checked);
        }}
        children="Ver dadas de baja"
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por nombre, tipo o sector..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Tipo"
              valor={tipo}
              onCambio={setTipo}
              opciones={opciones.tipos.map((valor) => ({
                valor,
                etiqueta: valor,
              }))}
            />
            <FiltroSelect
              label="Sector"
              valor={sectorId}
              onCambio={setSectorId}
              opciones={opciones.sectores.map((sector) => ({
                valor: String(sector.id),
                etiqueta: sector.nombre,
              }))}
              todos="Todos"
            />
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          {hayFiltros && equipos.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay equipos que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <EquipoTable
              equipos={equipos}
              orden={orden}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onReactivar={(equipo) => setEquipoAReactivar(equipo)}
              onIntervenir={(equipo) => setEquipoAIntervenir(equipo)}
              onVerHistorial={(equipo) => setEquipoVerHistorial(equipo)}
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
        isOpen={equipoAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el equipo{" "}
            <strong>{equipoAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={equipoAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el equipo ${equipoAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={() => {
          if (!procesando) setEquipoAReactivar(null);
        }}
        onConfirm={handleConfirmReactivar}
      />

      {/* Registro de intervención: toda la lógica vive en IntervencionEquipo. */}
      {equipoAIntervenir && (
        <IntervencionEquipo
          equipo={equipoAIntervenir}
          onCerrar={() => setEquipoAIntervenir(null)}
        />
      )}

      <HistorialCalibracionesDialog
        isOpen={equipoVerHistorial !== null}
        equipo={equipoVerHistorial}
        onClose={() => setEquipoVerHistorial(null)}
      />
    </Box>
  );
}
