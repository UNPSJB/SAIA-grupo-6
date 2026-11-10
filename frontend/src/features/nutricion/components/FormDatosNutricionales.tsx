import { useEffect, useState } from "react";
import { Badge, Box, Button, Checkbox, Heading, HStack, InputGroup, Stack, Table, Text } from "@chakra-ui/react";
import { LuBookOpen, LuDownload, LuFlaskConical, LuListChecks, LuScale } from "react-icons/lu";
import {
  BannerError,
  BotonCancelar,
  BotonGuardar,
  Celda,
  EncabezadoOscuro,
  EtiquetaEstado,
  FilaEncabezado,
  FormField,
  FormInput,
  FormNativeSelect,
  MensajeError,
} from "../../../components/ui/patrones";
import { formatoFechaHora } from "../../../common/utils/fechas";
import { formatoCantidad } from "../../../common/utils/numeros";
import { toaster } from "../../../components/ui/toaster";
import { guardarDatosInsumo, obtenerDatosInsumo, obtenerParametros } from "../services/nutricionService";
import {
  FUENTES,
  SUBNUTRIENTES,
  type AlimentoReferencia,
  type ClaveNutriente,
  type DatosNutricionales,
  type Fuente,
  type ParametroNutriente,
} from "../types/nutricion";
import { BuscadorAlimento } from "./BuscadorAlimento";
import { Aviso, BarraAvance, Bloque } from "./piezas";

interface Fila {
  valor: string;
  fuente: Fuente;
  referencia: string | null;
  alimento_referencia_id: number | null;
  /**
   * Escrito a mano en esta edición: no tiene fuente propia y sigue la que esté
   * elegida arriba (si arriba cambia, cambia con ella). Los valores ya
   * guardados o tomados de un alimento conservan la suya.
   */
  manual: boolean;
}

/** Solo dígitos y un separador decimal (coma o punto). */
const PARCIAL_NUMERICO = /^\d*[.,]?\d*$/;

const ETIQUETA_FUENTE = Object.fromEntries(FUENTES.map((f) => [f.valor, f.etiqueta]));
const FUENTE_CORTA: Record<Fuente, string> = {
  base_referencia: "Base de composición",
  rotulo_proveedor: "Rótulo del proveedor",
  bibliografia: "Bibliografía",
  valor_propio: "Valor propio",
};

/** "12.5000" -> "12.5" para editar sin ceros de sobra. */
function limpio(valor: string | null): string {
  if (valor === null || valor === "") return "";
  const n = Number(valor);
  return Number.isFinite(n) ? String(n) : valor;
}

function numeroValido(texto: string): boolean {
  const normalizado = texto.trim().replace(",", ".");
  return normalizado !== "" && Number.isFinite(Number(normalizado)) && Number(normalizado) >= 0;
}

const aDecimal = (texto: string) => texto.trim().replace(",", ".");

interface Props {
  insumoId: number;
  /** Se llama con los datos guardados (el diálogo se cierra, la página recalcula). */
  onGuardado?: (datos: DatosNutricionales) => void;
  onCancel?: () => void;
  /**
   * Solo para consultar: los campos quedan congelados y no hay botón de
   * guardar. Lo usa el detalle del cálculo del producto; los datos se editan
   * desde Insumos → Datos nutricionales (o desde "Completar datos" si faltan).
   */
  soloLectura?: boolean;
}

/**
 * Carga de los datos nutricionales por 100 g de un insumo (E11, historia 1).
 *
 * Arriba se elige la fuente: de una base de composición se toman todos los
 * valores del alimento elegido; con rótulo, bibliografía o valor propio se
 * escriben a mano. Cada valor guarda su fuente y fecha; si se cambia un número
 * respecto de lo que dijo la fuente, queda marcado como modificado con quién
 * lo hizo.
 */
