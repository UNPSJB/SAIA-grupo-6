import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { PersonalTable } from "../PersonalTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePersonales } from "../../hooks/usePersonales";
import { usePersonalABM } from "../../hooks/usePersonalABM";
import type { Persona } from "../../types/personal";
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

  const { personales, loading, error, cargarPersonales } = usePersonales(verInactivos);
  const {
    borrar,
    reactivar,
    loading: procesando,
    error: errorReactivar,
} = usePersonalABM();
  const {
    paginados: personalPaginado,
    totalPaginas,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(personales, verInactivos, PAGE_SIZE);

  const [personaAEliminar, setPersonaAEliminar] = useState<Persona | null>(null);
  const [personaAReactivar, setPersonaAReactivar] = useState<Persona | null>(null);


  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1); 
  };

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

      {!loading && !error && (
        <>
          <PersonalTable personales={personalPaginado} onEdit={handleEdit} onDelete={handleDeleteRequest} onReactivar={handleReactivarRequest} />

          {hayVariasPaginas && (
            <Paginacion
              count={totalPaginas}
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
