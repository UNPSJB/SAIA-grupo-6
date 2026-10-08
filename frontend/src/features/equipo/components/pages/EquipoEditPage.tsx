import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { EquipoForm } from "../../components/EquipoForm";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { useEquipo } from "../../hooks/useEquipo";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { Equipo } from "../../types/equipo";
import { BannerError, BotonVolver, DialogoExito } from "../../../../components/ui/patrones";

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
  // Dar de baja desde el formulario pasa por la misma confirmación que exige
  // la tabla: antes el switch escribía `activo: false` sin preguntar nada.
  const [bajaSolicitada, setBajaSolicitada] = useState(false);
  const [bajaConfirmada, setBajaConfirmada] = useState(false);

  const handleConfirmarBaja = () => {
    setBajaSolicitada(false);
    setBajaConfirmada(true);
  };

  const handleSubmit = async (values: Omit<Equipo, "id">) => {
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
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Editar Equipo
        </Heading>
        <BotonVolver onClick={() => navigate("/equipos")}>
          Volver a la lista
        </BotonVolver>
      </HStack>

      {cargando && (
        <Stack direction="row" gap="3" align="center" color="gray.600">
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
              ubicacion: equipo.ubicacion,
              activo: equipo.activo,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Equipo"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/equipos")}
            mostrarBaja={true}
            onSolicitarBaja={() => setBajaSolicitada(true)}
            bajaConfirmada={bajaConfirmada}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={bajaSolicitada}
        titulo="Dar de baja el equipo"
        mensaje={`El equipo "${equipo?.nombre}" va a desaparecer de los listados. ¿Querés continuar?`}
        textoConfirmar="Sí, dar de baja"
        confirmPalette="red"
        isLoading={guardando}
        onCancel={() => setBajaSolicitada(false)}
        onConfirm={handleConfirmarBaja}
      />

      <DialogoExito
        isOpen={exito}
        mensaje="Equipo modificado correctamente."
      />
    </Box>
  );
}
