import { useContext, useEffect, useState, type ReactNode } from "react";
import { Alert, Badge, Box, Button, HStack, SimpleGrid, Stack, Text, Textarea, chakra } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { LuArrowRight } from "react-icons/lu";
import { AuthContext } from "../../../common/context/auth-context";
import { puedeAdministrar } from "../../../common/api/permissions";
import { FormField, FormNativeSelect } from "../../../components/ui/patrones";
import { listarRecetas, listarVersiones } from "../../recetas/services/recetaService";
import type { VersionResumen } from "../../recetas/types/receta";
import type { Conservacion, Cruzada, DeclaracionesOut, Evaluacion, PropuestaDeclaraciones, Sustancia } from "../types/declaraciones";
import { catalogoAlergenos, confirmarDeclaraciones, consultarDeclaraciones, guardarDeclaraciones, historialDeclaraciones, regenerarDeclaraciones } from "../services/declaracionesService";
import { ConservacionFields } from "./ConservacionFields";
import { CampoOrigen } from "./CampoOrigen";
import { IndicadorCompletitud } from "./IndicadorCompletitud";
import type { ResumenDeclaracion } from "../utils/textoRotulo";

/** Estado de la conservación para el menú del editor. */
export type EstadoConservacion = "sin_guardar" | "cargada" | "vacia";

/**
 * Alérgenos, gluten y conservación del borrador (una sola revisión de
 * declaraciones en el backend: se guardan y confirman juntas).
 *
 * `vista` separa lo que se muestra: el editor pone "alergenos" y
 * "conservacion" en secciones distintas, pero es UN solo componente montado
 * (el estado no se pierde al cambiar de sección). Sin `vista` se muestra todo
 * en una tarjeta, como antes.
 */
