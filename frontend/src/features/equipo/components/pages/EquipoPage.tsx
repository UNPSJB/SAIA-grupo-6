import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box, Button, Heading, HStack, Spinner } from "@chakra-ui/react";
import { EquipoTable } from "../EquipoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { RegistrarCalibracionDialog } from "../RegistrarCalibracionDialog";
import { HistorialCalibracionesDialog } from "../HistorialCalibracionesDialog";
import { useEquipos } from "../../hooks/useEquipos";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import type { Equipo } from "../../types/equipo";
import { BannerError, DialogoExito, Paginacion, ToggleInactivos } from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function EquiposPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { equipos, loading, error, cargarEquipos } = useEquipos(verInactivos);
  const {
    borrar,
    reactivar,
    calibrar,
    loading: procesando,
    error: errorCalibracion,
  } = useEquipoABM();

  const [equipoAEliminar, setEquipoAEliminar] = useState<Equipo | null>(null);
  const [equipoAReactivar, setEquipoAReactivar] = useState<Equipo | null>(null);
  const [equipoACalibrar, setEquipoACalibrar] = useState<Equipo | null>(null);
  const [equipoVerHistorial, setEquipoVerHistorial] = useState<Equipo | null>(null);
  const [exitoCalibracion, setExitoCalibracion] = useState(false);

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

  const handleConfirmCalibrar = async (fecha: string, archivo: File) => {
    if (!equipoACalibrar) return;
    try {
      await calibrar(equipoACalibrar.id, fecha, archivo);
      setEquipoACalibrar(null);
      setExitoCalibracion(true);

      setTimeout(() => {
        setExitoCalibracion(false);
      }, 2500);
    } catch {
      // El hook expone el error en `errorCalibracion`, que se muestra abajo.
      // El diálogo queda abierto y con los datos cargados para que el
      // operador pueda reintentar sin volver a elegir el archivo.
    }
  };

  return (
    <Box p="5">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          {verInactivos ? "Equipos Dados de Baja" : "Gestión de Equipos"}
        </Heading>
        <Button
          colorPalette="brand"
          fontSize="md"
          fontWeight="bold"
          rounded="md"
          px="5"
          py="2.5"
          onClick={() => navigate("/equipos/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

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
            onCalibrar={(equipo) => setEquipoACalibrar(equipo)}
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
        isOpen={equipoACalibrar !== null}
        equipo={equipoACalibrar}
        isLoading={procesando}
        error={errorCalibracion}
        onClose={() => {
          if (!procesando) setEquipoACalibrar(null);
        }}
        onConfirm={handleConfirmCalibrar}
      />

      <HistorialCalibracionesDialog
        isOpen={equipoVerHistorial !== null}
        equipo={equipoVerHistorial}
        onClose={() => setEquipoVerHistorial(null)}
      />

      <DialogoExito
        isOpen={exitoCalibracion}
        mensaje="Calibración registrada y calculada correctamente."
      />
    </Box>
  );
}
