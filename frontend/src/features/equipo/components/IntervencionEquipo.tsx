import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Portal, Text } from "@chakra-ui/react";
import { RegistrarCalibracionDialog } from "./RegistrarCalibracionDialog";
import { useEquipoABM } from "../hooks/useEquipoABM";
import { usePlanesCalibracionMantenimiento } from "../../planCalibracionMantenimiento/hooks/usePlanesCalibracionMantenimiento";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";
import { DialogoExito } from "../../../components/ui/patrones";
import type { Equipo, TipoIntervencion } from "../types/equipo";

interface IntervencionEquipoProps {
  equipo: Equipo;
  /** Se llama cuando hay que cerrar: al cancelar o después del cartel de éxito. */
  onCerrar: () => void;
  /** Se llama solo cuando la intervención se registró bien (antes de cerrar). */
  onRegistrada?: () => void;
}

const mismoTipo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const nombreTipo = (tipo: TipoIntervencion) =>
  String(tipo).toLowerCase().startsWith("calib") ? "calibración" : "mantenimiento";

/** Aviso cuando el equipo no se puede intervenir (no tiene plan o no se pudo verificar). */
function AvisoSinPlan({
  mensaje,
  onCrearPlan,
  onCerrar,
}: {
  mensaje: string;
  onCrearPlan: () => void;
  onCerrar: () => void;
}) {
  return (
    <Portal>
      <Box
        position="fixed"
        inset="0"
        bg="blackAlpha.600"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex={1000}
      >
        <Box bg="white" rounded="xl" p="6" maxW="420px" w="90vw" boxShadow="lg">
          <Text fontSize="lg" fontWeight="bold" mb="2">
            No se puede registrar la intervención
          </Text>
          <Text color="fg.muted" mb="5">
            {mensaje}
          </Text>
          <Box display="flex" gap="3" justifyContent="flex-end">
            <Button variant="outline" onClick={onCerrar}>
              Cerrar
            </Button>
            <Button colorPalette="brand" onClick={onCrearPlan}>
              Crear plan
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}

/**
 * Registrar una intervención (calibración o mantenimiento) sobre un equipo.
 * Antes de abrir el diálogo verifica que el equipo tenga un plan, y al
 * confirmar que tenga uno del tipo elegido. Se usa desde la lista de equipos
 * y desde la página de intervención (a la que llevan las notificaciones).
 */
export function IntervencionEquipo({ equipo, onCerrar, onRegistrada }: IntervencionEquipoProps) {
  const navigate = useNavigate();
  const { registrarIntervencion, registrandoIntervencion, errorIntervencion } = useEquipoABM();
  const { planes, loading: cargandoPlanes, error: errorPlanes } = usePlanesCalibracionMantenimiento();

  const [exito, setExito] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const temporizador = useRef<number | undefined>(undefined);

  // Si la persona se va antes de que termine el cartel, no se dispara nada.
  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const planesDelEquipo = useMemo(
    () => planes.filter((p) => p.equipo_id === equipo.id),
    [planes, equipo.id]
  );

  const verificado = !cargandoPlanes;
  const puedeRegistrar = verificado && !errorPlanes && planesDelEquipo.length > 0;
  const hayAviso = verificado && (Boolean(errorPlanes) || planesDelEquipo.length === 0);

  const handleConfirm = async (fecha: string, archivo: File, tipo: TipoIntervencion) => {
    // El equipo tiene que tener un plan del tipo que se está registrando.
    if (!planesDelEquipo.some((p) => mismoTipo(String(p.tipo), String(tipo)))) {
      setErrorPlan(
        `Este equipo no tiene un plan de ${nombreTipo(tipo)}. Creá el plan antes de registrar la intervención.`
      );
      return;
    }

    setErrorPlan(null);
    try {
      await registrarIntervencion(equipo.id, fecha, archivo, tipo);
      notificarCambioNotificaciones(); // la alerta de la campana se actualiza
      setExito(true);

      temporizador.current = window.setTimeout(() => {
        setExito(false);
        onRegistrada?.();
        onCerrar();
      }, 2500);
    } catch {
      // El hook expone el error en `errorIntervencion`. El diálogo queda abierto
      // con los datos cargados para poder reintentar.
    }
  };

  return (
    <>
      <RegistrarCalibracionDialog
        isOpen={puedeRegistrar && !exito}
        equipo={equipo}
        isLoading={registrandoIntervencion}
        error={errorPlan ?? errorIntervencion}
        onClose={() => {
          if (!registrandoIntervencion) onCerrar();
        }}
        onConfirm={handleConfirm}
      />

      {hayAviso && (
        <AvisoSinPlan
          mensaje={
            errorPlanes
              ? "No se pudo verificar si el equipo tiene un plan de calibración o mantenimiento. Probá de nuevo."
              : `El equipo «${equipo.nombre}» no tiene ningún plan de calibración ni de mantenimiento. Creá uno para poder registrar intervenciones.`
          }
          onCrearPlan={() => navigate("/planes-calibracion-mantenimiento/nuevo")}
          onCerrar={onCerrar}
        />
      )}

      <DialogoExito
        isOpen={exito}
        mensaje="Intervención registrada y calculada correctamente."
      />
    </>
  );
}