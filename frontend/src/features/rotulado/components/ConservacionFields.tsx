import type { ReactNode } from "react";
import { Box, Button, SimpleGrid, Stack, Text, Textarea, chakra } from "@chakra-ui/react";
import { FormField, FormInput, FormNativeSelect } from "../../../components/ui/patrones";
import type { CondicionConservacion, Conservacion } from "../types/declaraciones";

function CondicionFields({ value, onChange, prefijo, children }: {
  value: CondicionConservacion; onChange: (v: CondicionConservacion) => void; prefijo: string;
  /** Más condiciones al final del grupo de casillas. */
  children?: ReactNode;
}) {
  const numero = (v: string) => v === "" ? null : Number(v);
  return <Stack gap="5" minW="0">
    <FormField mb="0" label={`${prefijo}Instrucciones de conservación`}>
      <Textarea aria-label={`${prefijo}Instrucciones de conservación`} value={value.instrucciones ?? ""}
        onChange={e => onChange({ ...value, instrucciones: e.target.value })} />
    </FormField>
    <Stack gap="3" minW="0">
    <chakra.label display="flex" alignItems="center" gap="2.5" fontSize="sm" cursor="pointer" w="fit-content"><input type="checkbox" checked={value.temperatura_aplicable ?? false}
      onChange={e => onChange({ ...value, temperatura_aplicable: e.target.checked, temperatura_minima: null, temperatura_maxima: null })} /> {prefijo}Temperatura aplicable</chakra.label>
    {value.temperatura_aplicable && <SimpleGrid columns={2} gap="4" minW="0" ps={{ base: "0", md: "26px" }} pb="2">
      <FormField mb="0" label={`${prefijo}Mínima (°C)`}><FormInput aria-label={`${prefijo}Mínima (°C)`} type="number" step="any" value={value.temperatura_minima ?? ""}
        onChange={e => onChange({ ...value, temperatura_minima: numero(e.target.value) })} /></FormField>
      <FormField mb="0" label={`${prefijo}Máxima (°C)`}><FormInput aria-label={`${prefijo}Máxima (°C)`} type="number" step="any" value={value.temperatura_maxima ?? ""}
        onChange={e => onChange({ ...value, temperatura_maxima: numero(e.target.value) })} /></FormField>
    </SimpleGrid>}
    <chakra.label display="flex" alignItems="center" gap="2.5" fontSize="sm" cursor="pointer" w="fit-content"><input type="checkbox" checked={value.duracion_aplicable ?? false}
      onChange={e => onChange({ ...value, duracion_aplicable: e.target.checked, duracion: null, unidad_duracion: null })} /> {prefijo}Vida útil declarada aplicable</chakra.label>
    {value.duracion_aplicable && <SimpleGrid columns={2} gap="4" minW="0" ps={{ base: "0", md: "26px" }} pb="2">
      <FormField mb="0" label={`${prefijo}Duración`}><FormInput aria-label={`${prefijo}Duración`} type="number" step="any" min="0" value={value.duracion ?? ""}
        onChange={e => onChange({ ...value, duracion: numero(e.target.value) })} /></FormField>
      <FormField mb="0" label={`${prefijo}Unidad`}><FormNativeSelect aria-label={`${prefijo}Unidad`} value={value.unidad_duracion ?? ""}
        onChange={e => onChange({ ...value, unidad_duracion: (e.target.value || null) as CondicionConservacion["unidad_duracion"] })}>
        <option value="">Seleccioná unidad</option><option value="horas">Horas</option><option value="dias">Días</option><option value="meses">Meses</option>
      </FormNativeSelect></FormField>
    </SimpleGrid>}
    {children}
    </Stack>
  </Stack>;
}

export function ConservacionFields({ value, onChange, sinQuitar = false }: { value: Conservacion | null; onChange: (v: Conservacion | null) => void; sinQuitar?: boolean }) {
  const datos = value ?? {};
  return <Stack gap="5" minW="0">
    <Text fontSize="sm" lineHeight="1.5" color="fg.muted">Datos declarados por el elaborador. La vida útil no se calcula automáticamente ni reemplaza la fecha de duración.</Text>
    <CondicionFields value={datos} onChange={v => onChange({ ...datos, ...v })} prefijo="">
    <chakra.label display="flex" alignItems="center" gap="2.5" fontSize="sm" cursor="pointer" w="fit-content"><input type="checkbox" checked={datos.despues_abrir_aplicable ?? false}
      onChange={e => onChange({ ...datos, despues_abrir_aplicable: e.target.checked, despues_abrir: null })} /> Condiciones después de abrir aplicables</chakra.label>
    {datos.despues_abrir_aplicable && <Box borderWidth="1px" borderColor="border.subtle" p="4" rounded="lg" minW="0">
      <CondicionFields value={datos.despues_abrir ?? {}} prefijo="Después de abrir: "
        onChange={v => onChange({ ...datos, despues_abrir: v })} />
    </Box>}
    </CondicionFields>
    {value && !sinQuitar && <Button type="button" variant="outline" alignSelf="start" whiteSpace="normal" h="auto" minH="10" onClick={() => onChange(null)}>Quitar condiciones de conservación</Button>}
  </Stack>;
}
