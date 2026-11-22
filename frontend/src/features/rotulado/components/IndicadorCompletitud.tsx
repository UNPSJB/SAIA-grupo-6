import { Badge, Box, Button, HStack, SimpleGrid, Stack, Text, chakra } from "@chakra-ui/react";
import { Link } from "react-router-dom";

interface Props {
  soloLectura?: boolean;
  compacto?: boolean;
  destinoPendiente?: (campo: string) => string | undefined;
  completitud: { estado_global: string; campos: { nombre: string; etiqueta: string; estado: string; motivo?: string | null }[] };
}
export function IndicadorCompletitud({ completitud, soloLectura = false, compacto = false, destinoPendiente }: Props) {
  const pendientes = completitud.campos.filter(c => c.estado === "pendiente" || c.estado === "sin_datos_origen");
  const completos = completitud.campos.filter(c => c.estado === "completo").length;
  const noAplicables = completitud.campos.filter(c => c.estado === "no_aplicable").length;
  const total = completos + pendientes.length;
  const porcentaje = total ? Math.round(completos / total * 100) : 0;
  return <Box bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" rounded="xl" p={compacto ? "3" : { base: "4", md: "6" }} mb={compacto ? "0" : "8"}>
    <HStack justify="space-between" align="start" gap={compacto ? "2" : "4"} mb={compacto ? "0" : "4"} flexWrap="wrap">
      <Box><Text fontWeight="semibold">Estado del rótulo</Text>{!soloLectura && <Text fontSize="sm" color="fg.muted">Se actualiza mientras completás el formulario.</Text>}</Box>
      {compacto && <Text fontSize="sm">{completos} completos · {pendientes.length} pendientes · {noAplicables} no aplicables</Text>}
      <Badge colorPalette={pendientes.length ? "orange" : "green"} rounded="full" px="3" py="1">{pendientes.length ? "En preparación" : "Datos completos"}</Badge>
    </HStack>
    {!compacto && <>
    <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3" mb="4">
      {[{ texto: `${completos} completos`, color: "green" }, { texto: `${pendientes.length} pendientes`, color: "orange" }, { texto: `${noAplicables} no aplicables`, color: "gray" }].map(item =>
        <Box key={item.color} bg="bg.panel" borderWidth="1px" borderColor="border.subtle" rounded="lg" p="3"><Badge colorPalette={item.color} variant="plain" fontSize="sm">{item.texto}</Badge></Box>
      )}
    </SimpleGrid>
    <Box role="progressbar" aria-label="Completitud de campos aplicables" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} bg="bg.muted" rounded="full" overflow="hidden" h="2">
      <Box w={`${porcentaje}%`} h="full" bg="green.500" transition="width 0.2s" />
    </Box>
    <Text fontSize="xs" color="fg.muted" mt="2">{porcentaje}% de los campos aplicables completos</Text>
    </>}
    {pendientes.length > 0 && <chakra.details mt="4" open={(soloLectura && !compacto) || undefined}>
      <Box as="summary" cursor="pointer" fontSize="sm" fontWeight="medium">Ver campos pendientes ({pendientes.length})</Box>
      <Stack gap="2" mt="3">{pendientes.map(campo => {
        const destino = destinoPendiente?.(campo.nombre);
        return <HStack key={campo.nombre} gap="3" align="start" flexWrap="wrap">
        <Badge colorPalette={campo.estado === "sin_datos_origen" ? "blue" : "orange"} size="sm">{campo.estado === "sin_datos_origen" ? "Sin datos de origen" : "Pendiente"}</Badge>
        <Text fontSize="sm">{campo.etiqueta}{campo.motivo ? ` — ${campo.motivo}` : ""}</Text>
        {destino && <Button asChild size="xs" variant="outline" ms="auto">
          <Link to={destino} aria-label={`Completar ${campo.etiqueta}`}>Completar</Link>
        </Button>}
      </HStack>; })}</Stack>
    </chakra.details>}
  </Box>;
}
