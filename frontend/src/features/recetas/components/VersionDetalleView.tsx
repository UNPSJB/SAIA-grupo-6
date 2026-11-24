import { Badge, Box, HStack, Heading, Stack, Table, Text } from "@chakra-ui/react";
import { LuTriangleAlert } from "react-icons/lu";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { formatoFechaHora } from "../../../common/utils/fechas";
import {
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { DatoDetalle, GrillaDatos } from "../../../components/ui/plantillas";
import { etiquetaEsAditivo, type VersionDetalle } from "../types/receta";
import { textoPorcion } from "../utils/porcion";

export function VersionDetalleView({
  version,
  vigente = false,
}: {
  version: VersionDetalle;
  /** Es la versión con la que se producen los lotes nuevos. */
  vigente?: boolean;
}) {
  // Ingredientes primero y aditivos después, como se declaran en el rótulo.
  const ingredientes = [...version.ingredientes].sort(
    (a, b) => Number(a.es_aditivo) - Number(b.es_aditivo),
  );
  const porcion = textoPorcion(version);
  // Una versión es histórica y no cambia, pero sus ingredientes pueden darse
  // de baja después en el maestro: se avisa para no producir con ellos a ciegas.
  const dadosDeBaja = version.ingredientes.filter((i) => i.ingrediente.activo === false);

  return (
    <Stack gap="6">
      <GrillaDatos columnasMax={4}>
        <DatoDetalle etiqueta="Rendimiento">
          {cantidadConUnidad(version.rendimiento, version.unidad_medida.simbolo)}
        </DatoDetalle>
        <DatoDetalle etiqueta="Porción o unidad de venta">{porcion ?? "Sin indicar"}</DatoDetalle>
        <DatoDetalle etiqueta="Vida útil">
          {version.vida_util_dias !== null && version.vida_util_dias !== undefined
            ? `${version.vida_util_dias} días`
            : "Sin definir"}
        </DatoDetalle>
        <DatoDetalle etiqueta="Creada el">{formatoFechaHora(version.creado_en)}</DatoDetalle>
      </GrillaDatos>

      {/* Ingredientes y tareas son dos listados que crecen sin límite: van
          apilados a todo el ancho (lado a lado, el más corto dejaba un hueco
          debajo). Las tareas se reparten en una grilla de 1/2/3 columnas. */}
      <Box>
        <Heading as="h4" size="md" mb="3">
          Ingredientes y aditivos
        </Heading>
        {dadosDeBaja.length > 0 && (
          <HStack
            role="status"
            align="flex-start"
            gap="2"
            mb="3"
            px="4"
            py="3"
            rounded="md"
            borderWidth="1px"
            borderColor="orange.border"
            bg="orange.subtle"
            color="orange.fg"
            fontSize="sm"
          >
            <Box as="span" mt="0.5" flexShrink={0} aria-hidden>
              <LuTriangleAlert size={16} />
            </Box>
            <Text>
              {dadosDeBaja.length === 1 ? "Usa un ingrediente dado de baja" : "Usa ingredientes dados de baja"}{" "}
              en el maestro: <strong>{dadosDeBaja.map((i) => i.ingrediente.nombre).join(", ")}</strong>.
              {vigente
                ? " Creá una nueva versión que lo reemplace antes de seguir produciendo con esta receta."
                : ""}
            </Text>
          </HStack>
        )}
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
                  <Celda>
                    <HStack gap="2" flexWrap="wrap">
                      <Text as="span">{i.ingrediente.nombre}</Text>
                      {i.ingrediente.activo === false && (
                        <Badge colorPalette="orange" variant="subtle">
                          Dado de baja
                        </Badge>
                      )}
                    </HStack>
                  </Celda>
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
        <Box
          display="grid"
          gridTemplateColumns={{
            base: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(3, minmax(0, 1fr))",
          }}
          gap="4"
        >
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
        </Box>
      </Box>
    </Stack>
  );
}
