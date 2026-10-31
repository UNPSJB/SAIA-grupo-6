import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { PersonalTable } from "../PersonalTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePersonales } from "../../hooks/usePersonales";
import { usePersonalABM } from "../../hooks/usePersonalABM";
import {
  ROLES_PERSONAL,
  type Persona,
  type RolPersonal,
} from "../../types/personal";
import type { ColumnaOrdenPersonal } from "../../services/personalService";
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

export function PersonalPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [rol, setRol] = useState("");
  const orden = useOrdenTabla<ColumnaOrdenPersonal, "nombre_asc">("nombre_asc");

  const {
    personales,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarPersonales,
  } = usePersonales(
    {
      incluirInactivos: verInactivos,
      buscar: busquedaAplicada,
      rol: rol ? (rol as RolPersonal) : undefined,
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  const {
    borrar,
    reactivar,
    loading: procesando,
    error: errorReactivar,
  } = usePersonalABM();

  const [personaAEliminar, setPersonaAEliminar] = useState<Persona | null>(null);
  const [personaAReactivar, setPersonaAReactivar] = useState<Persona | null>(null);


  const handleToggleInactivos = (checked: boolean) => {
    // El hook de listado vuelve solo a la página 1 cuando cambia el filtro.
    setVerInactivos(checked);
  };

  const limpiarTodo = () => {
    setBusqueda("");
    setRol("");
    orden.reiniciar();
  };

  const hayFiltros = busqueda.trim() !== "" || rol !== "";

  const ETIQUETAS_ORDEN: Record<ColumnaOrdenPersonal, string> = {
    nombre: "Nombre",
    dni: "DNI",
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
      clave: "rol",
      etiqueta: "Rol",
      valor: ROLES_PERSONAL.find((opcion) => opcion.value === rol)?.label ?? rol,
      onQuitar: () => setRol(""),
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

  const handleEdit = (persona: Persona) => navigate(`/personal/${persona.id}/editar`);
  
  const handleDeleteRequest = (persona: Persona) => setPersonaAEliminar(persona);
  const handleCloseDeleteDialog = () => { if (!procesando) setPersonaAEliminar(null); };
  const handleConfirmDelete = async () => {
    if (!personaAEliminar) return;
    try {
      await borrar(personaAEliminar.id);
      setPersonaAEliminar(null);
      await cargarPersonales();
    } catch (error) {
      console.error(error);
    }
  };

  const handleReactivarRequest = (persona: Persona) => setPersonaAReactivar(persona);
  const handleCloseReactivarDialog = () => { if (!procesando) setPersonaAReactivar(null); };
  const handleConfirmReactivar = async () => {
    if (!personaAReactivar) return;
    try {
      // `es_super_admin` se reenvía explícitamente: el backend solo lo modifica
      // si viene en el cuerpo (usa `exclude_unset`), así que omitirlo en la
      // reactivación degradaba al super admin a un administrador común.
      await reactivar(personaAReactivar.id, {
        nombre: personaAReactivar.nombre,
        apellido: personaAReactivar.apellido || null,
        dni: personaAReactivar.dni,
        email: personaAReactivar.email,
        telefono: personaAReactivar.telefono || null,
        puede_operar: personaAReactivar.puede_operar,
        puede_administrar: personaAReactivar.puede_administrar,
        es_super_admin: personaAReactivar.es_super_admin,
      });
      setPersonaAReactivar(null);
      await cargarPersonales();
    } catch {
      // El hook expone el error en `errorReactivar`.
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={verInactivos ? "Personal dado de baja" : "Gestión de personal"}
        description="Alta, modificación y baja del personal del laboratorio."
        actions={
          <Button colorPalette="brand" onClick={() => navigate("/personal/nuevo")}>
            + Agregar
          </Button>
        }
      />

      {loading && <Spinner color="brand.500" />}
      {error && <BannerError>{error}</BannerError>}
      {errorReactivar && <BannerError>{errorReactivar}</BannerError>}

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
            placeholder="Buscar por nombre, apellido, DNI o email..."
          />
        }
        filtros={
          <FiltroSelect
            label="Rol"
            valor={rol}
            onCambio={setRol}
            opciones={ROLES_PERSONAL.map((opcion) => ({
              valor: opcion.value,
              etiqueta: opcion.label,
            }))}
          />
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {!loading && !error && (
        <>
          {hayFiltros && personales.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay personal que coincida con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <PersonalTable
              personales={personales}
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
        isOpen={personaAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar a{" "}
            <strong>{personaAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
      
      <ConfirmarReactivacionDialog 
        isOpen={personaAReactivar !== null} 
        mensaje={`¿Está seguro que desea reactivar al empleado ${personaAReactivar?.nombre}?`} 
        isLoading={procesando} 
        onCancel={handleCloseReactivarDialog} 
        onConfirm={handleConfirmReactivar} 
      />
    </Box>
  );
}
