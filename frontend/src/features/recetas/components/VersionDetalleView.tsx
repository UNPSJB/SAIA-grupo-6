import { Badge, Box, Heading, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { formatoFechaHora } from "../../../common/utils/fechas";
import {
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { etiquetaEsAditivo, type VersionDetalle } from "../types/receta";
import { textoPorcion } from "../utils/porcion";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Text fontSize="sm" color="fg.muted">
      {etiqueta}:{" "}
      <Text as="span" fontWeight="bold" color="fg">
        {valor}
      </Text>
    </Text>
  );
}

export function VersionDetalleView({ version }: { version: VersionDetalle }) {
  // Ingredientes primero y aditivos después, como se declaran en el rótulo.
  const ingredientes = [...version.ingredientes].sort(
    (a, b) => Number(a.es_aditivo) - Number(b.es_aditivo),
  );
  const porcion = textoPorcion(version);

  return (
    <Stack gap="6">
      <HStack gap="6" flexWrap="wrap">
        <Dato
          etiqueta="Rendimiento"
          valor={cantidadConUnidad(version.rendimiento, version.unidad_medida.simbolo)}
        />
        <Dato etiqueta="Porción o unidad de venta" valor={porcion ?? "Sin indicar"} />
        <Dato
          etiqueta="Vida útil"
          valor={
            version.vida_util_dias !== null && version.vida_util_dias !== undefined
              ? `${version.vida_util_dias} días`
              : "Sin definir"
          }
        />
        <Dato etiqueta="Creada el" valor={formatoFechaHora(version.creado_en)} />
      </HStack>

      <Box>
        <Heading as="h4" size="md" mb="3">
          Ingredientes y aditivos
        </Heading>
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="720px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Ingrediente</EncabezadoOscuro>
                <EncabezadoOscuro ancho="angosta">Aditivo</EncabezadoOscuro>
                <EncabezadoOscuro ancho="amplia">Clase funcional e INS</EncabezadoOscuro>
                <EncabezadoOscuro numero ancho="media">Cantidad</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {ingredientes.map((i) => (
                <Table.Row key={i.id}>
                  <Celda>{i.ingrediente.nombre}</Celda>
                  <Celda>
                    <Badge colorPalette={i.es_aditivo ? "purple" : "gray"} variant="subtle">
                      {etiquetaEsAditivo(i.es_aditivo)}
                    </Badge>
                  </Celda>
                  <Celda>
                    {i.aditivo ? (
                      <Stack gap="0">
                        <Text fontSize="sm" color="fg">
                          {i.aditivo.clase_funcional}
                        </Text>
                        {/* El nombre no va: es el del ingrediente, en la primera columna. */}
                        <Text fontSize="xs" color="fg.muted">
                          {i.aditivo.numero_ins ? `INS ${i.aditivo.numero_ins}` : "Sin INS (se declara por su función)"}
                        </Text>
                      </Stack>
                    ) : (
                      <Text fontSize="sm" color="fg.subtle">
                        -
                      </Text>
                    )}
                  </Celda>
                  <Celda numero>{cantidadConUnidad(i.cantidad, i.unidad_medida.simbolo)}</Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      </Box>

      <Box>
        <Heading as="h4" size="md" mb="3">
          Tareas
        </Heading>
        <Stack gap="3">
          {version.tareas.map((t) => (
            <Tarjeta key={t.id} p="4">
              <Text fontWeight="bold" color="fg">
                {t.orden}. {t.descripcion}
              </Text>
              {t.procedimiento && (
                <Text fontSize="sm" color="fg.muted" mt="1" whiteSpace="pre-line">
                  {t.procedimiento}
                </Text>
              )}
              {t.ingredientes.length === 0 ? (
                <Text fontSize="sm" color="fg.subtle" mt="1">
                  Sin ingredientes asignados.
                </Text>
              ) : (
                <Stack gap="1" mt="2">
                  {t.ingredientes.map((u) => {
                    const unidad = version.ingredientes.find((i) => i.id === u.receta_ingrediente_id)
                      ?.unidad_medida.simbolo;
                    return (
                      <Text key={u.receta_ingrediente_id} fontSize="sm" color="fg.muted">
                        {u.ingrediente.nombre}: {cantidadConUnidad(u.cantidad, unidad)}
                      </Text>
                    );
                  })}
                </Stack>
              )}
            </Tarjeta>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
