import { useState } from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { LuCalendarClock } from "react-icons/lu";
import {
  AccionesFormulario,
  BotonGuardar,
  FormField,
  FormInput,
  MensajeError,
  Tarjeta,
} from "../../../components/ui/patrones";

// Mismo rango que valida el backend (`ConfiguracionAlertasUpdate`).
const DIAS_MINIMO = 1;
const DIAS_MAXIMO = 365;

/** El texto tiene que ser un entero dentro del rango; si no, `null`. */
function parsearDias(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;
  const dias = Number(limpio);
  return dias >= DIAS_MINIMO && dias <= DIAS_MAXIMO ? dias : null;
}

interface AlertasVencimientoPersonalCardProps {
  /** Valor que hoy está guardado en el servidor. */
  diasGuardados: number;
  guardando: boolean;
  /** Devuelve `true` si se guardó. */
  onGuardar: (dias: number) => Promise<boolean>;
  /** Se llama al editar el campo, para limpiar mensajes de un guardado anterior. */
  onEditar: () => void;
}

export function AlertasVencimientoPersonalCard({
  diasGuardados,
  guardando,
  onGuardar,
  onEditar,
}: AlertasVencimientoPersonalCardProps) {
  const [texto, setTexto] = useState(String(diasGuardados));

  const dias = parsearDias(texto);
  const invalido = dias === null;
  const sinCambios = dias === diasGuardados;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dias === null || sinCambios) return;
    void onGuardar(dias);
  };

  return (
    <Tarjeta p={{ base: "5", md: "6" }}>
      <Box as="form" onSubmit={handleSubmit} noValidate>
        <HStack gap="3" align="flex-start" mb="5">
          <Box color="brand.700" mt="0.5" aria-hidden>
            <LuCalendarClock size={22} />
          </Box>
          <Box>
            <Text fontWeight="bold" color="fg">
              Vencimientos del personal
            </Text>
            <Text mt="1" fontSize="sm" color="fg.muted">
              Con cuántos días de antelación el sistema avisa, en el centro de
              notificaciones, que se acerca el vencimiento de una aptitud del
              personal.
            </Text>
          </Box>
        </HStack>

        <FormField
          label="Días de antelación"
          invalid={texto !== "" && invalido}
          helper={`Entre ${DIAS_MINIMO} y ${DIAS_MAXIMO} días. Actualmente se alerta con ${diasGuardados} ${
            diasGuardados === 1 ? "día" : "días"
          } de antelación.`}
          mb="0"
        >
          <FormInput
            type="number"
            inputMode="numeric"
            min={DIAS_MINIMO}
            max={DIAS_MAXIMO}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              onEditar();
            }}
            maxW="160px"
          />
          {texto !== "" && invalido ? (
            <MensajeError>
              Ingresá un número entero entre {DIAS_MINIMO} y {DIAS_MAXIMO}.
            </MensajeError>
          ) : null}
        </FormField>

        <AccionesFormulario>
          <BotonGuardar loading={guardando} disabled={invalido || sinCambios}>
            Guardar cambios
          </BotonGuardar>
        </AccionesFormulario>
      </Box>
    </Tarjeta>
  );
}
