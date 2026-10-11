import { useEffect } from "react";
import { Box, Button, Field, HStack, Table, Text } from "@chakra-ui/react";
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
  PageHeader,
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
    <Box p="5">
      <PageHeader
        title="Consumo de productos de limpieza"
        description="Totales consumidos en el período seleccionado, por producto y por día."
      />

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
              <Text color="fg.muted" fontSize="sm">
                Total consumido en el período:{" "}
                <Text as="span" color="fg" fontSize="lg" fontWeight="bold">
                  {consumo.total_general}
                </Text>
              </Text>
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

          {consumo.por_fecha.length > 0 && (
            <Tarjeta mt="6">
              <Box p="4" borderBottomWidth="1px" borderColor="border">
                <Text color="fg.muted" fontSize="sm" fontWeight="bold">
                  Consumo por día
                </Text>
              </Box>
              <Box p="4" display="flex" flexDirection="column" gap="2">
                {consumo.por_fecha.map((item) => {
                  const maximo = Math.max(
                    ...consumo.por_fecha.map((i) => i.cantidad_total),
                    0.0001
                  );
                  const porcentaje = (item.cantidad_total / maximo) * 100;

                  return (
                    <Box key={item.fecha} display="flex" alignItems="center" gap="3">
                      <Text w="100px" fontSize="sm" color="fg.muted">
                        {item.fecha}
                      </Text>
                      <Box flex={1} bg="bg.muted" rounded="full" h="3" overflow="hidden">
                        <Box w={`${porcentaje}%`} h="100%" bg="brand.500" />
                      </Box>
                      <Text
                        w="70px"
                        textAlign="right"
                        fontSize="sm"
                        fontWeight="bold"
                        color="fg"
                      >
                        {item.cantidad_total}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            </Tarjeta>
          )}
        </>
      )}
    </Box>
  );
}