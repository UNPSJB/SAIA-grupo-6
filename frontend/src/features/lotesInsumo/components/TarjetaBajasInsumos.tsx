import { useCallback, useState } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { Badge, Box, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { haceDiasISO, hoyISO } from "../../../common/utils/fechas";
import { formatoCantidad } from "../../../common/utils/numeros";
import { BannerError, EstadoCargando } from "../../../components/ui/patrones";
import { SelectorRango } from "../../dashboard/components/SelectorRango";
import { TarjetaPanel } from "../../dashboard/components/TarjetaPanel";
import { obtenerIndicadorBajas } from "../services/loteInsumoService";
import type { IndicadorBajasResponse } from "../types/loteInsumo";

export function TarjetaBajasInsumos() {
  const [fechaDesde, setFechaDesde] = useState(() => haceDiasISO(30));
  const [fechaHasta, setFechaHasta] = useState(() => hoyISO());
  const cargar = useCallback(
    () => obtenerIndicadorBajas(fechaDesde, fechaHasta),
    [fechaDesde, fechaHasta],
  );
  const { items: datos, loading, error } = useLista<IndicadorBajasResponse | null>({
    cargar,
    dependencias: [fechaDesde, fechaHasta],
    valorInicial: null,
    mensajeError: "Error al cargar bajas.",
    preferirMensajeDelBackend: true,
  });

  const maximo = datos
    ? Math.max(...datos.por_motivo.map((m) => m.cantidad_registros), 0)
    : 0;

  return (
    <TarjetaPanel
      titulo="Bajas de insumos por motivo"
      descripcion="Registros y cantidades dadas de baja en el período"
      h="auto"
      flex="1"
      acciones={
        <SelectorRango
          desde={fechaDesde}
          hasta={fechaHasta}
          onCambio={(desde, hasta) => {
            setFechaDesde(desde);
            setFechaHasta(hasta);
          }}
        />
      }
    >
      {loading && <EstadoCargando>Cargando bajas...</EstadoCargando>}
      {!loading && error && <BannerError mb="0">{error}</BannerError>}

      {!loading && !error && datos && (
        <>
          <Text fontSize="sm" color="fg.muted" mb="3">
            Total de bajas registradas:{" "}
            <Text as="span" fontWeight="bold" color="fg">
              {formatoCantidad(datos.total_registros)}
            </Text>
          </Text>

          <Stack gap="2">
            {datos.por_motivo.map((item) => {
              const ancho =
                maximo > 0 ? Math.max((item.cantidad_registros / maximo) * 100, item.cantidad_registros > 0 ? 4 : 0) : 0;
              return (
                <Grid
                  key={item.motivo}
                  templateColumns="165px 1fr auto"
                  alignItems="center"
                  gap="3"
                  py="1"
                >
                  <Text fontSize="sm" color="fg">
                    {item.etiqueta}
                  </Text>
                  <Box h="3" bg="gray.100" rounded="full" overflow="hidden">
                    <Box
                      h="100%"
                      w={`${ancho}%`}
                      bg="orange.500"
                      rounded="full"
                      transition="width 0.3s ease"
                    />
                  </Box>
                  <HStack gap="2" justify="flex-end">
                    <Badge colorPalette={item.cantidad_registros > 0 ? "orange" : "gray"} variant="subtle">
                      {item.cantidad_registros} reg.
                    </Badge>
                    <Text fontSize="xs" color="fg.muted" minW="64px" textAlign="right">
                      Cant: {formatoCantidad(item.cantidad_total)}
                    </Text>
                  </HStack>
                </Grid>
              );
            })}
          </Stack>
        </>
      )}
    </TarjetaPanel>
  );
}