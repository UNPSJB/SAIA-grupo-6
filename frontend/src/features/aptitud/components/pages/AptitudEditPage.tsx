import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { AptitudForm } from "../AptitudForm";
import { useAptitud } from "../../hooks/useAptitud";
import { useAptitudABM } from "../../hooks/useAptitudABM";
import type { Aptitud } from "../../types/aptitud";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

export function AptitudEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const aptitudId = Number(id);

  const { aptitud, loading: cargando, error: errorCarga } = useAptitud(Number.isFinite(aptitudId) ? aptitudId : null);
  const { modificar, loading: guardando, error: errorGuardado } = useAptitudABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Aptitud, "id" | "activo">) => {
    try {
      await modificar(aptitudId, values);
      setExito(true);
      delayedNavigate("/aptitudes");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Editar aptitud"
        actions={
          <BotonVolver onClick={() => navigate("/aptitudes")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}
      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando datos de la aptitud...</Text>
        </Stack>
      )}

      {!cargando && !errorCarga && aptitud && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <AptitudForm
            key={aptitud.id}
            initialValues={{ nombre: aptitud.nombre, descripcion: aptitud.descripcion || "" }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar aptitud"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/aptitudes")}
          />
        </>
      )}

      <DialogoExito isOpen={exito} mensaje="Aptitud modificada correctamente." />
    </Box>
  );
}
