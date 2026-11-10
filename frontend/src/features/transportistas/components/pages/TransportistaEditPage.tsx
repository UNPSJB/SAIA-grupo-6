import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner, Stack, Text } from "@chakra-ui/react";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { useTransportista } from "../../hooks/useTransportista";
import { useTransportistaABM } from "../../hooks/useTransportistaABM";
import type { Transportista } from "../../types/transportista";
import { TransportistaForm } from "../TransportistaForm";

export function TransportistaEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const transportistaId = Number(id);

  const { transportista, loading: cargando, error: errorCarga } = useTransportista(
    Number.isFinite(transportistaId) ? transportistaId : null
  );
  const { modificar, loading: guardando, error: errorGuardado } = useTransportistaABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Transportista, "id" | "activo">) => {
    try {
      await modificar(transportistaId, values);
      setExito(true);
      delayedNavigate("/transportistas");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <PaginaFormulario
      volver={{ a: "/transportistas", etiqueta: "Transportistas" }}
      titulo="Editar transportista"
    >
      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}
      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando datos del transportista...</Text>
        </Stack>
      )}

      {!cargando && !errorCarga && transportista && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <TransportistaForm
            key={transportista.id}
            initialValues={{
              razon_social: transportista.razon_social,
              cuit: transportista.cuit,
              telefono: transportista.telefono,
              email: transportista.email ?? "",
              domicilio: transportista.domicilio ?? "",
              observaciones: transportista.observaciones ?? "",
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar transportista"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/transportistas")}
          />
        </>
      )}

      <DialogoExito isOpen={exito} mensaje="Transportista modificado correctamente." />
    </PaginaFormulario>
  );
}
