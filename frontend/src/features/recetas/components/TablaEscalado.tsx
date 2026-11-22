import { Badge, Box, Heading, Stack, Table, Text } from "@chakra-ui/react";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import {
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import { etiquetaEsAditivo, type RecetaEscalada } from "../types/receta";

/** Cantidades de la receta escalada: por ingrediente y por tarea. */
export function TablaEscalado({
  escalado,
  conTareas = true,
}: {
  escalado: RecetaEscalada;
  conTareas?: boolean;
}) {
  const ingredientes = [...escalado.ingredientes].sort(
    (a, b) => Number(a.es_aditivo) - Number(b.es_aditivo),
  );

  return (
    <Stack gap="6">
      <Box>
        <Heading as="h4" size="md" mb="3">
          Ingredientes y aditivos
        </Heading>
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="640px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Ingrediente</EncabezadoOscuro>
                <EncabezadoOscuro ancho="angosta">Aditivo</EncabezadoOscuro>
                <EncabezadoOscuro numero ancho="media">Receta (v{escalado.version.numero})</EncabezadoOscuro>
                <EncabezadoOscuro numero ancho="media">Para tu lote</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {ingredientes.map((i) => (
                <Table.Row key={i.ingrediente.id}>
                  <Celda>
                    <Text>
                      {i.ingrediente.nombre}
                      {i.ingrediente.activo === false && (
                        <Badge colorPalette="orange" variant="subtle" ml="2">
                          Dado de baja
                        </Badge>
                      )}
                    </Text>
                    {i.aditivo && (
                      <Text fontSize="xs" color="fg.muted">
                        {etiquetaAditivo(i.aditivo)}
                      </Text>
                    )}
                  </Celda>
                  <Celda>
                    <Badge colorPalette={i.es_aditivo ? "purple" : "gray"} variant="subtle">
                      {etiquetaEsAditivo(i.es_aditivo)}
                    </Badge>
                  </Celda>
                  <Celda numero color="fg.muted">{cantidadConUnidad(i.cantidad_receta, i.unidad_medida.simbolo)}</Celda>
                  <Celda numero fontWeight="bold">
                    {cantidadConUnidad(i.cantidad_escalada, i.unidad_medida.simbolo)}
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      </Box>

      {conTareas && (
        <Box>
          <Heading as="h4" size="md" mb="3">
            Por tarea
          </Heading>
          <Stack gap="3">
            {escalado.tareas.map((t) => (
              <Tarjeta key={t.orden} p="4">
                <Text fontWeight="bold" color="fg">
                  {t.orden}. {t.descripcion}
                </Text>
                {t.ingredientes.length === 0 ? (
                  <Text fontSize="sm" color="fg.subtle" mt="1">
                    Sin ingredientes asignados.
                  </Text>
                ) : (
                  <Stack gap="1" mt="2">
                    {t.ingredientes.map((u) => (
                      <Text key={u.ingrediente.id} fontSize="sm" color="fg.muted">
                        {u.ingrediente.nombre}:{" "}
                        <Text as="span" fontWeight="bold" color="fg">
                          {cantidadConUnidad(u.cantidad_escalada, u.unidad_medida.simbolo)}
                        </Text>
                      </Text>
                    ))}
                  </Stack>
                )}
              </Tarjeta>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