export function DeclaracionesSection({ borradorId, productoId, preview, formularioSucio, vista, onEstado, onDirtyChange, onOrigenChange, onDeclaracion, onConservacion }: {
  borradorId: number; productoId: number; preview?: PropuestaDeclaraciones | null;
  formularioSucio: boolean; vista?: "alergenos" | "conservacion";
  onEstado?: (pendiente: boolean) => void; onDirtyChange?: (sucio: boolean) => void;
  onOrigenChange?: () => void; onDeclaracion?: (resumen: ResumenDeclaracion | null) => void;
  onConservacion?: (estado: EstadoConservacion) => void;
}) {
  const auth = useContext(AuthContext);
  const autorizado = puedeAdministrar(auth?.user);
  const [datos, setDatos] = useState<DeclaracionesOut | null>(null);
  const [catalogo, setCatalogo] = useState<Sustancia[]>([]);
  const [versiones, setVersiones] = useState<VersionResumen[]>([]);
  const [versionId, setVersionId] = useState<number | undefined>();
  const [conservacion, setConservacion] = useState<Conservacion | null>(null);
  const [cruzadas, setCruzadas] = useState<Cruzada[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [historial, setHistorial] = useState<DeclaracionesOut[]>([]);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    if (!borradorId) return;
    Promise.all([consultarDeclaraciones(borradorId), catalogoAlergenos(),
      listarRecetas(true).then(async recetas => {
        const receta = recetas.find(r => r.producto_id === productoId);
        return receta ? listarVersiones(receta.id) : [];
      })]).then(([d, c, v]) => {
      if (!activo) return;
      setDatos(d); setCatalogo(c); setVersiones(v);
      setConservacion(d.contenido?.conservacion ?? null);
      setCruzadas(d.contenido?.contaminacion_cruzada ?? []);
      setEvaluaciones(d.contenido?.evaluaciones ?? []);
      setVersionId(d.contenido?.version_receta_id ?? undefined);
      setSucio(false); setError("");
    }).catch((e: unknown) => { if (activo) setError(e instanceof Error ? e.message : "No se pudieron cargar las declaraciones"); });
    return () => { activo = false; };
  }, [borradorId, productoId, intento]);
  useEffect(() => {
    onEstado?.(!datos || sucio || datos.estado !== "confirmada" || datos.pendientes.length > 0);
  }, [datos, sucio, onEstado]);

  useEffect(() => { onDirtyChange?.(sucio); }, [sucio, onDirtyChange]);

  useEffect(() => {
    onConservacion?.(sucio ? "sin_guardar" : conservacion?.instrucciones?.trim() ? "cargada" : "vacia");
  }, [sucio, conservacion, onConservacion]);

  useEffect(() => {
    onDeclaracion?.(
      datos
        ? { revision: datos.revision, texto: datos.declaracion ?? "", estado: datos.estado === "confirmada" ? "confirmada" : "sugerida", vigencia: datos.vigencia === "desactualizada" ? "desactualizada" : "vigente" }
        : null,
    );
  }, [datos, onDeclaracion]);

  async function operar(accion: () => Promise<DeclaracionesOut>) {
    setOcupado(true); setError("");
    try {
      const d = await accion();
      if (d.contenido?.version_receta_id !== datos?.contenido?.version_receta_id) onOrigenChange?.();
      setDatos(d);
      setConservacion(d.contenido?.conservacion ?? null);
      setCruzadas(d.contenido?.contaminacion_cruzada ?? []);
      setEvaluaciones(d.contenido?.evaluaciones ?? []);
      setVersionId(d.contenido?.version_receta_id ?? undefined);
      setSucio(false); setHistorial([]);
    } catch (e) { setError(e instanceof Error ? e.message : "Error al guardar. Recargá y revisá los datos."); }
    finally { setOcupado(false); }
  }
  const contenido = datos?.contenido ?? preview;
  const pendientes = datos?.pendientes ?? contenido?.pendientes_origen ?? ["Generá una propuesta."];
  const bloqueado = ocupado || sucio || formularioSucio || !autorizado;
  const confirmadaVigente = datos?.estado === "confirmada" && datos.vigencia === "vigente" && !sucio;
  const verAlergenos = vista !== "conservacion";
  const verConservacion = vista !== "alergenos";
  const versionOrigen = versiones.find(v => v.id === contenido?.version_receta_id)?.numero;

  const insignias = <HStack gap="2" flexWrap="wrap">
    <Badge colorPalette={confirmadaVigente ? "green" : "orange"} rounded="full">
      {sucio ? "Cambios manuales sin guardar" : datos?.estado === "confirmada" ? "Confirmada" : "Sugerida por el sistema"}
    </Badge>
    {datos?.vigencia === "desactualizada" && <Badge colorPalette="red" rounded="full">Pendiente de revisión: origen desactualizado</Badge>}
    {datos && <Badge variant="outline" rounded="full">Revisión {datos.revision}</Badge>}
  </HStack>;

  // Guardar / confirmar valen para toda la revisión (alérgenos y conservación).
  const barraAcciones = borradorId > 0 && datos && <Stack gap="3" pt="5" borderTopWidth="1px" borderColor="border.emphasized">
    {(sucio || formularioSucio) && <Text fontSize="sm" color="orange.fg">Guardá los cambios pendientes antes de regenerar o confirmar. Guardar no confirma.</Text>}
    <HStack flexWrap="wrap" gap="2" justify="flex-end">
      {sucio && <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => { setSucio(false); setIntento(n => n + 1); }}>Descartar cambios de declaraciones</Button>}
      <Button type="button" variant="outline" size="sm" loading={ocupado} disabled={!sucio || !autorizado || datos.vigencia !== "vigente"}
        onClick={() => operar(() => guardarDeclaraciones(borradorId, { revision: datos.revision, conservacion, contaminacion_cruzada: cruzadas, evaluaciones }))}>Guardar declaraciones</Button>
      <Button type="button" colorPalette="brand" size="sm" disabled={bloqueado || pendientes.length > 0 || datos.estado === "confirmada"}
        onClick={() => operar(() => confirmarDeclaraciones(borradorId, datos.revision))}>Confirmar declaraciones</Button>
    </HStack>
  </Stack>;

  const cuerpo = <>
    {error && <Text role="alert" color="red.fg">{error}</Text>}
    {!borradorId && <Text fontSize="sm" color="fg.muted">Guardá el borrador para editar estas declaraciones y confirmarlas.</Text>}

    {verAlergenos && <>
      {/* Cabecera: estado de la revisión y acciones de consulta. */}
      <HStack justify="space-between" align="start" columnGap="4" rowGap="3" flexWrap="wrap">
        <Stack gap="2.5">
          {insignias}
          <HStack gap="2" flexWrap="wrap">
            <CampoOrigen origen="receta" version={versionOrigen} />
            <Text fontSize="13px" color="fg.muted">Versión de receta de origen: {versionOrigen != null ? `v${versionOrigen}` : contenido?.version_receta_id ?? "sin versión"}</Text>
          </HStack>
        </Stack>
        {borradorId > 0 && <HStack gap="2" flexWrap="wrap">
          <Button type="button" size="sm" variant="outline" disabled={ocupado || sucio || formularioSucio}
            onClick={() => setIntento(n => n + 1)}>Recargar declaraciones</Button>
          {datos && <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={async () => {
            try { setHistorial(await historialDeclaraciones(borradorId)); }
            catch (e) { setError(e instanceof Error ? e.message : "Error al consultar historial"); }
          }}>Ver historial de declaraciones</Button>}
        </HStack>}
      </HStack>

      {historial.length > 0 && <Stack gap="3">{historial.map(h => <Box key={h.revision} as="details" borderWidth="1px" borderColor="border.subtle" rounded="lg" p="4">
        <Box as="summary" cursor="pointer" fontSize="sm">Revisión {h.revision}: {h.estado} — {h.vigencia}</Box>
        <Text fontSize="sm">{h.declaracion || "Sin sustancias declaradas"}</Text><Text fontSize="sm">{h.declaracion_cruzada}</Text>
        <Text fontSize="sm">Conservación: {h.contenido?.conservacion?.instrucciones ?? "sin informar"}</Text>
        <Text fontSize="sm">{h.confirmado_por_nombre} {h.confirmado_en}</Text>
      </Box>)}</Stack>}

      {/* Propuesta destacada + gluten. */}
      <Box borderWidth="1px" borderColor="brand.muted" bg="brand.subtle" rounded="lg" p="4">
        {datos?.declaracion
          ? <Text fontWeight="bold" fontSize="md">Propuesta: {datos.declaracion}</Text>
          : <Text fontSize="sm" color="fg.muted">Sin propuesta de declaración todavía.</Text>}
        <Text fontSize="sm" mt="2">
          <Text as="span" fontWeight="semibold">Gluten: </Text>
          {contenido?.gluten === "presente" ? "presencia declarada" : contenido?.gluten === "sin_presencia_declarada" ? "sin presencia declarada en los ingredientes evaluados" : "información insuficiente"}.
        </Text>
        <Text fontSize="13px" lineHeight="1.45" color="fg.muted" mt="1.5">Esta evaluación no certifica ni habilita declaraciones de producto libre de gluten.</Text>
      </Box>

      {/* Desglose: presentes y "puede contener". */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <Bloque titulo="Presentes" cantidad={contenido?.detectados.length}>
          {!contenido && <Text fontSize="sm" color="fg.muted">Generá o recargá la propuesta para ver los alérgenos detectados.</Text>}
          {contenido && !contenido.detectados.length && <Text fontSize="sm" color="fg.muted">Sin sustancias registradas en los ingredientes evaluados. Revisá los pendientes antes de confirmar.</Text>}
          {contenido?.detectados.map(d => <Box key={d.codigo} borderWidth="1px" borderColor="border.subtle" rounded="md" px="3.5" py="2.5" bg="bg.panel">
            <Text fontWeight="semibold" fontSize="sm">{d.nombre}</Text>
            {d.fuentes.map((f, i) => <Text key={`${f.ingrediente_id}-${i}`} fontSize="13px" lineHeight="1.45" color="fg.muted">{f.nombre}: {f.forma}</Text>)}
          </Box>)}
        </Bloque>
        <Bloque titulo="Puede contener" cantidad={contenido?.puede_contener?.length ?? 0}>
          {!contenido?.puede_contener?.length && <Text fontSize="sm" color="fg.muted">Ningún ingrediente declara trazas.</Text>}
          {contenido?.puede_contener?.map(p => <Box key={p.codigo} borderWidth="1px" borderColor="border.subtle" rounded="md" px="3.5" py="2.5" bg="bg.panel">
            <Text fontWeight="semibold" fontSize="sm">{p.nombre}</Text>
            <Text fontSize="13px" lineHeight="1.45" color="fg.muted">{p.fuentes.map(f => f.nombre).join(", ")}</Text>
          </Box>)}
          {!!contenido?.puede_contener?.length && <Text fontSize="13px" lineHeight="1.45" color="fg.muted">Declarado en los ingredientes.</Text>}
        </Bloque>
      </SimpleGrid>

      {/* Revisión por ingrediente: colapsada para no ocupar media pantalla. */}
      {!!contenido?.fuentes.length && <chakra.details borderWidth="1px" borderColor="border.subtle" rounded="lg" p="4">
        <Box as="summary" cursor="pointer" fontSize="sm" fontWeight="medium">Revisar alérgenos por ingrediente ({contenido.fuentes.length})</Box>
        <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} gap="3" mt="4">
          {contenido.fuentes.map(f => <Button key={f.ingrediente_id} asChild size="sm" variant="outline" borderColor="border.emphasized"
            h="auto" minH="9" py="1.5" justifyContent="space-between" whiteSpace="normal" textAlign="start">
            <Link to={`/ingredientes/${f.ingrediente_id}/editar`} aria-label={`Revisar alérgenos de ${f.nombre}`}>{f.nombre} <LuArrowRight aria-hidden /></Link>
          </Button>)}
        </SimpleGrid>
      </chakra.details>}

      <IndicadorCompletitud compacto titulo="Estado de declaraciones" completitud={{ estado_global: pendientes.length ? "pendiente" : "completo",
        campos: [...pendientes.map((motivo, i) => ({ nombre: `declaracion-${i}`, etiqueta: motivo, estado: "pendiente" })),
          { nombre: "confirmacion", etiqueta: "Confirmación administrativa vigente", estado: confirmadaVigente ? "completo" : "pendiente" }] }} />
      {datos?.confirmado_en && <Text fontSize="sm" color="fg.muted">Confirmó {datos.confirmado_por_nombre} el {new Date(datos.confirmado_en).toLocaleString()}. La confirmación corresponde a esta revisión.</Text>}

      {borradorId > 0 && datos && <>
        {/* Contaminación cruzada (manual). */}
        <Stack gap="4" borderWidth="1px" borderColor="border.subtle" rounded="lg" p="4">
          <HStack justify="space-between" gap="2" flexWrap="wrap">
            <HStack gap="2"><Text fontWeight="semibold">Posible contaminación cruzada</Text><CampoOrigen origen="manual" /></HStack>
            <Button type="button" size="sm" variant="outline" onClick={() => { setCruzadas([...cruzadas, { codigo: "", fundamento: "", respaldo: "" }]); setSucio(true); }}>Agregar contaminación cruzada</Button>
          </HStack>
          <Text fontSize="13px" lineHeight="1.45" color="fg.muted">Se registra por evaluación del proceso. La confirmación interna no sustituye la autorización sanitaria para utilizar “PUEDE CONTENER”.</Text>
          {cruzadas.map((c, i) => <Stack key={i} gap="3" borderWidth="1px" borderColor="border.subtle" rounded="md" p="4">
            <FormNativeSelect aria-label={`Alérgeno cruzado ${i + 1}`} value={c.codigo} onChange={e => { setCruzadas(cruzadas.map((v, j) => j === i ? { ...v, codigo: e.target.value } : v)); setSucio(true); }}>
              <option value="">Seleccioná una sustancia</option>{catalogo.map(s => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
            </FormNativeSelect>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
              <Textarea aria-label={`Fundamento cruzado ${i + 1}`} placeholder="Fundamento de la evaluación" value={c.fundamento}
                onChange={e => { setCruzadas(cruzadas.map((v, j) => j === i ? { ...v, fundamento: e.target.value } : v)); setSucio(true); }} />
              <Textarea aria-label={`Respaldo cruzado ${i + 1}`} placeholder="Referencia de autorización sanitaria" value={c.respaldo ?? ""}
                onChange={e => { setCruzadas(cruzadas.map((v, j) => j === i ? { ...v, respaldo: e.target.value } : v)); setSucio(true); }} />
            </SimpleGrid>
            <Button type="button" size="xs" variant="ghost" colorPalette="red" alignSelf="flex-end" onClick={() => { setCruzadas(cruzadas.filter((_, j) => j !== i)); setSucio(true); }}>Eliminar declaración cruzada</Button>
          </Stack>)}
        </Stack>

        {/* Regenerar con otra versión: selector y botón en la misma fila. */}
        <Stack gap="1.5">
          <HStack align="end" gap="3" flexWrap="wrap">
            <Box flex="1 1 240px" maxW="360px">
              <FormField label="Versión para regenerar" mb="0"><FormNativeSelect aria-label="Versión para regenerar" value={versionId ?? ""} disabled={bloqueado}
                onChange={e => setVersionId(Number(e.target.value) || undefined)}>
                <option value="">Versión actual del borrador</option>
                {versiones.map(v => <option key={v.id} value={v.id}>Versión {v.numero}</option>)}
              </FormNativeSelect></FormField>
            </Box>
            <Button type="button" variant="outline" disabled={bloqueado} onClick={() => operar(() => regenerarDeclaraciones(borradorId, datos.revision, versionId))}>Regenerar propuesta</Button>
          </HStack>
          <Text fontSize="13px" lineHeight="1.45" color="fg.muted">Una versión posterior no modifica este rótulo hasta que la selecciones y regeneres. La versión debe coincidir con el lote.</Text>
        </Stack>

        <Box as="details" borderWidth="1px" borderColor="border.subtle" rounded="lg" p="4"><Box as="summary" cursor="pointer" fontSize="sm" fontWeight="medium">Evaluaciones normativas documentadas</Box>
          <Text fontSize="sm" mt="2">Para sulfitos, evaluá el umbral en el producto final. Una excepción requiere fundamento y respaldo; no se deduce del nombre o INS.</Text>
          {contenido?.detectados.map(d => {
            const evaluacion = evaluaciones.find(e => e.codigo === d.codigo);
            return <Stack key={d.codigo} pt="4" gap="3">
              <Text>{d.nombre}</Text>
              <FormNativeSelect aria-label={`Evaluación de ${d.nombre}`} value={!evaluacion ? "" : evaluacion.declarar ? "si" : "no"}
                onChange={e => { setEvaluaciones([...evaluaciones.filter(v => v.codigo !== d.codigo), ...(e.target.value ? [{ codigo: d.codigo, declarar: e.target.value === "si", fundamento: "", respaldo: "" }] : [])]); setSucio(true); }}>
                <option value="">Sin evaluación adicional</option><option value="si">Corresponde declarar</option><option value="no">Excepción documentada: no declarar</option>
              </FormNativeSelect>
              {evaluacion && <><Textarea aria-label={`Fundamento de ${d.nombre}`} placeholder="Fundamento normativo" value={evaluacion.fundamento}
                onChange={e => { setEvaluaciones(evaluaciones.map(v => v.codigo === d.codigo ? { ...v, fundamento: e.target.value } : v)); setSucio(true); }} />
                <Textarea aria-label={`Respaldo de ${d.nombre}`} placeholder="Referencia documental" value={evaluacion.respaldo}
                  onChange={e => { setEvaluaciones(evaluaciones.map(v => v.codigo === d.codigo ? { ...v, respaldo: e.target.value } : v)); setSucio(true); }} /></>}
            </Stack>;
          })}
        </Box>
      </>}
    </>}

    {verConservacion && borradorId > 0 && datos && <Stack gap="5" pt={vista ? "0" : "5"} borderTopWidth={vista ? "0" : "1px"} borderColor="border.subtle">
      <HStack justify="space-between" align="center" columnGap="4" rowGap="3" flexWrap="wrap">
        <Stack gap="2">
          {!vista && <Text fontWeight="semibold">Condiciones de conservación</Text>}
          <CampoOrigen origen={sucio ? "manual" : contenido?.conservacion_origen ?? "producto"} />
        </Stack>
        <HStack gap="2" flexWrap="wrap">
          <Button type="button" size="sm" variant="outline" disabled={bloqueado} onClick={() => operar(() => regenerarDeclaraciones(borradorId, datos.revision, versionId, true))}>Reemplazar conservación con datos del producto</Button>
          {conservacion && <Button type="button" size="sm" variant="outline" onClick={() => { setConservacion(null); setSucio(true); }}>Quitar condiciones de conservación</Button>}
        </HStack>
      </HStack>
      <ConservacionFields sinQuitar value={conservacion} onChange={v => { setConservacion(v); setSucio(true); }} />
    </Stack>}
    {verConservacion && vista === "conservacion" && !(borradorId > 0 && datos) && borradorId > 0 && <Text fontSize="sm" color="fg.muted">Cargando declaraciones...</Text>}

    {barraAcciones}
  </>;

  if (vista) return <Stack data-declaraciones="true" gap="5" minW="0">{cuerpo}</Stack>;
  return <Stack as="section" data-declaraciones="true" gap="4" mb="6" p={{ base: "4", md: "6" }} borderWidth="1px" rounded="xl" bg="bg.panel">
    <Text as="h2" fontSize="lg" fontWeight="semibold" color="brand.fg">Alérgenos, gluten y conservación</Text>
    {cuerpo}
  </Stack>;
}

function Bloque({ titulo, cantidad, children }: { titulo: string; cantidad?: number; children: ReactNode }) {
  return <Stack gap="3" minW="0" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" rounded="lg" p="4">
    <HStack gap="2"><Text fontWeight="semibold" fontSize="sm">{titulo}</Text>{cantidad != null && <Badge size="sm" variant="subtle">{cantidad}</Badge>}</HStack>
    {children}
  </Stack>;
}

/** Aviso discreto de declaraciones pendientes (cabecera de la sección del editor). */
export function AvisoDeclaracionesPendientes() {
  return <Alert.Root status="warning" size="sm" variant="subtle" rounded="lg" px="4" py="2.5" alignItems="center">
    <Alert.Indicator />
    <Alert.Title fontWeight="normal">Declaraciones pendientes de revisión o confirmación.</Alert.Title>
  </Alert.Root>;
}
