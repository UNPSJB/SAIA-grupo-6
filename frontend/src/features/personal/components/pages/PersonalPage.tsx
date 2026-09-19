import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, ButtonGroup, Heading, HStack, IconButton, Pagination, Spinner, Text } from "@chakra-ui/react";
import { PersonalTable } from "../PersonalTable";
import { DeletePersonalDialog } from "../DeletePersonalDialog";
import { usePersonales } from "../../hooks/usePersonales";
import { usePersonalABM } from "../../hooks/usePersonalABM";
import type { Persona } from "../../types/personal";

const TEAL = "#468189";
const PAGE_SIZE = 10;

export function PersonalPage() {
  const navigate = useNavigate();
  const { personales, loading, error, cargarPersonales } = usePersonales();
  const { borrar, loading: borrando } = usePersonalABM();

  const [personaAEliminar, setPersonaAEliminar] = useState<Persona | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "operar" | "administrar">("todos");
  const [page, setPage] = useState(1);

  const personalFiltrado = useMemo(() => {
    return personales.filter((p) => {
      if (filtro === "operar") return p.puede_operar;
      if (filtro === "administrar") return p.puede_administrar;
      return true;
    });
  }, [personales, filtro]);

  const personalPaginado = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return personalFiltrado.slice(start, start + PAGE_SIZE);
  }, [personalFiltrado, page]);

  const handleEdit = (persona: Persona) => navigate(`/personal/${persona.id}/editar`);
  const handleDeleteRequest = (persona: Persona) => setPersonaAEliminar(persona);
  const handleCloseDialog = () => { if (!borrando) setPersonaAEliminar(null); };

  const handleConfirmDelete = async () => {
    if (!personaAEliminar) return;
    try {
      await borrar(personaAEliminar.id);
      setPersonaAEliminar(null);
      await cargarPersonales();
    } catch {
      // El error queda en el hook
    }
  };

  const estiloFiltro = (activo: boolean) => ({
    padding: "8px 16px", borderRadius: "6px", border: `1px solid ${TEAL}`,
    backgroundColor: activo ? TEAL : "#fff", color: activo ? "#fff" : TEAL,
    cursor: "pointer", fontWeight: "bold" as const, transition: "0.2s"
  });

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">Gestión de Personal</Heading>
        <Button bg={TEAL} color="white" fontSize="16px" fontWeight="bold" borderRadius="6px" px="20px" py="10px" _hover={{ bg: TEAL }} onClick={() => navigate("/personal/nuevo")}>
          + Agregar
        </Button>
      </HStack>

      <HStack mb="20px" gap="10px">
        <button onClick={() => { setFiltro("todos"); setPage(1); }} style={estiloFiltro(filtro === "todos")}>Todos</button>
        <button onClick={() => { setFiltro("operar"); setPage(1); }} style={estiloFiltro(filtro === "operar")}>Operadores</button>
        <button onClick={() => { setFiltro("administrar"); setPage(1); }} style={estiloFiltro(filtro === "administrar")}>Administradores</button>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <PersonalTable personales={personalPaginado} onEdit={handleEdit} onDelete={handleDeleteRequest} />

          {personalFiltrado.length > PAGE_SIZE && (
            <Pagination.Root count={personalFiltrado.length} pageSize={PAGE_SIZE} page={page} onPageChange={(e) => setPage(e.page)} mt="16px">
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

      <DeletePersonalDialog isOpen={personaAEliminar !== null} persona={personaAEliminar} isLoading={borrando} onClose={handleCloseDialog} onConfirm={handleConfirmDelete} />
    </Box>
  );
}