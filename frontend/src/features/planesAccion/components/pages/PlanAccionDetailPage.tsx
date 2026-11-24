import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import {
  LuBan,
  LuCheck,
  LuClipboardCheck,
  LuLink,
  LuPaperclip,
  LuPencil,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import { MotivoDialog } from "../../../../common/components/MotivoDialog";
import { useAuth } from "../../../../common/context/useAuth";
import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import {
  BannerError,
  BannerExito,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../../components/ui/patrones";
import {
  AvisoSoloLectura,
  DatoDetalle,
  GrillaDatos,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";
import { abrirArchivo } from "../../../documentos/services/documentoService";
import { usePlan } from "../../hooks/usePlan";
import {
  actualizarAccion,
  actualizarPlan,
  agregarAccion,
  agregarSituaciones,
  cancelarPlan,
  completarAccion,
  confirmarPlan,
  eliminarAccion,
  quitarSituacion,
  verificarPlan,
  verificarSituacion,
} from "../../services/planAccionService";
import {
  ETIQUETA_MOMENTO_RIESGO,
  estaCerrado,
  etiquetaNivel,
  paletaNivel,
  type AccionPlan,
  type Evidencia,
  type HistorialPlan,
  type MomentoRiesgo,
  type PlanDetalle,
  type RiesgoElementoPlan,
  type SituacionPlan,
} from "../../types/planAccion";
import {
  AccionDialog,
  CandidatasDialog,
  EditarPlanDialog,
  EvidenciaDialog,
} from "../DialogosPlan";
import { EtiquetaEstadoPlan, EtiquetaEstadoSituacion, EtiquetaVencido } from "../EtiquetasPlan";
import { ProyeccionRiesgo } from "../ProyeccionRiesgo";

type Dialogo =
  | { tipo: "editar" }
  | { tipo: "cancelar" }
  | { tipo: "nueva-accion" }
  | { tipo: "editar-accion"; accion: AccionPlan }
  | { tipo: "completar-accion"; accion: AccionPlan }
  | { tipo: "candidatas" }
  | { tipo: "verificar-situacion"; situacion: SituacionPlan };

const MOMENTOS: MomentoRiesgo[] = ["antes", "implementado", "cierre"];

const ETIQUETA_EVENTO: Record<string, string> = {
  creacion: "Creación",
  estado: "Estado",
  edicion: "Edición",
  accion: "Acción",
  alcance: "Alcance",
  evidencia: "Evidencia",
  verificacion: "Verificación",
  observacion: "Observación",
};

// ------------------------------------------------------------------ Evidencias

function ListaEvidencias({
  evidencias,
  onError,
}: {
  evidencias: Evidencia[];
  onError: (mensaje: string) => void;
}) {
  if (evidencias.length === 0) return null;
  return (
    <Stack gap="1.5" mt="2">
      {evidencias.map((e) => (
        <Box key={e.id} fontSize="xs" color="fg.muted">
          <HStack gap="1.5" flexWrap="wrap" align="baseline">
            <Badge
              colorPalette={e.tipo === "implementacion" ? "blue" : "purple"}
              variant="subtle"
              rounded="full"
              px="2"
            >
              {e.tipo === "implementacion" ? "Implementación" : "Verificación"}
            </Badge>
            <Text as="span" color="fg">
              {e.descripcion}
            </Text>
          </HStack>
          <HStack gap="2" flexWrap="wrap" mt="0.5">
            <Text as="span">
              {e.usuario_nombre ?? "—"} · {formatoFechaHora(e.fecha)}
            </Text>
            {e.archivo_url ? (
              <BotonTexto
                onClick={() => {
                  abrirArchivo(e.archivo_url as string).catch((err: unknown) =>
                    onError(err instanceof Error ? err.message : "No se pudo abrir el archivo."),
                  );
                }}
              >
                <LuPaperclip aria-hidden />
                {e.nombre_archivo ?? "Ver archivo"}
              </BotonTexto>
            ) : null}
          </HStack>
        </Box>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------- Secciones

function SeccionAcciones({
  plan,
  ocupado,
  onNueva,
  onEditar,
  onQuitar,
  onCompletar,
  onError,
}: {
  plan: PlanDetalle;
  ocupado: boolean;
  onNueva: () => void;
  onEditar: (a: AccionPlan) => void;
  onQuitar: (a: AccionPlan) => void;
  onCompletar: (a: AccionPlan) => void;
  onError: (mensaje: string) => void;
}) {
  const puedeCompletar = plan.estado === "en_ejecucion";
  return (
    <SeccionDetalle
      sinMarco
      titulo="Acciones"
      descripcion={`${plan.acciones_completadas} de ${plan.acciones_total} implementadas. Cada una se completa con su evidencia.`}
      acciones={
        plan.editable ? (
          <Button size="sm" variant="outline" colorPalette="brand" onClick={onNueva} disabled={ocupado}>
            <LuPlus aria-hidden />
            Agregar acción
          </Button>
        ) : null
      }
    >
      {plan.acciones.length === 0 ? (
        <EstadoVacio>Todavía no hay acciones. Un plan necesita al menos una para confirmarse.</EstadoVacio>
      ) : (
        <Stack gap="3">
          {plan.acciones.map((a) => (
            <Tarjeta key={a.id} p="4" borderColor={a.completada ? "green.border" : "border.subtle"}>
              <HStack justify="space-between" align="flex-start" gap="3" flexWrap="wrap">
                <Box minW="0" flex="1">
                  <Text fontWeight="medium" color="fg" fontSize="sm">
                    {a.descripcion}
                  </Text>
                  <HStack gap="2" mt="1" flexWrap="wrap" fontSize="xs" color="fg.muted">
                    <Text as="span">{a.responsable_nombre}</Text>
                    <Text as="span">· Plazo {formatoFecha(a.plazo)}</Text>
                    {a.completada ? (
                      <Badge colorPalette="green" variant="subtle" rounded="full" px="2">
                        <LuCheck aria-hidden />
                        Implementada el {formatoFecha(a.completada_en)}
                      </Badge>
                    ) : a.vencida ? (
                      <Badge colorPalette="red" variant="subtle" rounded="full" px="2">
                        Vencida
                      </Badge>
                    ) : (
                      <Badge colorPalette="gray" variant="subtle" rounded="full" px="2">
                        Pendiente
                      </Badge>
                    )}
                  </HStack>
                </Box>
                <HStack gap="2" flexWrap="wrap">
                  {puedeCompletar && !a.completada ? (
                    <Button size="sm" colorPalette="brand" onClick={() => onCompletar(a)} disabled={ocupado}>
                      <LuCheck aria-hidden />
                      Completar
                    </Button>
                  ) : null}
                  {plan.editable && !a.completada ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        colorPalette="neutral"
                        onClick={() => onEditar(a)}
                        disabled={ocupado}
                        aria-label="Editar acción"
                      >
                        <LuPencil aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        colorPalette="red"
                        onClick={() => onQuitar(a)}
                        disabled={ocupado}
                        aria-label="Quitar acción"
                      >
                        <LuTrash2 aria-hidden />
                      </Button>
                    </>
                  ) : null}
                </HStack>
              </HStack>
              <ListaEvidencias evidencias={a.evidencias} onError={onError} />
            </Tarjeta>
          ))}
        </Stack>
      )}
    </SeccionDetalle>
  );
}

function SeccionAlcance({
  plan,
  ocupado,
  onSumar,
  onQuitar,
  onVerificar,
  onError,
  verificadorIndependiente,
}: {
  plan: PlanDetalle;
  ocupado: boolean;
  onSumar: () => void;
  onQuitar: (s: SituacionPlan) => void;
  onVerificar: (s: SituacionPlan) => void;
  onError: (mensaje: string) => void;
  /** false si el usuario actual es responsable del plan o de alguna acción. */
  verificadorIndependiente: boolean;
}) {
  const verificando = plan.estado === "implementado" || plan.estado === "en_verificacion";
  return (
    <SeccionDetalle
      sinMarco
      titulo="Situaciones del alcance"
      descripcion="Las situaciones que este plan trata. Cada una se verifica por separado; al verificarse queda bajo control del plan y deja de sumar al riesgo tratado (el riesgo real no se modifica)."
      acciones={
        plan.editable && plan.candidatas_nuevas > 0 ? (
          <Button size="sm" variant="outline" colorPalette="brand" onClick={onSumar} disabled={ocupado}>
            <LuPlus aria-hidden />
            Sumar nuevas ({plan.candidatas_nuevas})
          </Button>
        ) : null
      }
    >
      <Stack gap="3">
        {plan.situaciones.map((s) => {
          const decide = plan.estado === "implementado" && s.estado === "accion_implementada";
          return (
            <Tarjeta key={s.id} p="4">
              <HStack justify="space-between" align="flex-start" gap="3" flexWrap="wrap">
                <Box minW="0" flex="1">
                  <HStack gap="2" flexWrap="wrap">
                    <Text fontWeight="medium" fontSize="sm" color="fg">
                      {s.titulo}
                    </Text>
                    {s.es_origen ? (
                      <Badge colorPalette="brand" variant="subtle" rounded="full" px="2">
                        Origen
                      </Badge>
                    ) : null}
                    <Badge colorPalette="neutral" variant="outline" rounded="full" px="2">
                      {s.tipo_etiqueta}
                    </Badge>
                    {s.controlada ? (
                      <Badge colorPalette="blue" variant="subtle" rounded="full" px="2">
                        Bajo control de este plan
                      </Badge>
                    ) : null}
                  </HStack>
                  {s.detalle ? (
                    <Text fontSize="xs" color="fg.muted" mt="0.5">
                      {s.detalle}
                    </Text>
                  ) : null}
                  <Text fontSize="xs" color="fg.subtle" mt="0.5">
                    {s.detalle.includes(s.elemento_nombre) ? "Detectada" : `${s.elemento_nombre} · detectada`} el{" "}
                    {formatoFecha(s.detectada_en)}
                    {s.resuelta_en ? ` · el motor dejó de detectarla el ${formatoFecha(s.resuelta_en)}` : ""}
                    {s.verificada_en ? ` · verificada el ${formatoFecha(s.verificada_en)}` : ""}
                  </Text>
                  {decide && s.verificacion_manual && !verificadorIndependiente ? (
                    <Text fontSize="xs" color="orange.fg" mt="0.5">
                      Sos responsable del plan o de alguna de sus acciones: la verificación la tiene que
                      hacer otra persona.
                    </Text>
                  ) : null}
                  {decide && s.verificacion_manual ? (
                    <Text fontSize="xs" color="fg.muted" mt="0.5">
                      Un incidente no se cierra solo: lo confirma a mano alguien que no sea responsable del
                      plan ni de sus acciones, con evidencia. Al confirmarlo pasa a "controlado" y deja de
                      sumar al riesgo tratado; el riesgo real queda en el historial.
                    </Text>
                  ) : s.sigue_presente && !s.verificacion_manual && s.estado !== "pendiente" ? (
                    <Text fontSize="xs" color="orange.fg" mt="0.5">
                      El motor la sigue detectando.
                    </Text>
                  ) : null}
                </Box>
                <HStack gap="2" flexWrap="wrap">
                  <EtiquetaEstadoSituacion estado={s.estado} />
                  {verificando && decide && s.verificacion_manual && verificadorIndependiente ? (
                    <Button size="sm" colorPalette="brand" onClick={() => onVerificar(s)} disabled={ocupado}>
                      <LuClipboardCheck aria-hidden />
                      Verificar
                    </Button>
                  ) : null}
                  {verificando && !s.verificacion_manual ? (
                    <Button
                      size="sm"
                      variant="outline"
                      colorPalette="neutral"
                      onClick={() => onVerificar(s)}
                      disabled={ocupado}
                    >
                      <LuPaperclip aria-hidden />
                      Adjuntar evidencia
                    </Button>
                  ) : null}
                  {plan.editable && !s.es_origen ? (
                    <Button
                      size="sm"
                      variant="outline"
                      colorPalette="red"
                      onClick={() => onQuitar(s)}
                      disabled={ocupado}
                      aria-label="Quitar del alcance"
                    >
                      <LuTrash2 aria-hidden />
                    </Button>
                  ) : null}
                </HStack>
              </HStack>
              <ListaEvidencias evidencias={s.evidencias} onError={onError} />
            </Tarjeta>
          );
        })}
      </Stack>
    </SeccionDetalle>
  );
}

function CeldaRiesgo({ registro }: { registro: RiesgoElementoPlan | undefined }) {
  if (!registro) {
    return (
      <Celda>
        <Text as="span" color="fg.subtle">
          —
        </Text>
      </Celda>
    );
  }
  return (
    <Celda>
      <HStack gap="2">
        <Badge colorPalette={paletaNivel(registro.nivel)} variant="subtle" rounded="full" px="2">
          {etiquetaNivel(registro.nivel)}
        </Badge>
        <Text as="span" fontSize="xs" color="fg.muted">
          {String(registro.puntaje).replace(".", ",")} pts
        </Text>
      </HStack>
      {registro.puntaje_tratado !== null && registro.puntaje_tratado !== registro.puntaje ? (
        <Text fontSize="xs" color="blue.fg" mt="1">
          Tratado: {String(registro.puntaje_tratado).replace(".", ",")} pts
        </Text>
      ) : null}
    </Celda>
  );
}

/**
 * Riesgo de cada elemento antes, durante y después. El REAL es el del motor y
 * nunca se modifica; el TRATADO es el mismo cálculo sin las situaciones que el
 * plan tiene bajo control. Las fotos las copia el plan en cada momento.
 */
function SeccionRiesgo({ plan }: { plan: PlanDetalle }) {
  const elementos = Array.from(new Set(plan.riesgos.map((r) => r.elemento)));
  return (
    <SeccionDetalle
      sinMarco
      titulo="Riesgo de los elementos"
      descripcion="El riesgo real lo calcula el motor y no cambia por tener un plan. El plan guarda una foto en cada momento y muestra el riesgo tratado y una estimación si resulta eficaz."
    >
      {plan.riesgo_actual.length > 0 ? (
        <Box mb="5">
          <Text fontWeight="bold" fontSize="sm" color="fg" mb="2">
            Riesgo ahora
          </Text>
          <Stack gap="2">
            {plan.riesgo_actual.map((r) => (
              <Tarjeta key={r.elemento} p="3">
                <HStack justify="space-between" gap="3" flexWrap="wrap">
                  <Box minW="0" flex="1">
                    <Text fontSize="sm" fontWeight="medium" color="fg" lineClamp={1}>
                      {r.etiqueta}
                    </Text>
                    {r.en_tratamiento ? (
                      <Text fontSize="xs" color="blue.fg">
                        En tratamiento
                      </Text>
                    ) : null}
                  </Box>
                  <HStack gap="4">
                    <Box>
                      <Text fontSize="2xs" color="fg.subtle">
                        Real
                      </Text>
                      <HStack gap="2">
                        <Badge colorPalette={paletaNivel(r.nivel)} variant="subtle" rounded="full" px="2">
                          {etiquetaNivel(r.nivel)}
                        </Badge>
                        <Text as="span" fontSize="sm" fontWeight="medium">
                          {String(r.puntaje).replace(".", ",")}
                        </Text>
                      </HStack>
                    </Box>
                    {r.en_tratamiento ? (
                      <Box>
                        <Text fontSize="2xs" color="fg.subtle">
                          Tratado
                        </Text>
                        <HStack gap="2">
                          <Badge
                            colorPalette={paletaNivel(r.nivel_tratado)}
                            variant="subtle"
                            rounded="full"
                            px="2"
                          >
                            {etiquetaNivel(r.nivel_tratado)}
                          </Badge>
                          <Text as="span" fontSize="sm" fontWeight="medium">
                            {String(r.puntaje_tratado).replace(".", ",")}
                          </Text>
                        </HStack>
                      </Box>
                    ) : null}
                  </HStack>
                </HStack>
              </Tarjeta>
            ))}
          </Stack>
        </Box>
      ) : null}
      {plan.proyeccion.length > 0 ? (
        <Box mb="5">
          <ProyeccionRiesgo proyeccion={plan.proyeccion} />
        </Box>
      ) : null}
      {elementos.length === 0 ? (
        <EstadoVacio>Todavía no hay registros de riesgo.</EstadoVacio>
      ) : (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="560px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Elemento</EncabezadoOscuro>
                {MOMENTOS.map((m) => (
                  <EncabezadoOscuro key={m}>{ETIQUETA_MOMENTO_RIESGO[m]}</EncabezadoOscuro>
                ))}
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {elementos.map((el) => {
                const registros = plan.riesgos.filter((r) => r.elemento === el);
                return (
                  <Table.Row key={el}>
                    <Celda>{registros[0]?.etiqueta ?? el}</Celda>
                    {MOMENTOS.map((m) => (
                      <CeldaRiesgo key={m} registro={registros.find((r) => r.momento === m)} />
                    ))}
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}
    </SeccionDetalle>
  );
}

function SeccionHistorial({ historial }: { historial: HistorialPlan[] }) {
  return (
    <SeccionDetalle titulo="Historial" descripcion="Todo lo que pasó con el plan, de lo más reciente a lo más antiguo.">
      {historial.length === 0 ? (
        <EstadoVacio>Sin movimientos.</EstadoVacio>
      ) : (
        <Stack gap="0">
          {historial.map((h) => (
            <HStack
              key={h.id}
              align="flex-start"
              gap="3"
              py="3"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              _last={{ borderBottomWidth: "0" }}
            >
              <Box
                mt="1.5"
                boxSize="2"
                rounded="full"
                bg="brand.solid"
                flexShrink={0}
                aria-hidden
              />
              <Box minW="0">
                <HStack gap="2" flexWrap="wrap">
                  <Text fontSize="xs" fontWeight="bold" color="brand.fg">
                    {ETIQUETA_EVENTO[h.evento] ?? h.evento}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {formatoFechaHora(h.fecha)} · {h.usuario_nombre ?? "Sistema"}
                  </Text>
                </HStack>
                <Text fontSize="sm" color="fg" mt="0.5">
                  {h.detalle}
                </Text>
              </Box>
            </HStack>
          ))}
        </Stack>
      )}
    </SeccionDetalle>
  );
}

function TextoDato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted" mb="1">
        {titulo}
      </Text>
      <Text fontSize="sm" color="fg" whiteSpace="pre-wrap">
        {children}
      </Text>
    </Box>
  );
}

// -------------------------------------------------------------------- Página

export function PlanAccionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const numero = Number(id);
  const planId = Number.isFinite(numero) ? numero : null;

  const { plan, error, reemplazar } = usePlan(planId);
  const { user } = useAuth();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const { valor: aviso, avisar } = useAvisoTemporal<string>(3500);

  if (!plan && !error) return <EstadoCargando pagina>Cargando plan...</EstadoCargando>;
  if (!plan) {
    return (
      <PaginaDetalle titulo="Plan de acción" volver={{ a: "/planes-accion", etiqueta: "Planes de acción" }}>
        <BannerError>{error ?? "No se encontró el plan."}</BannerError>
      </PaginaDetalle>
    );
  }

  /** Para los diálogos: si falla, el error sube y el diálogo lo muestra. */
  const aplicar = async (operacion: () => Promise<PlanDetalle>, mensaje: string) => {
    const actualizado = await operacion();
    reemplazar(actualizado);
    setDialogo(null);
    avisar(mensaje);
  };

  /** Para los botones directos: el error queda en un banner de la página. */
  const aplicarDirecto = async (operacion: () => Promise<PlanDetalle>, mensaje: string) => {
    setOcupado(true);
    setErrorAccion(null);
    try {
      const actualizado = await operacion();
      reemplazar(actualizado);
      avisar(mensaje);
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  };

  const cerrado = estaCerrado(plan.estado);
  const hayPorVerificar = plan.situaciones.some(
    (s) => s.estado === "accion_implementada" && !s.verificacion_manual,
  );

  const acciones = (
    <>
      {plan.estado === "borrador" ? (
        <Button
          colorPalette="brand"
          onClick={() => void aplicarDirecto(() => confirmarPlan(plan.id), "Plan confirmado: pasó a En ejecución.")}
          loading={ocupado}
        >
          <LuCheck aria-hidden />
          Confirmar plan
        </Button>
      ) : null}
      {plan.estado === "implementado" && hayPorVerificar ? (
        <Button
          colorPalette="brand"
          onClick={() => void aplicarDirecto(() => verificarPlan(plan.id), "Verificación realizada.")}
          loading={ocupado}
        >
          <LuClipboardCheck aria-hidden />
          Verificar situaciones
        </Button>
      ) : null}
      {plan.editable ? (
        <Button variant="outline" colorPalette="neutral" onClick={() => setDialogo({ tipo: "editar" })}>
          <LuPencil aria-hidden />
          Editar
        </Button>
      ) : null}
      {cerrado ? (
        <Button
          variant="outline"
          colorPalette="brand"
          onClick={() => navigate(`/planes-accion/nuevo?anterior=${plan.id}`)}
        >
          <LuLink aria-hidden />
          Crear plan vinculado
        </Button>
      ) : null}
      {plan.cancelable ? (
        <Button variant="outline" colorPalette="red" onClick={() => setDialogo({ tipo: "cancelar" })}>
          <LuBan aria-hidden />
          Cancelar plan
        </Button>
      ) : null}
    </>
  );

  return (
    <PaginaDetalle
      titulo={`Plan de acción #${plan.id}`}
      descripcion={plan.tipo_etiqueta}
      volver={{ a: "/planes-accion", etiqueta: "Planes de acción" }}
      estado={
        <HStack gap="2">
          <EtiquetaEstadoPlan estado={plan.estado} />
          {plan.vencido ? <EtiquetaVencido /> : null}
        </HStack>
      }
      acciones={acciones}
    >
      {aviso ? <BannerExito>{aviso}</BannerExito> : null}
      {errorAccion ? <BannerError>{errorAccion}</BannerError> : null}
      {error ? <BannerError>{error}</BannerError> : null}

      {cerrado ? (
        <AvisoSoloLectura>
          Plan cerrado: no se reabre. Si el problema vuelve, se crea un plan nuevo vinculado a este.
        </AvisoSoloLectura>
      ) : null}
      {plan.estado === "cancelado" ? (
        <AvisoSoloLectura>Plan cancelado: {plan.motivo_cancelacion ?? "sin motivo registrado"}.</AvisoSoloLectura>
      ) : null}
      {plan.estado === "en_verificacion" && plan.fecha_fin_observacion ? (
        <AvisoSoloLectura>
          En observación hasta el {formatoFecha(plan.fecha_fin_observacion)}. Si el problema reaparece en algún
          elemento, esa situación queda como no eficaz y su riesgo vuelve a subir.
        </AvisoSoloLectura>
      ) : null}

      <SeccionDetalle titulo="Datos del plan">
        <GrillaDatos mb="5">
          <DatoDetalle etiqueta="Responsable">{plan.responsable_nombre}</DatoDetalle>
          <DatoDetalle etiqueta="Plazo">{plan.plazo ? formatoFecha(plan.plazo) : "Sin plazo"}</DatoDetalle>
          <DatoDetalle etiqueta="Creado">
            {formatoFecha(plan.fecha_creacion)} · {plan.creado_por_nombre}
          </DatoDetalle>
          <DatoDetalle etiqueta="Implementado">
            {plan.fecha_implementado ? formatoFecha(plan.fecha_implementado) : "—"}
          </DatoDetalle>
          <DatoDetalle etiqueta="Observación">
            {plan.fecha_inicio_observacion && plan.fecha_fin_observacion
              ? `${formatoFecha(plan.fecha_inicio_observacion)} → ${formatoFecha(plan.fecha_fin_observacion)}`
              : `${plan.dias_observacion} días desde la implementación`}
          </DatoDetalle>
          <DatoDetalle etiqueta="Cierre">{plan.fecha_cierre ? formatoFecha(plan.fecha_cierre) : "—"}</DatoDetalle>
          {plan.plan_anterior_id ? (
            <DatoDetalle etiqueta="Continúa el plan">
              <BotonTexto onClick={() => navigate(`/planes-accion/${plan.plan_anterior_id}`)}>
                #{plan.plan_anterior_id}
              </BotonTexto>
            </DatoDetalle>
          ) : null}
          {plan.planes_vinculados.length > 0 ? (
            <DatoDetalle etiqueta="Planes posteriores">
              <HStack gap="2" flexWrap="wrap">
                {plan.planes_vinculados.map((v) => (
                  <BotonTexto key={v} onClick={() => navigate(`/planes-accion/${v}`)}>
                    #{v}
                  </BotonTexto>
                ))}
              </HStack>
            </DatoDetalle>
          ) : null}
        </GrillaDatos>
        <Stack gap="4">
          <TextoDato titulo="Causa identificada">{plan.causa}</TextoDato>
          <TextoDato titulo="Objetivo">{plan.objetivo}</TextoDato>
          <TextoDato titulo="Criterio de eficacia">{plan.criterio_eficacia}</TextoDato>
        </Stack>
      </SeccionDetalle>

      <SeccionAcciones
        plan={plan}
        ocupado={ocupado}
        onNueva={() => setDialogo({ tipo: "nueva-accion" })}
        onEditar={(accion) => setDialogo({ tipo: "editar-accion", accion })}
        onQuitar={(a) =>
          void aplicarDirecto(() => eliminarAccion(plan.id, a.id), "Acción quitada del plan.")
        }
        onCompletar={(accion) => setDialogo({ tipo: "completar-accion", accion })}
        onError={setErrorAccion}
      />

      <SeccionAlcance
        verificadorIndependiente={
          !user ||
          (user.id !== plan.responsable_id &&
            !plan.acciones.some((a) => a.responsable_id === user.id))
        }
        plan={plan}
        ocupado={ocupado}
        onSumar={() => setDialogo({ tipo: "candidatas" })}
        onQuitar={(s) =>
          void aplicarDirecto(() => quitarSituacion(plan.id, s.id), "Situación quitada del alcance.")
        }
        onVerificar={(situacion) => setDialogo({ tipo: "verificar-situacion", situacion })}
        onError={setErrorAccion}
      />

      <SeccionRiesgo plan={plan} />
      <SeccionHistorial historial={plan.historial} />

      {/* Diálogos */}
      {dialogo?.tipo === "editar" ? (
        <EditarPlanDialog
          plan={plan}
          onConfirm={(cambios) => aplicar(() => actualizarPlan(plan.id, cambios), "Plan actualizado.")}
          onCancel={() => setDialogo(null)}
        />
      ) : null}

      {dialogo?.tipo === "cancelar" ? (
        <MotivoDialog
          titulo="Cancelar plan"
          mensaje="El plan queda como cancelado y no se puede retomar. Las situaciones quedan libres para otro plan."
          etiquetaMotivo="Motivo de la cancelación"
          etiquetaConfirmar="Cancelar plan"
          onConfirm={(motivo) => aplicar(() => cancelarPlan(plan.id, motivo), "Plan cancelado.")}
          onCancel={() => setDialogo(null)}
        />
      ) : null}

      {dialogo?.tipo === "nueva-accion" ? (
        <AccionDialog
          onConfirm={(datos) => aplicar(() => agregarAccion(plan.id, datos), "Acción agregada.")}
          onCancel={() => setDialogo(null)}
        />
      ) : null}

      {dialogo?.tipo === "editar-accion" ? (
        <AccionDialog
          accion={dialogo.accion}
          onConfirm={(datos) =>
            aplicar(() => actualizarAccion(plan.id, dialogo.accion.id, datos), "Acción actualizada.")
          }
          onCancel={() => setDialogo(null)}
        />
      ) : null}

      {dialogo?.tipo === "completar-accion" ? (
        <EvidenciaDialog
          titulo="Completar acción"
          mensaje={dialogo.accion.descripcion}
          etiquetaDescripcion="Evidencia de implementación"
          etiquetaConfirmar="Completar"
          onConfirm={(descripcion, archivo) =>
            aplicar(
              () => completarAccion(plan.id, dialogo.accion.id, descripcion, archivo),
              "Acción completada.",
            )
          }
          onCancel={() => setDialogo(null)}
        />
      ) : null}

      {dialogo?.tipo === "candidatas" ? (
        <CandidatasDialog
          planId={plan.id}
          onConfirm={(ids, confirma) =>
            aplicar(() => agregarSituaciones(plan.id, ids, confirma), "Situaciones sumadas al plan.")
          }
          onCancel={() => setDialogo(null)}
        />
      ) : null}

      {dialogo?.tipo === "verificar-situacion" ? (
        <EvidenciaDialog
          titulo={dialogo.situacion.verificacion_manual ? "Verificar situación" : "Evidencia de verificación"}
          mensaje={dialogo.situacion.titulo}
          etiquetaDescripcion="Evidencia de verificación"
          minimo={dialogo.situacion.verificacion_manual ? 10 : 3}
          ayuda={
            dialogo.situacion.verificacion_manual
              ? "Obligatoria: describí qué se comprobó y cómo (al menos 10 caracteres). Podés adjuntar un archivo."
              : undefined
          }
          etiquetaConfirmar={dialogo.situacion.verificacion_manual ? "Verificar" : "Adjuntar"}
          pedirResultado={dialogo.situacion.verificacion_manual}
          onConfirm={(descripcion, archivo, resultado) =>
            aplicar(
              () => verificarSituacion(plan.id, dialogo.situacion.id, { descripcion, resultado, archivo }),
              "Verificación registrada.",
            )
          }
          onCancel={() => setDialogo(null)}
        />
      ) : null}
    </PaginaDetalle>
  );
}
