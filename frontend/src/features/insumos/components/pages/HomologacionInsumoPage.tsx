import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Button, HStack, SimpleGrid, Stack, Table, Text, Textarea } from "@chakra-ui/react";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import {
  BannerError,
  BannerExito,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EtiquetaEstado,
  FilaEncabezado,
  FormField,
  FormInput,
  FormNativeSelect,
  TarjetaFormulario,
  TituloFormulario,
  type TonoEstado,
} from "../../../../components/ui/patrones";
import { useLista } from "../../../../common/hooks/useLista";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import { formatoCantidad, formatoConSigno } from "../../../../common/utils/numeros";
import { listarAlergenos } from "../../../alergenos/services/alergenoService";
import type { Alergeno } from "../../../alergenos/types/alergeno";
import { decidirHomologacion, guardarRotulo, obtenerHomologacion } from "../../services/insumoService";
import {
  ETIQUETA_ESTADO_HOMOLOGACION,
  TONO_ESTADO_HOMOLOGACION,
  type EstadoFila,
  type HomologacionInsumo,
  type NivelAlergenoRotulo,
  type ResultadoComparacion,
} from "../../types/insumo";

interface Datos {
  homologacion: HomologacionInsumo | null;
  catalogo: Alergeno[];
}

type NivelSeleccion = NivelAlergenoRotulo | "";

const ETIQUETA_NIVEL: Record<NivelAlergenoRotulo, string> = {
  contiene: "Contiene",
  puede_contener: "Puede contener",
};

const ESTADO_FILA: Record<EstadoFila, { tono: TonoEstado; texto: string }> = {
  ok: { tono: "ok", texto: "En tolerancia" },
  fuera_de_tolerancia: { tono: "alerta", texto: "Fuera de tolerancia" },
  sin_dato: { tono: "alerta", texto: "Falta en el rótulo" },
  sin_referencia: { tono: "neutro", texto: "Sin referencia" },
  bajo_umbral: { tono: "ok", texto: "No significativo" },
};

const RESULTADO: Record<ResultadoComparacion, { tono: TonoEstado; texto: string; detalle: string }> = {
  apta: {
    tono: "ok",
    texto: "Apta",
    detalle: "El rótulo cumple la especificación del ingrediente.",
  },
  observada: {
    tono: "alerta",
    texto: "Observada",
    detalle: "Hay diferencias en los valores nutricionales: se puede aprobar con una justificación.",
  },
  rechazada: {
    tono: "peligro",
    texto: "No cumple",
    detalle: "La marca declara alérgenos que la especificación no admite: no se puede aprobar.",
  },
};

/** "12.5000" -> "12.5" para editar sin ceros de sobra. */
function limpio(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  return Number.isFinite(n) ? String(n) : valor;
}

const aDecimal = (texto: string) => texto.trim().replace(",", ".");
const PARCIAL_NUMERICO = /^\d*[.,]?\d*$/;

/**
 * Homologación de un insumo (marca) contra su ingrediente (especificación).
 *
 * Se carga el rótulo del fabricante por 100 g y se compara con los valores
 * objetivo del ingrediente (con la tolerancia de Parámetros nutricionales) y
 * con sus alérgenos. Solo de una marca aprobada se reciben lotes.
 */
