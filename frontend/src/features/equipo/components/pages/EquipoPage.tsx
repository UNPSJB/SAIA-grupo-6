import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import {
  Box,
  Button,
  ButtonGroup,
  Heading,
  HStack,
  IconButton,
  Pagination,
  Spinner,
  Text,
  Switch,
} from "@chakra-ui/react";
import { EquipoTable } from "../EquipoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { RegistrarCalibracionDialog } from "../RegistrarCalibracionDialog";
import { HistorialCalibracionesDialog } from "../HistorialCalibracionesDialog";
import { useEquipos } from "../../hooks/useEquipos";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import type { Equipo } from "../../types/equipo";
import { PELIGRO, TEAL, TEXTO_SECUNDARIO } from "../../../../common/theme/tokens";

const PAGE_SIZE = 10;

export function EquiposPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { equipos, loading, error, cargarEquipos } = useEquipos(verInactivos);
  const { borrar, reactivar, calibrar, loading: procesando } = useEquipoABM();

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
        activo: true
      });
      setEquipoAReactivar(null);
      await cargarEquipos();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  const handleEdit = (equipo: Equipo) => navigate(`/equipos/${equipo.id}/editar`);
  const handleDeleteRequest = (equipo: Equipo) => setEquipoAEliminar(equipo);
  const handleCloseDeleteDialog = () => { if (!procesando) setEquipoAEliminar(null); };

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
    } catch (error) {
      console.error("Falló la calibración", error);
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos ? "Equipos Dados de Baja" : "Gestión de Equipos"}
        </Heading>
        <Button
          bg={TEAL} color="white" fontSize="16px" fontWeight="bold" borderRadius="6px" px="20px" py="10px"
          _hover={{ bg: TEAL }} onClick={() => navigate("/equipos/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      <HStack justify="flex-end" mb="20px">
        <Switch.Root checked={verInactivos} onCheckedChange={(e) => { setVerInactivos(e.checked); setPage(1); }} colorPalette="gray">
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label style={{ fontSize: "14px", color: verInactivos ? PELIGRO : TEXTO_SECUNDARIO, fontWeight: verInactivos ? "bold" : "normal" }}>
            Ver dados de baja
          </Switch.Label>
        </Switch.Root>
      </HStack>

      {exitoCalibracion && (
        <Box style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <Box style={{ backgroundColor: "white", padding: "30px 50px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <Box style={{ fontSize: "50px", marginBottom: "10px" }}>✅</Box>
            <Heading as="h3" style={{ margin: 0, color: "#28a745", fontSize: "24px" }}>Éxito</Heading>
            <Text style={{ color: "#555", marginTop: "10px", fontSize: "16px", fontWeight: 500 }}>
              Calibración registrada y calculada correctamente.
            </Text>
          </Box>
        </Box>
      )}

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <EquipoTable
            equipos={equiposPaginados}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={(equipo) => setEquipoAReactivar(equipo)}
            onCalibrar={(equipo) => setEquipoACalibrar(equipo)}
            onVerHistorial={(equipo) => setEquipoVerHistorial(equipo)} // <-- Le decimos que abra la ventana de historial
          />

          {hayVariasPaginas && (
            <Pagination.Root
              count={totalPaginas}
              pageSize={PAGE_SIZE} page={page} onPageChange={(e) => setPage(e.page)} mt="16px"
            >
              <HStack justify="center">
                <ButtonGroup variant="ghost" size="sm">
                  <Pagination.Items
                    render={(pageItem) => {
                      const isSelected = pageItem.value === page;
                      return (
                        <IconButton
                          aria-label={`Página ${pageItem.value}`} bg={isSelected ? TEAL : "transparent"} color={isSelected ? "white" : TEAL} border={isSelected ? "none" : `1px solid ${TEAL}`}
                          _hover={{ bg: isSelected ? TEAL : `${TEAL}1A` }}
                        >
                          {pageItem.value}
                        </IconButton>
                      );
                    }}
                  />
                </ButtonGroup>
              </HStack>
            </Pagination.Root>
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
        onCancel={() => { if (!procesando) setEquipoAReactivar(null); }}
        onConfirm={handleConfirmReactivar}
      />

      <RegistrarCalibracionDialog
        isOpen={equipoACalibrar !== null}
        equipo={equipoACalibrar}
        isLoading={procesando}
        onClose={() => setEquipoACalibrar(null)}
        onConfirm={handleConfirmCalibrar}
      />

      {/* <-- Montamos la ventana del historial de calibraciones --> */}
      <HistorialCalibracionesDialog
        isOpen={equipoVerHistorial !== null}
        equipo={equipoVerHistorial}
        onClose={() => setEquipoVerHistorial(null)}
      />
    </Box>
  );
}