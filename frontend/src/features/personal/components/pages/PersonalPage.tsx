import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, ButtonGroup, Heading, HStack, IconButton, Pagination, Spinner, Switch, Text } from "@chakra-ui/react";
import { PersonalTable } from "../PersonalTable";
import { DeletePersonalDialog } from "../DeletePersonalDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePersonales } from "../../hooks/usePersonales";
import { usePersonalABM } from "../../hooks/usePersonalABM";
import type { Persona } from "../../types/personal";

const TEAL = "#468189";
const PAGE_SIZE = 10;

export function PersonalPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);
  const [page, setPage] = useState(1);

  // Le pedimos al backend la lista según el estado del switch
  const { personales, loading, error, cargarPersonales } = usePersonales(verInactivos);
  const { borrar, reactivar, loading: procesando } = usePersonalABM();

  const [personaAEliminar, setPersonaAEliminar] = useState<Persona | null>(null);
  const [personaAReactivar, setPersonaAReactivar] = useState<Persona | null>(null);

  // Paginamos directamente la lista filtrada que ya nos trae el backend (o la filtramos localmente por si acaso)
  const personalPaginado = useMemo(() => {
    const filtrados = personales.filter(p => verInactivos ? !p.activo : p.activo);
    const start = (page - 1) * PAGE_SIZE;
    return filtrados.slice(start, start + PAGE_SIZE);
  }, [personales, page, verInactivos]);

  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1); // Volvemos a la página 1 al cambiar de vista
  };

  const handleEdit = (persona: Persona) => navigate(`/personal/${persona.id}/editar`);
  
  // Acciones de Borrado
  const handleDeleteRequest = (persona: Persona) => setPersonaAEliminar(persona);
  const handleCloseDeleteDialog = () => { if (!procesando) setPersonaAEliminar(null); };
  const handleConfirmDelete = async () => {
    if (!personaAEliminar) return;
    try {
      await borrar(personaAEliminar.id);
      setPersonaAEliminar(null);
      await cargarPersonales();
    } catch { }
  };

  // Acciones de Reactivación directa en la tabla (Abre el modal existente)
  const handleReactivarRequest = (persona: Persona) => setPersonaAReactivar(persona);
  const handleCloseReactivarDialog = () => { if (!procesando) setPersonaAReactivar(null); };
  const handleConfirmReactivar = async () => {
    if (!personaAReactivar) return;
    try {
      await reactivar(personaAReactivar.id, {
        nombre: personaAReactivar.nombre,
        apellido: personaAReactivar.apellido || null,
        dni: personaAReactivar.dni,
        email: personaAReactivar.email,
        telefono: personaAReactivar.telefono || null,
        puede_operar: personaAReactivar.puede_operar,
        puede_administrar: personaAReactivar.puede_administrar,
      });
      setPersonaAReactivar(null);
      await cargarPersonales();
    } catch { }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos ? "Personal Dado de Baja" : "Gestión de Personal"}
        </Heading>
        <Button bg={TEAL} color="white" fontSize="16px" fontWeight="bold" borderRadius="6px" px="20px" py="10px" _hover={{ bg: TEAL }} onClick={() => navigate("/personal/nuevo")}>
          + Agregar
        </Button>
      </HStack>

      <HStack justify="flex-end" mb="20px">
        <Switch.Root checked={verInactivos} onCheckedChange={(e) => handleToggleInactivos(e.checked)} colorPalette="gray">
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label style={{ fontSize: "14px", color: verInactivos ? "#d9534f" : "#555", fontWeight: verInactivos ? "bold" : "normal" }}>
            Ver dados de baja
          </Switch.Label>
        </Switch.Root>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <PersonalTable personales={personalPaginado} onEdit={handleEdit} onDelete={handleDeleteRequest} onReactivar={handleReactivarRequest} />

          {personales.filter(p => verInactivos ? !p.activo : p.activo).length > PAGE_SIZE && (
            <Pagination.Root count={personales.filter(p => verInactivos ? !p.activo : p.activo).length} pageSize={PAGE_SIZE} page={page} onPageChange={(e) => setPage(e.page)} mt="16px">
              <HStack justify="center">
                <ButtonGroup variant="ghost" size="sm">
                  <Pagination.Items render={(pageItem) => {
                      const isSelected = pageItem.value === page;
                      return (
                        <IconButton aria-label={`Página ${pageItem.value}`} bg={isSelected ? TEAL : "transparent"} color={isSelected ? "white" : TEAL} border={isSelected ? "none" : `1px solid ${TEAL}`} _hover={{ bg: isSelected ? TEAL : `${TEAL}1A` }}>
                          {pageItem.value}
                        </IconButton>
                      );
                  }} />
                </ButtonGroup>
              </HStack>
            </Pagination.Root>
          )}
        </>
      )}

      {/* Modales de confirmación */}
      <DeletePersonalDialog isOpen={personaAEliminar !== null} persona={personaAEliminar} isLoading={procesando} onClose={handleCloseDeleteDialog} onConfirm={handleConfirmDelete} />
      
      <ConfirmarReactivacionDialog 
        isOpen={personaAReactivar !== null} 
        mensaje={`¿Estás seguro que deseas reactivar al empleado ${personaAReactivar?.nombre}?`} 
        isLoading={procesando} 
        onCancel={handleCloseReactivarDialog} 
        onConfirm={handleConfirmReactivar} 
      />
    </Box>
  );
}