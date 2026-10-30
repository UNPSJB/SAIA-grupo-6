import { useEffect } from "react";
import { Box, Button, Field, HStack, SimpleGrid, Table, Text } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";
import { useConsumoInsumos } from "../../hooks/useConsumoInsumos";
import {
  BannerError,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  FormInput,
  LabelFiltro,
  Tarjeta,
} from "../../../../components/ui/patrones";

export function ConsumoInsumosPage() {
  const {
    fechaDesde,
    fechaHasta,
    setFechaDesde,
    setFechaHasta,
    consumo,
    loading,
    error,
    cargar,
  } = useConsumoInsumos();

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Tarjeta p="4" mb="6">
        <HStack gap="4" flexWrap="wrap" align="flex-end">
          <Box>
            <Field.Root>
              <LabelFiltro>Desde</LabelFiltro>
              <FormInput
                type="date"
                value={fechaDesde}
                max={fechaHasta}
                onChange={(e) => setFechaDesde(e.target.value)}
                w="auto"
              />
            </Field.Root>
          </Box>

          <Box>
            <Field.Root>
              <LabelFiltro>Hasta</LabelFiltro>
              <FormInput
                type="date"
                value={fechaHasta}
                min={fechaDesde}
                onChange={(e) => setFechaHasta(e.target.value)}
                w="auto"
              />
            </Field.Root>
          </Box>

          <Button colorPalette="brand" onClick={() => cargar()} loading={loading}>
            <LuSearch aria-hidden />
            Consultar
          </Button>
        </HStack>
      </Tarjeta>

      {error && <BannerError>{error}</BannerError>}

      {loading && <EstadoCargando>Cargando consumo...</EstadoCargando>}

      {!loading && consumo && (
        <>
          <Tarjeta>
            <Box p="4" borderBottomWidth="1px" borderColor="border">
              <Text color="fg.muted" fontSize="sm" mb="3">
                Totales del período por unidad de medida. No se combinan unidades incompatibles.
              </Text>
              <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="3">
                {consumo.totales_por_unidad.map((total) => (
                  <Box key={total.unidad_medida_id} bg="bg.muted" rounded="md" px="3" py="2">
                    <Text fontSize="xs" color="fg.muted">Unidad {total.unidad_simbolo ?? "sin símbolo"}</Text>
                    <Text fontSize="lg" fontWeight="bold">
                      {total.cantidad_total} {total.unidad_simbolo ?? ""}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Box>

            {consumo.insumos.length === 0 ? (
              <Box p="8" textAlign="center">
                <Text color="fg.muted">
                  No hay consumos registrados en el período seleccionado.
                </Text>
              </Box>
            ) : (
              // `borderRadius="0"`: la tabla va debajo del bloque del total, y
              // con el radio del tema el encabezado oscuro quedaba con las
              // esquinas superiores redondeadas en mitad de la tarjeta.
              <Table.Root variant="outline" size="sm" borderRadius="0">
                <Table.Header>
                  <FilaEncabezado>
                    <EncabezadoOscuro>Producto</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="amplia">Cantidad acumulada</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="media">Registros</EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {consumo.insumos.map((insumo) => (
                    <Table.Row key={insumo.insumo_quimico_id}>
                      <Celda>{insumo.nombre}</Celda>
                      <Celda>
                        {insumo.cantidad_total} {insumo.unidad_simbolo ?? ""}
                      </Celda>
                      <Celda>{insumo.cantidad_registros}</Celda>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Tarjeta>

          {consumo.por_producto_fecha.length > 0 && (
            <Tarjeta mt="6">
              <Box p="4" borderBottomWidth="1px" borderColor="border">
                <Text color="fg.muted" fontSize="sm" fontWeight="bold">
                  Consumo por producto y día
                </Text>
              </Box>
              <Table.Root variant="outline" size="sm" borderRadius="0">
                <Table.Header>
                  <FilaEncabezado>
                    <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
                    <EncabezadoOscuro>Producto</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="amplia">Cantidad</EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {consumo.por_producto_fecha.map((item) => (
                    <Table.Row key={`${item.fecha}-${item.insumo_quimico_id}`}>
                      <Celda>{item.fecha}</Celda>
                      <Celda>{item.nombre}</Celda>
                      <Celda>{item.cantidad_total} {item.unidad_simbolo ?? ""}</Celda>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Tarjeta>
          )}
        </>
      )}
    </Box>
  );
}
