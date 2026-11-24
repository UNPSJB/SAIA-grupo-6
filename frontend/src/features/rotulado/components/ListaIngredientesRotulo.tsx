import { Badge, HStack, Text } from "@chakra-ui/react";
import type { ResumenDeclaracion } from "../utils/textoRotulo";

/** Estado de la declaración de alérgenos que va al final de la lista. */
export function EstadoAlergenos({ declaracion }: { declaracion?: ResumenDeclaracion | null }) {
  if (!declaracion) {
    return (
      <Badge colorPalette="gray" variant="subtle" alignSelf="flex-start">
        Alérgenos: sin propuesta todavía
      </Badge>
    );
  }

  const confirmada = declaracion.estado === "confirmada" && declaracion.vigencia === "vigente";
  const sinGuardar = declaracion.revision === 0;
  const sinAlergenos = declaracion.texto.trim() === "";
  const etiqueta = confirmada
    ? "Alérgenos confirmados"
    : sinGuardar
      ? "Alérgenos sugeridos, sin guardar ni confirmar"
      : "Alérgenos sugeridos, falta confirmar";

  return (
    <HStack gap="2" wrap="wrap" data-testid="estado-alergenos">
      <Badge colorPalette={confirmada ? "green" : "orange"} variant="subtle" whiteSpace="normal" h="auto" py="0.5">
        {etiqueta}
      </Badge>
      {sinAlergenos && (
        <Text fontSize="xs" color="fg.subtle">
          La propuesta no declara ningún alérgeno.
        </Text>
      )}
    </HStack>
  );
}
