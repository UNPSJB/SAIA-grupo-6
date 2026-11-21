import { Flex, Stack, Text } from "@chakra-ui/react";
import type { FrontalPrevisualizacion } from "../../rotulado/types/rotulado";
import { esClaveSello } from "../types/rotuladoFrontal";
import { OctogonoAdvertencia } from "./OctogonoAdvertencia";

export function GrupoOctogonos({ frontal, soloEstado, soloSellos, alineacion = "end" }: {
  frontal: FrontalPrevisualizacion;
  soloEstado?: boolean;
  soloSellos?: boolean;
  alineacion?: "start" | "end";
}) {
  const sellos = frontal.estado === "aplica" ? frontal.sellos : null;
  const positivos = sellos?.resultados.filter((sello) => sello.evaluado && sello.exceso === true) ?? [];
  const sinExcesos = sellos?.evaluado && sellos.completo && positivos.length === 0;
  const motivos = new Set([
    ...frontal.faltantes, ...frontal.advertencias,
    ...(sellos?.resultados.flatMap((sello) => !sello.evaluado && sello.motivo ? [sello.motivo] : []) ?? []),
  ]);
  return (
    <Stack gap="2">
      {!soloEstado && positivos.length > 0 && <Flex gap="2" wrap="wrap" justify={alineacion}>
        {positivos.map(({ clave, etiqueta }) => esClaveSello(clave)
          ? <OctogonoAdvertencia key={clave} clave={clave} />
          : <Text key={clave}>Representación no disponible: {etiqueta}</Text>)}
      </Flex>}
      {!soloSellos && <>
        {sinExcesos && <Text>No corresponden octógonos.</Text>}
        {frontal.estado !== "aplica" && <Text fontWeight="semibold">{frontal.mensaje}</Text>}
        {frontal.estado === "aplica" && (!sellos?.evaluado || !sellos.completo) &&
          <Text color="orange.fg" fontWeight="semibold">{sellos?.motivo ?? "Evaluación frontal pendiente."}</Text>}
        {[...motivos].map((motivo) => <Text key={motivo} fontSize="sm">{motivo}</Text>)}
      </>}
    </Stack>
  );
}
