import { useEffect } from "react";
import { Box, Button, Field, Heading, HStack, Input, Spinner, Table, Text } from "@chakra-ui/react";
import { useConsumoInsumos } from "../../hooks/useConsumoInsumos";
import {
  Celda,
  ColumnaHeader,
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
    <Box p="20px" maxW="1000px" margin="0 auto">
      <Heading as="h2" size="md" fontWeight="bold" color="gray.900" mb="20px">
        Consumo de productos de limpieza
      </Heading>

      <HStack gap="20px" mb="20px" flexWrap="wrap">
        <Field.Root>
          <LabelFiltro>DESDE</LabelFiltro>
          <Input
            type="date"
            value={fechaDesde}
            max={fechaHasta}
            onChange={(e) => setFechaDesde(e.target.value)}
            p="10px 14px"
            rounded="lg"
            borderWidth={2}
            borderColor="brand.300"
            fontSize="15px"
            w="auto"
          />
        </Field.Root>

        <Field.Root>
          <LabelFiltro>HASTA</LabelFiltro>
          <Input
            type="date"
            value={fechaHasta}
            min={fechaDesde}
            onChange={(e) => setFechaHasta(e.target.value)}
            p="10px 14px"
            rounded="lg"
            borderWidth={2}
            borderColor="brand.300"
            fontSize="15px"
            w="auto"
          />
        </Field.Root>

        <Button
          mt="26px"
          bg="brand.500"
          color="white"
          onClick={() => cargar()}
          loading={loading}
          border="none"
          p="10px 20px"
          rounded="lg"
          fontWeight="bold"
          _hover={{ bg: "brand.700" }}
        >
          Consultar
        </Button>
      </HStack>

      {error && (
        <Box
          bg="red.100"
          color="red.800"
          p="12px"
          rounded="md"
          mb="20px"
          border="1px solid"
          borderColor="red.200"
          fontWeight="bold"
        >
          ⚠️ {error}
        </Box>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" p="40px">
          <Spinner color="brand.500" />
        </Box>
      )}

      {!loading && consumo && (
        <>
          <Tarjeta>
            <Box p="16px" borderBottom="2px solid" borderColor="brand.300">
              <Text color="gray.600" fontSize="14px">
                Total consumido en el período:{" "}
                <Text as="span" color="gray.800" fontSize="18px" fontWeight="bold">
                  {consumo.total_general}
                </Text>
              </Text>
            </Box>

            {consumo.insumos.length === 0 ? (
              <Box p="30px" textAlign="center">
                <Text color="gray.500">
                  No hay consumos registrados en el período seleccionado.
                </Text>
              </Box>
            ) : (
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <ColumnaHeader>Producto</ColumnaHeader>
                    <ColumnaHeader>Cantidad acumulada</ColumnaHeader>
                    <ColumnaHeader>Registros</ColumnaHeader>
                  </Table.Row>
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
            <Tarjeta mt="20px">
              <Box p="16px" borderBottom="2px solid" borderColor="brand.300">
                <Text color="gray.600" fontSize="14px" fontWeight="bold">
                  Consumo por día
                </Text>
              </Box>
              <Box p="16px" display="flex" flexDirection="column" gap="8px">
                {consumo.por_fecha.map((item) => {
                  const maximo = Math.max(
                    ...consumo.por_fecha.map((i) => i.cantidad_total),
                    0.0001
                  );
                  const porcentaje = (item.cantidad_total / maximo) * 100;

                  return (
                    <Box key={item.fecha} display="flex" alignItems="center" gap="12px">
                      <Text w="100px" fontSize="13px" color="gray.600">{item.fecha}</Text>
                      <Box flex={1} bg="gray.100" rounded="4px" h="16px" overflow="hidden">
                        <Box w={`${porcentaje}%`} h="100%" bg="brand.500" />
                      </Box>
                      <Text w="70px" textAlign="right" fontSize="13px" fontWeight="bold" color="gray.800">
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