export function HomologacionInsumoPage() {
  const { id } = useParams<{ id: string }>();
  const insumoId = Number(id);

  const [valores, setValores] = useState<Record<string, string>>({});
  const [alergenos, setAlergenos] = useState<Record<number, NivelSeleccion>>({});
  const [referencia, setReferencia] = useState<string | null>(null);
  // null: sin tocar (vale lo guardado).
  const [porPorcion, setPorPorcion] = useState<boolean | null>(null);
  const [porcion, setPorcion] = useState<string | null>(null);
  const [justificacion, setJustificacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [decidiendo, setDecidiendo] = useState<"aprobar" | "rechazar" | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async (): Promise<Datos> => {
    const [homologacion, catalogo] = await Promise.all([obtenerHomologacion(insumoId), listarAlergenos()]);
    return { homologacion, catalogo };
  }, [insumoId]);
  const { items, loading, error, recargar } = useLista<Datos>({
    cargar,
    dependencias: [insumoId],
    valorInicial: { homologacion: null, catalogo: [] },
    mensajeError: "No se pudo cargar la homologación.",
    preferirMensajeDelBackend: true,
  });
  const h = items.homologacion;

  const guardados = useMemo(
    () => Object.fromEntries((h?.rotulo.valores ?? []).map((v) => [v.nutriente, limpio(v.valor)])),
    [h],
  );
  const alergenosGuardados = useMemo(
    () => Object.fromEntries((h?.rotulo.alergenos ?? []).map((a) => [a.alergeno_id, a.nivel])) as Record<
      number,
      NivelAlergenoRotulo
    >,
    [h],
  );
  // Catálogo activo, más los que el ingrediente o la marca tienen aunque estén dados de baja.
  const filasAlergenos = useMemo(() => {
    const filas = items.catalogo.map((a) => ({ id: a.id, nombre: a.nombre }));
    for (const fila of h?.comparacion.alergenos ?? []) {
      if (!filas.some((f) => f.id === fila.alergeno_id)) filas.push({ id: fila.alergeno_id, nombre: fila.nombre });
    }
    return filas;
  }, [items.catalogo, h]);

  if (loading && !h) {
    return (
      <PaginaFormulario ancho="ancho" titulo="Homologación del insumo">
        <EstadoCargando>Cargando homologación...</EstadoCargando>
      </PaginaFormulario>
    );
  }
  if (!h) {
    return (
      <PaginaFormulario ancho="ancho" titulo="Homologación del insumo" volver={{ a: "/ingredientes", etiqueta: "Ingredientes", historial: true }}>
        <BannerError>{error ?? "No se pudo cargar la homologación."}</BannerError>
      </PaginaFormulario>
    );
  }

  const valor = (clave: string) => valores[clave] ?? guardados[clave] ?? "";
  const nivel = (alergenoId: number): NivelSeleccion => alergenos[alergenoId] ?? alergenosGuardados[alergenoId] ?? "";
  const textoReferencia = referencia ?? h.rotulo.referencia ?? "";
  const esPorPorcion = porPorcion ?? h.rotulo.porcion !== null;
  const textoPorcion = porcion ?? limpio(h.rotulo.porcion);
  const numeroPorcion = Number(aDecimal(textoPorcion));
  const porcionValida = !esPorPorcion || (Number.isFinite(numeroPorcion) && numeroPorcion > 0 && numeroPorcion <= 10000);
  /** Lo escrito en el rótulo, llevado a 100 g/ml (para mostrar la conversión). */
  const a100 = (texto: string): number | null => {
    const n = Number(aDecimal(texto));
    if (texto.trim() === "" || !Number.isFinite(n)) return null;
    if (!esPorPorcion) return n;
    return porcionValida ? (n * 100) / numeroPorcion : null;
  };
  const nivelIngrediente = Object.fromEntries(
    h.comparacion.alergenos.filter((a) => a.nivel_ingrediente).map((a) => [a.alergeno_id, a.nivel_ingrediente]),
  ) as Record<number, NivelAlergenoRotulo>;

  // Cambió cómo declara el rótulo: los desvíos mostrados ya no valen hasta guardar.
  const porcionCambio =
    esPorPorcion !== (h.rotulo.porcion !== null) || (esPorPorcion && textoPorcion !== limpio(h.rotulo.porcion));
  const hayCambios =
    Object.keys(valores).some((k) => valores[k] !== (guardados[k] ?? "")) ||
    Object.keys(alergenos).some((k) => alergenos[Number(k)] !== (alergenosGuardados[Number(k)] ?? "")) ||
    (referencia !== null && referencia !== (h.rotulo.referencia ?? "")) ||
    porcionCambio;
  const invalidos = h.comparacion.nutrientes.filter((f) => {
    const v = valor(f.nutriente).trim();
    return v !== "" && !Number.isFinite(Number(aDecimal(v)));
  });

  const guardar = async () => {
    setGuardando(true);
    setErrorAccion(null);
    setAviso(null);
    try {
      await guardarRotulo(insumoId, {
        referencia: textoReferencia.trim() || null,
        porcion: esPorPorcion ? aDecimal(textoPorcion) : null,
        valores: h.comparacion.nutrientes
          .map((f) => ({ nutriente: f.nutriente, valor: aDecimal(valor(f.nutriente)) }))
          .filter((v) => v.valor !== ""),
        alergenos: filasAlergenos
          .map((f) => ({ alergeno_id: f.id, nivel: nivel(f.id) }))
          .filter((a): a is { alergeno_id: number; nivel: NivelAlergenoRotulo } => a.nivel !== ""),
      });
      setValores({});
      setAlergenos({});
      setReferencia(null);
      setPorPorcion(null);
      setPorcion(null);
      setAviso("Rótulo guardado. La comparación está actualizada.");
      await recargar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo guardar el rótulo.");
    } finally {
      setGuardando(false);
    }
  };

  const decidir = async (decision: "aprobar" | "rechazar") => {
    setDecidiendo(decision);
    setErrorAccion(null);
    setAviso(null);
    try {
      await decidirHomologacion(insumoId, decision, justificacion.trim() || null);
      setJustificacion("");
      setAviso(decision === "aprobar" ? "Insumo aprobado: ya se pueden recibir lotes de esta marca." : "Insumo rechazado.");
      await recargar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo registrar la decisión.");
    } finally {
      setDecidiendo(null);
    }
  };

  const resultado = RESULTADO[h.comparacion.resultado];
  const exigeJustificacion = h.comparacion.resultado === "observada";
  const puedeAprobar =
    !hayCambios && h.comparacion.resultado !== "rechazada" && (!exigeJustificacion || justificacion.trim() !== "");

  return (
    <PaginaFormulario
      ancho="ancho"
      volver={{ a: `/ingredientes/${h.ingrediente_id}/editar`, etiqueta: h.ingrediente_nombre, historial: true }}
      titulo={`Homologación de ${h.insumo_nombre}`}
      descripcion={`Rótulo de la marca comparado con la especificación de ${h.ingrediente_nombre}. Solo de un insumo aprobado y vigente se reciben y consumen lotes.`}
    >
      {errorAccion && <BannerError mb="4">{errorAccion}</BannerError>}
      {aviso && <BannerExito mb="4">{aviso}</BannerExito>}

      <TarjetaFormulario>
        <HStack justify="space-between" align="flex-start" gap="4" flexWrap="wrap">
          <Stack gap="1">
            <Text fontSize="sm" color="fg.muted">Estado</Text>
            <Box>
              {h.vencida ? (
                <EtiquetaEstado tono="peligro">Aprobada, vencida</EtiquetaEstado>
              ) : (
                <EtiquetaEstado tono={TONO_ESTADO_HOMOLOGACION[h.estado]}>
                  {ETIQUETA_ESTADO_HOMOLOGACION[h.estado]}
                </EtiquetaEstado>
              )}
            </Box>
          </Stack>
          {h.homologado_en && (
            <Stack gap="0" fontSize="sm" maxW="lg">
              <Text>
                Decidido por {h.homologado_por ?? "-"} el {formatoFechaHora(h.homologado_en)}
                {h.resultado_al_decidir === "observada" && " (con observación)"}
              </Text>
              {h.tolerancia_al_decidir && (
                <Text>
                  Comparada con una tolerancia de ±{formatoCantidad(h.tolerancia_al_decidir)}%
                  {Number(h.tolerancia_al_decidir) !== Number(h.comparacion.tolerancia_pct) &&
                    ` (la tolerancia actual es ±${formatoCantidad(h.comparacion.tolerancia_pct)}%)`}
                </Text>
              )}
              {h.vigente_hasta && (
                <Text color={h.vencida ? "red.fg" : undefined}>
                  {h.vencida ? "Venció el" : "Vigente hasta el"} {formatoFecha(h.vigente_hasta)}
                  {h.vencida && ": no se pueden recibir ni consumir sus lotes hasta volver a aprobarla."}
                </Text>
              )}
              {h.justificacion && <Text color="fg.muted">Justificación: {h.justificacion}</Text>}
            </Stack>
          )}
        </HStack>
        {h.estado === "requiere_revision" && (
          <Text fontSize="sm" color="fg.muted" mt="3">
            La especificación del ingrediente o el rótulo cambiaron después de aprobarla y la comparación empeoró.
            Revisala y volvé a decidir.
          </Text>
        )}
      </TarjetaFormulario>

      <TarjetaFormulario mt="6">
        <TituloFormulario mb="1">Rótulo del fabricante</TituloFormulario>
        <Text fontSize="sm" color="fg.muted" mb="4">
          Valores tal como figuran en el envase, por 100 g (o 100 ml) o por porción: si son por porción, se
          convierten solos a 100 para comparar. Tolerancia admitida: ±
          {formatoCantidad(h.comparacion.tolerancia_pct)}% respecto del valor objetivo del ingrediente.
          {h.es_aditivo && " Es un aditivo: solo se comparan valor energético y sodio."}
        </Text>

        <FormField label="Referencia del rótulo" opcional helper="Envase, ficha técnica o fecha en que se tomó.">
          <FormInput
            value={textoReferencia}
            maxLength={300}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej.: envase de 1 kg, lote 2026-10"
          />
        </FormField>

        <HStack gap="4" align="flex-start" flexWrap="wrap" mb="6">
          <Box w={{ base: "100%", sm: "260px" }}>
            <FormField label="El rótulo declara los valores" mb="0">
              <FormNativeSelect
                value={esPorPorcion ? "porcion" : "100"}
                onChange={(e) => setPorPorcion(e.target.value === "porcion")}
              >
                <option value="100">Por 100 g o 100 ml</option>
                <option value="porcion">Por porción</option>
              </FormNativeSelect>
            </FormField>
          </Box>
          {esPorPorcion && (
            <Box w={{ base: "100%", sm: "200px" }}>
              <FormField
                label="Porción del rótulo"
                required
                mb="0"
                error={!porcionValida ? "Indicá una porción mayor que 0." : undefined}
              >
                <HStack gap="2">
                  <FormInput
                    value={textoPorcion}
                    inputMode="decimal"
                    textAlign="right"
                    w="110px"
                    aria-label="Porción del rótulo"
                    onChange={(e) => {
                      if (PARCIAL_NUMERICO.test(e.target.value)) setPorcion(e.target.value);
                    }}
                  />
                  <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">g o ml</Text>
                </HStack>
              </FormField>
            </Box>
          )}
        </HStack>

        <Box overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="640px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Nutriente</EncabezadoOscuro>
                <EncabezadoOscuro center width="130px">Objetivo del ingrediente</EncabezadoOscuro>
                <EncabezadoOscuro center width="170px">
                  {esPorPorcion ? "Rótulo (por porción)" : "Rótulo de la marca"}
                </EncabezadoOscuro>
                {esPorPorcion && <EncabezadoOscuro center width="120px">Rótulo por 100</EncabezadoOscuro>}
                <EncabezadoOscuro center width="90px">Desvío</EncabezadoOscuro>
                <EncabezadoOscuro center width="220px">Comparación</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {h.comparacion.nutrientes.map((f) => {
                const editado =
                  porcionCambio ||
                  (valores[f.nutriente] !== undefined && valores[f.nutriente] !== (guardados[f.nutriente] ?? ""));
                const estado = ESTADO_FILA[f.estado];
                return (
                  <Table.Row key={f.nutriente}>
                    <Celda>{f.nombre}</Celda>
                    <Celda center>
                      {f.referencia === null ? (
                        <Text as="span" color="fg.muted">-</Text>
                      ) : (
                        `${formatoCantidad(f.referencia)} ${f.unidad}`
                      )}
                    </Celda>
                    <Celda center>
                      <HStack gap="2" justify="center">
                        <FormInput
                          value={valor(f.nutriente)}
                          inputMode="decimal"
                          textAlign="right"
                          w="100px"
                          aria-label={`${f.nombre} en el rótulo`}
                          onChange={(e) => {
                            if (PARCIAL_NUMERICO.test(e.target.value)) {
                              setValores((prev) => ({ ...prev, [f.nutriente]: e.target.value }));
                            }
                          }}
                        />
                        <Text fontSize="sm" color="fg.muted" w="32px" textAlign="left">{f.unidad}</Text>
                      </HStack>
                    </Celda>
                    {esPorPorcion && (
                      <Celda center>
                        {a100(valor(f.nutriente)) === null ? (
                          <Text as="span" color="fg.muted">-</Text>
                        ) : (
                          `${formatoCantidad(a100(valor(f.nutriente)))} ${f.unidad}`
                        )}
                      </Celda>
                    )}
                    <Celda center>{f.desvio_pct === null || editado ? "-" : `${formatoConSigno(Math.round(Number(f.desvio_pct) * 10) / 10)}%`}</Celda>
                    <Celda center>
                      {editado ? (
                        <Text as="span" fontSize="sm" color="fg.muted">Sin guardar</Text>
                      ) : (
                        <EtiquetaEstado tono={estado.tono}>{estado.texto}</EtiquetaEstado>
                      )}
                    </Celda>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>

        <TituloFormulario mt="6" mb="1" fontSize="md">Alérgenos declarados por la marca</TituloFormulario>
        <Text fontSize="sm" color="fg.muted" mb="4">
          Lo que la marca contiene tiene que estar en lo que contiene el ingrediente; lo que puede contener, en lo que
          el ingrediente contiene o puede contener.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
          {filasAlergenos.map((f) => {
            const fila = h.comparacion.alergenos.find((a) => a.alergeno_id === f.id);
            const noCumple = fila && !fila.cumple && alergenos[f.id] === undefined;
            return (
              <HStack key={f.id} justify="space-between" gap="3">
                <Stack gap="0" minW="0">
                  <Text fontSize="sm" color={noCumple ? "red.fg" : undefined} fontWeight={noCumple ? "medium" : undefined}>
                    {f.nombre}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    Ingrediente: {nivelIngrediente[f.id] ? ETIQUETA_NIVEL[nivelIngrediente[f.id]].toLowerCase() : "no"}
                  </Text>
                </Stack>
                <Box w="170px" flexShrink={0}>
                  <FormNativeSelect
                    value={nivel(f.id)}
                    onChange={(e) => setAlergenos((prev) => ({ ...prev, [f.id]: e.target.value as NivelSeleccion }))}
                    aria-label={`Alérgeno ${f.nombre} en el rótulo`}
                  >
                    <option value="">No</option>
                    <option value="contiene">{ETIQUETA_NIVEL.contiene}</option>
                    <option value="puede_contener">{ETIQUETA_NIVEL.puede_contener}</option>
                  </FormNativeSelect>
                </Box>
              </HStack>
            );
          })}
        </SimpleGrid>

        {invalidos.length > 0 && (
          <Box mt="4">
            <BannerError>Revisá los valores de {invalidos.map((f) => f.nombre).join(", ")}.</BannerError>
          </Box>
        )}
        <HStack mt="5" gap="3">
          <Button onClick={guardar} loading={guardando} disabled={!hayCambios || invalidos.length > 0 || !porcionValida}>
            Guardar rótulo y comparar
          </Button>
          {hayCambios && (
            <Button
              variant="ghost"
              disabled={guardando}
              onClick={() => {
                setValores({});
                setAlergenos({});
                setReferencia(null);
                setPorPorcion(null);
                setPorcion(null);
              }}
            >
              Descartar cambios
            </Button>
          )}
        </HStack>
      </TarjetaFormulario>

      <TarjetaFormulario mt="6">
        <TituloFormulario mb="3">Decisión</TituloFormulario>
        <HStack gap="3" mb="2" flexWrap="wrap">
          <EtiquetaEstado tono={resultado.tono}>{resultado.texto}</EtiquetaEstado>
          <Text fontSize="sm">{resultado.detalle}</Text>
        </HStack>
        {h.comparacion.problemas.length > 0 && (
          <Box as="ul" ps="5" mb="4" fontSize="sm" color="fg.muted">
            {h.comparacion.problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </Box>
        )}
        {hayCambios && (
          <Text fontSize="sm" color="fg.muted" mb="3">Guardá el rótulo antes de decidir.</Text>
        )}

        <FormField
          label="Justificación"
          required={exigeJustificacion}
          opcional={!exigeJustificacion}
          helper={
            exigeJustificacion
              ? "Obligatoria para aprobar con observación: por qué se acepta la diferencia."
              : "Queda registrada con la decisión (por ejemplo, el motivo de un rechazo)."
          }
        >
          <Textarea value={justificacion} maxLength={500} rows={3} onChange={(e) => setJustificacion(e.target.value)} />
        </FormField>

        <HStack gap="3">
          <Button colorPalette="green" onClick={() => decidir("aprobar")} loading={decidiendo === "aprobar"} disabled={!puedeAprobar || decidiendo !== null}>
            Aprobar
          </Button>
          <Button
            variant="outline"
            colorPalette="red"
            onClick={() => decidir("rechazar")}
            loading={decidiendo === "rechazar"}
            disabled={hayCambios || decidiendo !== null}
          >
            Rechazar
          </Button>
        </HStack>
      </TarjetaFormulario>
    </PaginaFormulario>
  );
}
