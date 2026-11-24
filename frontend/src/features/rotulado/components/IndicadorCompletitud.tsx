import { Badge, Box, Button, HStack, SimpleGrid, Stack, Text, chakra } from "@chakra-ui/react";
import { Link } from "react-router-dom";

interface Props {
  soloLectura?: boolean;
  compacto?: boolean;
  /** Título del bloque ("Estado del rótulo" por defecto). */
  titulo?: string;
  /** Barra de progreso también en la versión compacta (menú lateral del editor). */
  barra?: boolean;
  /** Sin la insignia "En preparación" (cuando ya está en el encabezado). */
  sinInsignia?: boolean;
  destinoPendiente?: (campo: string) => string | undefined;
  /** Ir al campo dentro de la misma página (en vez de un enlace). */
  onIrA?: (campo: string) => void;
  completitud: { estado_global: string; campos: { nombre: string; etiqueta: string; estado: string; motivo?: string | null }[] };
}
export function IndicadorCompletitud({
  completitud, soloLectura = false, compacto = false, titulo = "Estado del rótulo", barra = false,
  sinInsignia = false, destinoPendiente, onIrA,
}: Props) {
  const pendientes = completitud.campos.filter(c => c.estado === "pendiente" || c.estado === "sin_datos_origen");
  const completos = completitud.campos.filter(c => c.estado === "completo").length;
  const noAplicables = completitud.campos.filter(c => c.estado === "no_aplicable").length;
  const total = completos + pendientes.length;
  const porcentaje = total ? Math.round(completos / total * 100) : 0;
  const progreso = <Box role="progressbar" aria-label="Completitud de campos aplicables" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} w="full" bg={{ base: "blackAlpha.200", _dark: "whiteAlpha.200" }} rounded="full" overflow="hidden" h="1.5">
    <Box w={`${porcentaje}%`} h="full" rounded="full" bg="green.500" transition="width 0.2s" />
  </Box>;
  return <Box bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" rounded="xl" p={compacto ? "4" : { base: "4", md: "6" }} mb={compacto ? "0" : "8"}>
    <HStack justify="space-between" align={compacto ? "center" : "start"} gap={compacto ? "2" : "4"} mb={compacto ? "0" : "4"} flexWrap="wrap">
      <Box><Text fontWeight="semibold">{titulo}</Text>{!soloLectura && !compacto && <Text fontSize="sm" color="fg.muted">Se actualiza mientras completás el formulario.</Text>}</Box>
      {/* Con barra (menú lateral, angosto) el resumen se ve como tres métricas
          y la frase queda para lectores de pantalla. */}
      {compacto && <Text fontSize="sm" lineHeight="1.5" srOnly={barra || undefined}>{completos} completos · {pendientes.length} pendientes · {noAplicables} no aplicables</Text>}
      {!sinInsignia && <Badge colorPalette={pendientes.length ? "orange" : "green"} rounded="full" px="3" py="1">{pendientes.length ? "En preparación" : "Datos completos"}</Badge>}
    </HStack>
    {compacto && barra && <>
      <SimpleGrid aria-hidden columns={3} gap="2" mt="3">
        {[[completos, "completos", "green.fg"], [pendientes.length, "pendientes", "orange.fg"], [noAplicables, "no aplican", "fg.muted"]].map(([valor, etiqueta, color]) =>
          <Box key={etiqueta} minW="0">
            <Text fontSize="lg" fontWeight="semibold" lineHeight="1.2" color={color as string} fontVariantNumeric="tabular-nums">{valor}</Text>
            <Text fontSize="12px" lineHeight="1.4" color="fg.muted" whiteSpace="nowrap">{etiqueta}</Text>
          </Box>
        )}
      </SimpleGrid>
      <Box mt="3">{progreso}</Box>
    </>}
    {!compacto && <>
    <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3" mb="4">
      {[{ texto: `${completos} completos`, color: "green" }, { texto: `${pendientes.length} pendientes`, color: "orange" }, { texto: `${noAplicables} no aplicables`, color: "gray" }].map(item =>
        <Box key={item.color} bg="bg.panel" borderWidth="1px" borderColor="border.subtle" rounded="lg" p="3"><Badge colorPalette={item.color} variant="plain" fontSize="sm">{item.texto}</Badge></Box>
      )}
    </SimpleGrid>
    {progreso}
    <Text fontSize="xs" color="fg.muted" mt="2">{porcentaje}% de los campos aplicables completos</Text>
    </>}
    {pendientes.length > 0 && <chakra.details mt={compacto ? "3" : "4"} open={(soloLectura && !compacto) || undefined}>
      <Box as="summary" cursor="pointer" fontSize="sm" fontWeight="medium">Ver campos pendientes ({pendientes.length})</Box>
      <Stack gap="2.5" mt="3">{pendientes.map(campo => {
        const destino = destinoPendiente?.(campo.nombre);
        return <HStack key={campo.nombre} gap="2" align="start" flexWrap="wrap">
        <Badge colorPalette={campo.estado === "sin_datos_origen" ? "blue" : "orange"} size="sm">{campo.estado === "sin_datos_origen" ? "Sin datos de origen" : "Pendiente"}</Badge>
        <Text fontSize="sm" flex="1" minW="0">{campo.etiqueta}{campo.motivo ? ` — ${campo.motivo}` : ""}</Text>
        {destino && <Button asChild size="xs" variant="outline" ms="auto">
          <Link to={destino} aria-label={`Completar ${campo.etiqueta}`}>Completar</Link>
        </Button>}
        {!destino && onIrA && <Button type="button" size="xs" variant="ghost" ms="auto"
          aria-label={`Ir a ${campo.etiqueta}`} onClick={() => onIrA(campo.nombre)}>Ir</Button>}
      </HStack>; })}</Stack>
    </chakra.details>}
  </Box>;
}
