import { Badge, Box, Heading, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { formatoFechaHora } from "../../../common/utils/fechas";
import {
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { ETIQUETA_CLASIFICACION, type VersionDetalle } from "../types/receta";
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
  const insumos = [...version.insumos].sort(
    (a, b) => Number(a.clasificacion === "aditivo") - Number(b.clasificacion === "aditivo"),
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
                <EncabezadoOscuro>Insumo</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Clasificación</EncabezadoOscuro>
                <EncabezadoOscuro ancho="amplia">Clase funcional e INS</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Cantidad</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {insumos.map((i) => (
                <Table.Row key={i.id}>
                  <Celda>{i.insumo.nombre}</Celda>
                  <Celda>
                    <Badge colorPalette={i.clasificacion === "aditivo" ? "purple" : "gray"} variant="subtle">
                      {ETIQUETA_CLASIFICACION[i.clasificacion]}
                    </Badge>
                  </Celda>
                  <Celda>
                    {i.aditivo ? (
                      <Stack gap="0">
                        <Text fontSize="sm" color="fg">
                          {i.aditivo.clase_funcional}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {i.aditivo.nombre}
                          {i.aditivo.numero_ins ? ` · INS ${i.aditivo.numero_ins}` : ""}
                        </Text>
                      </Stack>
                    ) : (
                      <Text fontSize="sm" color="fg.subtle">
                        -
                      </Text>
                    )}
                  </Celda>
                  <Celda>{cantidadConUnidad(i.cantidad, i.unidad_medida.simbolo)}</Celda>
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
              {t.insumos.length === 0 ? (
                <Text fontSize="sm" color="fg.subtle" mt="1">
                  Sin insumos asignados.
                </Text>
              ) : (
                <Stack gap="1" mt="2">
                  {t.insumos.map((u) => {
                    const unidad = version.insumos.find((i) => i.id === u.receta_insumo_id)
                      ?.unidad_medida.simbolo;
                    return (
                      <Text key={u.receta_insumo_id} fontSize="sm" color="fg.muted">
                        {u.insumo.nombre}: {cantidadConUnidad(u.cantidad, unidad)}
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
