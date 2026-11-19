import type { ReactNode } from "react";
import { Badge, Flex, Table, VStack } from "@chakra-ui/react";
import type { Salida } from "../types/salida";
import { formatoFecha } from "@/common/utils/fechas";
import { useAuth } from "@/common/context/useAuth";
import { puedeAdministrar } from "@/common/api/permissions";
import {
  BotonAccion,
  CantidadConUnidad,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EtiquetaEstado,
  FilaClickeable,
  FilaEncabezado,
  TarjetaTabla,
  type TonoEstado,
} from "@/components/ui/patrones";

const TONO_ESTADO: Record<string, TonoEstado> = {
  RESERVADO: "info",
  DESPACHADO: "ok",
  ENTREGADO: "ok",
  CANCELADO: "peligro",
  RECHAZADA: "peligro",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  RESERVADO: "Reservado",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
  RECHAZADA: "Rechazada",
};

interface SalidaTableProps {
  salidas: Salida[];
  /** Pie de la tarjeta (resumen y paginación, `PieTabla`). */
  pie?: ReactNode;
  onVerDetalle: (salidaId: number) => void;
  onDespachar?: (salidaId: number) => void;
  onCancelar?: (salidaId: number) => void;
  onEntregar?: (salidaId: number) => void;
  onRechazar?: (salidaId: number) => void;
  onResolver?: (salidaId: number) => void;
  onReclamar?: (salidaId: number) => void;
}

/**
 * Tabla de salidas de producto.
 *
 * Columna "Lote / Producto": nombre del producto en negrita + código del lote
 * en texto secundario gris debajo.
 * Columna "Cantidad": número con unidad de medida del producto del lote.
 * Columna "Acciones": botones según el estado de la salida:
 *   - RESERVADO: "Despachar" y "Cancelar"
 *   - DESPACHADO: "Registrar entrega" / "Confirmar retiro" y
 *     "Rechazar entrega" / "Rechazar retiro"
 *   - RECHAZADA sin resolver: "Resolver rechazo" (solo administración)
 *   - ENTREGADO: "Registrar reclamo" (si el usuario puede operar)
 *   - CANCELADO / RECHAZADA resuelta: solo "Ver detalle"
 *
 * Toda la fila abre el detalle (igual que el botón "Ver detalle"); los
 * botones de acción no la activan.
 */
export function SalidaTable({
  salidas,
  pie,
  onVerDetalle,
  onDespachar,
  onCancelar,
  onEntregar,
  onRechazar,
  onResolver,
  onReclamar,
}: SalidaTableProps) {
  const { user } = useAuth();
  // La tabla puede recibir `onResolver` desde un padre que no filtre; el guard
  // definitivo queda acá para que "Resolver rechazo" no se vea nunca sin
  // permiso de administración (el backend también lo exige).
  const puedeResolver = puedeAdministrar(user);

  return (
    <TarjetaTabla pie={pie}>
      <Table.Root variant="outline" w="100%" minW="980px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Producto / Lote</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Cliente</EncabezadoOscuro>
            <EncabezadoOscuro numero ancho="media">Cantidad</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="angosta">Estado</EncabezadoOscuro>
            <EncabezadoOscuro center width="18%">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {salidas.map((salida) => (
            <FilaClickeable key={salida.id} onAbrir={() => onVerDetalle(salida.id)}>
              <Celda>
                <DatoPrincipal titulo={salida.producto_nombre} codigo={salida.lote_numero} />
              </Celda>
              <Celda>{salida.cliente_nombre}</Celda>
              <Celda numero>
                <CantidadConUnidad valor={salida.cantidad} unidad={salida.unidad_medida} />
              </Celda>
              <Celda whiteSpace="nowrap">{formatoFecha(salida.fecha_reserva)}</Celda>
              <Celda center>
                {salida.estado === "RECHAZADA" ? (
                  <VStack align="center" gap="1">
                    <EtiquetaEstado
                      tono={TONO_ESTADO[salida.estado] ?? "neutro"}
                    >
                      {ETIQUETA_ESTADO[salida.estado] ?? salida.estado}
                    </EtiquetaEstado>
                    <Badge
                      size="xs"
                      variant="subtle"
                      rounded="full"
                      colorPalette={
                        salida.disposicion === "REINGRESADA"
                          ? "teal"
                          : salida.disposicion === "DESECHADA"
                          ? "gray"
                          : "orange"
                      }
                    >
                      {salida.disposicion === "REINGRESADA"
                        ? "Reingresada"
                        : salida.disposicion === "DESECHADA"
                        ? "Desechada"
                        : "En revisión"}
                    </Badge>
                  </VStack>
                ) : (
                  <EtiquetaEstado
                    tono={TONO_ESTADO[salida.estado] ?? "neutro"}
                  >
                    {ETIQUETA_ESTADO[salida.estado] ?? salida.estado}
                  </EtiquetaEstado>
                )}
              </Celda>
              <Celda center>
                <Flex display="flex" justifyContent="center" gap="2" flexWrap="wrap">
                  <BotonAccion
                    accion="ver"
                    label="Ver detalle"
                    onClick={() => onVerDetalle(salida.id)}
                  />
                  {salida.estado === "RESERVADO" && onDespachar && (
                    <BotonAccion
                      accion="despachar"
                      label="Despachar reserva"
                      onClick={() => onDespachar(salida.id)}
                    />
                  )}
                  {salida.estado === "RESERVADO" && onCancelar && (
                    <BotonAccion
                      accion="cancelar"
                      label="Cancelar reserva"
                      onClick={() => onCancelar(salida.id)}
                    />
                  )}
                  {salida.estado === "DESPACHADO" && onEntregar && (
                    <BotonAccion
                      accion="entregar"
                      label={
                        salida.forma_entrega === "RETIRA_CLIENTE"
                          ? "Confirmar retiro"
                          : "Registrar entrega"
                      }
                      onClick={() => onEntregar(salida.id)}
                    />
                  )}
                  {salida.estado === "DESPACHADO" && onRechazar && (
                    <BotonAccion
                      accion="rechazar"
                      label={
                        salida.forma_entrega === "RETIRA_CLIENTE"
                          ? "Rechazar retiro"
                          : "Rechazar entrega"
                      }
                      onClick={() => onRechazar(salida.id)}
                    />
                  )}
                  {salida.estado === "RECHAZADA" &&
                    salida.disposicion === null &&
                    onResolver &&
                    puedeResolver && (
                      <BotonAccion
                        accion="disposicion"
                        label="Resolver rechazo"
                        onClick={() => onResolver(salida.id)}
                      />
                    )}
                  {salida.estado === "ENTREGADO" && onReclamar && (
                    <BotonAccion
                      accion="reclamar"
                      label="Registrar reclamo"
                      onClick={() => onReclamar(salida.id)}
                    />
                  )}
                </Flex>
              </Celda>
            </FilaClickeable>
          ))}
        </Table.Body>
      </Table.Root>
    </TarjetaTabla>
  );
}
