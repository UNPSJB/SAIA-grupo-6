import { useEffect, useState } from "react";
import { Alert, Box, Button, Flex, Grid, Heading, SimpleGrid, chakra, Spinner, Stack, Text } from "@chakra-ui/react";
import { Link, useParams } from "react-router-dom";
import { PaginaDetalle } from "../../../../components/ui/plantillas";
import { GrupoOctogonos } from "../../../rotuladoFrontal/components/GrupoOctogonos";
import { exportarBorradorPdf, previsualizarBorrador } from "../../services/rotuladoService";
import type { PrevisualizacionRotulado } from "../../types/rotulado";
import type { CondicionConservacion } from "../../types/declaraciones";
import { IndicadorCompletitud } from "../IndicadorCompletitud";
import { CuadroInstantaneaNutricional } from "../ResumenNutricional";

const LEYENDA = "BORRADOR: debe ser revisado por un/a profesional y por la autoridad sanitaria competente antes de su uso";

type Consulta = { id: number; datos?: PrevisualizacionRotulado; error?: string; status?: number };

function Campo({ nombre, valor, vacio = "Pendiente" }: { nombre: string; valor: string | null; vacio?: string }) {
  return <Box><Text fontWeight="semibold">{nombre}</Text><Text whiteSpace="pre-wrap" overflowWrap="anywhere">{valor?.trim() ? valor : vacio}</Text></Box>;
}

function Condiciones({ datos }: { datos: CondicionConservacion }) {
  return <Stack gap="1">
    <Text>{datos.instrucciones || "Instrucciones pendientes"}</Text>
    {datos.temperatura_aplicable && <Text>Temperatura: {datos.temperatura_minima ?? "—"} a {datos.temperatura_maxima ?? "—"} °C</Text>}
    {datos.duracion_aplicable && <Text>Duración: {datos.duracion ?? "Pendiente"} {datos.unidad_duracion}</Text>}
  </Stack>;
}

const camposEditables = new Set([
  "denominacion_venta", "lista_ingredientes", "contenido_neto", "rnpa_rppa",
  "razon_social", "domicilio", "fecha_duracion", "lote_producto", "identificacion_lote",
  "fecha_produccion", "fecha_cierre", "instrucciones_uso", "importador_razon_social",
  "importador_domicilio", "datos_nutricionales_json", "declaraciones",
]);

