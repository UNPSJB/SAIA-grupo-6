import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box, Button, Spinner } from "@chakra-ui/react";
import { EquipoTable } from "../EquipoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { RegistrarCalibracionDialog } from "../RegistrarCalibracionDialog";
import { HistorialCalibracionesDialog } from "../HistorialCalibracionesDialog";
import { useEquipos } from "../../hooks/useEquipos";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import type { Equipo, TipoIntervencion } from "../../types/equipo";
import {
  BannerError,
  DialogoExito,
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function EquiposPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { equipos, loading, error, cargarEquipos } = useEquipos(verInactivos);
  const {
    borrar,
    reactivar,
    registrarIntervencion,
    registrandoIntervencion,
    loading: procesando,
    errorIntervencion,
  } = useEquipoABM();

  const [equipoAEliminar, setEquipoAEliminar] = useState<Equipo | null>(null);
  const [equipoAReactivar, setEquipoAReactivar] = useState<Equipo | null>(null);
  const [equipoAIntervenir, setEquipoAIntervenir] = useState<Equipo | null>(null);
  const [equipoVerHistorial, setEquipoVerHistorial] = useState<Equipo | null>(null);
  const [exitoIntervencion, setExitoIntervencion] = useState(false);

  const {
    paginados: equiposPaginados,
    totalPaginas,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(equipos, verInactivos, PAGE_SIZE);

  const handleConfirmReactivar = async () => {
    if (!equipoAReactivar) return;
    try {
      await reactivar(equipoAReactivar.id, {
        nombre: equipoAReactivar.nombre,
        tipo: equipoAReactivar.tipo,
        ubicacion: equipoAReactivar.ubicacion,
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

  const handleConfirmIntervencion = async (
    fecha: string,
    archivo: File,
    tipo: TipoIntervencion,
  ) => {
    if (!equipoAIntervenir) return;
    try {
      await registrarIntervencion(equipoAIntervenir.id, fecha, archivo, tipo);
      setEquipoAIntervenir(null);
      setExitoIntervencion(true);

      setTimeout(() => {
        setExitoIntervencion(false);
      }, 2500);
    } catch {
      // El hook expone el error en `errorIntervencion`, que se muestra abajo.
      // El diálogo queda abierto y con los datos cargados para que el
      // operador pueda reintentar sin volver a elegir el archivo.
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
          setVerInactivos(checked);
          setPage(1);
        }}
        children="Ver dadas de baja"
      />

      {error && <BannerError>{error}</BannerError>}
      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          <EquipoTable
            equipos={equiposPaginados}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={(equipo) => setEquipoAReactivar(equipo)}
            onIntervenir={(equipo) => setEquipoAIntervenir(equipo)}
            onVerHistorial={(equipo) => setEquipoVerHistorial(equipo)}
          />

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

      <RegistrarCalibracionDialog
        isOpen={equipoAIntervenir !== null}
        equipo={equipoAIntervenir}
        isLoading={registrandoIntervencion}
        error={errorIntervencion}
        onClose={() => {
          if (!registrandoIntervencion) setEquipoAIntervenir(null);
        }}
        onConfirm={handleConfirmIntervencion}
      />

      <HistorialCalibracionesDialog
        isOpen={equipoVerHistorial !== null}
        equipo={equipoVerHistorial}
        onClose={() => setEquipoVerHistorial(null)}
      />

      <DialogoExito
        isOpen={exitoIntervencion}
        mensaje="Intervención registrada y calculada correctamente."
      />
    </Box>
  );
}
