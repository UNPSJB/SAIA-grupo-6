import { Link } from "react-router-dom";
import { Badge, Box, Button, HStack, Stack, Table, Text, Textarea } from "@chakra-ui/react";

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}
function texto(valor: unknown): string {
  return typeof valor === "string" && valor.trim() || typeof valor === "number" ? String(valor) : "—";
}
export function ResumenNutricional({ valor, onCambio, enlaceOrigen }: { valor: string; onCambio: (valor: string) => void; enlaceOrigen?: string }) {
  let datos: Record<string, unknown> | null = null;
  try { datos = objeto(JSON.parse(valor)); } catch { /* Se conserva el original en el detalle técnico. */ }
  const faltanDatos = datos?.estado !== "completa"
    || (Array.isArray(datos?.filas) && datos.filas.some(fila => objeto(fila)?.faltan_datos === true));
  return <Stack gap="4">
    {enlaceOrigen && faltanDatos && <Button asChild variant="outline" size="sm" alignSelf="start">
      <Link to={enlaceOrigen}>Abrir información nutricional del producto (E11)</Link>
    </Button>}
    <TablaInstantaneaNutricional datos={datos} />
    <Box as="details" borderWidth="1px" borderColor="border.subtle" rounded="lg" p="3">
      <Box as="summary" cursor="pointer" fontSize="sm" color="fg.muted">Detalle técnico · JSON nutricional</Box>
      <Text fontSize="xs" color="fg.muted" mt="3" mb="2">Instantánea guardada en este rótulo. Su edición no modifica E11.</Text>
      <Textarea aria-label="Datos nutricionales (JSON)" value={valor} onChange={e => onCambio(e.target.value)} fontFamily="mono" fontSize="xs" minH="200px" resize="vertical" spellCheck={false} />
    </Box>
  </Stack>;
}

export function TablaInstantaneaNutricional({ datos, estado, previsualizacion = false }: {
  datos: Record<string, unknown> | null;
  previsualizacion?: boolean;
  estado?: "completa" | "incompleta";
}) {
  const filas = Array.isArray(datos?.filas) ? datos.filas.map(objeto).filter(f => f !== null) : [];
  const estadoMostrado = estado ?? datos?.estado;
  return filas.length > 0 ? <Box borderWidth="1px" borderColor="border.subtle" rounded="lg" overflow="hidden">
      <HStack bg="bg.subtle" p={previsualizacion ? "2" : "4"} justify="space-between" flexWrap="wrap" gap="3">
        <Box>{!previsualizacion && <Text fontWeight="semibold">Información por porción</Text>}
          <Text fontSize="sm" color="fg.muted">Porción: {texto(datos?.porcion)} {texto(datos?.expresar_en)}{datos?.medida_casera ? ` · ${texto(datos.medida_casera)}` : ""}</Text></Box>
        {typeof estadoMostrado === "string" && <Badge colorPalette={estadoMostrado === "completa" ? "green" : "orange"}>{estadoMostrado === "completa" ? "Datos completos" : "Datos incompletos"}</Badge>}
      </HStack>
      <Box overflowX="auto" tabIndex={0} role="region" aria-label="Tabla nutricional por porción"><Table.Root size="sm" variant="line" striped
          minW={previsualizacion ? "520px" : undefined} tableLayout={previsualizacion ? "auto" : undefined}
          data-sin-tarjetas={previsualizacion ? "" : undefined}
          css={previsualizacion ? { "& :is(th, td)": { paddingBlock: "1", lineHeight: "short" }, "& td:not(:first-of-type)": { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" } } : undefined}>
        <Table.Caption p={previsualizacion ? "2" : "3"} textAlign="start">Instantánea nutricional E11. VD: valor diario.</Table.Caption>
        <Table.Header><Table.Row>
          <Table.ColumnHeader minW={previsualizacion ? "140px" : "180px"} w={previsualizacion ? "38%" : undefined}>Nutriente</Table.ColumnHeader>
          <Table.ColumnHeader minW={previsualizacion ? "105px" : "130px"} textAlign="end">Por 100 {texto(datos?.expresar_en)}</Table.ColumnHeader>
          <Table.ColumnHeader minW={previsualizacion ? "105px" : "130px"} textAlign="end">Por porción</Table.ColumnHeader>
          <Table.ColumnHeader minW={previsualizacion ? "60px" : "90px"} textAlign="end">% VD</Table.ColumnHeader>
        </Table.Row></Table.Header>
        <Table.Body>{filas.map((fila, index) => <Table.Row key={index}>
          <Table.Cell fontWeight="medium">{texto(fila.nombre)}<Text as={previsualizacion ? "span" : "p"} ms={previsualizacion ? "2" : undefined} fontSize="xs" color="fg.muted">{texto(fila.unidad)}{fila.faltan_datos === true ? " · Faltan datos" : ""}</Text></Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.por_100_texto ?? fila.por_100)}</Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.por_porcion_texto ?? fila.por_porcion)}</Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.vd_texto ?? fila.vd)}</Table.Cell>
        </Table.Row>)}</Table.Body>
      </Table.Root></Box>
      {Array.isArray(datos?.problemas) && datos.problemas.length > 0 && <Stack p="4" gap="1">{datos.problemas.map((problema, index) => <Text key={index} fontSize="sm" color="fg.muted">{texto(problema)}</Text>)}</Stack>}
    </Box> : <Text>Sin filas nutricionales disponibles.</Text>;
}
