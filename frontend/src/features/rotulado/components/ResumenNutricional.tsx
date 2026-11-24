import { Link } from "react-router-dom";
import { Badge, Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { CuadroNutricional, type FilaCuadro } from "../../nutricion/components/TablaNutricional";

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}
function texto(valor: unknown): string {
  return typeof valor === "string" && valor.trim() || typeof valor === "number" ? String(valor) : "—";
}
/**
 * `compacta`: tabla más apretada y sin la insignia de estado (el editor la
 * muestra en la cabecera de su sección, junto al botón de origen).
 */
export function ResumenNutricional({ valor, enlaceOrigen, compacta = false }: { valor: string; enlaceOrigen?: string; compacta?: boolean }) {
  let datos: Record<string, unknown> | null = null;
  try { datos = objeto(JSON.parse(valor)); } catch { /* Ilegible: se muestra sin filas. */ }
  const faltanDatos = datos?.estado !== "completa"
    || (Array.isArray(datos?.filas) && datos.filas.some(fila => objeto(fila)?.faltan_datos === true));
  return <Stack gap="5">
    {enlaceOrigen && faltanDatos && <Button asChild variant="outline" size="sm" alignSelf="start">
      <Link to={enlaceOrigen}>Abrir información nutricional del producto</Link>
    </Button>}
    <TablaInstantaneaNutricional datos={datos} previsualizacion={compacta} sinEstado={compacta} />
  </Stack>;
}

export function TablaInstantaneaNutricional({ datos, estado, previsualizacion = false, sinEstado = false }: {
  datos: Record<string, unknown> | null;
  previsualizacion?: boolean;
  estado?: "completa" | "incompleta";
  sinEstado?: boolean;
}) {
  const filas = Array.isArray(datos?.filas) ? datos.filas.map(objeto).filter(f => f !== null) : [];
  const estadoMostrado = estado ?? datos?.estado;
  return filas.length > 0 ? <Box borderWidth="1px" borderColor="border.subtle" rounded="lg" overflow="hidden">
      <HStack bg="bg.subtle" px={previsualizacion ? "3" : "4"} py={previsualizacion ? "2.5" : "4"} justify="space-between" flexWrap="wrap" gap="3">
        <Box>{!previsualizacion && <Text fontWeight="semibold">Información por porción</Text>}
          <Text fontSize="sm" color="fg.muted">Porción: {texto(datos?.porcion)} {texto(datos?.expresar_en)}{datos?.medida_casera ? ` · ${texto(datos.medida_casera)}` : ""}</Text></Box>
        {!sinEstado && typeof estadoMostrado === "string" && <Badge colorPalette={estadoMostrado === "completa" ? "green" : "orange"}>{estadoMostrado === "completa" ? "Datos completos" : "Datos incompletos"}</Badge>}
      </HStack>
      <Box overflowX="auto" tabIndex={0} role="region" aria-label="Tabla nutricional por porción"><Table.Root size="sm" variant="line" striped
          minW={previsualizacion ? { base: "0", md: "520px" } : undefined} tableLayout={previsualizacion ? "auto" : undefined}
          data-sin-tarjetas={previsualizacion ? "" : undefined}
          css={previsualizacion ? {
            "& :is(th, td)": { paddingBlock: "1", paddingInline: { base: "1.5", md: "3" }, lineHeight: "short", whiteSpace: "normal" },
            "& td:not(:first-of-type)": { whiteSpace: { base: "normal", md: "nowrap" }, fontVariantNumeric: "tabular-nums" },
          } : undefined}>
        <Table.Caption px="3" py={previsualizacion ? "2.5" : "3"} textAlign="start">Instantánea de la información nutricional. VD: valor diario.</Table.Caption>
        <Table.Header><Table.Row>
          <Table.ColumnHeader minW={{ base: "0", md: previsualizacion ? "140px" : "180px" }} w={previsualizacion ? "38%" : undefined}>Nutriente</Table.ColumnHeader>
          <Table.ColumnHeader minW={{ base: "0", md: previsualizacion ? "105px" : "130px" }} textAlign="end">Por 100 {texto(datos?.expresar_en)}</Table.ColumnHeader>
          <Table.ColumnHeader minW={{ base: "0", md: previsualizacion ? "105px" : "130px" }} textAlign="end">Por porción</Table.ColumnHeader>
          <Table.ColumnHeader minW={{ base: "0", md: previsualizacion ? "60px" : "90px" }} textAlign="end">% VD</Table.ColumnHeader>
        </Table.Row></Table.Header>
        <Table.Body>{filas.map((fila, index) => <Table.Row key={index} css={fila.faltan_datos === true ? { "& > td": { background: "var(--chakra-colors-orange-subtle)" } } : undefined}>
          <Table.Cell fontWeight="medium">{texto(fila.nombre)}<Text as={previsualizacion ? "span" : "p"} ms={previsualizacion ? "2" : undefined} fontSize="xs" color="fg.muted">{texto(fila.unidad)}</Text>
            {fila.faltan_datos === true && <Badge colorPalette="orange" size="xs" ms="2">Faltan datos</Badge>}</Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.por_100_texto ?? fila.por_100)}</Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.por_porcion_texto ?? fila.por_porcion)}</Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.vd_texto ?? fila.vd)}</Table.Cell>
        </Table.Row>)}</Table.Body>
      </Table.Root></Box>
      {Array.isArray(datos?.problemas) && datos.problemas.length > 0 && <Stack p="4" gap="1">{datos.problemas.map((problema, index) => <Text key={index} fontSize="sm" color="fg.muted">{texto(problema)}</Text>)}</Stack>}
    </Box> : <Text>Sin filas nutricionales disponibles.</Text>;
}

