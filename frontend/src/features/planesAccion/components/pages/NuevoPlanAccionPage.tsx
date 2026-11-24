import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, HStack, Text, Textarea, VStack } from "@chakra-ui/react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { useResponsables } from "../../hooks/useResponsables";
import { useProyeccion } from "../../hooks/useProyeccion";
import { useSituacionesDisponibles } from "../../hooks/useSituacionesDisponibles";
import { ProyeccionRiesgo } from "../ProyeccionRiesgo";
import { crearPlan } from "../../services/planAccionService";
import {
  ListaSituacionesElegibles,
  MarcasSituacion,
  TextoSituacion,
} from "../SituacionesElegibles";
import type { AccionInput } from "../../types/planAccion";
import { hoyISO } from "../../../../common/utils/fechas";
import {
  AccionesFormulario,
  AvisoFaltantes,
  BotonCancelar,
  BotonGuardar,
  BotonTexto,
  EstadoCargando,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  TarjetaFormulario,
  TituloFormulario,
  faltantes,
  useIntentoEnvio,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";

interface AccionBorrador {
  descripcion: string;
  responsable_id: number;
  plazo: string;
}

const ACCION_VACIA: AccionBorrador = { descripcion: "", responsable_id: 0, plazo: "" };

export function NuevoPlanAccionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { situaciones, loading, error: errorSituaciones } = useSituacionesDisponibles();
  const { responsables } = useResponsables();

  // Se llega con `?situacion=<clave de la alerta>` desde el centro de
  // notificaciones, o con `?anterior=<plan>` para continuar un plan cerrado.
  const claveInicial = params.get("situacion");
  const anterior = Number(params.get("anterior")) || null;

  const [origenElegido, setOrigenElegido] = useState<number | null>(null);
  const origenId = useMemo(() => {
    if (origenElegido !== null) return origenElegido;
    if (!claveInicial) return null;
    return (
      situaciones.find(
        (s) => s.clave_alerta === claveInicial || String(s.situacion_id) === claveInicial,
      )?.situacion_id ?? null
    );
  }, [origenElegido, claveInicial, situaciones]);

  const origen = situaciones.find((s) => s.situacion_id === origenId) ?? null;
  const [adicionalesElegidas, setAdicionales] = useState<number[]>([]);

  // Selección efectiva: se descartan las que dejaron de ser compatibles (por
  // ejemplo, de otro tipo cuyo elemento entraba por una situación que se
  // desmarcó). Una situación es compatible si es del mismo tipo que el origen
  // o si es de un elemento que ya está en el alcance.
  const adicionales = useMemo(() => {
    if (!origen) return [];
    const aceptadas: number[] = [];
    const elementos = new Set([origen.elemento]);
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const id of adicionalesElegidas) {
        if (aceptadas.includes(id)) continue;
        const s = situaciones.find((x) => x.situacion_id === id);
        if (s && (s.tipo === origen.tipo || elementos.has(s.elemento))) {
          aceptadas.push(id);
          elementos.add(s.elemento);
          cambio = true;
        }
      }
    }
    return aceptadas;
  }, [origen, situaciones, adicionalesElegidas]);

  // Candidatas: mismo tipo que el origen, o del mismo elemento que algo del alcance.
  const candidatas = useMemo(() => {
    if (!origen) return [];
    const elementos = new Set([origen.elemento]);
    for (const id of adicionales) {
      const s = situaciones.find((x) => x.situacion_id === id);
      if (s) elementos.add(s.elemento);
    }
    return situaciones.filter(
      (s) =>
        s.situacion_id !== origen.situacion_id &&
        (s.tipo === origen.tipo || elementos.has(s.elemento)),
    );
  }, [origen, situaciones, adicionales]);
  const hayOtroTipo = adicionales.some(
    (id) => situaciones.find((x) => x.situacion_id === id)?.tipo !== origen?.tipo,
  );

  const [causa, setCausa] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [criterio, setCriterio] = useState("");
  const [responsableId, setResponsableId] = useState(0);
  const [plazo, setPlazo] = useState("");
  const { proyeccion } = useProyeccion(origenId ? [origenId, ...adicionales] : []);
  const [confirmaCausa, setConfirmaCausa] = useState(false);
  const [acciones, setAcciones] = useState<AccionBorrador[]>([{ ...ACCION_VACIA }]);
  const [guardando, setGuardando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const elegirOrigen = (id: number) => {
    setOrigenElegido(id);
    setAdicionales([]);
    setConfirmaCausa(false);
  };

  const alternarAdicional = (id: number) =>
    setAdicionales(() =>
      adicionales.includes(id) ? adicionales.filter((x) => x !== id) : [...adicionales, id],
    );

  const cambiarAccion = (indice: number, cambios: Partial<AccionBorrador>) =>
    setAcciones((actuales) =>
      actuales.map((accion, i) => (i === indice ? { ...accion, ...cambios } : accion)),
    );

  // Las filas de acciones vacías no cuentan: se ignoran al guardar.
  const accionesCompletas = acciones.filter((a) => a.descripcion.trim() !== "");
  const accionesIncompletas = accionesCompletas.some((a) => !a.responsable_id || !a.plazo);

  const faltan = faltantes({
    origen: [origen === null, "la situación a tratar"],
    causa: [causa.trim().length < 3, "la causa identificada"],
    objetivo: [objetivo.trim().length < 3, "el objetivo"],
    criterio: [criterio.trim().length < 3, "el criterio de eficacia"],
    responsable: [!responsableId, "el responsable general"],
    acciones: [accionesIncompletas, "responsable y plazo de cada acción"],
    confirma: [adicionales.length > 0 && !confirmaCausa, "la confirmación de causa compatible"],
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!puedeEnviar(faltan.lista) || origen === null) return;
    setGuardando(true);
    setErrorEnvio(null);
    try {
      const plan = await crearPlan({
        situacion_origen_id: origen.situacion_id,
        causa: causa.trim(),
        objetivo: objetivo.trim(),
        criterio_eficacia: criterio.trim(),
        responsable_id: responsableId,
        plazo: plazo || null,
        plan_anterior_id: anterior,
        situaciones_adicionales: adicionales,
        confirma_causa_compatible: confirmaCausa,
        acciones: accionesCompletas.map<AccionInput>((a) => ({
          descripcion: a.descripcion.trim(),
          responsable_id: a.responsable_id,
          plazo: a.plazo,
        })),
      });
      navigate(`/planes-accion/${plan.id}`);
    } catch (err) {
      setErrorEnvio(err instanceof Error ? err.message : "No se pudo crear el plan.");
    } finally {
      setGuardando(false);
    }
  };

  const volver = anterior
    ? { a: `/planes-accion/${anterior}`, etiqueta: `Plan #${anterior}` }
    : { a: "/planes-accion", etiqueta: "Planes de acción" };

  return (
    <PaginaFormulario
      titulo="Nuevo plan de acción"
      descripcion={
        anterior
          ? `Continúa el plan #${anterior}: queda vinculado para que el historial muestre qué se intentó.`
          : "Un plan trata una causa identificada. No modifica el riesgo real: el motor lo sigue calculando, y el plan lo muestra aparte como riesgo tratado."
      }
      volver={volver}
      ancho="ancho"
      error={errorEnvio ?? errorSituaciones}
    >
      {loading ? (
        <EstadoCargando>Cargando situaciones...</EstadoCargando>
      ) : (
        <Box as="form" onSubmit={handleSubmit}>
          {/* 1. Situación de origen */}
          <TarjetaFormulario>
            <TituloFormulario>1. Situación a tratar</TituloFormulario>
            {situaciones.length === 0 ? (
              <Text color="fg.muted" fontSize="sm">
                No hay situaciones presentes que se puedan tratar: o no hay ninguna, o todas ya
                están en un plan en curso.
              </Text>
            ) : origen ? (
              <HStack
                align="flex-start"
                justify="space-between"
                gap="4"
                p="4"
                rounded="md"
                borderWidth="1px"
                borderColor="brand.300"
                bg="brand.subtle"
              >
                <VStack align="stretch" gap="2" minW="0">
                  <TextoSituacion situacion={origen} />
                  <MarcasSituacion situacion={origen} />
                </VStack>
                <BotonTexto onClick={() => setOrigenElegido(0)}>Cambiar</BotonTexto>
              </HStack>
            ) : (
              <FormField label="Situación de origen" required invalid={intentado && faltan.tiene("origen")}>
                <FormNativeSelect
                  value=""
                  onChange={(e) => elegirOrigen(Number(e.target.value))}
                >
                  <SelectPlaceholder value="">Elegí la situación…</SelectPlaceholder>
                  {situaciones.map((s) => (
                    <option key={s.situacion_id} value={s.situacion_id}>
                      {s.sugerir_plan ? "★ " : ""}
                      {s.titulo} — {s.elemento_nombre}
                    </option>
                  ))}
                </FormNativeSelect>
              </FormField>
            )}
          </TarjetaFormulario>

          {/* 2. Causa, objetivo y eficacia */}
          <TarjetaFormulario>
            <TituloFormulario>2. Qué se va a corregir</TituloFormulario>
            <FormField label="Causa identificada" required invalid={intentado && faltan.tiene("causa")}>
              <Textarea
                value={causa}
                onChange={(e) => setCausa(e.target.value)}
                placeholder="Por qué ocurre el problema (no el síntoma)"
                rows={3}
                resize="vertical"
              />
            </FormField>
            <FormField label="Objetivo del plan" required invalid={intentado && faltan.tiene("objetivo")}>
              <Textarea
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                placeholder="Qué se quiere lograr"
                rows={2}
                resize="vertical"
              />
            </FormField>
            <FormField
              label="Criterio de eficacia"
              required
              invalid={intentado && faltan.tiene("criterio")}
              helper="Cómo se va a saber que el tratamiento funcionó, una vez terminado el período de observación."
            >
              <Textarea
                value={criterio}
                onChange={(e) => setCriterio(e.target.value)}
                placeholder="Ej: no vuelven a registrarse reportes de plagas en el sector"
                rows={2}
                resize="vertical"
              />
            </FormField>
            <HStack gap="4" align="flex-start" flexWrap="wrap">
              <Box flex="1" minW="240px">
                <FormField
                  label="Responsable general"
                  required
                  invalid={intentado && faltan.tiene("responsable")}
                >
                  <FormNativeSelect
                    value={responsableId}
                    onChange={(e) => setResponsableId(Number(e.target.value))}
                  >
                    <SelectPlaceholder>Elegí una persona…</SelectPlaceholder>
                    {responsables.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </FormNativeSelect>
                </FormField>
              </Box>
              <Box flex="1" minW="200px">
                <FormField label="Plazo del plan (opcional)">
                  <FormInput
                    type="date"
                    min={hoyISO()}
                    value={plazo}
                    onChange={(e) => setPlazo(e.target.value)}
                  />
                </FormField>
              </Box>
            </HStack>
          </TarjetaFormulario>

          {/* 3. Alcance */}
          {origen && (
            <TarjetaFormulario>
              <TituloFormulario>3. Alcance</TituloFormulario>
              <Text fontSize="sm" color="fg.muted" mb="4">
                {candidatas.length === 0
                  ? "No hay otras situaciones para sumar."
                  : `SAIA propone las demás situaciones de “${origen.tipo_etiqueta}” y las de otro tipo que ocurren en el mismo elemento. Sumá solo las que comparten la causa de este plan: dos situaciones del mismo tipo, o del mismo elemento, no siempre la comparten.`}
              </Text>
              {candidatas.length > 0 && (
                <>
                  <ListaSituacionesElegibles
                    situaciones={candidatas}
                    seleccionadas={adicionales}
                    onAlternar={alternarAdicional}
                  />
                  {adicionales.length > 0 && (
                    <HStack
                      as="label"
                      align="flex-start"
                      gap="3"
                      mt="4"
                      p="3"
                      rounded="md"
                      bg="bg.subtle"
                      cursor="pointer"
                    >
                      <input
                        type="checkbox"
                        checked={confirmaCausa}
                        onChange={(e) => setConfirmaCausa(e.target.checked)}
                        style={{ marginTop: 4 }}
                      />
                      <Text fontSize="sm">
                        Confirmo que las situaciones elegidas comparten una causa compatible con la
                        del plan.
                        {hayOtroTipo
                          ? " Incluye situaciones de otro tipo: cada una se verifica y se observa según su propio tipo."
                          : ""}
                      </Text>
                    </HStack>
                  )}
                </>
              )}
              {proyeccion.length > 0 && (
                <Box mt="5">
                  <ProyeccionRiesgo proyeccion={proyeccion} />
                </Box>
              )}
            </TarjetaFormulario>
          )}

          {/* 4. Acciones */}
          <TarjetaFormulario>
            <TituloFormulario>4. Acciones</TituloFormulario>
            <Text fontSize="sm" color="fg.muted" mb="4">
              Cada acción tiene su responsable y su plazo. Pueden completarse después, mientras el
              plan está en borrador; para pasar a ejecución hace falta al menos una.
            </Text>
            <VStack align="stretch" gap="4">
              {acciones.map((accion, indice) => (
                <Box key={indice} p="4" rounded="md" borderWidth="1px" borderColor="border.subtle">
                  <FormField label={`Acción ${indice + 1}`} mb="3">
                    <Textarea
                      value={accion.descripcion}
                      onChange={(e) => cambiarAccion(indice, { descripcion: e.target.value })}
                      placeholder="Qué se va a hacer"
                      rows={2}
                      resize="vertical"
                    />
                  </FormField>
                  <HStack gap="4" align="flex-end" flexWrap="wrap">
                    <Box flex="1" minW="220px">
                      <FormField label="Responsable" mb="0">
                        <FormNativeSelect
                          value={accion.responsable_id}
                          onChange={(e) =>
                            cambiarAccion(indice, { responsable_id: Number(e.target.value) })
                          }
                        >
                          <SelectPlaceholder>Elegí una persona…</SelectPlaceholder>
                          {responsables.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </FormNativeSelect>
                      </FormField>
                    </Box>
                    <Box flex="1" minW="180px">
                      <FormField label="Plazo" mb="0">
                        <FormInput
                          type="date"
                          min={hoyISO()}
                          value={accion.plazo}
                          onChange={(e) => cambiarAccion(indice, { plazo: e.target.value })}
                        />
                      </FormField>
                    </Box>
                    {acciones.length > 1 && (
                      <BotonTexto
                        color="red.fg"
                        onClick={() => setAcciones((a) => a.filter((_, i) => i !== indice))}
                        title="Quitar la acción"
                      >
                        <LuTrash2 aria-hidden />
                        Quitar
                      </BotonTexto>
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
            <Box mt="4">
              <BotonTexto onClick={() => setAcciones((a) => [...a, { ...ACCION_VACIA }])}>
                <LuPlus aria-hidden />
                Agregar otra acción
              </BotonTexto>
            </Box>
          </TarjetaFormulario>

          <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
          <AccionesFormulario>
            <BotonGuardar loading={guardando}>Crear plan</BotonGuardar>
            <BotonCancelar onClick={() => navigate(volver.a)} disabled={guardando}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </Box>
      )}
    </PaginaFormulario>
  );
}
