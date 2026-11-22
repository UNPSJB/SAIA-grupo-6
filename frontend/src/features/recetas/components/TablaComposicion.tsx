import { Badge, Box, Heading, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { cantidadConUnidad, formatoPorcentajeFino } from "../../../common/utils/numeros";
import { Celda, EncabezadoOscuro, FilaEncabezado, Tarjeta } from "../../../components/ui/patrones";
import {
  type Composicion,
  type ComposicionFaltante,
  type ComposicionItem,
} from "../types/receta";

function Grupo({ titulo, items }: { titulo: string; items: ComposicionItem[] }) {
  if (items.length === 0) return null;
  return (
    <Box>
      <Heading as="h4" size="md" mb="3">{titulo}</Heading>
      <Tarjeta overflowX="auto">
        <Table.Root variant="outline" w="100%" minW="520px">
          <Table.Header>
            <FilaEncabezado>
              <EncabezadoOscuro>Ingrediente</EncabezadoOscuro>
              <EncabezadoOscuro numero width="20%">En la receta</EncabezadoOscuro>
              <EncabezadoOscuro numero width="20%">En gramos</EncabezadoOscuro>
              {/* En % como las otras: `width="18"` eran 18px y la columna se cortaba; 24% para que "Porcentaje" entre en una línea. */}
              <EncabezadoOscuro numero width="24%">Porcentaje</EncabezadoOscuro>
            </FilaEncabezado>
          </Table.Header>
          <Table.Body>
            {items.map((i) => (
              <Table.Row key={i.ingrediente.id}>
                <Celda>{i.ingrediente.nombre}</Celda>
                <Celda numero color="fg.muted">
                  {cantidadConUnidad(i.cantidad, i.unidad_medida.simbolo)}
                </Celda>
                <Celda numero>{cantidadConUnidad(i.gramos, "g")}</Celda>
                <Celda numero fontWeight="bold">{formatoPorcentajeFino(i.porcentaje)}</Celda>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Tarjeta>
    </Box>
  );
}

export function TablaComposicion({ composicion }: { composicion: Composicion }) {
  return (
    <Stack gap="6">
      <Grupo titulo="Ingredientes" items={composicion.ingredientes} />
      <Grupo titulo="Aditivos" items={composicion.aditivos} />
    </Stack>
  );
}

export function ResumenComposicion({ composicion }: { composicion: Composicion }) {
  return (
    <HStack gap="4" wrap="wrap">
      <Text>
        Total de la formulación:{" "}
        <Text as="span" fontWeight="bold">
          {cantidadConUnidad(composicion.total_gramos, "g")}
        </Text>
      </Text>
      <Badge colorPalette={composicion.suma_correcta ? "green" : "orange"} variant="subtle" whiteSpace="normal" h="auto" py="0.5">
        Suma de porcentajes: {formatoPorcentajeFino(composicion.suma_porcentajes)}
        {composicion.suma_correcta ? " (dentro del redondeo)" : " (revisar)"}
      </Badge>
    </HStack>
  );
}

export function FaltantesComposicion({ faltantes }: { faltantes: ComposicionFaltante[] }) {
  return (
    <Tarjeta p="5">
      <Heading as="h4" size="md" mb="2">No se puede calcular todavía</Heading>
      <Text color="fg.muted" mb="3">
        Completá estos datos en el maestro de ingredientes o de unidades de medida:
      </Text>
      <Stack gap="2">
        {faltantes.map((f) => (
          <Text key={f.ingrediente.id} fontSize="sm">
            <Text as="span" fontWeight="bold">{f.ingrediente.nombre}</Text>{" "}
            {f.es_aditivo ? "(aditivo)" : ""}: {f.motivo}
          </Text>
        ))}
      </Stack>
    </Tarjeta>
  );
}