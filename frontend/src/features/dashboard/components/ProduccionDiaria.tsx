import { useState, type ReactNode } from "react";
import { Box, Button, Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { LuCalendarDays, LuTrendingUp, LuX } from "react-icons/lu";
import { FormNativeSelect, LabelFiltro } from "../../../components/ui/patrones";
import { fechaLocalISO } from "../../../common/utils/fechas";
import { formatoCantidad } from "../../../common/utils/numeros";
import { plural, type Periodo, type ProduccionDelDia, type Serie } from "../types/paneles";
import { GraficoSerie, type SerieGrafico } from "./graficos";
import { MetricasBloque, type Metrica } from "./piezasPanel";
import { unidadesDe } from "./produccionDiaria.utils";

/**
 * Un color por producto, el primero libre al agregarlo. El primero es el
 * teal de las series de producción (también el de la curva sin productos);
 * el resto alterna tono y luminosidad para que dos vecinos no se confundan.
 */
const COLORES_PRODUCTO = [
  "#009b8f", // teal
  "#eb6834", // naranja
  "#2a78d6", // azul
  "#8e5bd0", // violeta
  "#c99a3b", // ocre
  "#d6457f", // magenta
  "#5b6b7f", // pizarra
  "#7a9a3b", // oliva
] as const;

/** Más curvas que colores ya no se leen: se tapan entre sí. */
const MAXIMO_PRODUCTOS = COLORES_PRODUCTO.length;

/** Un decimal: "105,751" en un número grande se lee como miles. */
const redondear = (valor: number) => Math.round(valor * 10) / 10;

const textoLotes = (n: number) => (n ? plural(n, "lote terminado", "lotes terminados") : "sin lotes");

/** Claves de la serie de un producto en los valores de cada punto. */
const claveProducto = (indice: number) => `p${indice}`;
const claveLotes = (indice: number) => `l${indice}`;

interface Agregado {
  nombre: string;
  color: string;
}

/**
 * Un punto por día del período, también los días sin producción (en 0): un
 * día sin lotes terminados es un dato, no un hueco.
 *
 * Sin productos elegidos, el punto lleva el total del día en esa unidad
 * (`producido`); con productos, lo de cada uno, sacado del detalle por
 * producto que ya trae cada día.
 */
function serieDiaria(
  porDia: ProduccionDelDia[],
  unidad: string,
  elegidos: Agregado[],
  periodo: Periodo,
): Serie {
  const delDia = new Map(porDia.filter((p) => p.unidad === unidad).map((p) => [p.fecha, p]));
  const puntos: Serie["puntos"] = [];
  const cursor = new Date(`${periodo.desde}T00:00:00`);
  const fin = new Date(`${periodo.hasta}T00:00:00`);
  while (cursor <= fin) {
    const clave = fechaLocalISO(cursor);
    const dia = delDia.get(clave);
    const valores: Record<string, number> = {};
    if (elegidos.length === 0) {
      valores.producido = dia?.cantidad ?? 0;
      valores.lotes = dia?.cantidad_lotes ?? 0;
    } else {
      elegidos.forEach((producto, i) => {
        // El nombre del producto es único: identifica su fila en el detalle.
        const fila = dia?.productos.find((p) => p.producto === producto.nombre);
        valores[claveProducto(i)] = fila?.cantidad ?? 0;
        valores[claveLotes(i)] = fila?.cantidad_lotes ?? 0;
      });
    }
    puntos.push({
      clave,
      etiqueta: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
      valores,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return { granularidad: "dia", puntos };
}

/** Productos con producción en el período, con su unidad, por nombre. */
function productosDe(porDia: ProduccionDelDia[]): { nombre: string; unidad: string }[] {
  const unidades = new Map<string, string>();
  for (const dia of porDia) for (const p of dia.productos) unidades.set(p.producto, dia.unidad);
  return [...unidades.entries()]
    .map(([nombre, unidad]) => ({ nombre, unidad }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Detalle del cartel de un día sin productos elegidos: qué se terminó y
 * cuánto de cada producto. Es una función y no un componente: el cartel
 * muestra un texto como línea atenuada y un elemento debajo de una divisoria.
 */
function detalleDelDia(dia: ProduccionDelDia | undefined, unidad: string): ReactNode {
  if (!dia || dia.productos.length === 0) return "Sin lotes terminados";
  if (dia.productos.length === 1) {
    const [p] = dia.productos;
    return `${p.producto} · ${textoLotes(p.cantidad_lotes)}`;
  }
  return (
    <Stack gap="1" as="ul" listStyleType="none" m="0" p="0">
      <Text as="li" fontSize="xs" color="fg.muted">
        {textoLotes(dia.cantidad_lotes)}:
      </Text>
      {dia.productos.map((p) => (
        <Flex as="li" key={p.producto} gap="3" justify="space-between" fontSize="xs">
          <Text as="span" color="fg" lineClamp={1} title={p.producto}>
            {p.producto}
          </Text>
          <Text as="span" color="fg.muted" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
            {formatoCantidad(redondear(p.cantidad))} {unidad}
            {p.cantidad_lotes > 1 ? ` · ${p.cantidad_lotes} lotes` : ""}
          </Text>
        </Flex>
      ))}
    </Stack>
  );
}

/** Detalle del cartel con productos elegidos: los lotes de cada uno ese día. */
function detalleLotes(valores: Record<string, number | null>, elegidos: Agregado[]): ReactNode {
  if (elegidos.length === 1) return textoLotes(valores[claveLotes(0)] ?? 0);
  return (
    <Stack gap="1" as="ul" listStyleType="none" m="0" p="0">
      {elegidos.map((p, i) => (
        <Flex as="li" key={p.nombre} gap="3" justify="space-between" fontSize="xs">
          <Text as="span" color="fg" lineClamp={1} title={p.nombre}>
            {p.nombre}
          </Text>
          <Text as="span" color="fg.muted" whiteSpace="nowrap">
            {textoLotes(valores[claveLotes(i)] ?? 0)}
          </Text>
        </Flex>
      ))}
    </Stack>
  );
}

/** Chip de un producto en el gráfico: su color, su total y la cruz para sacarlo. */
function ChipProducto({
  nombre,
  color,
  total,
  onQuitar,
}: {
  nombre: string;
  color: string;
  total: string;
  onQuitar: () => void;
}) {
  return (
    <Box
      as="li"
      display="inline-flex"
      alignItems="center"
      gap="2"
      pl="2.5"
      pr="1"
      py="1"
      rounded="full"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      maxW="100%"
    >
      <Box as="span" w="2.5" h="2.5" rounded="full" bg={color} flexShrink={0} aria-hidden />
      <Text as="span" fontSize="sm" fontWeight="semibold" lineClamp={1} title={nombre}>
        {nombre}
      </Text>
      <Text as="span" fontSize="xs" color="fg.muted" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
        {total}
      </Text>
      <IconButton
        aria-label={`Quitar ${nombre} del gráfico`}
        size="2xs"
        variant="ghost"
        colorPalette="neutral"
        rounded="full"
        onClick={onQuitar}
      >
        <LuX size={12} aria-hidden />
      </IconButton>
    </Box>
  );
}

/**
 * Producción día a día en el período del panel: cuánto se terminó cada día,
 * con el promedio diario y el mejor día arriba. Al pasar por un día, el
 * cartel dice qué productos se terminaron.
 *
 * Se pueden agregar productos, uno por vez: cada uno queda como un chip con
 * su color y su total, y dibuja su propia curva; quitar el chip saca la
 * curva. Solo se ofrecen los que tuvieron producción en el período, y de la
 * unidad del primero (kilos con kilos), porque comparten el eje.
 *
 * Sin productos, cada unidad va por separado: si hay producción en más de
 * una, un selector elige cuál se grafica. El día es el de cierre del lote,
 * el mismo criterio que "Elaborado por producto".
 */
export function ProduccionDiaria({
  porDia,
  periodo,
  unidad,
  onUnidad,
}: {
  porDia: ProduccionDelDia[];
  periodo: Periodo;
  /**
   * Unidad graficada. La decide el panel porque "Elaborado por producto" va
   * en la misma: cambiarla acá cambia los dos gráficos.
   */
  unidad: string | null;
  onUnidad: (unidad: string) => void;
}) {
  /**
   * Productos agregados, en orden, cada uno con su color: el color se fija
   * al agregarlo, así quitar otro chip no le cambia el color a los que quedan.
   */
  const [agregados, setAgregados] = useState<Agregado[]>([]);

  const productos = productosDe(porDia);
  const unidadDe = (nombre: string) => productos.find((p) => p.nombre === nombre)?.unidad ?? null;
  /** Para agregar: los que no están, y de la unidad de los ya elegidos. */
  const opcionesAgregar = productos.filter(
    (p) => !agregados.some((a) => a.nombre === p.nombre) && (agregados.length === 0 || p.unidad === unidad),
  );
  const lleno = agregados.length >= MAXIMO_PRODUCTOS;

  const agregar = (nombre: string) => {
    if (!nombre || lleno) return;
    // El primer producto fija la unidad del gráfico (y la del panel).
    const suya = unidadDe(nombre);
    if (agregados.length === 0 && suya) onUnidad(suya);
    setAgregados((actuales) => {
      // El primer color libre: el de un chip quitado vuelve a usarse.
      const color = COLORES_PRODUCTO.find((c) => !actuales.some((a) => a.color === c)) ?? COLORES_PRODUCTO[0];
      return [...actuales, { nombre, color }];
    });
  };
  const quitar = (nombre: string) => setAgregados((actuales) => actuales.filter((a) => a.nombre !== nombre));

  const unidades = unidadesDe(porDia);

  const serie = unidad ? serieDiaria(porDia, unidad, agregados, periodo) : null;
  const delDia = new Map(porDia.filter((p) => p.unidad === unidad).map((p) => [p.fecha, p]));

  const series: SerieGrafico[] =
    agregados.length === 0
      ? [
          {
            clave: "producido",
            etiqueta: `Producido (${unidad})`,
            color: COLORES_PRODUCTO[0],
          },
        ]
      : agregados.map((p, i) => ({
          clave: claveProducto(i),
          etiqueta: `${p.nombre} (${unidad})`,
          color: p.color,
        }));
  const claves = series.map((s) => s.clave);

  const sumar = (clave: string) => serie?.puntos.reduce((t, p) => t + (p.valores[clave] ?? 0), 0) ?? 0;
  /** Lo del día entre todas las curvas visibles. */
  const delPunto = (valores: Record<string, number | null>) =>
    claves.reduce((t, c) => t + (valores[c] ?? 0), 0);
  const dias = serie?.puntos.length ?? 1;
  const total = claves.reduce((t, c) => t + sumar(c), 0);
  const mejor = serie?.puntos.reduce((a, b) => (delPunto(b.valores) > delPunto(a.valores) ? b : a));
  const entre = agregados.length > 1 ? ` entre los ${agregados.length} productos` : "";

  const metricas: Metrica[] = [
    {
      clave: "promedio",
      etiqueta: "Promedio diario",
      valor: `${formatoCantidad(redondear(total / dias))} ${unidad}`,
      icono: LuCalendarDays,
      detalle: `${formatoCantidad(redondear(total))} ${unidad} en ${plural(dias, "día", "días")}${entre}`,
    },
    {
      clave: "mejor",
      etiqueta: "Mejor día",
      valor: mejor ? `${formatoCantidad(redondear(delPunto(mejor.valores)))} ${unidad}` : null,
      icono: LuTrendingUp,
      detalle: mejor ? `El ${mejor.etiqueta}${entre}` : undefined,
    },
  ];

  const nombres = agregados.map((p) => p.nombre);

  return (
    <>
      <HStack gap="4" mb={agregados.length ? "3" : "4"} flexWrap="wrap" align="flex-end">
        <Box minW="220px" maxW="300px" flex="1">
          <LabelFiltro>{agregados.length ? "Agregar otro producto" : "Comparar productos"}</LabelFiltro>
          <FormNativeSelect
            // Siempre vacío: elegir agrega un chip y el select vuelve a cero.
            value=""
            onChange={(e) => agregar(e.target.value)}
            aria-label={agregados.length ? "Agregar otro producto al gráfico" : "Comparar productos"}
            disabled={lleno || opcionesAgregar.length === 0}
          >
            <option value="">
              {lleno
                ? `Máximo ${MAXIMO_PRODUCTOS} productos`
                : opcionesAgregar.length === 0
                  ? `No hay otros productos en ${unidad}`
                  : agregados.length === 0
                    ? "Todos los productos"
                    : "Elegir producto..."}
            </option>
            {opcionesAgregar.map((p) => (
              <option key={p.nombre} value={p.nombre}>
                {p.nombre}
              </option>
            ))}
          </FormNativeSelect>
        </Box>

        {agregados.length === 0 && unidades.length > 1 && (
          <HStack gap="1" pb="1" role="group" aria-label="Unidad del gráfico">
            {unidades.map((u) => (
              <Button
                key={u}
                size="xs"
                colorPalette="brand"
                variant={u === unidad ? "solid" : "outline"}
                aria-pressed={u === unidad}
                onClick={() => onUnidad(u)}
              >
                {u}
              </Button>
            ))}
          </HStack>
        )}
      </HStack>

      {agregados.length > 0 && (
        <HStack
          as="ul"
          listStyleType="none"
          m="0"
          p="0"
          mb="4"
          gap="2"
          flexWrap="wrap"
          aria-label="Productos en el gráfico"
        >
          {agregados.map((p, i) => (
            <ChipProducto
              key={p.nombre}
              nombre={p.nombre}
              color={p.color}
              total={`${formatoCantidad(redondear(sumar(claveProducto(i))))} ${unidad}`}
              onQuitar={() => quitar(p.nombre)}
            />
          ))}
          {agregados.length > 1 && (
            <Box as="li">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                colorPalette="neutral"
                onClick={() => setAgregados([])}
              >
                Quitar todos
              </Button>
            </Box>
          )}
        </HStack>
      )}

      {serie && unidad && (
        <>
          <MetricasBloque metricas={metricas} />
          <GraficoSerie
            serie={serie}
            series={series}
            tipo="area"
            alto={200}
            resumen={
              agregados.length
                ? `Producción diaria en ${unidad} de ${nombres.join(", ")}`
                : `Producción diaria en ${unidad} en el período`
            }
            extraTooltip={(valores, clave) =>
              agregados.length ? detalleLotes(valores, agregados) : detalleDelDia(delDia.get(clave), unidad)
            }
          />
        </>
      )}
    </>
  );
}
