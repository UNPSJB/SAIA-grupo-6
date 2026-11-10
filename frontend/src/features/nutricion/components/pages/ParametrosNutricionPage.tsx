import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, Box, Button, Checkbox, HStack, InputGroup, Stack, Table, Text } from "@chakra-ui/react";
import { LuFileDown, LuFileUp, LuSlidersHorizontal, LuTextQuote } from "react-icons/lu";
import { Pagina, PestanasPagina, SeccionDetalle } from "../../../../components/ui/plantillas";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import {
  BannerError,
  BotonGuardar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  FormField,
  FormInput,
  FormNativeSelect,
  Paginacion,
  Tarjeta,
  TextoTruncado,
} from "../../../../components/ui/patrones";
import { toaster } from "../../../../components/ui/toaster";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import {
  buscarAlimentos,
  guardarParametros,
  importarAlimentos,
  listarBases,
  obtenerParametros,
} from "../../services/nutricionService";
import {
  CLAVES_NUTRIENTES,
  SUBNUTRIENTES,
  type AlimentoReferencia,
  type ParametroNutriente,
  type Parametros,
  type ResultadoImportacion,
} from "../../types/nutricion";
import { Aviso, Bloque } from "../piezas";

/**
 * Parámetros de la tabla nutricional y base de composición (E11).
 *
 * El redondeo, el Valor Diario, el umbral de "no significativo" y las leyendas
 * son parámetros y no constantes del código: la norma o el criterio del/la
 * profesional de referencia pueden cambiar.
 */
export function ParametrosNutricionPage() {
  return (
    <Pagina
      titulo="Parámetros nutricionales"
      descripcion="Cómo se calcula y se expresa la tabla de información nutricional, y de dónde salen los datos de los insumos."
    >
      <PestanasPagina
        pestanas={[
          { valor: "parametros", etiqueta: "Redondeo y valores diarios", contenido: <PanelParametros /> },
          { valor: "base", etiqueta: "Base de composición", contenido: <PanelBase /> },
        ]}
      />
    </Pagina>
  );
}

const vacioANull = (t: string | null) => (t === null || t.trim() === "" ? null : t.trim().replace(",", "."));
/** "2000.000" -> "2000"; lo que la persona está escribiendo ("0,") queda igual. */
const editable = (v: string | null) => (v === null ? "" : /^\d+\.\d*0$/.test(v) ? String(Number(v)) : v);