export function FormDatosNutricionales({ insumoId, onGuardado, onCancel, soloLectura = false }: Props) {
  const [datos, setDatos] = useState<DatosNutricionales | null>(null);
  const [parametros, setParametros] = useState<ParametroNutriente[]>([]);
  const [filas, setFilas] = useState<Record<string, Fila>>({});
  const [peso, setPeso] = useState("");
  const [densidad, setDensidad] = useState("");
  const [aporta, setAporta] = useState(false);
  const [anadidos, setAnadidos] = useState(false);
  const [fuente, setFuente] = useState<Fuente>("rotulo_proveedor");
  const [referencia, setReferencia] = useState("");
  const [alimento, setAlimento] = useState<AlimentoReferencia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);

  const inicializar = (d: DatosNutricionales) => {
    setDatos(d);
    setFilas(
      Object.fromEntries(
        d.valores.map((v) => [
          v.nutriente,
          {
            valor: limpio(v.valor),
            fuente: v.fuente,
            referencia: v.referencia,
            alimento_referencia_id: v.alimento_referencia_id,
            manual: false,
          },
        ]),
      ),
    );
    setPeso(limpio(d.peso_unidad_g));
    setDensidad(limpio(d.densidad_g_ml));
    setAporta(d.aporta_energia_sodio);
    setAnadidos(d.azucares_son_anadidos);
    // La fuente de arriba arranca en la que más se usó al cargar.
    const primera = d.valores[0];
    if (primera) {
      setFuente(primera.fuente);
      if (primera.fuente !== "base_referencia") setReferencia(primera.referencia ?? "");
    }
  };

  useEffect(() => {
    let vigente = true;
    Promise.all([obtenerDatosInsumo(insumoId), obtenerParametros()])
      .then(([d, p]) => {
        if (!vigente) return;
        setParametros(p.nutrientes);
        inicializar(d);
      })
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [insumoId]);

  if (cargando) return <Text color="fg.muted" fontStyle="italic">Cargando datos nutricionales...</Text>;
  if (!datos) return <BannerError>{error ?? "No se pudieron cargar los datos."}</BannerError>;

  const admitidos = parametros.filter((p) => datos.nutrientes_admitidos.includes(p.clave));
  const guardados = Object.fromEntries(datos.valores.map((v) => [v.nutriente, v]));
  const esAditivo = datos.tipo === "aditivo";
  // Ingrediente cuyo azúcar es todo añadido: sus azúcares añadidos son los
  // totales (guía de rotulado) y no se cargan aparte.
  const derivado = (clave: string) => anadidos && !esAditivo && clave === "azucares_anadidos";

  /** Fuente con la que se va a guardar la fila. */
  const fuenteDe = (f: Fila): Pick<Fila, "fuente" | "referencia" | "alimento_referencia_id"> => {
    if (!f.manual) return f;
    // Con la base elegida arriba, lo escrito a mano no viene de la base: es valor propio.
    if (fuente === "base_referencia") {
      return { fuente: "valor_propio", referencia: null, alimento_referencia_id: null };
    }
    return { fuente, referencia: referencia.trim() || null, alimento_referencia_id: null };
  };
  const arriba = fuenteDe({ valor: "", fuente, referencia: null, alimento_referencia_id: null, manual: true });
  // Valores guardados (o tomados de un alimento) con una fuente distinta de la de arriba.
  const conOtraFuente = Object.values(filas).filter(
    (f) => !f.manual && (f.fuente !== arriba.fuente || (f.referencia ?? null) !== arriba.referencia),
  ).length;

  const aplicar = () => {
    if (fuente === "base_referencia") {
      if (!alimento) return setError("Elegí un alimento de la base de composición.");
      const nuevas = { ...filas };
      let sinDato = 0;
      for (const p of admitidos) {
        const valor = alimento[p.clave as ClaveNutriente];
        if (valor === null || valor === undefined) {
          sinDato += 1;
          continue;
        }
        nuevas[p.clave] = {
          valor: limpio(valor),
          fuente,
          referencia: `${alimento.base}: ${alimento.nombre}`,
          alimento_referencia_id: alimento.id,
          manual: false,
        };
      }
      setFilas(nuevas);
      setError(
        sinDato > 0
          ? `El alimento no tiene ${sinDato} de los nutrientes: completalos con otra fuente.`
          : null,
      );
      return;
    }
    // Rótulo, bibliografía o valor propio: los valores guardados pasan a seguir la fuente de arriba.
    const nuevas: Record<string, Fila> = {};
    for (const [clave, fila] of Object.entries(filas)) {
      nuevas[clave] = { ...fila, manual: true };
    }
    setFilas(nuevas);
    setError(null);
  };

  const cambiarValor = (clave: string, valor: string) => {
    if (!PARCIAL_NUMERICO.test(valor.trim())) return;
    setFilas((previas) => {
      const actual = previas[clave];
      if (valor.trim() === "") {
        const resto = { ...previas };
        delete resto[clave];
        return resto;
      }
      // Un valor guardado conserva su fuente (si cambia el número, queda "modificado").
      if (actual) return { ...previas, [clave]: { ...actual, valor } };
      return {
        ...previas,
        [clave]: { valor, fuente, referencia: null, alimento_referencia_id: null, manual: true },
      };
    });
  };

  const invalidos = Object.entries(filas).filter(([, f]) => !numeroValido(f.valor));
  const necesitaDensidad = datos.unidad_tipo === "volumen";
  const necesitaPeso = datos.unidad_tipo === "unidad";

  const handleSubmit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (soloLectura) return;
    setIntentado(true);
    if (invalidos.length > 0) return;
    if ((peso && !numeroValido(peso)) || (densidad && !numeroValido(densidad))) return;
    setGuardando(true);
    setError(null);
    try {
      const guardado = await guardarDatosInsumo(insumoId, {
        peso_unidad_g: peso ? aDecimal(peso) : null,
        densidad_g_ml: densidad ? aDecimal(densidad) : null,
        aporta_energia_sodio: aporta,
        azucares_son_anadidos: anadidos,
        valores: Object.entries(filas)
          .filter(([nutriente]) => !derivado(nutriente))
          .map(([nutriente, f]) => ({
          nutriente,
          valor: aDecimal(f.valor),
          ...fuenteDe(f),
        })),
      });
      inicializar(guardado);
      setIntentado(false);
      toaster.create({ type: "success", title: "Datos nutricionales guardados." });
      onGuardado?.(guardado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los datos.");
    } finally {
      setGuardando(false);
    }
  };

  const cargados = admitidos.filter((p) => {
    const clave = derivado(p.clave) ? "azucares_totales" : p.clave;
    return filas[clave] && numeroValido(filas[clave].valor);
  }).length;
  const hayCambios = anadidos !== datos.azucares_son_anadidos || admitidos.some((p) => {
    if (derivado(p.clave)) return false;
    const fila = filas[p.clave];
    const guardado = guardados[p.clave];
    if (!fila) return Boolean(guardado);
    const efectiva = fuenteDe(fila);
    return (
      !guardado ||
      efectiva.fuente !== guardado.fuente ||
      (efectiva.referencia ?? null) !== (guardado.referencia ?? null) ||
      Number(aDecimal(fila.valor)) !== Number(guardado.valor)
    );
  });

  // Fuente que comparten todas las filas guardadas sin cambios: se muestra una
  // sola vez arriba de la tabla en lugar de repetirla en cada renglón.
  const comun = (() => {
    const lista = datos.valores;
    if (lista.length === 0) return null;
    const primera = lista[0];
    const iguales = lista.every((v) => v.fuente === primera.fuente && (v.referencia ?? null) === (primera.referencia ?? null));
    return iguales ? primera : null;
  })();

  return (
    <Box as="form" {...{ noValidate: true }} onSubmit={handleSubmit}>
      {error && <BannerError mb="4">{error}</BannerError>}

      {/* Encabezado: qué insumo es y cómo están sus datos. */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", md: "1fr 240px" }}
        gap="4"
        alignItems="center"
        pb="5"
        mb="5"
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
        <Box minW="0">
          <HStack gap="2" flexWrap="wrap" mb="1">
            <Heading as="h3" size="lg" color="fg">{datos.nombre}</Heading>
            <Badge colorPalette={esAditivo ? "purple" : "gray"} variant="subtle">
              {esAditivo ? "Aditivo" : "Ingrediente"}
            </Badge>
            {datos.completitud.completo ? (
              <EtiquetaEstado tono="ok">
                {datos.completitud.exige_datos ? "Datos completos" : "No requiere datos"}
              </EtiquetaEstado>
            ) : (
              <EtiquetaEstado tono="alerta">Datos incompletos</EtiquetaEstado>
            )}
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            Se usa en las recetas en <strong>{datos.unidad}</strong>. Los valores se cargan siempre por 100 g.
          </Text>
        </Box>
        {(datos.completitud.exige_datos || cargados > 0) && <BarraAvance valor={cargados} total={admitidos.length} />}
      </Box>

      {!datos.completitud.completo && (
        <Aviso tono="alerta" titulo="Para usarlo en el cálculo falta:" mb="5">
          {datos.completitud.faltantes.join(", ")}.
        </Aviso>
      )}

      {esAditivo && (
        <Bloque
          titulo="Aporte nutricional del aditivo"
          icono={LuFlaskConical}
          ayuda="Por defecto un aditivo no lleva datos nutricionales. Si aporta energía o sodio de forma relevante (bicarbonato, conservantes con sodio), marcalo: entonces se le exigen esos dos valores."
        >
          <Checkbox.Root checked={aporta} onCheckedChange={(e) => setAporta(!!e.checked)} colorPalette="brand" disabled={soloLectura}>
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label fontWeight="medium">Aporta energía o sodio de forma relevante</Checkbox.Label>
          </Checkbox.Root>
        </Bloque>
      )}

      {(necesitaDensidad || necesitaPeso || datos.unidad_tipo === null) && (
        <Bloque
          titulo="Equivalencia a gramos"
          icono={LuScale}
          ayuda={`La receta usa este insumo en ${datos.unidad}; para sumar su aporte hay que saber cuántos gramos son.`}
        >
          {datos.unidad_tipo === null ? (
            <Aviso tono="peligro">
              La unidad «{datos.unidad}» no se puede pasar a gramos. Cambiala en el maestro de insumos para poder
              usar este insumo en el cálculo.
            </Aviso>
          ) : necesitaDensidad ? (
            <FormField label="Densidad" required mb="0" invalid={intentado && !!densidad && !numeroValido(densidad)}>
              <InputGroup endElement={<Text fontSize="sm" color="fg.muted">g/ml</Text>} maxW="220px">
                <FormInput value={densidad} onChange={(e) => setDensidad(e.target.value)} readOnly={soloLectura} inputMode="decimal" placeholder="Ej: 1,03" textAlign="right" />
              </InputGroup>
            </FormField>
          ) : (
            <FormField label="Peso de cada unidad" required mb="0" invalid={intentado && !!peso && !numeroValido(peso)}>
              <InputGroup endElement={<Text fontSize="sm" color="fg.muted">g</Text>} maxW="220px">
                <FormInput value={peso} onChange={(e) => setPeso(e.target.value)} readOnly={soloLectura} inputMode="decimal" placeholder="Ej: 50" textAlign="right" />
              </InputGroup>
            </FormField>
          )}
        </Bloque>
      )}

      {!soloLectura && (
        <Bloque
          titulo="Fuente de los datos"
          icono={LuBookOpen}
          ayuda={
            fuente === "base_referencia"
              ? "Buscá el alimento en la base de composición y tocá «Tomar valores del alimento»: la tabla de abajo se completa con sus valores."
              : "Escribí los valores en la tabla de abajo: se guardan con esta fuente y este detalle."
          }
        >
          <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "minmax(0, 1fr) minmax(0, 1.4fr)" }} gap="4" alignItems="start">
            <FormField label="Fuente" mb="0">
              <FormNativeSelect
                value={fuente}
                onChange={(e) => {
                  setFuente(e.target.value as Fuente);
                  // El detalle es de la fuente anterior (otro proveedor, otra cita).
                  setReferencia("");
                }}
              >
                {FUENTES.map((f) => (
                  <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
                ))}
              </FormNativeSelect>
            </FormField>
            {fuente === "base_referencia" ? (
              <BuscadorAlimento seleccionado={alimento} onSeleccionar={setAlimento} />
            ) : (
              <FormField label="Detalle de la fuente" mb="0" helper="Opcional, pero recomendado para auditar de dónde salió cada valor.">
                <FormInput
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  maxLength={300}
                  placeholder={fuente === "rotulo_proveedor" ? "Ej: Molinos X, harina 000, rótulo 2026" : "Ej: cita bibliográfica"}
                />
              </FormField>
            )}
          </Box>

          {fuente === "base_referencia" && (
            <HStack mt="4" gap="3" flexWrap="wrap">
              <Button type="button" colorPalette="brand" onClick={aplicar} disabled={!alimento}>
                <LuDownload aria-hidden /> Tomar valores del alimento
              </Button>
              <Text fontSize="xs" color="fg.muted">Lo que escribas a mano en una fila vacía se guarda como «Valor propio».</Text>
            </HStack>
          )}
          {fuente !== "base_referencia" && conOtraFuente > 0 && (
            <Aviso
              tono="info"
              mt="4"
              acciones={
                <Button type="button" size="sm" variant="outline" colorPalette="blue" onClick={aplicar}>
                  Pasarlos a esta fuente
                </Button>
              }
            >
              {conOtraFuente === 1 ? "1 valor guardado tiene" : `${conOtraFuente} valores guardados tienen`} otra fuente y{" "}
              {conOtraFuente === 1 ? "la conserva" : "la conservan"}.
            </Aviso>
          )}
        </Bloque>
      )}

      <Bloque
        titulo="Valores por 100 g"
        icono={LuListChecks}
        ayuda={
          soloLectura
            ? "Solo lectura. Para cambiar estos datos, editá el insumo desde Insumos → Datos nutricionales."
            : "Dejá vacío lo que no tengas. Si cambiás un número que vino de una fuente, queda marcado como modificado y se registra quién lo cambió."
        }
      >
        {!esAditivo && (
          <Box mb="4" p="3" bg="bg.subtle" rounded="md">
            <Checkbox.Root checked={anadidos} onCheckedChange={(e) => setAnadidos(!!e.checked)} colorPalette="brand" disabled={soloLectura}>
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label fontWeight="medium">Todo su azúcar es añadido</Checkbox.Label>
            </Checkbox.Root>
            <Text fontSize="xs" color="fg.muted" mt="1">
              Para azúcar, miel, jarabes, dulce de leche y similares. La guía de rotulado calcula los azúcares
              añadidos sumando los azúcares de estos ingredientes: se toman sus azúcares totales.
            </Text>
          </Box>
        )}
        {comun && (
          <HStack gap="2" mb="4" fontSize="sm" flexWrap="wrap" color="fg.muted">
            <Text>Guardados con</Text>
            <Badge variant="outline" colorPalette="gray">{FUENTE_CORTA[comun.fuente]}</Badge>
            {comun.referencia && <Text color="fg">{comun.referencia}</Text>}
            <Text>
              · {formatoFechaHora(comun.cargado_en)}
              {comun.cargado_por ? ` por ${comun.cargado_por}` : ""}
            </Text>
          </HStack>
        )}
        <Box overflowX="auto" mx={{ base: "-4", md: "-5" }} mb={{ base: "-4", md: "-5" }} borderTopWidth="1px" borderColor="border.subtle">
          <Table.Root size="sm" data-sin-tarjetas="" minW="640px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Nutriente</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Valor</EncabezadoOscuro>
                <EncabezadoOscuro>Fuente y registro</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {admitidos.map((p) => {
                const fila = filas[p.clave];
                const guardado = guardados[p.clave];
                const efectiva = fila ? fuenteDe(fila) : null;
                const invalido = intentado && !!fila && !numeroValido(fila.valor);
                const sinCambios =
                  guardado &&
                  fila &&
                  efectiva &&
                  efectiva.fuente === guardado.fuente &&
                  (efectiva.referencia ?? null) === (guardado.referencia ?? null) &&
                  Number(aDecimal(fila.valor)) === Number(guardado.valor);
                const sub = SUBNUTRIENTES.includes(p.clave);
                if (derivado(p.clave)) {
                  return (
                    <Table.Row key={p.clave} borderBottomWidth="1px" borderColor="border.subtle" bg="bg.subtle">
                      <Celda py="2.5" px="4" pl="9">
                        <Text as="span" color="fg.muted">{p.nombre}</Text>
                      </Celda>
                      <Celda py="2" px="3">
                        <InputGroup endElement={<Text fontSize="xs" color="fg.muted">{p.unidad}</Text>}>
                          <FormInput size="sm" value={filas.azucares_totales?.valor ?? ""} disabled textAlign="right" placeholder="—" aria-label={`${p.nombre} por 100 g (igual a azúcares totales)`} />
                        </InputGroup>
                      </Celda>
                      <Celda py="2" px="4">
                        <Text fontSize="sm" color="fg.muted">Igual a azúcares totales</Text>
                      </Celda>
                    </Table.Row>
                  );
                }
                return (
                  <Table.Row key={p.clave} borderBottomWidth="1px" borderColor="border.subtle" _hover={{ bg: "bg.subtle" }}>
                    <Celda py="2.5" px="4" pl={sub ? "9" : "4"}>
                      <Text as="span" fontWeight={sub ? "normal" : "medium"} color={sub ? "fg.muted" : "fg"}>
                        {p.nombre}
                      </Text>
                    </Celda>
                    <Celda py="2" px="3">
                      <InputGroup endElement={<Text fontSize="xs" color="fg.muted">{p.unidad}</Text>}>
                        <FormInput
                          size="sm"
                          value={fila?.valor ?? ""}
                          onChange={(e) => cambiarValor(p.clave, e.target.value)}
                          readOnly={soloLectura}
                          inputMode="decimal"
                          textAlign="right"
                          aria-label={`${p.nombre} por 100 g`}
                          aria-invalid={invalido}
                          borderColor={invalido ? "red.500" : undefined}
                          placeholder="—"
                        />
                      </InputGroup>
                    </Celda>
                    <Celda py="2" px="4">
                      {fila && efectiva ? (
                        <Stack
                          gap="0.5"
                          title={
                            guardado && sinCambios
                              ? `${ETIQUETA_FUENTE[guardado.fuente]}${guardado.referencia ? ` · ${guardado.referencia}` : ""}
Cargado el ${formatoFechaHora(guardado.cargado_en)}${guardado.cargado_por ? ` por ${guardado.cargado_por}` : ""}`
                              : undefined
                          }
                        >
                          <HStack gap="2" flexWrap="wrap">
                            {comun && sinCambios ? (
                              <Text fontSize="sm" color="fg.subtle">Igual que el resto</Text>
                            ) : (
                              <>
                                <Text fontSize="sm">{FUENTE_CORTA[efectiva.fuente]}</Text>
                                {efectiva.referencia && (
                                  <Text fontSize="xs" color="fg.muted" lineClamp={1} maxW="260px">
                                    · {efectiva.referencia}
                                  </Text>
                                )}
                              </>
                            )}
                            {!sinCambios && <Badge colorPalette="blue" variant="subtle" size="sm">Sin guardar</Badge>}
                            {guardado?.modificado && sinCambios && (
                              <Badge colorPalette="orange" variant="subtle" size="sm">Modificado</Badge>
                            )}
                          </HStack>
                          {guardado?.modificado && sinCambios && (
                            <Text fontSize="xs" color="orange.fg">
                              La fuente decía {formatoCantidad(guardado.valor_fuente)} · cambiado por{" "}
                              {guardado.modificado_por ?? "—"} el {formatoFechaHora(guardado.modificado_en)}
                            </Text>
                          )}
                        </Stack>
                      ) : (
                        <Text fontSize="sm" color="fg.subtle">Sin dato</Text>
                      )}
                    </Celda>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      </Bloque>

      {intentado && invalidos.length > 0 && (
        <MensajeError mt="0" mb="4">Hay valores que no son números válidos (mayores o iguales a cero).</MensajeError>
      )}

      {soloLectura ? (
        <HStack gap="3" flexWrap="wrap" justify="space-between" pt="2">
          <Text fontSize="sm" color="fg.muted">
            Solo lectura: los datos se editan desde Insumos → Datos nutricionales.
          </Text>
          {onCancel && (
            <BotonCancelar onClick={onCancel}>Cerrar</BotonCancelar>
          )}
        </HStack>
      ) : (
      <HStack gap="3" flexWrap="wrap" justify="space-between" pt="2">
        <Text fontSize="sm" color={hayCambios ? "blue.fg" : "fg.muted"}>
          {hayCambios ? "Hay cambios sin guardar." : "No hay cambios sin guardar."}
        </Text>
        <HStack gap="3">
          {onCancel && (
            <BotonCancelar onClick={onCancel} disabled={guardando}>
              Cancelar
            </BotonCancelar>
          )}
          <BotonGuardar loading={guardando}>Guardar datos nutricionales</BotonGuardar>
        </HStack>
      </HStack>
      )}
    </Box>
  );
}
