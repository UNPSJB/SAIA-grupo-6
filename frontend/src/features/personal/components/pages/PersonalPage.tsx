import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box, Button, ButtonGroup, Heading, HStack, IconButton, Pagination, Spinner, Switch, Text } from "@chakra-ui/react";
import { PersonalTable } from "../PersonalTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePersonales } from "../../hooks/usePersonales";
import { usePersonalABM } from "../../hooks/usePersonalABM";
import type { Persona } from "../../types/personal";
import {
  PELIGRO,
  TEAL,
  TEAL_OSCURO,
  TEXTO_SECUNDARIO,
} from "../../../../common/theme/tokens";

const PAGE_SIZE = 10;

export function PersonalPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { personales, loading, error, cargarPersonales } = usePersonales(verInactivos);
  const { borrar, reactivar, loading: procesando } = usePersonalABM();
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
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Box> {/* Sin padding extra para ganar espacio vertical */}
      <HStack justify="space-between" mb="10px"> {/* Margen achicado */}
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos ? "Personal Dado de Baja" : "Gestión de Personal"}
        </Heading>
        {/* BOTÓN AGREGAR ACHICADO */}
        <Button 
          bg={TEAL} 
          color="white" 
          fontSize="14px" 
          fontWeight="bold" 
          borderRadius="6px" 
          px="16px" 
          py="6px" 
          height="auto" 
          _hover={{ bg: TEAL_OSCURO }} 
          onClick={() => navigate("/personal/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <PersonalTable personales={personalPaginado} onEdit={handleEdit} onDelete={handleDeleteRequest} onReactivar={handleReactivarRequest} />

          <HStack justify="space-between" mt="15px" alignItems="center">
            
            <Switch.Root checked={verInactivos} onCheckedChange={(e) => handleToggleInactivos(e.checked)} colorPalette="gray">
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label style={{ fontSize: "14px", color: verInactivos ? PELIGRO : TEXTO_SECUNDARIO, fontWeight: verInactivos ? "bold" : "normal" }}>
                Ver dados de baja
              </Switch.Label>
            </Switch.Root>

            {hayVariasPaginas && (
              <Pagination.Root count={totalPaginas} pageSize={PAGE_SIZE} page={page} onPageChange={(e) => setPage(e.page)}>
                <HStack justify="center">
                  <ButtonGroup variant="ghost" size="sm">
                    <Pagination.Items render={(pageItem) => {
                        const isSelected = pageItem.value === page;
                        return (
                          /* BOTONES DE PAGINACIÓN ACHICADOS (32x32) */
                          <IconButton 
                            aria-label={`Página ${pageItem.value}`} 
                            width="32px"
                            height="32px"
                            minWidth="32px"
                            fontSize="14px"
                            padding="0"
                            bg={isSelected ? TEAL : "transparent"} 
                            color={isSelected ? "white" : TEAL} 
                            border={isSelected ? "none" : `1px solid ${TEAL}`} 
                            _hover={{ bg: isSelected ? TEAL : `${TEAL}1A` }}
                          >
                            {pageItem.value}
                          </IconButton>
                        );
                    }} />
                  </ButtonGroup>
                </HStack>
              </Pagination.Root>
            )}

          </HStack>
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