function Etiqueta({ datos }: { datos: PrevisualizacionRotulado }) {
  const { borrador, origen, completitud, nutricion, declaraciones, rotulado_frontal } = datos;
  const editor = `/rotulado/borradores/${borrador.id}`;
  const faltaEnvasado = rotulado_frontal.faltantes.some(motivo => motivo.includes("envasado en ausencia del cliente"));
  // El rotulado frontal se configura en el producto: siempre se puede ir a
  // verlo o cambiarlo; si falta algo, el enlace lleva a lo que falta.
  const pendienteFrontal = rotulado_frontal.estado === "sin_definir";
  const destinoFrontal = `/productos/${borrador.producto_id}/rotulado-frontal?solo_lectura=true&borrador_id=${borrador.id}`
    + (pendienteFrontal ? `#${faltaEnvasado ? "envasado" : "marcas"}` : "");
  const conservacion = declaraciones?.contenido?.conservacion;
  const gluten = declaraciones?.contenido?.gluten;
  const confirmada = declaraciones?.estado === "confirmada" && declaraciones.vigencia === "vigente" && !declaraciones.pendientes.length;
  const loteVacio = completitud.campos.some(c => c.nombre === "identificacion_lote" && c.estado === "no_aplicable")
    ? "No aplicable" : "Pendiente";

  return <Stack gap="3">
    {origen.motivo && <Alert.Root status="warning"><Alert.Indicator /><Alert.Title>{origen.motivo}</Alert.Title></Alert.Root>}
    <Flex gap="3" align="center" wrap="wrap">
      {origen.version_numero != null && <Text fontSize="sm" color="fg.muted">Versión de receta {origen.version_numero}</Text>}
      <Box flex="1 1 420px">
        <IndicadorCompletitud completitud={completitud} soloLectura compacto
          destinoPendiente={campo => campo === "rotulado_frontal" ? `/productos/${borrador.producto_id}/rotulado-frontal?solo_lectura=true&borrador_id=${borrador.id}` : camposEditables.has(campo) ? `${editor}#${campo}` : undefined} />
      </Box>
    </Flex>
    <Grid templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 2fr) minmax(0, 3fr)" }}
      templateAreas={{ base: '"principal" "nutricion" "detalles"', lg: '"principal nutricion" "detalles nutricion"' }}
      templateRows={{ lg: "auto 1fr" }} alignItems="start" gap="4">
      <Stack as="section" gridArea="principal" aria-label="Cara principal" minW="0" p="4"
        gap="2" bg="bg.panel" borderWidth="1px" rounded="xl">
        <Heading as="h2" size={{ base: "2xl", md: "3xl" }} overflowWrap="anywhere">
          {borrador.denominacion_venta?.trim() || "Denominación de venta pendiente"}
        </Heading>
        <Text overflowWrap="anywhere"><Text as="span" fontWeight="semibold">Contenido neto</Text>{" · "}
          {borrador.contenido_neto?.trim() || "Pendiente"}
        </Text>
        <GrupoOctogonos frontal={rotulado_frontal} soloSellos alineacion="start" />
        <Flex gap="3" align="start" wrap="wrap">
          <GrupoOctogonos frontal={rotulado_frontal} soloEstado />
          <Button asChild variant="outline" size="sm" alignSelf="start">
            {pendienteFrontal
              ? <Link to={destinoFrontal} aria-label="Completar rotulado frontal">Completar</Link>
              : <Link to={destinoFrontal}>Ver o modificar rotulado frontal</Link>}
          </Button>
        </Flex>
        {nutricion.difiere_de_e12 && <Text role="status" fontSize="sm" color="orange.fg">
          La evaluación actual del rotulado frontal usa datos distintos de la tabla guardada para esta versión.
        </Text>}
      </Stack>
      <Stack as="section" gridArea="nutricion" aria-label="Información nutricional" minW="0" p="3"
        gap="2" bg="bg.panel" borderWidth="1px" rounded="xl">
        <Heading as="h2" size="lg">Información nutricional</Heading>
        {!nutricion.tabla && <Alert.Root status="warning">
          <Alert.Indicator />
          <Box>
            <Alert.Title>{nutricion.problemas[0] ?? "Tabla nutricional no disponible."}</Alert.Title>
            {origen.estado === "verificado" && <Button asChild variant="outline" size="sm" mt="2">
              <Link to={`${editor}#datos_nutricionales_json`}>Ir a edición para recalcular la tabla</Link>
            </Button>}
          </Box>
        </Alert.Root>}
        {nutricion.tabla && nutricion.estado !== "completa" && <Text role="status" fontSize="sm" color="red.fg">
          Tabla incompleta: se calculó con datos faltantes.
        </Text>}
        {nutricion.tabla && <CuadroInstantaneaNutricional datos={nutricion.tabla}
          incompleta={nutricion.estado !== "completa"} />}
      </Stack>
      <Stack as="section" gridArea="detalles" aria-label="Información complementaria" minW="0" p="5" gap="2"
        bg="bg.panel" borderWidth="1px" rounded="xl" fontSize="sm">
        <Campo nombre="Ingredientes" valor={borrador.lista_ingredientes} />
        <Heading as="h3" size="sm" pt="3" borderTopWidth="1px">Alérgenos, gluten y conservación</Heading>
        <Text fontWeight="semibold">{confirmada ? "Confirmada y vigente" : declaraciones?.revision
          ? declaraciones.vigencia === "desactualizada" ? "Revisión desactualizada" : "Declaración pendiente de confirmación"
          : "Sin revisión disponible"}</Text>
        {declaraciones?.declaracion && <Text>{declaraciones.declaracion}</Text>}
        {declaraciones?.declaracion_cruzada && <Text>{declaraciones.declaracion_cruzada}</Text>}
        {gluten && <Text>Gluten: {gluten === "presente" ? "presencia declarada" : gluten === "sin_presencia_declarada" ? "sin presencia declarada en los insumos evaluados" : "información insuficiente"}.</Text>}
        {conservacion && <>
          <Text fontWeight="semibold">Conservación</Text>
          <Condiciones datos={conservacion} />
          {conservacion.despues_abrir_aplicable && <>
            <Text fontWeight="semibold">Después de abrir</Text>
            {conservacion.despues_abrir ? <Condiciones datos={conservacion.despues_abrir} /> : <Text>Pendiente</Text>}
          </>}
        </>}
        <chakra.details borderTopWidth="1px" pt="3" mt="2">
          <Box as="summary" cursor="pointer" fontWeight="semibold">Ver datos del establecimiento y del lote</Box>
          <SimpleGrid columns={{ base: 1, xl: 2 }} gap="3" mt="3">
            <Campo nombre="Razón social del establecimiento" valor={borrador.razon_social} />
            <Campo nombre="Domicilio del establecimiento" valor={borrador.domicilio} />
            <Campo nombre="RNPA/RPPA" valor={borrador.rnpa_rppa} />
            {borrador.es_importado && <>
              <Campo nombre="Razón social del importador" valor={borrador.importador_razon_social} />
              <Campo nombre="Domicilio del importador" valor={borrador.importador_domicilio} />
            </>}
            <Campo nombre="Lote" valor={borrador.identificacion_lote} vacio={loteVacio} />
            <Campo nombre="Fecha de duración" valor={borrador.fecha_duracion} />
            <Campo nombre="Instrucciones de uso" valor={borrador.instrucciones_uso} />
          </SimpleGrid>
        </chakra.details>
      </Stack>
    </Grid>
  </Stack>;
}

