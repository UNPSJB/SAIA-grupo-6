import { useState } from "react";
import { Badge, Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { LuArrowDown, LuArrowUp, LuPencil } from "react-icons/lu";
import { useStockAcciones } from "../hooks/useStockAcciones";
import { useStockActual } from "../hooks/useStockActual";
import type { StockInsumoQuimico } from "../types/stock";
import {
  BannerError,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { StockOperacionDialog, type TipoDialogoStock } from "./StockOperacionDialog";
import { useProveedores } from "../../proveedores/hooks/useProveedores";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";

interface DialogoAbierto {
  tipo: TipoDialogoStock;
  insumo: StockInsumoQuimico;
}

function valorDecimal(valor: number | string | null) {
  return valor === null ? "Sin definir" : String(valor);
}

export function StockActualTab() {
  const { stock, loading, error, recargar } = useStockActual();
  const { proveedores } = useProveedores();
  const { loading: guardando, actualizarMinimo, registrarAjuste, registrarIngreso } = useStockAcciones();
  const [dialogo, setDialogo] = useState<DialogoAbierto | null>(null);

  const cerrarDialogo = () => {
    if (!guardando) setDialogo(null);
  };

  const recargarDespuesDeGuardar = async (accion: () => Promise<void>) => {
    await accion();
    await recargar();
    notificarCambioNotificaciones();
  };

  return (
    <>
      {error ? <BannerError>{error}</BannerError> : null}
      {loading ? <EstadoCargando>Cargando stock actual...</EstadoCargando> : null}

      {!loading && !error && stock.length === 0 ? (
        <EstadoVacio>No hay productos químicos registrados para gestionar.</EstadoVacio>
      ) : null}

      {!loading && !error && stock.length > 0 ? (
        <>
          <Tarjeta display={{ base: "none", md: "block" }}>
            <Table.Root variant="outline" size="sm">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro>Producto</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="angosta">Actual</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="angosta">Mínimo</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="accionesAnchas">Acciones</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {stock.map((insumo) => (
                  <Table.Row key={insumo.insumo_quimico_id} opacity={insumo.activo ? 1 : 0.65}>
                    <Celda fontWeight="medium">{insumo.nombre}</Celda>
                    <Celda>
                      {valorDecimal(insumo.cantidad_actual)} {insumo.unidad_simbolo ?? ""}
                    </Celda>
                    <Celda>
                      {valorDecimal(insumo.stock_minimo)}
                      {insumo.stock_minimo !== null ? ` ${insumo.unidad_simbolo ?? ""}` : ""}
                    </Celda>
                    <Celda>
                      {insumo.stock_bajo ? (
                        <Badge colorPalette="red">Stock bajo</Badge>
                      ) : (
                        <Badge colorPalette="green">Disponible</Badge>
                      )}
                    </Celda>
                    <Celda>
                      <HStack gap="2" flexWrap="wrap">
                        <Button size="xs" colorPalette="brand" onClick={() => setDialogo({ tipo: "ingreso", insumo })}>
                          <LuArrowUp aria-hidden /> Ingreso
                        </Button>
                        <Button size="xs" variant="outline" colorPalette="neutral" onClick={() => setDialogo({ tipo: "ajuste", insumo })}>
                          <LuArrowDown aria-hidden /> Ajuste
                        </Button>
                        <Button size="xs" variant="plain" color="brand.fg" onClick={() => setDialogo({ tipo: "minimo", insumo })}>
                          <LuPencil aria-hidden /> Mínimo
                        </Button>
                      </HStack>
                    </Celda>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>

          <Stack display={{ base: "flex", md: "none" }} gap="3">
            {stock.map((insumo) => (
              <Tarjeta key={insumo.insumo_quimico_id} p="4" borderColor={insumo.stock_bajo ? "red.300" : "border.subtle"}>
                <HStack justify="space-between" align="flex-start" gap="3" mb="3">
                  <Box>
                    <Text fontWeight="bold">{insumo.nombre}</Text>
                    <Text color="fg.muted" fontSize="sm">
                      Actual: {valorDecimal(insumo.cantidad_actual)} {insumo.unidad_simbolo ?? ""}
                    </Text>
                  </Box>
                  <Badge colorPalette={insumo.stock_bajo ? "red" : "green"} flexShrink={0}>
                    {insumo.stock_bajo ? "Stock bajo" : "Disponible"}
                  </Badge>
                </HStack>
                <Text color="fg.muted" fontSize="sm" mb="3">
                  Mínimo: {valorDecimal(insumo.stock_minimo)}
                  {insumo.stock_minimo !== null ? ` ${insumo.unidad_simbolo ?? ""}` : ""}
                </Text>
                <Stack direction="row" gap="2" flexWrap="wrap">
                  <Button size="sm" colorPalette="brand" onClick={() => setDialogo({ tipo: "ingreso", insumo })}>
                    Ingreso
                  </Button>
                  <Button size="sm" variant="outline" colorPalette="neutral" onClick={() => setDialogo({ tipo: "ajuste", insumo })}>
                    Ajuste
                  </Button>
                  <Button size="sm" variant="plain" color="brand.fg" onClick={() => setDialogo({ tipo: "minimo", insumo })}>
                    Mínimo
                  </Button>
                </Stack>
              </Tarjeta>
            ))}
          </Stack>
        </>
      ) : null}

      {dialogo ? (
        <StockOperacionDialog
          key={`${dialogo.tipo}-${dialogo.insumo.insumo_quimico_id}`}
          tipo={dialogo.tipo}
          insumo={dialogo.insumo}
          loading={guardando}
          proveedores={proveedores}
          onClose={cerrarDialogo}
          onIngreso={(cantidad, proveedorId, numeroLote) =>
            recargarDespuesDeGuardar(() =>
              registrarIngreso(dialogo.insumo.insumo_quimico_id, cantidad, proveedorId, numeroLote),
            )
          }
          onAjuste={(cantidad, operacion, motivo) =>
            recargarDespuesDeGuardar(() =>
              registrarAjuste(dialogo.insumo.insumo_quimico_id, cantidad, operacion, motivo),
            )
          }
          onMinimo={(minimo) =>
            recargarDespuesDeGuardar(() => actualizarMinimo(dialogo.insumo.insumo_quimico_id, minimo))
          }
        />
      ) : null}
    </>
  );
}
