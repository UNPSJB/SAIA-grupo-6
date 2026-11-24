import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { BotonTexto, EtiquetaEstado, type TonoEstado } from "../../../components/ui/patrones";
import { DatoDetalle, GrillaDatos, SeccionDetalle } from "../../../components/ui/plantillas";
import { formatoFecha, formatoFechaHora } from "../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { BadgePlazo, BadgePrioridad } from "../../reclamos/components/ReclamosTable";
import { BadgeEstadoLote } from "../../lotes/components/BadgeEstadoLote";
import { etiquetaMotivoRetiro } from "../../retiros/types/retiro";
import { ESTADOS_SALIDA, FORMAS_ENTREGA } from "../../salidas/types/salida";
import type { IncidenteDetalle } from "../types/incidente";
import { estadoLabel, formatoFecha as formatoFechaIncidente, tipoColor, tipoLabel } from "../types/incidente";

/** Dato que ocupa todo el renglón: textos libres que pueden ser largos. */
function DatoLargo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <Box gridColumn="1 / -1">
      <DatoDetalle etiqueta={etiqueta}>
        <Text whiteSpace="pre-line">{children}</Text>
      </DatoDetalle>
    </Box>
  );
}

/** Nombre con enlace a su ficha; texto plano si quien mira no puede abrirla. */
function Enlace({
  a,
  estado,
  children,
}: {
  a: string | null;
  /** `state` de la navegación. */
  estado?: unknown;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  if (!a) return <>{children}</>;
  return (
    <BotonTexto
      onClick={() => navigate(a, { state: estado })}
      textAlign="left"
      whiteSpace="normal"
      wordBreak="break-word"
      justifyContent="flex-start"
    >
      {children}
    </BotonTexto>
  );
}

const TONO_SALIDA: Record<string, TonoEstado> = {
  RESERVADO: "info",
  DESPACHADO: "ok",
  ENTREGADO: "ok",
  CANCELADO: "peligro",
  RECHAZADA: "peligro",
};

const ESTADOS_REPOSICION: Record<string, { etiqueta: string; tono: TonoEstado }> = {
  PENDIENTE: { etiqueta: "Pendiente", tono: "alerta" },
  PARCIAL: { etiqueta: "Parcial", tono: "info" },
  CUMPLIDA: { etiqueta: "Cumplida", tono: "ok" },
  ANULADA: { etiqueta: "Anulada", tono: "neutro" },
};

function textoVencimiento(dias: number): string {
  if (dias === 0) return "vence hoy";
  const cantidad = Math.abs(dias) === 1 ? "1 día" : `${Math.abs(dias)} días`;
  return dias < 0 ? `vencido hace ${cantidad}` : `vence en ${cantidad}`;
}

/**
 * Todo lo que el sistema ya sabe alrededor del incidente: equipo, reclamo,
 * retiro, entrega, lote, reposiciones e incidentes parecidos. Cada bloque
 * aparece solo si el incidente tiene ese vínculo.
 *
 * `esAdmin` decide los enlaces: las fichas de equipo y cliente son de
 * administración, y a un operador el enlace lo sacaría de la pantalla.
 */
export function VinculosIncidente({
  incidente,
  esAdmin,
}: {
  incidente: IncidenteDetalle;
  esAdmin: boolean;
}) {
  const { equipo, reclamo, retiro, salida, lote, reposiciones } = incidente;

  return (
    <>
      {equipo && (
        <SeccionDetalle titulo="Equipo involucrado">
          <GrillaDatos>
            <DatoDetalle etiqueta="Equipo">
              <Enlace a={esAdmin ? `/equipos/detalle/${equipo.id}` : null}>{equipo.nombre}</Enlace>
            </DatoDetalle>
            <DatoDetalle etiqueta="Tipo">{equipo.tipo}</DatoDetalle>
            <DatoDetalle etiqueta="Sector">{equipo.sector_nombre ?? "-"}</DatoDetalle>
            {!equipo.activo && (
              <DatoDetalle etiqueta="Estado">
                <EtiquetaEstado tono="neutro">Dado de baja</EtiquetaEstado>
              </DatoDetalle>
            )}
            {equipo.planes.map((plan) => (
              <DatoDetalle
                key={plan.tipo}
                etiqueta={plan.tipo === "calibracion" ? "Calibración" : "Mantenimiento"}
              >
                <Text color={plan.dias_restantes < 0 ? "fg.error" : undefined}>
                  {formatoFecha(plan.proximo_vencimiento)} ({textoVencimiento(plan.dias_restantes)})
                </Text>
                <Text fontSize="xs" fontWeight="normal" color="fg.muted">
                  Última: {formatoFecha(plan.fecha_ultima_intervencion)}
                </Text>
              </DatoDetalle>
            ))}
          </GrillaDatos>
        </SeccionDetalle>
      )}

      {reclamo && (
        <SeccionDetalle titulo="Reclamo del cliente">
          <GrillaDatos>
            <DatoDetalle etiqueta="Reclamo">
              <Enlace a={`/reclamos/${reclamo.id}`}>Ver reclamo #{reclamo.id}</Enlace>
            </DatoDetalle>
            <DatoDetalle etiqueta="Motivo">
              <Stack gap="1" align="flex-start">
                <Text>{reclamo.motivo_label}</Text>
                <BadgePrioridad motivo={reclamo.motivo} />
              </Stack>
            </DatoDetalle>
            <DatoDetalle etiqueta="Fecha del reclamo">
              {formatoFecha(reclamo.fecha_reclamo)}
            </DatoDetalle>
            <DatoDetalle etiqueta="Plazo">
              <BadgePlazo dias={reclamo.dias_desde_entrega} fueraDePlazo={reclamo.fuera_de_plazo} />
            </DatoDetalle>
            {reclamo.detalle?.trim() && <DatoLargo etiqueta="Detalle">{reclamo.detalle}</DatoLargo>}
          </GrillaDatos>
        </SeccionDetalle>
      )}

      {retiro && (
        <SeccionDetalle titulo="Retiro del mercado">
          <GrillaDatos>
            <DatoDetalle etiqueta="Retiro">
              <Enlace a={`/retiros/${retiro.id}`}>Ver retiro #{retiro.id}</Enlace>
            </DatoDetalle>
            <DatoDetalle etiqueta="Estado">
              <EtiquetaEstado tono={retiro.estado === "CERRADO" ? "ok" : "alerta"}>
                {retiro.estado === "CERRADO" ? "Cerrado" : "En curso"}
              </EtiquetaEstado>
            </DatoDetalle>
            <DatoDetalle etiqueta="Motivo">{etiquetaMotivoRetiro(retiro.motivo)}</DatoDetalle>
            <DatoDetalle etiqueta="Fecha del retiro">{formatoFecha(retiro.fecha_retiro)}</DatoDetalle>
            <DatoDetalle etiqueta="Iniciado por">{retiro.iniciado_por_nombre}</DatoDetalle>
            <DatoDetalle etiqueta="Clientes avisados">
              {retiro.total_afectados === 0
                ? "Sin entregas afectadas"
                : `${retiro.notificados} de ${retiro.total_afectados}`}
            </DatoDetalle>
            {retiro.detalle?.trim() && <DatoLargo etiqueta="Detalle">{retiro.detalle}</DatoLargo>}
          </GrillaDatos>
        </SeccionDetalle>
      )}

      {salida && (
        <SeccionDetalle titulo={salida.estado === "RECHAZADA" ? "Entrega rechazada" : "Entrega"}>
          <GrillaDatos>
            <DatoDetalle etiqueta="Salida">
              <Enlace a={`/salidas/${salida.id}/detalle`}>Ver salida #{salida.id}</Enlace>
            </DatoDetalle>
            <DatoDetalle etiqueta="Estado">
              <EtiquetaEstado tono={TONO_SALIDA[salida.estado] ?? "neutro"}>
                {ESTADOS_SALIDA.find((e) => e.valor === salida.estado)?.etiqueta ?? salida.estado}
              </EtiquetaEstado>
            </DatoDetalle>
            <DatoDetalle etiqueta="Cliente">
              <Enlace a={esAdmin ? `/clientes/${salida.cliente_id}/detalle` : null}>
                {salida.cliente_nombre}
              </Enlace>
              {salida.cliente_contacto && (
                <Text fontSize="xs" fontWeight="normal" color="fg.muted">
                  {salida.cliente_contacto}
                </Text>
              )}
            </DatoDetalle>
            <DatoDetalle etiqueta="Cantidad">
              {cantidadConUnidad(salida.cantidad, salida.unidad_medida)}
            </DatoDetalle>
            <DatoDetalle etiqueta="Despacho">{formatoFecha(salida.fecha_despacho)}</DatoDetalle>
            {salida.fecha_entrega && (
              <DatoDetalle etiqueta="Entrega">{formatoFecha(salida.fecha_entrega)}</DatoDetalle>
            )}
            {salida.forma_entrega && (
              <DatoDetalle etiqueta="Transporte">
                {salida.transportista_nombre ??
                  FORMAS_ENTREGA.find((f) => f.valor === salida.forma_entrega)?.etiqueta ??
                  salida.forma_entrega}
              </DatoDetalle>
            )}
            {salida.recibido_por && (
              <DatoDetalle etiqueta="Recibió">{salida.recibido_por}</DatoDetalle>
            )}
            {salida.motivo_rechazo && (
              <>
                <DatoDetalle etiqueta="Motivo del rechazo">
                  {salida.motivo_rechazo_label ?? salida.motivo_rechazo}
                </DatoDetalle>
                <DatoDetalle etiqueta="Fecha del rechazo">
                  {formatoFecha(salida.fecha_rechazo)}
                </DatoDetalle>
                <DatoDetalle etiqueta="Destino de la mercadería">
                  {salida.disposicion ? (
                    <EtiquetaEstado tono={salida.disposicion === "REINGRESADA" ? "ok" : "peligro"}>
                      {salida.disposicion === "REINGRESADA" ? "Reingresada al lote" : "Desechada"}
                    </EtiquetaEstado>
                  ) : (
                    <EtiquetaEstado tono="alerta">Decisión pendiente</EtiquetaEstado>
                  )}
                </DatoDetalle>
                {salida.decidida_por_nombre && (
                  <DatoDetalle etiqueta="Decidió">
                    {salida.decidida_por_nombre}
                    <Text fontSize="xs" fontWeight="normal" color="fg.muted">
                      {formatoFechaHora(salida.fecha_disposicion)}
                    </Text>
                  </DatoDetalle>
                )}
                {salida.justificacion_disposicion && (
                  <DatoLargo etiqueta="Justificación del destino">
                    {salida.justificacion_disposicion}
                  </DatoLargo>
                )}
              </>
            )}
          </GrillaDatos>
        </SeccionDetalle>
      )}

      {lote && (
        <SeccionDetalle titulo="Lote">
          <GrillaDatos>
            <DatoDetalle etiqueta="Número de lote">
              <Enlace a={`/lotes/${lote.id}`}>{lote.numero_lote}</Enlace>
            </DatoDetalle>
            <DatoDetalle etiqueta="Producto">{lote.producto_nombre}</DatoDetalle>
            <DatoDetalle etiqueta="Estado">
              {lote.retirado ? (
                <EtiquetaEstado tono="peligro">Retirado del mercado</EtiquetaEstado>
              ) : lote.estado === "terminado" ? (
                // Terminado no dice dónde está la mercadería; "En almacén" o "Agotado", sí.
                lote.estado_lote
              ) : (
                <BadgeEstadoLote estado={lote.estado} />
              )}
            </DatoDetalle>
            <DatoDetalle etiqueta="Elaboración">{formatoFecha(lote.fecha_inicio)}</DatoDetalle>
            <DatoDetalle etiqueta="Vencimiento">{formatoFecha(lote.fecha_vencimiento)}</DatoDetalle>
            <DatoDetalle etiqueta="Producido">
              {cantidadConUnidad(lote.cantidad_producida, lote.unidad)}
            </DatoDetalle>
            <DatoDetalle etiqueta="Saldo en planta">
              {cantidadConUnidad(lote.saldo, lote.unidad)}
            </DatoDetalle>
          </GrillaDatos>
        </SeccionDetalle>
      )}

      {reposiciones.length > 0 && (
        <SeccionDetalle
          titulo={reposiciones.length === 1 ? "Reposición al cliente" : "Reposiciones a clientes"}
        >
          <Stack gap="4" separator={<Box borderTopWidth="1px" borderColor="border.subtle" />}>
            {reposiciones.map((repo) => {
              const estado = ESTADOS_REPOSICION[repo.estado];
              return (
                <GrillaDatos key={repo.id}>
                  <DatoDetalle etiqueta="Cliente">{repo.cliente_nombre}</DatoDetalle>
                  <DatoDetalle etiqueta="Producto">{repo.producto_nombre}</DatoDetalle>
                  <DatoDetalle etiqueta="A reponer">
                    {cantidadConUnidad(repo.cantidad_original, repo.unidad)}
                  </DatoDetalle>
                  <DatoDetalle etiqueta="Falta entregar">
                    {cantidadConUnidad(repo.cantidad_pendiente, repo.unidad)}
                  </DatoDetalle>
                  <DatoDetalle etiqueta="Estado">
                    <EtiquetaEstado tono={estado?.tono ?? "neutro"}>
                      {estado?.etiqueta ?? repo.estado}
                    </EtiquetaEstado>
                  </DatoDetalle>
                </GrillaDatos>
              );
            })}
          </Stack>
        </SeccionDetalle>
      )}
    </>
  );
}

/** Otros incidentes del mismo equipo o lote: deja ver si el problema se repite. */
export function IncidentesRelacionados({
  incidente,
  esAdmin,
}: {
  incidente: IncidenteDetalle;
  esAdmin: boolean;
}) {
  const location = useLocation();
  const { relacionados, relacionados_total: total } = incidente;
  if (total === 0) return null;

  const que = [incidente.equipo_id && "equipo", incidente.lote_id && "lote"]
    .filter(Boolean)
    .join(" o ");

  return (
    <SeccionDetalle
      // A un operador solo le llegan los propios: el total no es el del equipo.
      titulo={`${esAdmin ? "Otros incidentes" : "Otros reportes tuyos"} del mismo ${que} (${total})`}
      descripcion={
        total > relacionados.length ? `Se muestran los ${relacionados.length} más recientes.` : undefined
      }
    >
      <Stack gap="3" separator={<Box borderTopWidth="1px" borderColor="border.subtle" />}>
        {relacionados.map((otro) => (
          <HStack key={otro.id} justify="space-between" gap="3" flexWrap="wrap">
            <Box minW="0" flex="1 1 220px">
              {/* Conserva de dónde se vino, para que "Volver" siga llevando ahí. */}
              <Enlace a={`/incidentes/${otro.id}`} estado={location.state}>
                {otro.titulo} #{otro.id}
              </Enlace>
              <Text fontSize="xs" color="fg.muted">
                {formatoFechaIncidente(otro.fecha_reporte)}
              </Text>
            </Box>
            <HStack gap="2" flexWrap="wrap">
              <Badge colorPalette={tipoColor(otro.tipo)} borderRadius="md" px="2" py="1">
                {tipoLabel(otro.tipo)}
              </Badge>
              <EtiquetaEstado tono={otro.estado === "cerrado" ? "ok" : "alerta"}>
                {estadoLabel(otro.estado)}
              </EtiquetaEstado>
            </HStack>
          </HStack>
        ))}
      </Stack>
    </SeccionDetalle>
  );
}
