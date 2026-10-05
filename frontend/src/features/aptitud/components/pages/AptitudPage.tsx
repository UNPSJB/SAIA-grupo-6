import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner, Switch, Text } from "@chakra-ui/react";
import { AptitudTable } from "../AptitudTable";
import { DeleteAptitudDialog } from "../DeleteAptitudDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useAptitudes } from "../../hooks/useAptitudes";
import { useAptitudABM } from "../../hooks/useAptitudABM";
import type { Aptitud } from "../../types/aptitud";


const TEAL = "#468189";

export function AptitudPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const { aptitudes, loading, error, cargarAptitudes } = useAptitudes(verInactivos);
  const { borrar, reactivar, loading: procesando, error: errorEliminar } = useAptitudABM();
  const aptitudesFiltradas = useMemo(
  () => aptitudes.filter((a) => (verInactivos ? !a.activo : a.activo)),[aptitudes, verInactivos] );

  const [aptitudAEliminar, setAptitudAEliminar] = useState<Aptitud | null>(null);
  const [aptitudAReactivar, setAptitudAReactivar] = useState<Aptitud | null>(null);

  const handleEdit = (aptitud: Aptitud) => navigate(`/aptitudes/${aptitud.id}/editar`);
  const handleDeleteRequest = (aptitud: Aptitud) => setAptitudAEliminar(aptitud);
  const handleCloseDeleteDialog = () => { if (!procesando) setAptitudAEliminar(null); };

  const handleConfirmDelete = async () => {
    if (!aptitudAEliminar) return;
    try {
      await borrar(aptitudAEliminar.id);
      setAptitudAEliminar(null);
      await cargarAptitudes();
    } catch {
      setAptitudAEliminar(null);
    }
  };

  const handleReactivarRequest = (aptitud: Aptitud) => setAptitudAReactivar(aptitud);
  const handleCloseReactivarDialog = () => { if (!procesando) setAptitudAReactivar(null); };

  const handleConfirmReactivar = async () => {
    if (!aptitudAReactivar) return;
    try {
      await reactivar(aptitudAReactivar.id, {
        nombre: aptitudAReactivar.nombre,
        descripcion: aptitudAReactivar.descripcion,
      });
      setAptitudAReactivar(null);
      await cargarAptitudes();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos ? "Aptitudes Dadas de Baja" : "Gestión de Aptitudes"}
        </Heading>
        <Button bg={TEAL} color="white" fontSize="16px" fontWeight="bold" borderRadius="6px" px="20px" py="10px" _hover={{ bg: "#37666d" }} onClick={() => navigate("/aptitudes/nuevo")}>
          + Agregar
        </Button>
      </HStack>

      {errorEliminar && (
        <Box style={{ backgroundColor: "#f8d7da", color: "#721c24", padding: "12px", borderRadius: "6px", marginBottom: "20px", border: "1px solid #f5c6cb", fontWeight: "bold" }}>
          ⚠️ {errorEliminar}
        </Box>
      )}

      <HStack justify="flex-end" mb="20px">
        <Switch.Root checked={verInactivos} onCheckedChange={(e) => setVerInactivos(e.checked)} colorPalette="gray">
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label style={{ fontSize: "14px", color: verInactivos ? "#d9534f" : "#555", fontWeight: verInactivos ? "bold" : "normal" }}>
            Ver dadas de baja
          </Switch.Label>
        </Switch.Root>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <AptitudTable
          aptitudes={aptitudesFiltradas}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onReactivar={handleReactivarRequest}
        />
      )}

      <DeleteAptitudDialog
        isOpen={aptitudAEliminar !== null}
        aptitud={aptitudAEliminar}
        isLoading={procesando}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={aptitudAReactivar !== null}
        mensaje={`¿Estás seguro que deseas reactivar la aptitud ${aptitudAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
