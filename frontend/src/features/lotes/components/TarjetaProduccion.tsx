import { useState } from "react";
import { HStack, Text } from "@chakra-ui/react";
import {
  BannerError,
  EstadoCargando,
} from "../../../components/ui/patrones";
import { haceDiasISO, hoyISO } from "../../../common/utils/fechas";
import { useDashboardLotes } from "../hooks/useLotes";
import { GraficoProduccion } from "./GraficoProduccion";
import { TarjetaPanel } from "../../dashboard/components/TarjetaPanel";
import { SelectorRango } from "../../dashboard/components/SelectorRango";
import { cantidadConUnidad, formatoCantidad } from "../../../common/utils/numeros";

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
      descripcion="Cantidad producida por producto en el período seleccionado"
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
      {loading && <EstadoCargando>Cargando producción...</EstadoCargando>}

      {!loading && error && <BannerError mb="0">{error}</BannerError>}

      {!loading && !error && (
        <>
          <HStack gap="6" mb="3" flexWrap="wrap">
            <Text fontSize="sm" color="fg.muted">
              Total producido:{" "}
              {/* Por unidad: antes se sumaban kilos con unidades en un solo número. */}
              <Text as="span" fontWeight="bold" color="fg">
                {dashboard.total_por_unidad.length === 0
                  ? "-"
                  : dashboard.total_por_unidad
                      .map((t) => cantidadConUnidad(t.cantidad, t.unidad))
                      .join(" · ")}
              </Text>
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Lotes registrados:{" "}
              <Text as="span" fontWeight="bold" color="fg">
                {formatoCantidad(dashboard.total_lotes)}
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
