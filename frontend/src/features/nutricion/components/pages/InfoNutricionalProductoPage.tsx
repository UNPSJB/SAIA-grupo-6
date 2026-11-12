import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { LuCalculator, LuDownload, LuPrinter, LuTag, LuUtensils } from "react-icons/lu";
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
  FormInput,
  FormNativeSelect,
} from "../../../../components/ui/patrones";
import { toaster } from "../../../../components/ui/toaster";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { formatoFechaHora } from "../../../../common/utils/fechas";
import {
  descargarPdf,
  guardarConfiguracionProducto,
  obtenerInfoNutricional,
} from "../../services/nutricionService";
import type { InfoNutricional } from "../../types/nutricion";
import { DatosNutricionalesDialog } from "../DatosNutricionalesDialog";
import { LaboratorioProducto } from "../LaboratorioProducto";
import { Aviso, Bloque } from "../piezas";
import { TablaNutricional } from "../TablaNutricional";

const limpio = (v: string | null) => (v === null ? "" : String(Number(v)));
const aDecimal = (t: string) => (t.trim() ? t.trim().replace(",", ".") : null);
const valido = (t: string) => !t.trim() || (Number.isFinite(Number(aDecimal(t))) && Number(aDecimal(t)) > 0);

const MASA = ["kg", "g", "mg", "tn", "kilogramo", "gramo"];
const VOLUMEN = ["l", "ml", "cm³", "cm3", "cc", "litro", "mililitro"];

/**
 * Información nutricional de un producto (E11, historias 2, 3 y 4).
 *
 * Se recalcula cada vez que se abre y cada vez que se completa un dato:
 * nunca queda una tabla vieja guardada que parezca vigente.
 */
