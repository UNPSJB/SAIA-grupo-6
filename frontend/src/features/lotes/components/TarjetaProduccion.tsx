import { useState } from "react";
import { Box, Field, HStack, Text } from "@chakra-ui/react";
import {
  BannerError,
  EstadoCargando,
  FormInput,
  LabelFiltro,
} from "../../../components/ui/patrones";
import { haceDiasISO, hoyISO } from "../../../common/utils/fechas";
import { useDashboardLotes } from "../hooks/useLotes";
import { GraficoProduccion } from "./GraficoProduccion";
import { TarjetaPanel } from "../../dashboard/components/TarjetaPanel";

export function TarjetaProduccion() {
  const [fechaDesde, setFechaDesde] = useState(() => haceDiasISO(30));
  const [fechaHasta, setFechaHasta] = useState(() => hoyISO());

  const { dashboard, loading, error } = useDashboardLotes({
    fechaDesde,
    fechaHasta,
  });

  return (
    <TarjetaPanel
      titulo="Producción por producto"
      h="auto"
      acciones={
        <HStack gap="3" flexWrap="wrap">
          <Box minW="150px">
            <Field.Root>
              <LabelFiltro>Desde</LabelFiltro>
              <FormInput
                type="date"
                value={fechaDesde}
                onChange={(event) => setFechaDesde(event.target.value)}
                w="auto"
              />
            </Field.Root>
          </Box>
          <Box minW="150px">
            <Field.Root>
              <LabelFiltro>Hasta</LabelFiltro>
              <FormInput
                type="date"
                value={fechaHasta}
                onChange={(event) => setFechaHasta(event.target.value)}
                w="auto"
              />
            </Field.Root>
          </Box>
        </HStack>
      }
    >
      {loading && <EstadoCargando>Cargando producción...</EstadoCargando>}

      {!loading && error && <BannerError mb="0">{error}</BannerError>}

      {!loading && !error && (
        <>
          <HStack gap="6" mb="3" flexWrap="wrap">
            <Text fontSize="sm" color="fg.muted">
              Total producido:{" "}
              <Text as="span" fontWeight="bold" color="fg">
                {dashboard.total_cantidad_producida}
              </Text>
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Lotes registrados:{" "}
              <Text as="span" fontWeight="bold" color="fg">
                {dashboard.total_lotes}
              </Text>
            </Text>
          </HStack>

          {dashboard.por_producto.length === 0 ? (
            <Text fontSize="sm" color="fg.subtle" py="8" textAlign="center">
              No hay producción registrada en el período seleccionado.
            </Text>
          ) : (
            <GraficoProduccion datos={dashboard.por_producto} />
          )}
        </>
      )}
    </TarjetaPanel>
  );
}
