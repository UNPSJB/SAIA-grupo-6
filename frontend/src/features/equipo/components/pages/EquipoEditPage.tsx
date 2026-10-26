import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { EquipoForm } from "../../components/EquipoForm";
import { useEquipo } from "../../hooks/useEquipo";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { EquipoInput } from "../../types/equipo";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

export function EquipoEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const equipoId = Number(id);

  const {
    equipo,
    loading: cargando,
    error: errorCarga,
  } = useEquipo(Number.isFinite(equipoId) ? equipoId : null);
  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useEquipoABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: EquipoInput) => {
    try {
      await modificar(equipoId, values);
      setExito(true);
      // Espera 2 segundos para que el usuario lea el cartel antes de volver a la lista
      delayedNavigate("/equipos");
    } catch {
      // El error ya queda reflejado en useEquipoABM().error
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Editar Equipo"
        description="Modificá los datos del equipo."
        actions={
          <BotonVolver onClick={() => navigate("/equipos")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando datos del Equipo...</Text>
        </Stack>
      )}

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {!cargando && !errorCarga && equipo && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <EquipoForm
            key={equipo.id}
            initialValues={{
              nombre: equipo.nombre,
              tipo: equipo.tipo,
              sector_id: equipo.sector_id,
              activo: equipo.activo,
            }}
            sectorActual={equipo.sector}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Equipo"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/equipos")}
          />
        </>
      )}

      <DialogoExito
        isOpen={exito}
        mensaje="Equipo modificado correctamente."
      />
    </Box>
  );
}