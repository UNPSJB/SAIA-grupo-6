import { Box, Button, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { FormField, FormInput, FormNativeSelect } from "../../../components/ui/patrones";
import type { CondicionConservacion, Conservacion } from "../types/declaraciones";

function CondicionFields({ value, onChange, prefijo }: {
  value: CondicionConservacion; onChange: (v: CondicionConservacion) => void; prefijo: string;
}) {
  const numero = (v: string) => v === "" ? null : Number(v);
  return <Stack gap="3" minW="0">
    <FormField mb="0" label={`${prefijo}Instrucciones de conservación`}>
      <Textarea aria-label={`${prefijo}Instrucciones de conservación`} value={value.instrucciones ?? ""}
        onChange={e => onChange({ ...value, instrucciones: e.target.value })} />
    </FormField>
    <label><input type="checkbox" checked={value.temperatura_aplicable ?? false}
      onChange={e => onChange({ ...value, temperatura_aplicable: e.target.checked, temperatura_minima: null, temperatura_maxima: null })} /> {prefijo}Temperatura aplicable</label>
    {value.temperatura_aplicable && <SimpleGrid columns={2} gap="3" minW="0">
      <FormField mb="0" label={`${prefijo}Mínima (°C)`}><FormInput aria-label={`${prefijo}Mínima (°C)`} type="number" step="any" value={value.temperatura_minima ?? ""}
        onChange={e => onChange({ ...value, temperatura_minima: numero(e.target.value) })} /></FormField>
      <FormField mb="0" label={`${prefijo}Máxima (°C)`}><FormInput aria-label={`${prefijo}Máxima (°C)`} type="number" step="any" value={value.temperatura_maxima ?? ""}
        onChange={e => onChange({ ...value, temperatura_maxima: numero(e.target.value) })} /></FormField>
    </SimpleGrid>}
    <label><input type="checkbox" checked={value.duracion_aplicable ?? false}
      onChange={e => onChange({ ...value, duracion_aplicable: e.target.checked, duracion: null, unidad_duracion: null })} /> {prefijo}Vida útil declarada aplicable</label>
    {value.duracion_aplicable && <SimpleGrid columns={2} gap="3" minW="0">
      <FormField mb="0" label={`${prefijo}Duración`}><FormInput aria-label={`${prefijo}Duración`} type="number" step="any" min="0" value={value.duracion ?? ""}
        onChange={e => onChange({ ...value, duracion: numero(e.target.value) })} /></FormField>
      <FormField mb="0" label={`${prefijo}Unidad`}><FormNativeSelect aria-label={`${prefijo}Unidad`} value={value.unidad_duracion ?? ""}
        onChange={e => onChange({ ...value, unidad_duracion: (e.target.value || null) as CondicionConservacion["unidad_duracion"] })}>
        <option value="">Seleccioná unidad</option><option value="horas">Horas</option><option value="dias">Días</option><option value="meses">Meses</option>
      </FormNativeSelect></FormField>
    </SimpleGrid>}
  </Stack>;
}

export function ConservacionFields({ value, onChange }: { value: Conservacion | null; onChange: (v: Conservacion | null) => void }) {
  const datos = value ?? {};
  return <Stack gap="3" minW="0" mt="5">
    <Text fontSize="sm" color="fg.muted">Datos declarados por el elaborador. La vida útil no se calcula automáticamente ni reemplaza la fecha de duración.</Text>
    <CondicionFields value={datos} onChange={v => onChange({ ...datos, ...v })} prefijo="" />
    <label><input type="checkbox" checked={datos.despues_abrir_aplicable ?? false}
      onChange={e => onChange({ ...datos, despues_abrir_aplicable: e.target.checked, despues_abrir: null })} /> Condiciones después de abrir aplicables</label>
    {datos.despues_abrir_aplicable && <Box borderWidth="1px" borderColor="border.subtle" p="3" rounded="lg" minW="0">
      <CondicionFields value={datos.despues_abrir ?? {}} prefijo="Después de abrir: "
        onChange={v => onChange({ ...datos, despues_abrir: v })} />
    </Box>}
    {value && <Button type="button" variant="outline" alignSelf="start" whiteSpace="normal" h="auto" minH="10" onClick={() => onChange(null)}>Quitar condiciones de conservación</Button>}
  </Stack>;
}
