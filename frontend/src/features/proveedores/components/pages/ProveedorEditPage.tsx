import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";
import { useProveedor } from "../../hooks/useProveedor";
import { useProveedorABM } from "../../hooks/useProveedorABM";
import type { Proveedor } from "../../types/proveedor";
import { ProveedorForm } from "../ProveedorForm";

export function ProveedorEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const proveedorId = Number(id);

  const { proveedor, loading: cargando, error: errorCarga } = useProveedor(
    Number.isFinite(proveedorId) ? proveedorId : null
  );
  const { modificar, loading: guardando, error: errorGuardado } = useProveedorABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Proveedor, "id" | "activo">) => {
    try {
      await modificar(proveedorId, values);
      setExito(true);
      delayedNavigate("/proveedores");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Editar proveedor"
        actions={
          <BotonVolver onClick={() => navigate("/proveedores")}>Volver a la lista</BotonVolver>
        }
      />

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}
      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando datos del proveedor...</Text>
        </Stack>
      )}

      {!cargando && !errorCarga && proveedor && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <ProveedorForm
            key={proveedor.id}
            initialValues={{ nombre: proveedor.nombre, matricula: proveedor.matricula }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar proveedor"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/proveedores")}
          />
        </>
      )}

      <DialogoExito isOpen={exito} mensaje="Proveedor modificado correctamente." />
    </Box>
  );
}
