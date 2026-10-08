import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box, Button, Heading, HStack, Spinner } from "@chakra-ui/react";
import { ElementoLimpiezaTable } from "../ElementoLimpiezaTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useElementosLimpieza } from "../../hooks/useElementosLimpieza";
import { useElementoLimpiezaABM } from "../../hooks/useElementoLimpiezaABM";
import type { ElementoLimpieza } from "../../types/elementoLimpieza";
import { BannerError, Paginacion, ToggleInactivos } from "../../../../components/ui/patrones";

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

  const [elementoAEliminar, setElementoAEliminar] =
    useState<ElementoLimpieza | null>(null);
  const [elementoAReactivar, setElementoAReactivar] =
    useState<ElementoLimpieza | null>(null);

  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
  };

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
    <Box p="5">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          {verInactivos
            ? "Elementos de Limpieza Dados de Baja"
            : "Gestión de Elementos de Limpieza"}
        </Heading>
        <Button
          colorPalette="brand"
          fontSize="md"
          fontWeight="bold"
          rounded="md"
          px="5"
          py="2.5"
          onClick={() => navigate("/elementos-limpieza/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>


      <ToggleInactivos
        checked={verInactivos}
        
         onChange={handleToggleInactivos}
         children="Ver dados de baja"
      />

      {error && <BannerError>{error}</BannerError>}
      {loading && <Spinner color="brand.500" />}

      {!loading && !error && (
        <>
          <ElementoLimpiezaTable
            elementos={elementosPaginados}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={(elemento) => setElementoAReactivar(elemento)}
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
