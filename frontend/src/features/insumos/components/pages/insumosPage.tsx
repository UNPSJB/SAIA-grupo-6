import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner, Text } from "@chakra-ui/react";
import { InsumoTable } from "../insumoTable";
import { DeleteInsumoDialog } from "../DeleteInsumoDialog";
import { useInsumos } from "../../hooks/useInsumos";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import type { Insumo } from "../../types/insumo";

const TEAL = "#468189";

export function InsumosPage() {
  const navigate = useNavigate();
  const { insumos, loading, error, cargarInsumos } = useInsumos();
  const { borrar, loading: borrando } = useInsumoABM();

  const [insumoAEliminar, setInsumoAEliminar] = useState<Insumo | null>(null);

  const handleEdit = (insumo: Insumo) => {
    navigate(`/insumos/${insumo.id}/editar`);
  };

  const handleDeleteRequest = (insumo: Insumo) => {
    setInsumoAEliminar(insumo);
  };

  const handleCloseDialog = () => {
    if (borrando) return;
    setInsumoAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!insumoAEliminar) return;

    try {
      await borrar(insumoAEliminar.id);
      setInsumoAEliminar(null);
      await cargarInsumos();
    } catch {
      // El error ya queda reflejado en useInsumoABM().error
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        {/* size="md" = 24px, como el <h2> por defecto del navegador */}
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Gestión de Insumos
        </Heading>
        <Button
          bg={TEAL}
          color="white"
          fontSize="16px"
          fontWeight="bold"
          borderRadius="6px"
          px="20px"
          py="10px"
          _hover={{ bg: TEAL }}
          onClick={() => navigate("/insumos/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {loading && <Spinner />}

      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <InsumoTable
          insumos={insumos}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
        />
      )}

      <DeleteInsumoDialog
        isOpen={insumoAEliminar !== null}
        insumo={insumoAEliminar}
        isLoading={borrando}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}
