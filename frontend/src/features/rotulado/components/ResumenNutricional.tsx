import { Badge, Box, HStack, Stack, Table, Text, Textarea } from "@chakra-ui/react";

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}
function texto(valor: unknown): string {
  return typeof valor === "string" && valor.trim() || typeof valor === "number" ? String(valor) : "—";
}
export function ResumenNutricional({ valor, onCambio }: { valor: string; onCambio: (valor: string) => void }) {
  let datos: Record<string, unknown> | null = null;
  try { datos = objeto(JSON.parse(valor)); } catch { /* Se conserva el original en el detalle técnico. */ }
  const filas = Array.isArray(datos?.filas) ? datos.filas.map(objeto).filter(f => f !== null) : [];
  return <Stack gap="4">
    {filas.length > 0 ? <Box borderWidth="1px" borderColor="border.subtle" rounded="lg" overflow="hidden">
      <HStack bg="bg.subtle" p="4" justify="space-between" flexWrap="wrap" gap="3">
        <Box><Text fontWeight="semibold">Información por porción</Text>
          <Text fontSize="sm" color="fg.muted">Porción: {texto(datos?.porcion)} {texto(datos?.expresar_en)}{datos?.medida_casera ? ` · ${texto(datos.medida_casera)}` : ""}</Text></Box>
        {typeof datos?.estado === "string" && <Badge colorPalette={datos.estado === "completa" ? "green" : "orange"}>{datos.estado === "completa" ? "Datos completos" : "Datos incompletos"}</Badge>}
      </HStack>
      <Box overflowX="auto"><Table.Root size="sm" variant="line" striped>
        <Table.Caption p="3" textAlign="start">Instantánea nutricional E11. VD: valor diario.</Table.Caption>
        <Table.Header><Table.Row>
          <Table.ColumnHeader minW="180px">Nutriente</Table.ColumnHeader>
          <Table.ColumnHeader minW="130px" textAlign="end">Por 100 {texto(datos?.expresar_en)}</Table.ColumnHeader>
          <Table.ColumnHeader minW="130px" textAlign="end">Por porción</Table.ColumnHeader>
          <Table.ColumnHeader minW="90px" textAlign="end">% VD</Table.ColumnHeader>
        </Table.Row></Table.Header>
        <Table.Body>{filas.map((fila, index) => <Table.Row key={index}>
          <Table.Cell fontWeight="medium">{texto(fila.nombre)}<Text fontSize="xs" color="fg.muted">{texto(fila.unidad)}{fila.faltan_datos === true ? " · Faltan datos" : ""}</Text></Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.por_100_texto ?? fila.por_100)}</Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.por_porcion_texto ?? fila.por_porcion)}</Table.Cell>
          <Table.Cell textAlign="end">{texto(fila.vd_texto ?? fila.vd)}</Table.Cell>
        </Table.Row>)}</Table.Body>
      </Table.Root></Box>
      {Array.isArray(datos?.problemas) && datos.problemas.length > 0 && <Stack p="4" gap="1">{datos.problemas.map((problema, index) => <Text key={index} fontSize="sm" color="fg.muted">{texto(problema)}</Text>)}</Stack>}
    </Box> : <Box bg="bg.subtle" p="4" rounded="lg"><Text fontSize="sm" color="fg.muted">{!valor.trim() ? "No hay información nutricional disponible para este rótulo." : "No se pudo mostrar la tabla nutricional. Revisá los datos en el detalle técnico."}</Text></Box>}
    <Box as="details" borderWidth="1px" borderColor="border.subtle" rounded="lg" p="3">
      <Box as="summary" cursor="pointer" fontSize="sm" color="fg.muted">Detalle técnico · JSON nutricional</Box>
      <Text fontSize="xs" color="fg.muted" mt="3" mb="2">Instantánea guardada en este rótulo. Su edición no modifica E11.</Text>
      <Textarea aria-label="Datos nutricionales (JSON)" value={valor} onChange={e => onCambio(e.target.value)} fontFamily="mono" fontSize="xs" minH="200px" resize="vertical" spellCheck={false} />
    </Box>
  </Stack>;
}