export function RotuladoPreviewPage() {
  const { id } = useParams();
  return <ConsultaPrevisualizacion key={id} borradorId={Number(id)} />;
}

function ConsultaPrevisualizacion({ borradorId }: { borradorId: number }) {
  const valido = Number.isSafeInteger(borradorId) && borradorId > 0;
  const [consulta, setConsulta] = useState<Consulta>();
  const [intento, setIntento] = useState(0);
  const [exportando, setExportando] = useState(false);
  const [errorExportacion, setErrorExportacion] = useState<string>();
  const actual = consulta?.id === borradorId ? consulta : undefined;

  useEffect(() => {
    if (!valido) return;
    const controlador = new AbortController();
    const { signal } = controlador;
    void previsualizarBorrador(borradorId, signal).then(
      (datos) => { if (!signal.aborted) setConsulta({ id: borradorId, datos }); },
      (error: Error & { status?: number }) => {
        if (!signal.aborted) setConsulta({ id: borradorId, error: error.message, status: error.status });
      },
    );
    return () => controlador.abort();
  }, [borradorId, valido, intento]);

  async function descargar() {
    setExportando(true);
    setErrorExportacion(undefined);
    try {
      await exportarBorradorPdf(borradorId);
    } catch (error) {
      setErrorExportacion(error instanceof Error ? error.message : "No se pudo exportar el borrador.");
    } finally {
      setExportando(false);
    }
  }

  const noExiste = !valido || actual?.status === 404;
  const prohibido = actual?.status === 401 || actual?.status === 403;

  return <PaginaDetalle ancho="completo" banner={false} titulo="Previsualización de rótulo" acciones={
    <Flex gap="2" wrap="wrap">
      <Button asChild variant="outline"><Link to="/rotulado">Volver al listado</Link></Button>
      {actual?.datos && <Button colorPalette="brand" loading={exportando} onClick={descargar}>Exportar PDF</Button>}
      {actual?.datos && <Button asChild variant="outline"><Link to={`/rotulado/borradores/${borradorId}`}>Editar borrador</Link></Button>}
    </Flex>
  }>
    <Stack gap="3">
      <Alert.Root status="warning" size="sm"><Alert.Indicator /><Alert.Title>{LEYENDA}</Alert.Title></Alert.Root>
      {errorExportacion && <Alert.Root status="error"><Alert.Indicator /><Alert.Title>{errorExportacion}</Alert.Title></Alert.Root>}
      {noExiste ? <Text>El borrador no existe o está archivado.</Text>
        : prohibido ? <Text>Se requiere permiso de administrar.</Text>
        : actual?.error ? <Stack align="start"><Text role="alert">{actual.error}</Text>
          <Button onClick={() => { setConsulta(undefined); setIntento(intento + 1); }}>Reintentar</Button></Stack>
        : actual?.datos ? <Etiqueta datos={actual.datos} />
        : <Flex gap="2" align="center" role="status"><Spinner size="sm" />Cargando borrador</Flex>}
    </Stack>
  </PaginaDetalle>;
}
