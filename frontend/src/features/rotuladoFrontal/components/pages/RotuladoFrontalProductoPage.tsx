import { useEnfocarFragmento } from "../../../../common/hooks/useEnfocarFragmento";
import { useCallback, useEffect, useState } from "react";
import { useLista } from "../../../../common/hooks/useLista";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge, Box, Button, HStack, SimpleGrid, Stack, Table, Text } from "@chakra-ui/react";
import { LuBookOpen, LuHistory, LuInfo, LuTriangleAlert } from "react-icons/lu";
import { DatoDetalle, PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import {
  BannerError,
  BotonAccion,
  BotonGuardar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EtiquetaEstado,
  FilaEncabezado,
  FormField,
  FormNativeSelect,
} from "../../../../components/ui/patrones";
import { toaster } from "../../../../components/ui/toaster";
import { formatoCantidad, cantidadConUnidad } from "../../../../common/utils/numeros";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import {
  evaluarRotulado,
  guardarRotulado,
  listarEvaluaciones,
} from "../../services/rotuladoFrontalService";
import {
  CANALES_COMERCIALIZACION,
  ETIQUETA_ESTADO,
  MARCAS_ROTULADO,
  type CanalComercializacion,
  type ClaveMarca,
  type EstadoRotulado,
  type EvaluacionRotulado,
  type EvaluacionRotuladoGuardada,
  type MarcaRotulado,
  type ResultadoSello,
  type SellosRotulado,
} from "../../types/rotuladoFrontal";

type ValorMarca = "auto" | "si" | "no";
type ValorEnvasado = "" | "si" | "no";

const TONO_ESTADO: Record<EstadoRotulado, "ok" | "alerta" | "peligro" | "neutro" | "info"> = {
  aplica: "peligro",
  exceptuado: "ok",
  no_aplica: "neutro",
  no_aplica_canal_industrial: "neutro",
  sin_definir: "alerta",
  modulo_inactivo: "alerta",
};

const aValorMarca = (valor: boolean | null): ValorMarca =>
  valor === null ? "auto" : valor ? "si" : "no";

const aBooleano = (valor: ValorMarca): boolean | null =>
  valor === "auto" ? null : valor === "si";

function textoDeMarca(marca: MarcaRotulado, evaluada = true): string {
  if (marca.valor === null) return evaluada ? "Sin dato" : "No evaluada";
  return marca.valor ? "Sí" : "No";
}

function FuentesDeMarca({ marca, evaluada = true }: { marca: MarcaRotulado; evaluada?: boolean }) {
  if (marca.fuentes.length === 0) {
    return (
      <Text fontSize="xs" color="fg.subtle">
        {evaluada ? "Sin marcas en la receta" : "No se consultó la receta"}
      </Text>
    );
  }
  return (
    <Stack gap="0.5">
      {marca.fuentes.slice(0, 3).map((fuente) => (
        <Text key={`${fuente.ingrediente_id}-${fuente.motivo}`} fontSize="xs" color="fg.muted">
          {fuente.nombre} · {fuente.motivo}
        </Text>
      ))}
      {marca.fuentes.length > 3 && (
        <Text fontSize="xs" color="fg.subtle">y {marca.fuentes.length - 3} más</Text>
      )}
    </Stack>
  );
}

function valorConUnidad(valor: string | null, unidad: string): string {
  if (valor === null) return "Sin dato";
  const texto = formatoCantidad(valor);
  return unidad ? `${texto} ${unidad}` : texto;
}

function DetalleEvaluacionGuardada({
  evaluacion,
  onCerrar,
}: {
  evaluacion: EvaluacionRotuladoGuardada;
  onCerrar: () => void;
}) {
  const sellos = evaluacion.instantanea.sellos;
  return (
    <Box
      mt="4"
      p="4"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="md"
      bg="bg.subtle"
    >
      <HStack justify="space-between" align="flex-start" gap="3" flexWrap="wrap">
        <Box>
          <Text fontWeight="semibold">
            Evaluación del {formatoFechaHora(evaluacion.evaluado_en)}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {evaluacion.producto_nombre} · Regla v{evaluacion.regla_version} ·{" "}
            {evaluacion.norma_origen}
          </Text>
        </Box>
        <Button size="xs" variant="ghost" onClick={onCerrar}>
          Cerrar
        </Button>
      </HStack>

      <HStack gap="2" mt="4" flexWrap="wrap">
        <EtiquetaEstado tono={TONO_ESTADO[evaluacion.estado]}>
          {ETIQUETA_ESTADO[evaluacion.estado]}
        </EtiquetaEstado>
        {sellos?.excesos.map((exceso) => (
          <Badge key={exceso} colorPalette="red" variant="subtle" size="sm">
            {exceso}
          </Badge>
        ))}
      </HStack>

      <Text mt="3" fontSize="sm">
        {evaluacion.mensaje}
      </Text>

      <Box
        mt="4"
        display="grid"
        gridTemplateColumns={{ base: "1fr", md: "repeat(3, minmax(0, 1fr))" }}
        gap="4"
      >
        <DatoDetalle etiqueta="Norma de origen">
          {evaluacion.norma_origen}
        </DatoDetalle>
        <DatoDetalle etiqueta="Vigencia desde">
          {formatoFecha(evaluacion.instantanea.parametros.vigencia_desde)}
        </DatoDetalle>
        <DatoDetalle etiqueta="Receta">
          {evaluacion.instantanea.version_receta_numero
            ? `Versión ${evaluacion.instantanea.version_receta_numero}`
            : "Sin versión de receta"}
        </DatoDetalle>
      </Box>

      <Text fontSize="sm" fontWeight="medium" mt="5" mb="2">
        Marcas registradas
      </Text>
      <HStack gap="2" flexWrap="wrap">
        {evaluacion.instantanea.marcas.map((marca) => (
          <Badge key={marca.clave} variant="subtle" colorPalette="gray" size="sm">
            {marca.nombre}: {marca.valor === null ? "sin dato" : marca.valor ? "sí" : "no"}
          </Badge>
        ))}
      </HStack>

      <Text fontSize="sm" fontWeight="medium" mt="5" mb="2">
        Sellos calculados
      </Text>
      {!sellos ? (
        <Text fontSize="sm" color="fg.muted">
          Esta evaluación no guardó el cálculo de sellos.
        </Text>
      ) : !sellos.evaluado ? (
        <Text fontSize="sm" color="fg.muted">
          {sellos.motivo ?? "No se calcularon sellos para esta evaluación."}
        </Text>
      ) : (
        <Box overflowX="auto" borderTopWidth="1px" borderColor="border.subtle">
          <Table.Root size="sm" minW="760px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Sello</EncabezadoOscuro>
                <EncabezadoOscuro>Cálculo</EncabezadoOscuro>
                <EncabezadoOscuro>Umbral</EncabezadoOscuro>
                <EncabezadoOscuro center>Resultado</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {sellos.resultados.map((resultado) => (
                <Table.Row
                  key={resultado.clave}
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                >
                  <Celda py="2" px="3">{resultado.etiqueta}</Celda>
                  <Celda py="2" px="3">
                    {resultado.evaluado ? (
                      <Text fontSize="xs">{resultado.formula}</Text>
                    ) : (
                      <Text fontSize="xs" color="fg.muted">
                        {resultado.motivo}
                      </Text>
                    )}
                  </Celda>
                  <Celda py="2" px="3">
                    {valorConUnidad(resultado.umbral, resultado.unidad_umbral)}
                  </Celda>
                  <Celda py="2" px="3" center>
                    {resultado.exceso === null ? (
                      <Badge colorPalette="gray" variant="subtle" size="sm">
                        Sin evaluar
                      </Badge>
                    ) : resultado.exceso ? (
                      <Badge colorPalette="red" variant="solid" size="sm">
                        Exceso
                      </Badge>
                    ) : (
                      <Badge colorPalette="green" variant="subtle" size="sm">
                        No supera
                      </Badge>
                    )}
                    <MarcaCercania resultado={resultado} />
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Box>
  );
}

/** "+9.1" -> "+9,1 %". */
function distanciaTexto(distancia: string | null | undefined): string {
  const numero = Number(distancia);
  if (distancia === null || distancia === undefined || !Number.isFinite(numero)) return "";
  return `${numero > 0 ? "+" : ""}${formatoCantidad(numero)} %`;
}

/** Debajo del resultado de un sello: queda a menos de la tolerancia del umbral. */
function MarcaCercania({ resultado }: { resultado: ResultadoSello }) {
  if (!resultado.cerca_del_umbral) return null;
  return (
    <Text fontSize="xs" color="orange.fg" mt="1" whiteSpace="nowrap">
      Cerca del umbral ({distanciaTexto(resultado.distancia_umbral_pct)})
    </Text>
  );
}

function AvisoCercania({ sellos }: { sellos: SellosRotulado }) {
  const cerca = sellos.cerca_del_umbral ?? [];
  return (
    <Box p="3" bg="orange.subtle" borderWidth="1px" borderColor="orange.muted" rounded="md">
      <HStack gap="2" color="orange.fg">
        <LuTriangleAlert aria-hidden />
        <Text fontSize="sm" fontWeight="semibold">
          {cerca.length === 1 ? "Un sello queda cerca del umbral" : `${cerca.length} sellos quedan cerca del umbral`}
        </Text>
      </HStack>
      <Text fontSize="sm" mt="1">
        {cerca.join(", ")}: el valor calculado está a menos de {formatoCantidad(sellos.tolerancia_pct)} % del
        umbral. Las marcas aprobadas pueden apartarse de la especificación de sus ingredientes en esa proporción
        (tolerancia de homologación), así que el producto real podría quedar del otro lado. Conviene confirmarlo con
        un análisis de laboratorio.
      </Text>
    </Box>
  );
}

export function RotuladoFrontalProductoPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const productoId = Number(id);
  const [params] = useSearchParams();
  const soloLectura = params.get("solo_lectura") === "true";
  const borradorId = Number(params.get("borrador_id"));
  const volverVista = Number.isSafeInteger(borradorId) && borradorId > 0;
  const [evaluacion, setEvaluacion] = useState<EvaluacionRotulado | null>(null);
  const [envasado, setEnvasado] = useState<ValorEnvasado>("");
  const [canal, setCanal] = useState<CanalComercializacion>("MINORISTA");
  const [categoriaRotulado, setCategoriaRotulado] = useState("");
  const [marcas, setMarcas] = useState<Record<ClaveMarca, ValorMarca>>({
    azucares: "auto",
    grasas: "auto",
    sodio: "auto",
    edulcorantes: "auto",
    cafeina: "auto",
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cargarHistorial = useCallback(() => listarEvaluaciones(productoId), [productoId]);
  const {
    items: historial,
    loading: cargandoHistorial,
    error: historialError,
    recargar: recargarHistorial,
  } = useLista<EvaluacionRotuladoGuardada[]>({
    cargar: cargarHistorial,
    dependencias: [productoId],
    valorInicial: [],
    mensajeError: "No se pudo cargar el historial.",
    preferirMensajeDelBackend: true,
  });
  // La evaluación abierta, siempre en su versión recién cargada del historial.
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null);
  const seleccionada = historial.find((item) => item.id === seleccionadaId) ?? null;

  useEnfocarFragmento(!cargando && !!evaluacion);

  const inicializar = (datos: EvaluacionRotulado) => {
    setEvaluacion(datos);
    const config = datos.configuracion;
    setEnvasado(
      config.envasado_sin_cliente === null
        ? ""
        : config.envasado_sin_cliente
          ? "si"
          : "no",
    );
    setCanal(config.canal_comercializacion);
    setCategoriaRotulado(datos.categoria_rotulado ?? "");
    setMarcas({
      azucares: aValorMarca(config.azucares_agregados),
      grasas: aValorMarca(config.grasas_agregadas),
      sodio: aValorMarca(config.sodio_agregado),
      edulcorantes: aValorMarca(config.edulcorantes),
      cafeina: aValorMarca(config.cafeina),
    });
  };

  useEffect(() => {
    let vigente = true;
    evaluarRotulado(productoId, undefined, soloLectura)
      .then((datos) => {
        if (vigente) inicializar(datos);
      })
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [productoId, soloLectura]);

  const guardar = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const datos = await guardarRotulado(productoId, {
        envasado_sin_cliente: envasado === "" ? null : envasado === "si",
        azucares_agregados: aBooleano(marcas.azucares),
        grasas_agregadas: aBooleano(marcas.grasas),
        sodio_agregado: aBooleano(marcas.sodio),
        edulcorantes: aBooleano(marcas.edulcorantes),
        cafeina: aBooleano(marcas.cafeina),
        canal_comercializacion: canal,
        categoria_rotulado: categoriaRotulado || null,
      });
      inicializar(datos);
      await recargarHistorial();
      toaster.create({ type: "success", title: "Rotulado frontal evaluado." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la evaluación.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <PaginaDetalle
        volver={{ a: "/productos", etiqueta: "Productos", historial: true }}
        titulo="Rotulado frontal"
      >
        <EstadoCargando>Evaluando rotulado frontal...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  return (
    <PaginaDetalle
      ancho="completo"
      volver={{ a: "/productos", etiqueta: "Productos", historial: true }}
      titulo={evaluacion?.producto ?? "Rotulado frontal"}
      descripcion="Indicá cómo se comercializa el producto y las marcas que correspondan. La evaluación aplica la regla vigente y calcula los sellos cuando corresponde."
      estado={
        evaluacion ? (
          <EtiquetaEstado tono={TONO_ESTADO[evaluacion.estado]}>
            {ETIQUETA_ESTADO[evaluacion.estado]}
          </EtiquetaEstado>
        ) : null
      }
      acciones={<HStack gap="2" flexWrap="wrap">
        {volverVista && <Button asChild variant="outline" colorPalette="brand">
          <Link to={`/rotulado/borradores/${borradorId}/previsualizar`}>Volver a la previsualización</Link>
        </Button>}
        <Button variant="outline" colorPalette="brand" onClick={() => navigate("/rotulado?tab=reglas")}>
          <LuBookOpen aria-hidden /> Reglas de aplicabilidad
        </Button>
      </HStack>}
    >
      {error && <BannerError mb="4">{error}</BannerError>}

      {evaluacion && !evaluacion.modulo_activo && (
        <Box
          mb="4"
          p="3"
          bg="orange.50"
          borderWidth="1px"
          borderColor="orange.200"
          rounded="md"
        >
          <HStack gap="2" color="orange.900">
            <LuInfo aria-hidden />
            <Text fontSize="sm" fontWeight="semibold">
              El módulo de octógonos está desactivado
            </Text>
          </HStack>
          <Text fontSize="sm" color="orange.900" mt="1">
            No se evalúan marcas ni se calculan sellos. El resto del sistema
            sigue funcionando; podés reactivarlo desde Reglas de aplicabilidad.
          </Text>
        </Box>
      )}

      {evaluacion && (
        <Box as="form" {...{ noValidate: true }} onSubmit={guardar}>
          <SeccionDetalle
            titulo="Cómo se comercializa"
            descripcion="La normativa solo aplica a productos envasados en ausencia del cliente y destinados al consumo final directo."
            mb="6"
          >
            {/* Tres preguntas cortas: en una fila desde `lg` (antes eran selects
                de 420px apilados, con dos tercios de la tarjeta vacíos). */}
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap="5" alignItems="start">
              <FormField id="envasado"
                label="¿El producto se comercializa envasado en ausencia del cliente?"
                required
                mb="0"
              >
                <FormNativeSelect
                  value={envasado}
                  onChange={(e) => setEnvasado(e.target.value as ValorEnvasado)}
                >
                  <option value="">Seleccioná una opción</option>
                  <option value="si">Sí, se comercializa envasado</option>
                  <option value="no">No se comercializa envasado</option>
                </FormNativeSelect>
              </FormField>

              <FormField
                label="Canal de comercialización"
                helper="Solo el canal minorista se considera consumo final directo. Los canales mayorista e industrial no llevan sellos en el empaque del producto."
                mb="0"
              >
                <FormNativeSelect
                  value={canal}
                  onChange={(e) => setCanal(e.target.value as CanalComercializacion)}
                >
                  {CANALES_COMERCIALIZACION.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </FormNativeSelect>
              </FormField>

              <FormField
                label="Categoría a los efectos del rotulado"
                helper="La lista de categorías exceptuadas sale de la versión vigente de la regla."
                mb="0"
              >
                <FormNativeSelect
                  value={categoriaRotulado}
                  onChange={(e) => setCategoriaRotulado(e.target.value)}
                >
                  <option value="">No es una categoría exceptuada</option>
                  {evaluacion.regla.reglas_aplicabilidad.categorias_exceptuadas.map(
                    (categoria) => (
                      <option key={categoria.clave} value={categoria.clave}>
                        {categoria.etiqueta}
                      </option>
                    ),
                  )}
                </FormNativeSelect>
              </FormField>
            </SimpleGrid>
          </SeccionDetalle>

          <SeccionDetalle
            titulo="Marcas del producto"
            descripcion="Se detectan desde las marcas de ingredientes y aditivos de la receta vigente. Podés corregir cada una."
            mb="6"
          >
            {!evaluacion.perfil_evaluado && (
              // Sin este aviso, una categoría exceptuada o un producto no
              // envasado dejaban todas las marcas en "Sin dato" y parecía que
              // el guardado las había borrado.
              <HStack
                align="flex-start"
                gap="2"
                mb="4"
                p="3"
                rounded="md"
                borderWidth="1px"
                borderColor="border.subtle"
                bg="bg.subtle"
                color="fg.muted"
                fontSize="sm"
              >
                <Box as="span" mt="0.5" flexShrink={0}>
                  <LuInfo aria-hidden />
                </Box>
                <Text>
                  <Text as="span" fontWeight="semibold" color="fg">
                    No se evalúan las marcas desde la receta.
                  </Text>{" "}
                  {evaluacion.mensaje}
                </Text>
              </HStack>
            )}
            <Box id="marcas" tabIndex={-1} aria-label="Marcas del producto" overflowX="auto" mx={{ base: "-4", md: "-5" }} borderTopWidth="1px" borderColor="border.subtle">
              <Table.Root size="sm" minW="760px">
                <Table.Header>
                  <FilaEncabezado>
                    <EncabezadoOscuro>Marca</EncabezadoOscuro>
                    <EncabezadoOscuro>Detectado en la receta</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="media">Valor para el producto</EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {MARCAS_ROTULADO.map((definicion) => {
                    const marca = evaluacion.marcas.find((m) => m.clave === definicion.clave);
                    if (!marca) return null;
                    return (
                      <Table.Row key={definicion.clave} borderBottomWidth="1px" borderColor="border.subtle">
                        <Celda py="3" px="4">
                          <HStack gap="2" flexWrap="wrap">
                            <Text fontWeight="medium">{definicion.nombre}</Text>
                            {!marca.obligatoria && (
                              <Badge colorPalette="gray" variant="subtle" size="sm">
                                No obligatoria
                              </Badge>
                            )}
                          </HStack>
                          <Text fontSize="xs" color="fg.muted" mt="1">{definicion.ayuda}</Text>
                        </Celda>
                        <Celda py="3" px="4">
                          <HStack gap="2" mb="1" flexWrap="wrap">
                            <Badge
                              colorPalette={
                                marca.valor
                                  ? "blue"
                                  : marca.valor === false || !evaluacion.perfil_evaluado
                                    ? "gray"
                                    : "orange"
                              }
                              variant="subtle"
                              size="sm"
                            >
                              {textoDeMarca(marca, evaluacion.perfil_evaluado)}
                            </Badge>
                            {marca.origen === "correccion" && (
                              <Badge colorPalette="green" variant="subtle" size="sm">
                                Corrección manual
                              </Badge>
                            )}
                          </HStack>
                          <FuentesDeMarca marca={marca} evaluada={evaluacion.perfil_evaluado} />
                        </Celda>
                        <Celda py="3" px="4">
                          <FormNativeSelect
                            aria-label={`Valor de ${definicion.nombre}`}
                            value={marcas[definicion.clave]}
                            onChange={(e) =>
                              setMarcas((previas) => ({
                                ...previas,
                                [definicion.clave]: e.target.value as ValorMarca,
                              }))
                            }
                            maxW="220px"
                          >
                            <option value="auto">
                              Según receta{marca.resuelta && marca.origen === "receta"
                                ? ` (${marca.valor ? "sí" : "no"})`
                                : marca.resuelta
                                  ? ""
                                  : evaluacion.perfil_evaluado
                                    ? " (sin dato)"
                                    : " (no evaluada)"}
                            </option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </FormNativeSelect>
                        </Celda>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
            <HStack mt="4" justify="flex-end">
              <BotonGuardar loading={guardando}>Guardar y evaluar</BotonGuardar>
            </HStack>
          </SeccionDetalle>
        </Box>
      )}

      {evaluacion && (
        <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1.4fr) minmax(300px, 1fr)" }} gap="6">
          <SeccionDetalle titulo="Resultado" mb="0">
            <HStack gap="3" mb="3" flexWrap="wrap">
              <EtiquetaEstado tono={TONO_ESTADO[evaluacion.estado]}>
                {ETIQUETA_ESTADO[evaluacion.estado]}
              </EtiquetaEstado>
              <Text fontSize="sm" color="fg.muted">
                {evaluacion.version ? `Versión ${evaluacion.version.numero} de la receta` : "Sin versión de receta"}
              </Text>
            </HStack>
            <Text color="fg">{evaluacion.mensaje}</Text>

            {evaluacion.faltantes.length > 0 && (
              <Box mt="4" p="3" bg="orange.50" borderWidth="1px" borderColor="orange.200" rounded="md">
                <HStack gap="2" color="orange.900" mb="1">
                  <LuInfo aria-hidden />
                  <Text fontWeight="semibold" fontSize="sm">Falta completar</Text>
                </HStack>
                <Text fontSize="sm" color="orange.900">
                  {evaluacion.faltantes.join(", ")}.
                </Text>
              </Box>
            )}

            {evaluacion.advertencias.length > 0 && (
              <Stack gap="2" mt="4">
                {evaluacion.advertencias.map((advertencia) => (
                  <HStack key={advertencia} align="flex-start" gap="2" color="fg.muted" fontSize="sm">
                    <LuInfo aria-hidden />
                    <Text>{advertencia}</Text>
                  </HStack>
                ))}
              </Stack>
            )}
          </SeccionDetalle>

          <SeccionDetalle titulo="Regla aplicada" mb="0">
            <Stack gap="4">
              <DatoDetalle etiqueta="Versión de la regla">v{evaluacion.regla.version}</DatoDetalle>
              <DatoDetalle etiqueta="Norma">{evaluacion.regla.norma_origen}</DatoDetalle>
              <DatoDetalle etiqueta="Vigencia desde">
                {formatoFecha(evaluacion.regla.vigencia_desde)}
              </DatoDetalle>
              <DatoDetalle etiqueta="Marcas obligatorias">
                {MARCAS_ROTULADO.filter((marca) => {
                  const encontrada = evaluacion.marcas.find((m) => m.clave === marca.clave);
                  return encontrada?.obligatoria;
                })
                  .map((marca) => marca.nombre)
                  .join(", ")}
              </DatoDetalle>
              <DatoDetalle etiqueta="Última evaluación">
                {formatoFechaHora(evaluacion.evaluado_en)}
              </DatoDetalle>
            </Stack>
          </SeccionDetalle>
        </Box>
      )}

      {evaluacion && (
        <SeccionDetalle
          titulo="Historial de versiones de la receta"
          descripcion="Cada modificación de la receta crea una versión nueva. Se muestra la fecha y hora de creación y quién la guardó."
          mt="6"
          mb="0"
        >
          {evaluacion.versiones_receta.length === 0 ? (
            <HStack gap="2" color="fg.muted" fontSize="sm">
              <LuInfo aria-hidden />
              <Text>El producto todavía no tiene versiones de receta.</Text>
            </HStack>
          ) : (
            <Box
              overflowX="auto"
              mx={{ base: "-4", md: "-5" }}
              borderTopWidth="1px"
              borderColor="border.subtle"
            >
              <Table.Root size="sm" minW="640px">
                <Table.Header>
                  <FilaEncabezado>
                    <EncabezadoOscuro ancho="angosta">Versión</EncabezadoOscuro>
                    <EncabezadoOscuro>Fecha y hora</EncabezadoOscuro>
                    <EncabezadoOscuro>Creado / modificado por</EncabezadoOscuro>
                    <EncabezadoOscuro numero ancho="media">Rendimiento</EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {evaluacion.versiones_receta.map((version) => (
                    <Table.Row
                      key={version.id}
                      borderBottomWidth="1px"
                      borderColor="border.subtle"
                    >
                      <Celda py="3" px="4">
                        <HStack gap="2" flexWrap="wrap">
                          <Text fontWeight="medium">v{version.numero}</Text>
                          {version.vigente && (
                            <Badge colorPalette="green" variant="subtle" size="sm">
                              Vigente
                            </Badge>
                          )}
                          {version.id === evaluacion.version?.id && (
                            <Badge colorPalette="blue" variant="subtle" size="sm">
                              En evaluación
                            </Badge>
                          )}
                        </HStack>
                      </Celda>
                      <Celda py="3" px="4">{formatoFechaHora(version.creado_en)}</Celda>
                      <Celda py="3" px="4">
                        <Text fontSize="xs" color="fg.muted">
                          {version.numero === 1 ? "Creado por" : "Modificado por"}
                        </Text>
                        <Text>{version.creado_por_nombre ?? "Sin registrar"}</Text>
                      </Celda>
                      <Celda py="3" px="4" numero>
                        {cantidadConUnidad(version.rendimiento, version.unidad)}
                      </Celda>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          )}
        </SeccionDetalle>
      )}

      {evaluacion && (
        <SeccionDetalle
          titulo="Sellos de advertencia"
          descripcion="Se calculan con los valores de la información nutricional y los umbrales de la regla vigente."
          mt="6"
          mb="0"
        >
          {!evaluacion.sellos.evaluado ? (
            <HStack gap="2" color="fg.muted" fontSize="sm">
              <LuInfo aria-hidden />
              <Text>
                {evaluacion.sellos.motivo ??
                  "No se calcularon sellos para esta evaluación."}
              </Text>
            </HStack>
          ) : (
            <Stack gap="4">
              {evaluacion.sellos.excesos.length > 0 ? (
                <HStack gap="2" flexWrap="wrap">
                  {evaluacion.sellos.excesos.map((exceso) => (
                    <Badge
                      key={exceso}
                      colorPalette="red"
                      variant="solid"
                      size="lg"
                    >
                      {exceso}
                    </Badge>
                  ))}
                </HStack>
              ) : (
                <Text fontSize="sm" color="fg.muted">
                  El producto no supera ningún umbral de la regla vigente.
                </Text>
              )}

              {(evaluacion.sellos.cerca_del_umbral ?? []).length > 0 && (
                <AvisoCercania sellos={evaluacion.sellos} />
              )}

              {!evaluacion.sellos.completo && (
                <Box
                  p="3"
                  bg="orange.50"
                  borderWidth="1px"
                  borderColor="orange.200"
                  rounded="md"
                >
                  <HStack gap="2" color="orange.900">
                    <LuTriangleAlert aria-hidden />
                    <Text fontSize="sm" fontWeight="semibold">
                      El cálculo de sellos está incompleto
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="orange.900" mt="1">
                    {evaluacion.sellos.motivo}
                  </Text>
                </Box>
              )}

              <Box
                overflowX="auto"
                mx={{ base: "-4", md: "-5" }}
                borderTopWidth="1px"
                borderColor="border.subtle"
              >
                <Table.Root size="sm" minW="920px">
                  <Table.Header>
                    <FilaEncabezado>
                      <EncabezadoOscuro>Sello</EncabezadoOscuro>
                      <EncabezadoOscuro>Valor nutricional</EncabezadoOscuro>
                      <EncabezadoOscuro>Cálculo</EncabezadoOscuro>
                      <EncabezadoOscuro>Umbral</EncabezadoOscuro>
                      <EncabezadoOscuro center>Resultado</EncabezadoOscuro>
                    </FilaEncabezado>
                  </Table.Header>
                  <Table.Body>
                    {evaluacion.sellos.resultados.map((resultado) => (
                      <Table.Row
                        key={resultado.clave}
                        borderBottomWidth="1px"
                        borderColor="border.subtle"
                      >
                        <Celda py="3" px="4">
                          <Text fontWeight="medium">{resultado.etiqueta}</Text>
                          <Text fontSize="xs" color="fg.muted" mt="1">
                            {resultado.criterio}
                          </Text>
                        </Celda>
                        <Celda py="3" px="4">
                          {valorConUnidad(
                            resultado.valor_nutriente,
                            resultado.unidad_nutriente,
                          )}
                        </Celda>
                        <Celda py="3" px="4">
                          {resultado.evaluado ? (
                            <Stack gap="1">
                              <Text fontSize="sm">{resultado.formula}</Text>
                              <Text fontSize="xs" color="fg.muted">
                                {resultado.pasos
                                  .map(
                                    (paso) =>
                                      `${paso.descripcion}: ${valorConUnidad(
                                        paso.valor,
                                        paso.unidad,
                                      )}`,
                                  )
                                  .join(" · ")}
                              </Text>
                            </Stack>
                          ) : (
                            <Text fontSize="sm" color="fg.muted">
                              {resultado.motivo}
                            </Text>
                          )}
                        </Celda>
                        <Celda py="3" px="4">
                          {valorConUnidad(
                            resultado.umbral,
                            resultado.unidad_umbral,
                          )}
                        </Celda>
                        <Celda py="3" px="4" center>
                          {resultado.exceso === null ? (
                            <Badge colorPalette="gray" variant="subtle" size="sm">
                              Sin evaluar
                            </Badge>
                          ) : resultado.exceso ? (
                            <Badge colorPalette="red" variant="solid" size="sm">
                              Exceso
                            </Badge>
                          ) : (
                            <Badge
                              colorPalette="green"
                              variant="subtle"
                              size="sm"
                            >
                              No supera
                            </Badge>
                          )}
                          <MarcaCercania resultado={resultado} />
                        </Celda>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>

              <Text fontSize="xs" color="fg.muted">
                Regla v{evaluacion.sellos.regla_version} · Vigencia desde{" "}
                {formatoFecha(evaluacion.sellos.vigencia_desde)} ·{" "}
                {evaluacion.sellos.norma_origen}
              </Text>
            </Stack>
          )}
        </SeccionDetalle>
      )}

      {evaluacion && (
        <SeccionDetalle
          titulo="Historial de evaluaciones"
          descripcion="Cada evaluación guarda una foto de la regla, la receta y los sellos calculados. Podés reconstruir un resultado anterior aunque después cambie la norma."
          mt="6"
          mb="0"
        >
          {cargandoHistorial ? (
            <EstadoCargando>Cargando historial...</EstadoCargando>
          ) : historialError ? (
            <BannerError>{historialError}</BannerError>
          ) : historial.length === 0 ? (
            <HStack gap="2" color="fg.muted" fontSize="sm">
              <LuHistory aria-hidden />
              <Text>Todavía no hay evaluaciones guardadas para este producto.</Text>
            </HStack>
          ) : (
            <>
              <Box
                overflowX="auto"
                mx={{ base: "-4", md: "-5" }}
                borderTopWidth="1px"
                borderColor="border.subtle"
              >
                <Table.Root size="sm" minW="860px">
                  <Table.Header>
                    <FilaEncabezado>
                      <EncabezadoOscuro>Fecha y hora</EncabezadoOscuro>
                      <EncabezadoOscuro>Estado</EncabezadoOscuro>
                      <EncabezadoOscuro ancho="angosta">Regla</EncabezadoOscuro>
                      <EncabezadoOscuro>Norma</EncabezadoOscuro>
                      <EncabezadoOscuro>Excesos</EncabezadoOscuro>
                      <EncabezadoOscuro center ancho="media">Detalle</EncabezadoOscuro>
                    </FilaEncabezado>
                  </Table.Header>
                  <Table.Body>
                    {historial.map((item) => {
                      const sellos = item.instantanea.sellos;
                      return (
                        <Table.Row
                          key={item.id}
                          borderBottomWidth="1px"
                          borderColor="border.subtle"
                        >
                          <Celda py="3" px="4">
                            {formatoFechaHora(item.evaluado_en)}
                          </Celda>
                          <Celda py="3" px="4">
                            <EtiquetaEstado tono={TONO_ESTADO[item.estado]}>
                              {ETIQUETA_ESTADO[item.estado]}
                            </EtiquetaEstado>
                          </Celda>
                          <Celda py="3" px="4">v{item.regla_version}</Celda>
                          <Celda py="3" px="4">
                            <Text fontSize="sm">{item.norma_origen}</Text>
                            <Text fontSize="xs" color="fg.muted">
                              Vigencia desde{" "}
                              {formatoFecha(
                                item.instantanea.parametros.vigencia_desde,
                              )}
                            </Text>
                          </Celda>
                          <Celda py="3" px="4">
                            {!sellos ? (
                              <Text fontSize="sm" color="fg.muted">Sin sellos</Text>
                            ) : sellos.excesos.length === 0 ? (
                              <Text fontSize="sm" color="fg.muted">Sin excesos</Text>
                            ) : (
                              <HStack gap="1" flexWrap="wrap">
                                {sellos.excesos.map((exceso) => (
                                  <Badge
                                    key={exceso}
                                    colorPalette="red"
                                    variant="subtle"
                                    size="sm"
                                  >
                                    {exceso}
                                  </Badge>
                                ))}
                              </HStack>
                            )}
                          </Celda>
                          <Celda py="3" px="4" center>
                            <BotonAccion
                              accion="ver"
                              label="Ver snapshot"
                              onClick={() => setSeleccionadaId(item.id)}
                            />
                          </Celda>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              </Box>
              {seleccionada && (
                <DetalleEvaluacionGuardada
                  evaluacion={seleccionada}
                  onCerrar={() => setSeleccionadaId(null)}
                />
              )}
            </>
          )}
        </SeccionDetalle>
      )}
    </PaginaDetalle>
  );
}
