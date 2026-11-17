import { useEffect, useId, useState } from "react";
import { Badge, Box, Button, chakra, HStack, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { FormField, FormInput, FormNativeSelect } from "../../../components/ui/patrones";
import { CloseButton } from "../../../components/ui/close-button";
import { catalogoAlergenos } from "../services/declaracionesService";
import type { PerfilDeclaracion, Sustancia } from "../types/declaraciones";

export function PerfilDeclaracionFields({ value, onChange }: {
  value: PerfilDeclaracion | null; onChange: (v: PerfilDeclaracion) => void;
}) {
  const [catalogo, setCatalogo] = useState<Sustancia[]>([]);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [codigoEditar, setCodigoEditar] = useState<string | null>(null);
  const id = useId();
  useEffect(() => {
    let activo = true;
    catalogoAlergenos().then(v => { if (activo) { setCatalogo(v); setError(""); } })
      .catch((e: unknown) => { if (activo) setError(e instanceof Error ? e.message : "Error al cargar alérgenos"); });
    return () => { activo = false; };
  }, [intento]);
  const perfil = value ?? { evaluacion: "sin_evaluar", gluten: "desconocido", marcas: [] };

  function normalizar(texto: string) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  }
  const consulta = normalizar(busqueda);
  const resultados = consulta ? catalogo.filter(s => normalizar(s.nombre).includes(consulta)) : [];
  const nombre = (codigo: string) => catalogo.find(s => s.codigo === codigo)?.nombre ?? codigo;

  function cambiarMarca(codigo: string, forma: string) {
    onChange({ ...perfil, marcas: [...perfil.marcas.filter(m => m.codigo !== codigo),
      ...(forma ? [{ codigo, forma: forma as "directa" | "derivado" }] : [])] });
    if (!forma && codigoEditar === codigo) setCodigoEditar(null);
  }

  function selector(sustancia: Sustancia, contexto: "catalogo" | "busqueda") {
    const marca = perfil.marcas.find(m => m.codigo === sustancia.codigo);
    return <Box key={sustancia.codigo} minW="0" borderWidth="1px" borderColor={marca ? "brand.300" : "border.subtle"}
      rounded="lg" p="3" bg={marca ? "bg.subtle" : "bg.panel"}
      css={{ "& > div": { height: "100%" }, "& label": { flex: "1" } }}>
      <FormField label={<HStack flexWrap="wrap"><Text as="span" overflowWrap="anywhere">{sustancia.nombre}</Text>
        {marca && <Badge colorPalette="brand" variant="subtle">Registrado</Badge>}</HStack>} mb="0">
        <FormNativeSelect aria-label={`Presencia de ${sustancia.nombre}${contexto === "busqueda" ? " (búsqueda)" : ""}`}
          minW="0" w="full" value={marca?.forma ?? ""} onChange={e => cambiarMarca(sustancia.codigo, e.target.value)}>
          <option value="">Sin marca registrada</option><option value="directa">Presencia directa</option><option value="derivado">Derivado</option>
        </FormNativeSelect>
      </FormField>
    </Box>;
  }

  return <Stack as="section" gap="4" mt="5" minW="0">
    <Text as="h2" fontWeight="semibold">Alérgenos y gluten del insumo</Text>
    <Text fontSize="sm" color="fg.muted">Registrá los alérgenos identificados en este insumo. Una lista sin marcas no implica ausencia de alérgenos si la evaluación está pendiente.</Text>
    {error && <Text role="alert">{error} <button type="button" onClick={() => setIntento(n => n + 1)}>Reintentar catálogo</button></Text>}
    <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" minW="0">
    <FormField label="Evaluación de alérgenos" mb="0"><FormNativeSelect aria-label="Evaluación de alérgenos" value={perfil.evaluacion}
      onChange={e => onChange({ ...perfil, evaluacion: e.target.value as PerfilDeclaracion["evaluacion"] })}>
      <option value="sin_evaluar">Sin evaluar</option><option value="incompleta">Incompleta</option><option value="evaluada">Evaluada</option>
    </FormNativeSelect></FormField>
    <Box minW="0">
    <FormField label="Información de gluten" mb="0"><FormNativeSelect aria-label="Información de gluten" value={perfil.gluten}
      onChange={e => onChange({ ...perfil, gluten: e.target.value as PerfilDeclaracion["gluten"] })}>
      <option value="desconocido">Información desconocida</option><option value="presente">Presente</option><option value="ausencia_declarada">Ausencia declarada en este insumo</option>
    </FormNativeSelect></FormField>
    <Text fontSize="sm" color="fg.muted" mt="2">La ausencia declarada no certifica un producto libre de gluten.</Text>
    </Box>
    </SimpleGrid>
    <FormField label="Buscar alérgeno" mb="0">
      <FormInput type="search" aria-label="Buscar alérgeno" placeholder="Buscar alérgeno..." value={busqueda}
        autoComplete="off" aria-controls={consulta ? `${id}-resultados` : undefined} onChange={e => setBusqueda(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} />
    </FormField>
    {consulta && <Box id={`${id}-resultados`} role="region" aria-label="Resultados de búsqueda de alérgenos">
      <Text fontSize="sm" color="fg.muted" mb="2" role="status">
        {resultados.length ? `${resultados.length} resultado${resultados.length === 1 ? "" : "s"}` : "No se encontraron alérgenos para esa búsqueda."}
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="3" maxH="72" overflowY="auto" minW="0">
        {resultados.map(s => selector(s, "busqueda"))}
      </SimpleGrid>
    </Box>}

    <Stack gap="2" role="group" aria-label="Alérgenos registrados">
      <Text fontSize="sm" fontWeight="medium">Alérgenos registrados</Text>
      {!perfil.marcas.length && <Text fontSize="sm" color="fg.muted">Sin marcas de alérgenos registradas.</Text>}
      <HStack flexWrap="wrap" align="start" gap="2">
        {perfil.marcas.map(m => <HStack key={m.codigo} gap="0" maxW="100%" minW="0" rounded="full"
          borderWidth="1px" borderColor="brand.300" bg="bg.subtle" px="2">
          <Button type="button" variant="plain" size="sm" flex="1" h="auto" minH="10" minW="0" py="2" px="2"
            whiteSpace="normal" textAlign="left" aria-label={`Editar marca de ${nombre(m.codigo)}`}
            title="Editar tipo de marca"
            aria-expanded={codigoEditar === m.codigo} aria-controls={codigoEditar === m.codigo ? `${id}-editor` : undefined}
            onClick={() => setCodigoEditar(codigoEditar === m.codigo ? null : m.codigo)}>
            <Text as="span" overflowWrap="anywhere">{nombre(m.codigo)} · {m.forma === "directa" ? "Presencia directa" : "Derivado"}</Text>
          </Button>
          <CloseButton type="button" size="sm" flexShrink="0" aria-label={`Quitar marca de ${nombre(m.codigo)}`}
            onClick={() => cambiarMarca(m.codigo, "")} />
        </HStack>)}
      </HStack>
      {codigoEditar && perfil.marcas.some(m => m.codigo === codigoEditar) && <Box id={`${id}-editor`} p="3" borderWidth="1px" rounded="lg">
        <FormField label={`Editar marca de ${nombre(codigoEditar)}`} mb="0">
          <FormNativeSelect aria-label={`Tipo de marca de ${nombre(codigoEditar)}`}
            value={perfil.marcas.find(m => m.codigo === codigoEditar)?.forma ?? ""}
            onChange={e => cambiarMarca(codigoEditar, e.target.value)}>
            <option value="">Sin marca registrada</option><option value="directa">Presencia directa</option><option value="derivado">Derivado</option>
          </FormNativeSelect>
        </FormField>
      </Box>}
    </Stack>

    <chakra.details open={error ? true : undefined} borderWidth="1px" borderColor="border.subtle" rounded="lg" p="3" minW="0">
      <Box as="summary" cursor="pointer" fontSize="sm" fontWeight="medium" color="brand.fg"
        _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "2px" }}>
        Ver catálogo completo de alérgenos
      </Box>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="3" mt="3" maxH="96" overflowY="auto" minW="0">
        {catalogo.map(s => selector(s, "catalogo"))}
      </SimpleGrid>
    </chakra.details>
    <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" minW="0">
    <FormField label="Respaldo del perfil" mb="0"><Textarea aria-label="Respaldo del perfil" rows={2} value={perfil.respaldo ?? ""}
      onChange={e => onChange({ ...perfil, respaldo: e.target.value })} /></FormField>
    <FormField label="Observaciones del perfil" mb="0"><Textarea aria-label="Observaciones del perfil" rows={2} value={perfil.observaciones ?? ""}
      onChange={e => onChange({ ...perfil, observaciones: e.target.value })} /></FormField>
    </SimpleGrid>
  </Stack>;
}
