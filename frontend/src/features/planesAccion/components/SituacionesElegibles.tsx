import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";
import { formatoFecha } from "../../../common/utils/fechas";
import type { SituacionDisponible } from "../types/planAccion";

const PALETA_CRITICIDAD = { alta: "red", media: "orange", baja: "green" } as const;
const ETIQUETA_CRITICIDAD = { alta: "Alta", media: "Media", baja: "Baja" } as const;

/** Etiquetas de una situación: criticidad y, si corresponde, la sugerencia de SAIA. */
export function MarcasSituacion({ situacion }: { situacion: SituacionDisponible }) {
  return (
    <HStack gap="2" flexWrap="wrap">
      {situacion.criticidad && situacion.puntaje > 0 && (
        <Badge
          colorPalette={PALETA_CRITICIDAD[situacion.criticidad]}
          variant="subtle"
          rounded="full"
          px="2"
        >
          {ETIQUETA_CRITICIDAD[situacion.criticidad]}
        </Badge>
      )}
      {situacion.recurrencia >= 3 && (
        <Badge colorPalette="orange" variant="outline" rounded="full" px="2">
          Recurrente
        </Badge>
      )}
      {situacion.sugerir_plan && (
        <Badge colorPalette="brand" variant="solid" rounded="full" px="2" gap="1">
          <LuSparkles aria-hidden />
          SAIA sugiere un plan
        </Badge>
      )}
    </HStack>
  );
}

/** Texto de una situación: qué es, dónde y desde cuándo. */
export function TextoSituacion({ situacion }: { situacion: SituacionDisponible }) {
  return (
    <Box minW="0">
      <Text fontWeight="medium" fontSize="sm" color="fg">
        {situacion.titulo}
      </Text>
      {situacion.detalle && (
        <Text fontSize="xs" color="fg.muted" mt="0.5">
          {situacion.detalle}
        </Text>
      )}
      <Text fontSize="xs" color="fg.subtle" mt="0.5">
        {situacion.tipo_etiqueta} · presente desde el {formatoFecha(situacion.detectada_en)}
      </Text>
    </Box>
  );
}

/**
 * Lista de situaciones con casillas. Se usa para elegir las que se suman al
 * alcance de un plan.
 */
export function ListaSituacionesElegibles({
  situaciones,
  seleccionadas,
  onAlternar,
}: {
  situaciones: SituacionDisponible[];
  seleccionadas: number[];
  onAlternar: (situacionId: number) => void;
}) {
  return (
    <VStack align="stretch" gap="2">
      {situaciones.map((situacion) => {
        const marcada = seleccionadas.includes(situacion.situacion_id);
        return (
          <HStack
            key={situacion.situacion_id}
            as="label"
            align="flex-start"
            gap="3"
            p="3"
            rounded="md"
            borderWidth="1px"
            borderColor={marcada ? "brand.400" : "border.subtle"}
            bg={marcada ? "brand.subtle" : "bg.panel"}
            cursor="pointer"
          >
            <input
              type="checkbox"
              checked={marcada}
              onChange={() => onAlternar(situacion.situacion_id)}
              style={{ marginTop: 4 }}
            />
            <VStack align="stretch" gap="1" flex="1" minW="0">
              <TextoSituacion situacion={situacion} />
              <MarcasSituacion situacion={situacion} />
            </VStack>
          </HStack>
        );
      })}
    </VStack>
  );
}
