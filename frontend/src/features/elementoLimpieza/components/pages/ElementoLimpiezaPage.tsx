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
import { ElementoLimpiezaTable } from "../ElementoLimpiezaTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useElementosLimpieza } from "../../hooks/useElementosLimpieza";
import { useElementoLimpiezaABM } from "../../hooks/useElementoLimpiezaABM";
import type { ElementoLimpieza } from "../../types/elementoLimpieza";
import { PELIGRO, TEAL, TEXTO_SECUNDARIO } from "../../../../common/theme/tokens";

const PAGE_SIZE = 10;

export function ElementosLimpiezaPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const {
    elementosLimpieza,
    loading,
    error,
    cargarElementosLimpieza,
  } = useElementosLimpieza(verInactivos);
  const {
    paginados: elementosPaginados,
    totalPaginas,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(elementosLimpieza, verInactivos, PAGE_SIZE);

  const { borrar, reactivar, loading: procesando } = useElementoLimpiezaABM();

  const [elementoAEliminar, setElementoAEliminar] = useState<ElementoLimpieza | null>(null);
  const [elementoAReactivar, setElementoAReactivar] = useState<ElementoLimpieza | null>(null);


 const handleConfirmReactivar = async () => { 
  if (!elementoAReactivar) return; 
  try { 
    await reactivar(elementoAReactivar.id); 
    setElementoAReactivar(null); 
    await cargarElementosLimpieza(); 
  } catch {
    // The mutation hook exposes the failure state to this page.
  }

};

  const handleEdit = (elemento: ElementoLimpieza) => {
    navigate(`/elementos-limpieza/${elemento.id}/editar`);
  };

  const handleDeleteRequest = (elemento: ElementoLimpieza) => {
    setElementoAEliminar(elemento);
  };

  const handleCloseDeleteDialog = () => {
    if (procesando) return;
    setElementoAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!elementoAEliminar) return;
    try {
      await borrar(elementoAEliminar.id);
      setElementoAEliminar(null);
      await cargarElementosLimpieza();
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          {verInactivos
            ? "Elementos de Limpieza Dados de Baja"
            : "Gestión de Elementos de Limpieza"}
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
          onClick={() => navigate("/elementos-limpieza/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      <HStack justify="flex-end" mb="20px">
        <Switch.Root
          checked={verInactivos}
          onCheckedChange={(e) => {
            setVerInactivos(e.checked);
            setPage(1);
          }}
          colorPalette="gray"
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label
            style={{
              fontSize: "14px",
              color: verInactivos ? PELIGRO : TEXTO_SECUNDARIO,
              fontWeight: verInactivos ? "bold" : "normal",
            }}
          >
            Ver dados de baja
          </Switch.Label>
        </Switch.Root>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <ElementoLimpiezaTable
            elementos={elementosPaginados}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={(elemento) => setElementoAReactivar(elemento)}
          />

          {hayVariasPaginas && (
            <Pagination.Root
              count={totalPaginas}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={(e) => setPage(e.page)}
              mt="16px"
            >
              <HStack justify="center">
                <ButtonGroup variant="ghost" size="sm">
                  <Pagination.Items
                    render={(pageItem) => {
                      const isSelected = pageItem.value === page;
                      return (
                        <IconButton
                          aria-label={`Página ${pageItem.value}`}
                          bg={isSelected ? TEAL : "transparent"}
                          color={isSelected ? "white" : TEAL}
                          border={isSelected ? "none" : `1px solid ${TEAL}`}
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
        isOpen={elementoAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el elemento{" "}
            <strong>{elementoAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={elementoAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el elemento de limpieza ${elementoAReactivar?.nombre}?`}
        isLoading={procesando}
        onCancel={() => {
          if (!procesando) setElementoAReactivar(null);
        }}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
