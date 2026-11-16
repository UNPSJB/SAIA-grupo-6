import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner, Stack, Text } from "@chakra-ui/react";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { useProveedor } from "../../hooks/useProveedor";
import { useProveedorABM } from "../../hooks/useProveedorABM";
import type { ProveedorFormValues } from "../../types/proveedor";
import { ProveedorForm } from "../ProveedorForm";
import { ProveedorComplementos } from "../ProveedorComplementos";

export function ProveedorEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const proveedorId = Number(id);

  const { proveedor, loading: cargando, error: errorCarga, recargar: recargarProveedor } = useProveedor(
    Number.isFinite(proveedorId) ? proveedorId : null
  );
  const { modificar, loading: guardando, error: errorGuardado } = useProveedorABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: ProveedorFormValues) => {
    try {
      await modificar(proveedorId, values);
      setExito(true);
      delayedNavigate("/proveedores");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <PaginaFormulario
      volver={{ a: "/proveedores", etiqueta: "Proveedores" }}
      titulo="Editar proveedor"
    >
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
            initialValues={{ nombre: proveedor.nombre, cuit: proveedor.cuit ?? proveedor.matricula, contacto: proveedor.contacto ?? "", domicilio: proveedor.domicilio ?? "", rubro: proveedor.rubro ?? "", es_certificado: proveedor.es_certificado }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar proveedor"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/proveedores")}
          />
          <ProveedorComplementos key={proveedor.id} proveedor={proveedor} onActualizado={() => { void recargarProveedor(); }} />
        </>
      )}

      <DialogoExito isOpen={exito} mensaje="Proveedor modificado correctamente." />
    </PaginaFormulario>
  );
}
