import { Badge, Box, Heading, Stack, Table, Text } from "@chakra-ui/react";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import {
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import { ETIQUETA_CLASIFICACION, type RecetaEscalada } from "../types/receta";

/** Cantidades de la receta escalada: por insumo y por tarea. */
export function TablaEscalado({
  escalado,
  conTareas = true,
}: {
  escalado: RecetaEscalada;
  conTareas?: boolean;
}) {
  const insumos = [...escalado.insumos].sort(
    (a, b) => Number(a.clasificacion === "aditivo") - Number(b.clasificacion === "aditivo"),
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
                <EncabezadoOscuro>Insumo</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Clasificación</EncabezadoOscuro>
                <EncabezadoOscuro numero ancho="media">Receta (v{escalado.version.numero})</EncabezadoOscuro>
                <EncabezadoOscuro numero ancho="media">Para tu lote</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {insumos.map((i) => (
                <Table.Row key={i.insumo.id}>
                  <Celda>
                    <Text>{i.insumo.nombre}</Text>
                    {i.aditivo && (
                      <Text fontSize="xs" color="fg.muted">
                        {etiquetaAditivo(i.aditivo)}
                      </Text>
                    )}
                  </Celda>
                  <Celda>
                    <Badge colorPalette={i.clasificacion === "aditivo" ? "purple" : "gray"} variant="subtle">
                      {ETIQUETA_CLASIFICACION[i.clasificacion]}
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
                {t.insumos.length === 0 ? (
                  <Text fontSize="sm" color="fg.subtle" mt="1">
                    Sin insumos asignados.
                  </Text>
                ) : (
                  <Stack gap="1" mt="2">
                    {t.insumos.map((u) => (
                      <Text key={u.insumo.id} fontSize="sm" color="fg.muted">
                        {u.insumo.nombre}:{" "}
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