export function InfoNutricionalProductoPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const productoId = Number(id);
  const [info, setInfo] = useState<InfoNutricional | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completar, setCompletar] = useState<number | null>(null);
  // Consulta de solo lectura desde el detalle del cálculo.
  const [consultar, setConsultar] = useState<number | null>(null);
  const [descargando, setDescargando] = useState(false);

  const recalcular = useCallback(async () => {
    try {
      setInfo(await obtenerInfoNutricional(productoId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo calcular la información nutricional.");
    } finally {
      setCargando(false);
    }
  }, [productoId]);

  // Carga inicial; después, `recalcular` se llama al guardar un dato.
  useEffect(() => {
    let vigente = true;
    obtenerInfoNutricional(productoId)
      .then((datos) => vigente && setInfo(datos))
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [productoId]);

  const exportar = async () => {
    if (!info) return;
    setDescargando(true);
    try {
      await descargarPdf(productoId, info.producto);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setDescargando(false);
    }
  };

  const estado =
    info?.estado === "completa" ? (
      <EtiquetaEstado tono="ok">Completa</EtiquetaEstado>
    ) : info ? (
      <EtiquetaEstado tono="peligro">Incompleta</EtiquetaEstado>
    ) : null;

  const pendientes = info ? info.incompletos.length + info.problemas.length : 0;

  return (
    <PaginaDetalle
      ancho="completo"
      volver={{ a: "/productos", etiqueta: "Productos", historial: true }}
      titulo={info ? info.producto : "Información nutricional"}
      descripcion="Tabla de información nutricional calculada a partir de la receta vigente."
      estado={estado}
      acciones={
        info && info.estado !== "sin_receta" ? (
          <>
            <Button
              variant="outline"
              colorPalette="brand"
              onClick={() => navigate(`/productos/${productoId}/rotulado-frontal`)}
            >
              <LuTag aria-hidden /> Rotulado frontal
            </Button>
            <Button variant="outline" colorPalette="brand" onClick={() => window.print()}>
              <LuPrinter aria-hidden /> Imprimir
            </Button>
            <Button colorPalette="brand" onClick={exportar} loading={descargando}>
              <LuDownload aria-hidden /> Descargar PDF
            </Button>
          </>
        ) : undefined
      }
    >
      {error && <BannerError mb="4">{error}</BannerError>}
      {cargando && <EstadoCargando>Calculando información nutricional...</EstadoCargando>}

      {info && info.estado === "sin_receta" && (
        <Aviso
          tono="info"
          titulo="El producto todavía no tiene receta"
          acciones={
            <Button size="sm" colorPalette="brand" onClick={() => navigate("/recetas/nueva")}>
              Crear receta
            </Button>
          }
        >
          La información nutricional se calcula a partir de los ingredientes de la receta y su rendimiento.
        </Aviso>
      )}

      {info && info.estado !== "sin_receta" && (
        <>
          {pendientes > 0 && (
            <Box mb="6" borderWidth="1px" borderColor="red.200" bg="red.50" rounded="lg" overflow="hidden">
              <Box px="5" py="4" borderBottomWidth="1px" borderColor="red.200">
                <Text fontWeight="semibold" color="red.800">
                  La tabla está incompleta: {pendientes === 1 ? "falta 1 dato" : `faltan ${pendientes} datos`}
                </Text>
                <Text fontSize="sm" color="red.700">
                  Mientras tanto se marca como incompleta en la pantalla, al imprimir y en el PDF. Al completar un dato
                  se recalcula sola.
                </Text>
              </Box>
              <Stack gap="0" bg="bg.panel">
                {info.incompletos.map((ing) => (
                  <HStack
                    key={ing.insumo_id}
                    justify="space-between"
                    gap="3"
                    flexWrap="wrap"
                    px="5"
                    py="3"
                    borderBottomWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Box minW="0" flex="1">
                      <Text fontWeight="medium">
                        {ing.nombre}{" "}
                        <Text as="span" fontWeight="normal" color="fg.muted" fontSize="sm">
                          · {ing.tipo === "aditivo" ? "aditivo con aporte de energía o sodio" : "ingrediente"}
                        </Text>
                      </Text>
                      <Text fontSize="sm" color="red.700">Falta: {ing.faltantes.join(", ")}</Text>
                    </Box>
                    <Button size="sm" colorPalette="brand" onClick={() => setCompletar(ing.insumo_id)}>
                      Completar datos
                    </Button>
                  </HStack>
                ))}
                {info.problemas.map((p) => (
                  <HStack key={p} px="5" py="3" borderBottomWidth="1px" borderColor="border.subtle">
                    <Text fontSize="sm" color="red.700">
                      {p} <Text as="span" color="fg.muted">(se completa en «Porción declarada»)</Text>
                    </Text>
                  </HStack>
                ))}
              </Stack>
            </Box>
          )}

          {/*
            La tabla toma solo su ancho (como un rótulo, ~620 px) y la columna
            de la derecha se queda con el resto: antes la tarjeta de la tabla se
            estiraba y dejaba un hueco blanco a su derecha. El análisis de
            laboratorio va abajo, a lo ancho, para que la columna de la derecha
            no quede mucho más alta que la tabla.
          */}
          <Box
            display="grid"
            gridTemplateColumns={{
              base: "minmax(0, 1fr)",
              lg: "minmax(0, 1fr) 300px",
              xl: "fit-content(720px) minmax(340px, 1fr)",
            }}
            gap="6"
            alignItems="start"
          >
            <SeccionDetalle titulo="Tabla nutricional" mb="0" minW="0">
              <TablaNutricional info={info} />
            </SeccionDetalle>

            <Stack gap="6">
              <SeccionDetalle titulo="Resumen del cálculo" mb="0">
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap="4">
                  <DatoDetalle etiqueta="Receta">Versión {info.version?.numero}</DatoDetalle>
                  <DatoDetalle etiqueta="Rendimiento">
                    {formatoCantidad(info.version?.rendimiento)} {info.version?.unidad}
                  </DatoDetalle>
                  <DatoDetalle etiqueta="Base de cálculo">
                    {info.cantidad_base ? `${formatoCantidad(info.cantidad_base)} ${info.expresar_en}` : "Sin calcular"}
                  </DatoDetalle>
                  <DatoDetalle etiqueta="Calculada">{formatoFechaHora(info.calculado_en)}</DatoDetalle>
                </Box>
              </SeccionDetalle>
              <ConfiguracionProducto key={JSON.stringify(info.configuracion)} info={info} onGuardado={recalcular} />
            </Stack>
          </Box>

          <Box mt="6">
            <LaboratorioProducto key={JSON.stringify(info.laboratorio)} info={info} onGuardado={recalcular} />
          </Box>

          <Bloque
            mt="6"
            titulo="Detalle del cálculo"
            icono={LuCalculator}
            ayuda="Se suma el aporte de cada insumo según su cantidad en la receta y se divide por el rendimiento. No se modelan pérdidas por cocción."
          >
            <Box overflowX="auto" mx={{ base: "-4", md: "-5" }} mb={{ base: "-4", md: "-5" }} borderTopWidth="1px" borderColor="border.subtle">
              <Table.Root size="sm" minW="640px">
                <Table.Header>
                  <FilaEncabezado>
                    <EncabezadoOscuro>Insumo</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="media" numero>Cantidad</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="media" numero>En gramos</EncabezadoOscuro>
                    <EncabezadoOscuro>Datos nutricionales</EncabezadoOscuro>
                    <EncabezadoOscuro center ancho="angosta">Acción</EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {info.ingredientes.map((ing) => (
                    <Table.Row key={ing.insumo_id} borderBottomWidth="1px" borderColor="border.subtle">
                      <Celda py="2.5" px="4">
                        <Text fontWeight="medium">{ing.nombre}</Text>
                        <Text fontSize="xs" color="fg.muted">{ing.tipo === "aditivo" ? "Aditivo" : "Ingrediente"}</Text>
                      </Celda>
                      <Celda py="2.5" px="4" numero>{formatoCantidad(ing.cantidad)} {ing.unidad}</Celda>
                      <Celda py="2.5" px="4" numero>{ing.gramos ? `${formatoCantidad(ing.gramos)} g` : "—"}</Celda>
                      <Celda py="2.5" px="4">
                        {!ing.exige_datos ? (
                          <EtiquetaEstado tono="neutro">
                            {ing.incluido ? "Suma sus datos cargados" : "No requiere datos"}
                          </EtiquetaEstado>
                        ) : ing.completo ? (
                          <EtiquetaEstado tono="ok">Completos</EtiquetaEstado>
                        ) : (
                          <EtiquetaEstado tono="alerta">Incompletos</EtiquetaEstado>
                        )}
                      </Celda>
                      <Celda py="2.5" px="4" center>
                        <BotonAccion
                          accion="ver"
                          label={`Ver datos nutricionales de ${ing.nombre}`}
                          onClick={() => setConsultar(ing.insumo_id)}
                        />
                      </Celda>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Bloque>
        </>
      )}

      {consultar !== null && (
        <DatosNutricionalesDialog insumoId={consultar} soloLectura onCerrar={() => setConsultar(null)} />
      )}

      {completar !== null && (
        <DatosNutricionalesDialog
          insumoId={completar}
          onCerrar={() => setCompletar(null)}
          onGuardado={() => {
            setCompletar(null);
            void recalcular();
          }}
        />
      )}
    </PaginaDetalle>
  );
}

function ConfiguracionProducto({ info, onGuardado }: { info: InfoNutricional; onGuardado: () => Promise<void> }) {
  const cfg = info.configuracion;
  const [expresarEn, setExpresarEn] = useState<"g" | "ml">(cfg.expresar_en);
  const [porcion, setPorcion] = useState(limpio(cfg.porcion));
  const [medida, setMedida] = useState(cfg.medida_casera ?? "");
  const [peso, setPeso] = useState(limpio(cfg.peso_unidad_g));
  const [densidad, setDensidad] = useState(limpio(cfg.densidad_g_ml));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Qué conversión necesita el rendimiento de la receta para llegar a g o ml.
  const unidad = (info.version?.unidad ?? "").toLowerCase();
  const esMasa = MASA.includes(unidad);
  const esVolumen = VOLUMEN.includes(unidad);
  const pidePeso = (!esMasa && !esVolumen) || !!cfg.peso_unidad_g;
  const pideDensidad = (expresarEn === "g" ? esVolumen : !esVolumen) || !!cfg.densidad_g_ml;

  const guardar = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (![porcion, peso, densidad].every(valido)) {
      return setError("Porción, peso y densidad tienen que ser números mayores que cero.");
    }
    setGuardando(true);
    setError(null);
    try {
      await guardarConfiguracionProducto(info.producto_id, {
        expresar_en: expresarEn,
        porcion: aDecimal(porcion),
        medida_casera: medida.trim() || null,
        peso_unidad_g: pidePeso ? aDecimal(peso) : null,
        densidad_g_ml: pideDensidad ? aDecimal(densidad) : null,
      });
      toaster.create({ type: "success", title: "Porción guardada. La tabla se recalculó." });
      await onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los datos.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SeccionDetalle titulo="Porción declarada" mb="0">
      <Box as="form" {...{ noValidate: true }} onSubmit={guardar}>
        {error && <BannerError mb="4">{error}</BannerError>}
        <FormField label="Tabla expresada por" mb="4">
          <FormNativeSelect value={expresarEn} onChange={(e) => setExpresarEn(e.target.value as "g" | "ml")}>
            <option value="g">100 g (sólidos)</option>
            <option value="ml">100 ml (líquidos)</option>
          </FormNativeSelect>
        </FormField>
        <Box display="grid" gridTemplateColumns="120px 1fr" gap="3">
          <FormField label={`Porción (${expresarEn})`} required mb="4">
            <FormInput value={porcion} onChange={(e) => setPorcion(e.target.value)} inputMode="decimal" placeholder="50" textAlign="right" />
          </FormField>
          <FormField label="Medida casera" required mb="4">
            <FormInput value={medida} onChange={(e) => setMedida(e.target.value)} maxLength={100} placeholder="Ej: 2 rebanadas" />
          </FormField>
        </Box>
        {(pidePeso || pideDensidad) && (
          <Box p="3" mb="4" bg="bg.subtle" rounded="md">
            <HStack gap="2" mb="3" color="fg.muted" fontSize="xs">
              <LuUtensils aria-hidden />
              <Text>
                La receta rinde en {info.version?.unidad}: para llegar a 100 {expresarEn} hace falta
                {pidePeso && pideDensidad ? " el peso por unidad y la densidad." : pidePeso ? " el peso por unidad." : " la densidad."}
              </Text>
            </HStack>
            {pidePeso && (
              <FormField label="Peso por unidad de producto (g)" mb={pideDensidad ? "3" : "0"}>
                <FormInput value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" textAlign="right" bg="bg.panel" />
              </FormField>
            )}
            {pideDensidad && (
              <FormField label="Densidad del producto (g/ml)" mb="0">
                <FormInput value={densidad} onChange={(e) => setDensidad(e.target.value)} inputMode="decimal" textAlign="right" bg="bg.panel" />
              </FormField>
            )}
          </Box>
        )}
        <BotonGuardar loading={guardando} w="100%">Guardar y recalcular</BotonGuardar>
      </Box>
    </SeccionDetalle>
  );
}
