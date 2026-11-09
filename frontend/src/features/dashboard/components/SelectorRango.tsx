import { Box, Field, HStack } from "@chakra-ui/react";
import { hoyISO } from "../../../common/utils/fechas";
import { FormInput, LabelFiltro } from "../../../components/ui/patrones";

/**
 * "Desde / Hasta" de las tarjetas del panel (producción, incidentes por
 * categoría, iniciados vs resueltos). Antes cada tarjeta armaba sus dos
 * inputs a mano; así se ven y se comportan igual en las tres.
 *
 * "Hasta" no deja elegir una fecha futura, y cada extremo limita al otro
 * (`max` / `min`) para que no se pueda armar un rango al revés desde el
 * calendario del navegador.
 */
export function SelectorRango({
  desde,
  hasta,
  onCambio,
}: {
  desde: string;
  hasta: string;
  onCambio: (desde: string, hasta: string) => void;
}) {
  const hoy = hoyISO();
  return (
    <HStack gap="3" flexWrap="wrap" align="flex-end">
      <Box minW="140px">
        <Field.Root>
          <LabelFiltro>Desde</LabelFiltro>
          <FormInput
            type="date"
            value={desde}
            max={hasta || hoy}
            onChange={(event) => onCambio(event.target.value, hasta)}
            w="auto"
            size="sm"
          />
        </Field.Root>
      </Box>
      <Box minW="140px">
        <Field.Root>
          <LabelFiltro>Hasta</LabelFiltro>
          <FormInput
            type="date"
            value={hasta}
            min={desde || undefined}
            max={hoy}
            onChange={(event) => onCambio(desde, event.target.value)}
            w="auto"
            size="sm"
          />
        </Field.Root>
      </Box>
    </HStack>
  );
}
