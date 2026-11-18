import { Badge, Box, Flex, Table, Text, VStack } from "@chakra-ui/react";
import type { Salida } from "../types/salida";
import { formatoFecha } from "@/common/utils/fechas";
import { cantidadConUnidad } from "@/common/utils/numeros";
import { useAuth } from "@/common/context/useAuth";
import { puedeAdministrar } from "@/common/api/permissions";
import {
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  EtiquetaEstado,
  FilaEncabezado,
  Tarjeta,
  type TonoEstado,
} from "@/components/ui/patrones";

const TONO_ESTADO: Record<string, TonoEstado> = {
  RESERVADO: "info",
  DESPACHADO: "ok",
  ENTREGADO: "ok",
  CANCELADO: "peligro",
  RECHAZADA: "peligro",
};

interface SalidaTableProps {
  salidas: Salida[];
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
 * La fila NO es clickeable: la navegación al detalle se hace únicamente a
 * través del botón de la columna Acciones.
 */
export function SalidaTable({
  salidas,
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
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="980px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro ancho="amplia">Lote / Producto</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Cliente</EncabezadoOscuro>
            <EncabezadoOscuro numero ancho="media">Cantidad</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
            <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {salidas.map((salida) => (
            <Table.Row key={salida.id}>
              <Celda>
                <Box>
                  <Text fontWeight="bold" color="fg" fontSize="sm">
                    {salida.producto_nombre}
                  </Text>
                  <Text fontSize="xs" color="fg.subtle">
                    {salida.lote_numero}
                  </Text>
                </Box>
              </Celda>
              <Celda>{salida.cliente_nombre}</Celda>
              <Celda numero>
                {cantidadConUnidad(salida.cantidad, salida.unidad_medida)}
              </Celda>
              <Celda>{formatoFecha(salida.fecha_reserva)}</Celda>
              <Celda>
                {salida.estado === "RECHAZADA" ? (
                  <VStack align="flex-start" gap="1">
                    <EtiquetaEstado
                      tono={TONO_ESTADO[salida.estado] ?? "neutro"}
                    >
                      {salida.estado}
                    </EtiquetaEstado>
                    <Badge
                      size="xs"
                      variant="subtle"
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
                    {salida.estado}
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
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}
