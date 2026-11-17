import { useState } from "react";
import { Text } from "@chakra-ui/react";
import { LuFactory, LuScale } from "react-icons/lu";
import {
  BannerError,
  EstadoCargando,
} from "../../../components/ui/patrones";
import { haceDiasISO, hoyISO } from "../../../common/utils/fechas";
import { useDashboardLotes } from "../hooks/useLotes";
import { GraficoProduccion } from "./GraficoProduccion";
import { TarjetaPanel } from "../../dashboard/components/TarjetaPanel";
import { SelectorRango } from "../../dashboard/components/SelectorRango";
import { MetricasBloque, type Metrica } from "../../dashboard/components/piezasPanel";
import { formatoCantidad } from "../../../common/utils/numeros";

/**
 * Producción por producto en el período elegido. Arriba, los totales en el
 * mismo formato que las métricas de los paneles de categoría: uno por unidad
 * (kg, un...), porque sumar kilos con unidades no significa nada, y los lotes.
 */
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
      tamanoTitulo="lg"
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
          <MetricasBloque
            metricas={[
              ...dashboard.total_por_unidad.map(
                (t): Metrica => ({
                  clave: `total-${t.unidad}`,
                  etiqueta: `Producido en ${t.unidad}`,
                  // Un decimal: "105,751 kg" en un número grande se lee como miles.
                  valor: `${formatoCantidad(Math.round(Number(t.cantidad) * 10) / 10)} ${t.unidad}`,
                  icono: LuScale,
                }),
              ),
              {
                clave: "lotes",
                etiqueta: "Lotes registrados",
                valor: formatoCantidad(dashboard.total_lotes),
                icono: LuFactory,
              },
            ]}
          />

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
