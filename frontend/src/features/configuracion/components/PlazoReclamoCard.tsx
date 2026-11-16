import { useState } from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { LuMessageSquare } from "react-icons/lu";
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

interface PlazoReclamoCardProps {
  /** Valor que hoy está guardado en el servidor. */
  plazoGuardado: number;
  guardando: boolean;
  /** Devuelve `true` si se guardó. */
  onGuardar: (dias: number) => Promise<boolean>;
  /** Se llama al editar el campo, para limpiar mensajes de un guardado anterior. */
  onEditar: () => void;
}

/**
 * Tarjeta de configuración del plazo de referencia para reclamos (Historia 20).
 *
 * Es solo una referencia: un reclamo fuera de plazo se registra igual y queda
 * con la etiqueta visible. El valor se congela en cada reclamo al registrarlo.
 */
export function PlazoReclamoCard({
  plazoGuardado,
  guardando,
  onGuardar,
  onEditar,
}: PlazoReclamoCardProps) {
  const [texto, setTexto] = useState(String(plazoGuardado));

  const dias = parsearDias(texto);
  const invalido = dias === null;
  const sinCambios = dias === plazoGuardado;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dias === null || sinCambios) return;
    void onGuardar(dias);
  };

  return (
    <Tarjeta p={{ base: "5", md: "6" }}>
      <form onSubmit={handleSubmit} noValidate>
        <HStack gap="3" align="flex-start" mb="5">
          <Box color="brand.700" mt="0.5" aria-hidden>
            <LuMessageSquare size={22} />
          </Box>
          <Box>
            <Text fontWeight="bold" color="fg">
              Plazo de referencia para reclamos
            </Text>
            <Text mt="1" fontSize="sm" color="fg.muted">
              Cuántos días desde la entrega se consideran “en plazo” para un
              reclamo de cliente. Los reclamos fuera de plazo se registran igual
              y se marcan.
            </Text>
          </Box>
        </HStack>

        <FormField
          label="Plazo de referencia para reclamos (días)"
          invalid={texto !== "" && invalido}
          helper={`Entre ${DIAS_MINIMO} y ${DIAS_MAXIMO} días. Actualmente el plazo es de ${plazoGuardado} ${
            plazoGuardado === 1 ? "día" : "días"
          }.`}
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
      </form>
    </Tarjeta>
  );
}