/** Cómo se vería un valor con estas reglas (sin considerar el umbral). */
function ejemplo(valor: number, n: ParametroNutriente) {
  const decimales = valor < 10 ? n.decimales_menor_10 : n.decimales_desde_10;
  return valor.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function PanelParametros() {
  const [datos, setDatos] = useState<Parametros | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerParametros().then(setDatos).catch((e: Error) => setError(e.message));
  }, []);

  if (!datos) return error ? <BannerError>{error}</BannerError> : <EstadoCargando>Cargando parámetros...</EstadoCargando>;

  const cambiarNutriente = (clave: string, campo: string, valor: string | number | null) =>
    setDatos({
      ...datos,
      nutrientes: datos.nutrientes.map((n) => (n.clave === clave ? { ...n, [campo]: valor } : n)),
    });
  const cambiarNumero = (clave: string, campo: string, valor: string) => {
    if (/^\d*[.,]?\d*$/.test(valor)) cambiarNutriente(clave, campo, valor);
  };

  const guardar = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const guardado = await guardarParametros({
        ...datos,
        generales: datos.generales,
        nutrientes: datos.nutrientes.map((n) => ({
          ...n,
          valor_diario: vacioANull(n.valor_diario),
          umbral_no_significativo: vacioANull(n.umbral_no_significativo),
        })),
      });
      setDatos(guardado);
      toaster.create({ type: "success", title: "Parámetros guardados. Las tablas se calculan con ellos desde ahora." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los parámetros.");
    } finally {
      setGuardando(false);
    }
  };

  const decimales = (valor: number, onChange: (v: number) => void, etiqueta: string) => (
    <FormNativeSelect value={valor} onChange={(e) => onChange(Number(e.target.value))} aria-label={etiqueta}>
      {[0, 1, 2, 3].map((d) => (
        <option key={d} value={d}>{d === 0 ? "Entero" : `${d} decimal${d > 1 ? "es" : ""}`}</option>
      ))}
    </FormNativeSelect>
  );

  return (
    <Box as="form" {...{ noValidate: true }} onSubmit={guardar}>
      {error && <BannerError mb="4">{error}</BannerError>}

      <Aviso tono="info" mb="5">
        Valores iniciales tomados de las Res. GMC 46/03 y 47/03 (MERCOSUR). Confirmalos con el/la profesional de
        referencia: cualquier cambio se aplica a todas las tablas desde el próximo cálculo.
      </Aviso>

      <Bloque
        titulo="Por nutriente"
        icono={LuSlidersHorizontal}
        ayuda="El umbral de «no significativo» se compara con el valor por porción: si es menor o igual, se declara «0,0» (y, si está activada, se nombra en la frase de «no significativo»). Azúcares y grasas trans no tienen Valor Diario en la norma («No corresponde»): su %VD queda en blanco."
      >
        <Box overflowX="auto" mx={{ base: "-4", md: "-5" }} mb={{ base: "-4", md: "-5" }} borderTopWidth="1px" borderColor="border.subtle">
          <Table.Root size="sm" minW="900px" data-sin-tarjetas="">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Nutriente</EncabezadoOscuro>
                <EncabezadoOscuro width="150px">Valor diario</EncabezadoOscuro>
                <EncabezadoOscuro width="150px">No significativo hasta</EncabezadoOscuro>
                <EncabezadoOscuro width="140px">Menores a 10</EncabezadoOscuro>
                <EncabezadoOscuro width="140px">Desde 10</EncabezadoOscuro>
                <EncabezadoOscuro width="130px" numero>Ejemplo</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {datos.nutrientes.map((n) => {
                const sub = SUBNUTRIENTES.includes(n.clave);
                const unidad = <Text fontSize="xs" color="fg.muted">{n.unidad}</Text>;
                return (
                  <Table.Row key={n.clave} borderBottomWidth="1px" borderColor="border.subtle">
                    <Celda py="2" px="4" pl={sub ? "8" : "4"}>
                      <Text fontWeight={sub ? "normal" : "medium"} color={sub ? "fg.muted" : "fg"}>{n.nombre}</Text>
                    </Celda>
                    <Celda py="2" px="3">
                      {!n.admite_vd ? (
                        <Text
                          fontSize="sm"
                          color="fg.muted"
                          title="La norma no fija Valor Diario para este nutriente: el %VD queda en blanco."
                        >
                          No corresponde
                        </Text>
                      ) : (
                      <InputGroup endElement={unidad}>
                        <FormInput
                          size="sm"
                          textAlign="right"
                          value={editable(n.valor_diario)}
                          onChange={(e) => cambiarNumero(n.clave, "valor_diario", e.target.value)}
                          inputMode="decimal"
                          placeholder="—"
                          title="Vacío: Valor Diario no establecido"
                          aria-label={`Valor diario de ${n.nombre}`}
                        />
                      </InputGroup>
                      )}
                    </Celda>
                    <Celda py="2" px="3">
                      <InputGroup endElement={unidad}>
                        <FormInput
                          size="sm"
                          textAlign="right"
                          value={editable(n.umbral_no_significativo)}
                          onChange={(e) => cambiarNumero(n.clave, "umbral_no_significativo", e.target.value)}
                          inputMode="decimal"
                          placeholder="—"
                          title="Vacío: sin umbral de no significativo"
                          aria-label={`Umbral de no significativo de ${n.nombre}`}
                        />
                      </InputGroup>
                    </Celda>
                    <Celda py="2" px="3">
                      {decimales(n.decimales_menor_10, (v) => cambiarNutriente(n.clave, "decimales_menor_10", v), `Decimales menores a 10 de ${n.nombre}`)}
                    </Celda>
                    <Celda py="2" px="3">
                      {decimales(n.decimales_desde_10, (v) => cambiarNutriente(n.clave, "decimales_desde_10", v), `Decimales desde 10 de ${n.nombre}`)}
                    </Celda>
                    <Celda py="2" px="4" numero color="fg.muted">
                      {ejemplo(4.56, n)} · {ejemplo(12.34, n)}
                    </Celda>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      </Bloque>

      <Bloque
        titulo="Notas y formato de la tabla"
        icono={LuTextQuote}
        ayuda="Notas optativas y opciones de formato que acompañan a la tabla nutricional de todos los productos. Cada campo explica para qué sirve, dónde aparece y qué pasa si se deja vacío. Lo obligatorio es fijo y no se configura: la leyenda de valores calculados, la del % Valor Diario, la nota «** Determinado en laboratorio.» (siempre que haya valores de laboratorio) y el factor de 4,2 para pasar de kcal a kJ. El %VD de azúcares y grasas trans va en blanco, sin nota."
      >
        <Stack gap="0" mx={{ base: "-4", md: "-5" }} mb={{ base: "-4", md: "-5" }} borderTopWidth="1px" borderColor="border.subtle">
          <CampoParametro
            titulo="Frase de «no significativo»"
            descripcion="Agrega al pie de la tabla la frase de la declaración nutricional simplificada de la Guía de Rotulado. El sistema arma la lista solo, en cada producto: nombra los nutrientes cuyo valor por porción queda por debajo de su umbral de «no significativo». Por ejemplo, en un pan de molde: «No aporta cantidades significativas de azúcares totales, azúcares añadidos y grasas trans.»."
            aparece={["Pie de la tabla, solo si hay nutrientes no significativos", "Impresión", "PDF"]}
            vacio="Desmarcada: esos nutrientes se siguen declarando «0,0» en la tabla, pero sin la frase al pie. Marcada (recomendado), se cumplen las dos referencias: el «0,0» del rótulo de la cátedra y la frase de la Guía de Rotulado."
          >
            <Checkbox.Root
              checked={datos.generales.frase_no_significativo}
              onCheckedChange={(e) => setDatos({ ...datos, generales: { ...datos.generales, frase_no_significativo: !!e.checked } })}
              colorPalette="brand"
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>Agregar la frase «No aporta cantidades significativas de…»</Checkbox.Label>
            </Checkbox.Root>
          </CampoParametro>

          <CampoParametro
            titulo="Columna por 100 g / 100 ml"
            descripcion="La norma exige declarar la «Cantidad por porción» y el «% VD». La columna por 100 g (o 100 ml) es optativa: sirve para comparar productos entre sí y la pide la historia de usuario de la tabla, pero el rótulo de referencia de la cátedra no la incluye."
            aparece={["Tabla en pantalla", "Impresión", "PDF"]}
            vacio="Desmarcada: la tabla muestra solo «Cantidad por porción» y «% VD»."
          >
            <Checkbox.Root
              checked={datos.generales.mostrar_por_100}
              onCheckedChange={(e) => setDatos({ ...datos, generales: { ...datos.generales, mostrar_por_100: !!e.checked } })}
              colorPalette="brand"
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>Mostrar también la columna por 100 g / 100 ml</Checkbox.Label>
            </Checkbox.Root>
          </CampoParametro>
        </Stack>
      </Bloque>

      <HStack justify="flex-end">
        <BotonGuardar loading={guardando}>Guardar parámetros</BotonGuardar>
      </HStack>
    </Box>
  );
}

const PAGE_SIZE_ALIMENTOS = 10;

const COLUMNAS_TABLA = [
  ["energia", "kcal"],
  ["carbohidratos", "Carbohid. (g)"],
  ["azucares_totales", "Azúcares (g)"],
  ["proteinas", "Proteínas (g)"],
  ["grasas_totales", "Grasas (g)"],
  ["grasas_saturadas", "Saturadas (g)"],
  ["fibra", "Fibra (g)"],
  ["sodio", "Sodio (mg)"],
] as const;

function descargarPlantilla() {
  const contenido = `codigo;nombre;${CLAVES_NUTRIENTES.join(";")}\nA001;Harina de trigo 000;341;72;0,3;0;10,5;1,2;0,2;0;2,7;2\n`;
  const enlace = URL.createObjectURL(new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = enlace;
  a.download = "plantilla_base_composicion.csv";
  a.click();
  URL.revokeObjectURL(enlace);
}

function PanelBase() {
  const [bases, setBases] = useState<string[]>([]);
  const [base, setBase] = useState("");
  const [texto, setTexto] = useState("");
  const buscar = useValorDebounced(texto);
  const [alimentos, setAlimentos] = useState<AlimentoReferencia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [nombreBase, setNombreBase] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const selector = useRef<HTMLInputElement>(null);

  const { paginados, page, setPage, hayVariasPaginas } = usePaginas(
    alimentos,
    PAGE_SIZE_ALIMENTOS,
    `${buscar}|${base}|${recarga}`,
  );
  const limpiarFiltros = () => {
    setTexto("");
    setBase("");
  };
  const chips = chipsDeFiltros([
    { clave: "busqueda", etiqueta: "Búsqueda", valor: texto, recortar: true, onQuitar: () => setTexto("") },
    { clave: "base", etiqueta: "Base", valor: base, onQuitar: () => setBase("") },
  ]);

  useEffect(() => {
    listarBases().then(setBases).catch(() => setBases([]));
  }, [recarga]);

  useEffect(() => {
    let vigente = true;
    // Hasta 500 alimentos (el máximo de la API); la tabla los pagina de a 10.
    buscarAlimentos(buscar, base, 500)
      .then((r) => vigente && setAlimentos(r))
      .catch((e: Error) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [buscar, base, recarga]);

  const importar = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (!nombreBase.trim() || !archivo) return setError("Indicá el nombre de la base y elegí el archivo CSV.");
    setImportando(true);
    setError(null);
    try {
      setResultado(await importarAlimentos(nombreBase.trim(), archivo));
      setArchivo(null);
      if (selector.current) selector.current.value = "";
      setRecarga((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar el archivo.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <>
      {error && <BannerError mb="4">{error}</BannerError>}

      <Bloque
        titulo="Importar una base de composición"
        icono={LuFileUp}
        ayuda="La licencia y el formato de SARA 2 todavía no están verificados: la base se importa desde un CSV. La que viene cargada es solo de ejemplo."
        acciones={
          <Button size="sm" variant="ghost" colorPalette="brand" onClick={descargarPlantilla}>
            <LuFileDown aria-hidden /> Descargar plantilla CSV
          </Button>
        }
      >
        <Box as="form" {...{ noValidate: true }} onSubmit={importar}>
          <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr auto" }} gap="4" alignItems="end">
            <FormField label="Nombre de la base" required mb="0">
              <FormInput value={nombreBase} onChange={(e) => setNombreBase(e.target.value)} maxLength={100} placeholder="Ej: SARA 2" list="bases-existentes" />
              <datalist id="bases-existentes">
                {bases.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Archivo CSV" required mb="0">
              <input
                ref={selector}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              <HStack
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selector.current?.click()}
                w="100%"
                h="10"
                px="3"
                gap="3"
                borderWidth="2px"
                borderStyle="dashed"
                borderColor="brand.300"
                rounded="lg"
                cursor="pointer"
                onClick={() => selector.current?.click()}
                _hover={{ borderColor: "brand.500", bg: "brand.50" }}
              >
                <LuFileUp aria-hidden />
                <Text fontSize="sm" color={archivo ? "fg" : "fg.muted"} lineClamp={1}>
                  {archivo ? archivo.name : "Elegir archivo…"}
                </Text>
              </HStack>
            </FormField>
            <Button type="submit" colorPalette="brand" loading={importando}>
              Importar
            </Button>
          </Box>
          <Text fontSize="xs" color="fg.muted" mt="3">
            Una fila por alimento, valores por 100 g (energía en kcal, sodio en mg). Columnas: «nombre» (obligatoria),
            «codigo» y una por nutriente con el nombre de la plantilla. Si el alimento ya existe en esa base, se actualiza.
          </Text>
        </Box>
        {resultado && (
          <Aviso tono={resultado.errores.length ? "alerta" : "ok"} mt="4" titulo={`Base «${resultado.base}» importada`}>
            {resultado.creados} alimentos nuevos y {resultado.actualizados} actualizados.
            {resultado.errores.length > 0 && (
              <Stack gap="0.5" mt="2">
                {resultado.errores.map((e) => (
                  <Text key={e} fontSize="xs">{e}</Text>
                ))}
              </Stack>
            )}
          </Aviso>
        )}
      </Bloque>

      <SeccionDetalle
        sinMarco
        mb="0"
        titulo="Alimentos cargados"
        descripcion="Valores por 100 g. Son los que se ofrecen al elegir «Base de composición» en los datos de un insumo."
      >
        <BarraFiltros
          busqueda={<CampoBusqueda valor={texto} onCambio={setTexto} placeholder="Nombre del alimento..." />}
          filtros={
            <FiltroSelect
              label="Base"
              valor={base}
              onCambio={setBase}
              opciones={bases.map((b) => ({ valor: b, etiqueta: b }))}
              todos="Todas las bases"
              minW="260px"
            />
          }
        />
        <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarFiltros} />

        {alimentos.length === 0 ? (
          chips.length > 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarFiltros}>
              No hay alimentos que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <EstadoVacio>Todavía no hay alimentos cargados: importá una base desde el formulario de arriba.</EstadoVacio>
          )
        ) : (
          <>
            <Tarjeta overflowX="auto">
              <Table.Root variant="outline" w="100%" minW="960px">
                <Table.Header>
                  <FilaEncabezado>
                    <EncabezadoOscuro width="220px">Alimento</EncabezadoOscuro>
                    <EncabezadoOscuro width="180px">Base</EncabezadoOscuro>
                    {COLUMNAS_TABLA.map(([k, etiqueta]) => (
                      <EncabezadoOscuro key={k} numero>{etiqueta}</EncabezadoOscuro>
                    ))}
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {paginados.map((a) => (
                    <Table.Row key={a.id}>
                      <Celda>
                        <TextoTruncado texto={a.nombre} lineClamp={1} fontWeight="medium" />
                      </Celda>
                      <Celda>
                        <TextoTruncado texto={a.base} lineClamp={1} fontSize="xs" color="fg.muted" title={a.base} />
                      </Celda>
                      {COLUMNAS_TABLA.map(([k]) => (
                        <Celda key={k} numero>{formatoCantidad(a[k], "—")}</Celda>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Tarjeta>
            {hayVariasPaginas && (
              <Paginacion count={alimentos.length} pageSize={PAGE_SIZE_ALIMENTOS} page={page} onPageChange={setPage} />
            )}
          </>
        )}
      </SeccionDetalle>
    </>
  );
}


/**
 * Un parámetro con su explicación: a la izquierda qué es, dónde aparece y qué
 * pasa si queda vacío; a la derecha el control.
 */
function CampoParametro({
  titulo,
  descripcion,
  aparece,
  vacio,
  children,
}: {
  titulo: string;
  descripcion: ReactNode;
  aparece: string[];
  vacio: string;
  children: ReactNode;
}) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1.15fr) minmax(0, 1fr)" }}
      gap={{ base: "3", lg: "6" }}
      px={{ base: "4", md: "5" }}
      py="5"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      _last={{ borderBottomWidth: "0" }}
    >
      <Box minW="0">
        <HStack gap="2" mb="1">
          <Text fontWeight="semibold">{titulo}</Text>
          <Badge size="sm" variant="subtle" colorPalette="gray">
            Opcional
          </Badge>
        </HStack>
        <Text fontSize="sm" color="fg.muted" mb="3">{descripcion}</Text>
        <HStack gap="1.5" flexWrap="wrap" mb="2">
          <Text fontSize="xs" fontWeight="semibold" color="fg.muted">Aparece en:</Text>
          {aparece.map((lugar) => (
            <Badge key={lugar} size="sm" variant="outline" colorPalette="teal">{lugar}</Badge>
          ))}
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          <Text as="span" fontWeight="semibold">Si queda vacío: </Text>
          {vacio}
        </Text>
      </Box>
      <Box minW="0" alignSelf="center">{children}</Box>
    </Box>
  );
}
