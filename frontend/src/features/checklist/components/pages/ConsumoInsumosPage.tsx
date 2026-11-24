import { useEffect } from "react";
import { Box, Button, Field, HStack, SimpleGrid, Table, Text } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { formatoFecha } from "../../../../common/utils/fechas";
import { useConsumoInsumos } from "../../hooks/useConsumoInsumos";
import { BotonExportar } from "../../../exportacion";
import {
  BannerError,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  FormInput,
  LabelFiltro,
  Paginacion,
  Tarjeta,
  DatoPrincipal,
  CantidadConUnidad,
} from "../../../../components/ui/patrones";
import { cantidadConUnidad } from "../../../../common/utils/numeros";

const FILAS_POR_PAGINA = 20;

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
  // Un mes son cientos de renglones (producto × día): de a 20.
  const porDia = usePaginas(
    consumo?.por_producto_fecha ?? [],
    FILAS_POR_PAGINA,
    consumo ? `${consumo.fecha_desde}|${consumo.fecha_hasta}` : "",
  );

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Tarjeta p="4" mb="6">
        <HStack gap="4" flexWrap="wrap" align="flex-end">
          <Box flex={{ base: "1 1 130px", md: "none" }}>
            <Field.Root>
              <LabelFiltro>Desde</LabelFiltro>
              <FormInput
                type="date"
                value={fechaDesde}
                max={fechaHasta}
                onChange={(e) => setFechaDesde(e.target.value)}
                w={{ base: "100%", md: "auto" }}
              />
            </Field.Root>
          </Box>

          <Box flex={{ base: "1 1 130px", md: "none" }}>
            <Field.Root>
              <LabelFiltro>Hasta</LabelFiltro>
              <FormInput
                type="date"
                value={fechaHasta}
                min={fechaDesde}
                onChange={(e) => setFechaHasta(e.target.value)}
                w={{ base: "100%", md: "auto" }}
              />
            </Field.Root>
          </Box>

          <Button colorPalette="brand" onClick={() => cargar()} loading={loading}>
            <LuSearch aria-hidden />
            Consultar
          </Button>

          {consumo && (
            <BotonExportar
              nombreTabla="stock_consumo"
              vista="stock-consumo"
              filtros={{
                fecha_desde: consumo.fecha_desde,
                fecha_hasta: consumo.fecha_hasta,
              }}
            />
          )}
        </HStack>
      </Tarjeta>

      {error && <BannerError>{error}</BannerError>}

      {loading && <EstadoCargando pagina>Cargando consumo...</EstadoCargando>}

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
                      {cantidadConUnidad(total.cantidad_total, total.unidad_simbolo)}
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
                    <EncabezadoOscuro numero ancho="amplia">Cantidad acumulada</EncabezadoOscuro>
                    <EncabezadoOscuro numero ancho="media">Registros</EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {consumo.insumos.map((insumo) => (
                    <Table.Row key={insumo.insumo_quimico_id}>
                      <Celda>
                        <DatoPrincipal titulo={insumo.nombre} />
                      </Celda>
                      <Celda numero>
                        <CantidadConUnidad valor={insumo.cantidad_total} unidad={insumo.unidad_simbolo} />
                      </Celda>
                      <Celda numero>{insumo.cantidad_registros}</Celda>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Tarjeta>

          {consumo.por_producto_fecha.length > 0 && (
            <>
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
                    <EncabezadoOscuro numero ancho="amplia">Cantidad</EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {porDia.paginados.map((item) => (
                    <Table.Row key={`${item.fecha}-${item.insumo_quimico_id}`}>
                      <Celda>{formatoFecha(item.fecha)}</Celda>
                      <Celda>
                        <DatoPrincipal titulo={item.nombre} />
                      </Celda>
                      <Celda numero>
                        <CantidadConUnidad valor={item.cantidad_total} unidad={item.unidad_simbolo} />
                      </Celda>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Tarjeta>
            {porDia.hayVariasPaginas && (
              <Paginacion
                count={porDia.total}
                pageSize={FILAS_POR_PAGINA}
                page={porDia.page}
                onPageChange={porDia.setPage}
              />
            )}
            </>
          )}
        </>
      )}
    </Box>
  );
}
