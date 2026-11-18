import { Pagina, PestanasPagina } from "../../../../components/ui/plantillas";
import { ConsumoInsumosPage } from "../../../checklist/components/pages/ConsumoInsumosPage";
import { LotesStockTab } from "../LotesStockTab";
import { MovimientosStockTab } from "../MovimientosStockTab";
import { StockActualTab } from "../StockActualTab";

/**
 * Stock de químicos. La pestaña va en la URL (`/gestion-stock?tab=movimientos`)
 * y se resuelve en `PestanasPagina`: sin pestaña, abre "Stock actual" sin
 * redirigir. Antes cada pestaña era una ruta hija y `/gestion-stock` saltaba a
 * `/gestion-stock/stock` con un `<Navigate>`; las direcciones viejas siguen
 * funcionando (ver el router).
 */
export function GestionStockPage() {
  return (
    <Pagina
      titulo="Stock de químicos"
      descripcion="Controlá existencias, movimientos y consumos de productos químicos."
    >
      <PestanasPagina
        pestanas={[
          { valor: "stock", etiqueta: "Stock actual", contenido: <StockActualTab /> },
          { valor: "movimientos", etiqueta: "Movimientos", contenido: <MovimientosStockTab /> },
          { valor: "lotes", etiqueta: "Lotes", contenido: <LotesStockTab /> },
          { valor: "consumos", etiqueta: "Consumos", contenido: <ConsumoInsumosPage /> },
        ]}
      />
    </Pagina>
  );
}