// Las instantáneas guardadas antes de incluir las notas al pie no las traen:
// la del %VD es fija (Guía de Rotulado), así que se repone.
const LEYENDA_VD =
  "* % Valores Diarios con base a una dieta de 2.000 kcal u 8.400 kJ. Sus valores diarios pueden ser mayores o menores dependiendo de sus necesidades energéticas.";
const LEYENDA_LABORATORIO = "** Determinado en laboratorio.";

/** La instantánea guardada en el rótulo, con el formato del cuadro del envase. */
export function CuadroInstantaneaNutricional({ datos, incompleta = false }: {
  datos: Record<string, unknown> | null;
  incompleta?: boolean;
}) {
  const filas: FilaCuadro[] = (Array.isArray(datos?.filas) ? datos.filas.map(objeto).filter(f => f !== null) : [])
    .map(f => ({
      clave: String(f.clave ?? ""),
      nombre: texto(f.nombre),
      unidad: typeof f.unidad === "string" ? f.unidad : "",
      por_100_texto: texto(f.por_100_texto ?? f.por_100),
      por_porcion_texto: texto(f.por_porcion_texto ?? f.por_porcion),
      vd_texto: typeof f.vd_texto === "string" ? f.vd_texto : "",
      faltan_datos: f.faltan_datos === true,
      de_laboratorio: f.de_laboratorio === true,
    }));
  if (filas.length === 0) return <Text>Sin filas nutricionales disponibles.</Text>;
  const cadena = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return <Box maxW="620px">
    <CuadroNutricional
      filas={filas}
      porcion={typeof datos?.porcion === "number" || typeof datos?.porcion === "string" ? datos.porcion : null}
      medidaCasera={cadena(datos?.medida_casera)}
      expresarEn={cadena(datos?.expresar_en) ?? "g"}
      mostrarPor100={datos?.mostrar_por_100 !== false}
      incompleta={incompleta}
      leyendaNoSignificativo={cadena(datos?.leyenda_no_significativo)}
      leyendaVd={cadena(datos?.leyenda_vd) ?? LEYENDA_VD}
      leyendaLaboratorio={cadena(datos?.leyenda_laboratorio) ?? LEYENDA_LABORATORIO}
    />
  </Box>;
}
