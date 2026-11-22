import { useContext, useEffect, useState } from "react";
import { Badge, Box, Button, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { Link } from "react-router-dom";
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
import type { ResumenDeclaracion } from "./ListaIngredientesRotulo";

export function DeclaracionesSection({ borradorId, productoId, preview, formularioSucio, onEstado, onDirtyChange, onOrigenChange, onDeclaracion }: {
  borradorId: number; productoId: number; preview?: PropuestaDeclaraciones | null;
  formularioSucio: boolean; onEstado?: (pendiente: boolean) => void; onDirtyChange?: (sucio: boolean) => void;
  onOrigenChange?: () => void; onDeclaracion?: (resumen: ResumenDeclaracion | null) => void;
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
  return <Stack as="section" data-declaraciones="true" gap="4" mb="6" p={{ base: "4", md: "6" }} borderWidth="1px" rounded="xl" bg="bg.panel">
    <Text as="h2" fontSize="lg" fontWeight="semibold" color="brand.fg">Alérgenos, gluten y conservación</Text>
    <HStack flexWrap="wrap">
      <Badge colorPalette={datos?.estado === "confirmada" && datos.vigencia === "vigente" && !sucio ? "green" : "orange"}>
        {sucio ? "Cambios manuales sin guardar" : datos?.estado === "confirmada" ? "Confirmada" : "Sugerida por el sistema"}
      </Badge>
      {datos?.vigencia === "desactualizada" && <Badge colorPalette="red">Pendiente de revisión: origen desactualizado</Badge>}
      {datos && <Text>Revisión {datos.revision}</Text>}
    </HStack>
    {error && <Text role="alert" color="red.fg">{error}</Text>}
    {borradorId > 0 && <Button type="button" size="sm" alignSelf="start" disabled={ocupado || sucio || formularioSucio}
      onClick={() => setIntento(n => n + 1)}>Recargar declaraciones</Button>}
    <CampoOrigen origen="receta" version={versiones.find(v => v.id === contenido?.version_receta_id)?.numero} />
    <Text>Versión de receta de origen: {contenido?.version_receta_id ?? "sin versión"}</Text>
    {contenido?.detectados.map(d => <Box key={d.codigo}>
      <Text fontWeight="medium">{d.nombre}</Text>
      {d.fuentes.map((f, i) => <Text key={`${f.ingrediente_id}-${i}`} fontSize="sm">{f.nombre}: {f.forma}</Text>)}
    </Box>)}
    {contenido && !contenido.detectados.length && <Text>Sin sustancias registradas en los ingredientes evaluados. Revisá los pendientes antes de confirmar.</Text>}
    {!!contenido?.puede_contener?.length && <Box>
      <Text fontWeight="medium">Puede contener (declarado en los ingredientes)</Text>
      {contenido.puede_contener.map(p => <Text key={p.codigo} fontSize="sm">{p.nombre}: {p.fuentes.map(f => f.nombre).join(", ")}</Text>)}
    </Box>}
    <Text>Gluten: {contenido?.gluten === "presente" ? "presencia declarada" : contenido?.gluten === "sin_presencia_declarada" ? "sin presencia declarada en los ingredientes evaluados" : "información insuficiente"}.</Text>
    <Text fontSize="sm" color="fg.muted">Esta evaluación no certifica ni habilita declaraciones de producto libre de gluten.</Text>
    {datos?.declaracion && <Text fontWeight="bold">Propuesta: {datos.declaracion}</Text>}
    {contenido?.fuentes.map(f => <Text key={f.ingrediente_id} fontSize="sm"><Link to={`/ingredientes/${f.ingrediente_id}/editar`}>Revisar alérgenos de {f.nombre}</Link></Text>)}
    <IndicadorCompletitud completitud={{ estado_global: pendientes.length ? "pendiente" : "completo",
      campos: [...pendientes.map((motivo, i) => ({ nombre: `declaracion-${i}`, etiqueta: motivo, estado: "pendiente" })),
        { nombre: "confirmacion", etiqueta: "Confirmación administrativa vigente", estado: datos?.estado === "confirmada" && datos.vigencia === "vigente" && !sucio ? "completo" : "pendiente" }] }} />
    {datos?.confirmado_en && <Text fontSize="sm">Confirmó {datos.confirmado_por_nombre} el {new Date(datos.confirmado_en).toLocaleString()}. La confirmación corresponde a esta revisión.</Text>}
    {!borradorId && <Text>Guardá el borrador para editar estas declaraciones y confirmarlas.</Text>}
    {borradorId > 0 && datos && <>
      <FormField label="Versión para regenerar"><FormNativeSelect aria-label="Versión para regenerar" value={versionId ?? ""} disabled={bloqueado}
        onChange={e => setVersionId(Number(e.target.value) || undefined)}>
        <option value="">Versión actual del borrador</option>
        {versiones.map(v => <option key={v.id} value={v.id}>Versión {v.numero}</option>)}
      </FormNativeSelect></FormField>
      <Text fontSize="sm">Una versión posterior no modifica este rótulo hasta que la selecciones y regeneres. La versión debe coincidir con el lote.</Text>
      <Button type="button" disabled={bloqueado} onClick={() => operar(() => regenerarDeclaraciones(borradorId, datos.revision, versionId))}>Regenerar propuesta</Button>
      <Box borderTopWidth="1px" pt="4">
        <Text fontWeight="semibold">Posible contaminación cruzada</Text><CampoOrigen origen="manual" />
        <Text fontSize="sm">Se registra por evaluación del proceso. La confirmación interna no sustituye la autorización sanitaria para utilizar “PUEDE CONTENER”.</Text>
        {cruzadas.map((c, i) => <Stack key={i} mt="3" borderWidth="1px" p="3">
          <FormNativeSelect aria-label={`Alérgeno cruzado ${i + 1}`} value={c.codigo} onChange={e => { setCruzadas(cruzadas.map((v, j) => j === i ? { ...v, codigo: e.target.value } : v)); setSucio(true); }}>
            <option value="">Seleccioná una sustancia</option>{catalogo.map(s => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
          </FormNativeSelect>
          <Textarea aria-label={`Fundamento cruzado ${i + 1}`} placeholder="Fundamento de la evaluación" value={c.fundamento}
            onChange={e => { setCruzadas(cruzadas.map((v, j) => j === i ? { ...v, fundamento: e.target.value } : v)); setSucio(true); }} />
          <Textarea aria-label={`Respaldo cruzado ${i + 1}`} placeholder="Referencia de autorización sanitaria" value={c.respaldo ?? ""}
            onChange={e => { setCruzadas(cruzadas.map((v, j) => j === i ? { ...v, respaldo: e.target.value } : v)); setSucio(true); }} />
          <Button type="button" onClick={() => { setCruzadas(cruzadas.filter((_, j) => j !== i)); setSucio(true); }}>Eliminar declaración cruzada</Button>
        </Stack>)}
        <Button type="button" mt="3" onClick={() => { setCruzadas([...cruzadas, { codigo: "", fundamento: "", respaldo: "" }]); setSucio(true); }}>Agregar contaminación cruzada</Button>
      </Box>
      <Box borderTopWidth="1px" pt="4">
        <Text fontWeight="semibold">Condiciones de conservación</Text>
        <CampoOrigen origen={sucio ? "manual" : contenido?.conservacion_origen ?? "producto"} />
        <ConservacionFields value={conservacion} onChange={v => { setConservacion(v); setSucio(true); }} />
        <Button type="button" mt="3" disabled={bloqueado} onClick={() => operar(() => regenerarDeclaraciones(borradorId, datos.revision, versionId, true))}>Reemplazar conservación con datos del producto</Button>
      </Box>
      <Box as="details"><Box as="summary" cursor="pointer">Evaluaciones normativas documentadas</Box>
        <Text fontSize="sm">Para sulfitos, evaluá el umbral en el producto final. Una excepción requiere fundamento y respaldo; no se deduce del nombre o INS.</Text>
        {contenido?.detectados.map(d => {
          const evaluacion = evaluaciones.find(e => e.codigo === d.codigo);
          return <Stack key={d.codigo} p="3" gap="2">
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
      {(sucio || formularioSucio) && <Text color="orange.fg">Guardá los cambios pendientes antes de regenerar o confirmar. Guardar no confirma.</Text>}
      <HStack flexWrap="wrap">
        <Button type="button" loading={ocupado} disabled={!sucio || !autorizado || datos.vigencia !== "vigente"}
          onClick={() => operar(() => guardarDeclaraciones(borradorId, { revision: datos.revision, conservacion, contaminacion_cruzada: cruzadas, evaluaciones }))}>Guardar declaraciones</Button>
        <Button type="button" disabled={bloqueado || pendientes.length > 0 || datos.estado === "confirmada"}
          onClick={() => operar(() => confirmarDeclaraciones(borradorId, datos.revision))}>Confirmar declaraciones</Button>
        {sucio && <Button type="button" disabled={ocupado} onClick={() => { setSucio(false); setIntento(n => n + 1); }}>Descartar cambios de declaraciones</Button>}
        <Button type="button" disabled={ocupado} onClick={async () => {
          try { setHistorial(await historialDeclaraciones(borradorId)); }
          catch (e) { setError(e instanceof Error ? e.message : "Error al consultar historial"); }
        }}>Ver historial de declaraciones</Button>
      </HStack>
      {historial.map(h => <Box key={h.revision} as="details" borderWidth="1px" p="3">
        <Box as="summary">Revisión {h.revision}: {h.estado} — {h.vigencia}</Box>
        <Text>{h.declaracion || "Sin sustancias declaradas"}</Text><Text>{h.declaracion_cruzada}</Text>
        <Text>Conservación: {h.contenido?.conservacion?.instrucciones ?? "sin informar"}</Text>
        <Text>{h.confirmado_por_nombre} {h.confirmado_en}</Text>
      </Box>)}
    </>}
  </Stack>;
}
