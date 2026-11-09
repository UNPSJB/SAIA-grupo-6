import { useState } from "react";
import { Box, HStack, InputGroup, Stack, Text } from "@chakra-ui/react";
import { SeccionDetalle } from "../../../components/ui/plantillas";
import { BannerError, BotonGuardar, FormField, FormInput } from "../../../components/ui/patrones";
import { toaster } from "../../../components/ui/toaster";
import { formatoFecha } from "../../../common/utils/fechas";
import { guardarLaboratorio } from "../services/nutricionService";
import { SUBNUTRIENTES, type InfoNutricional } from "../types/nutricion";

const PARCIAL_NUMERICO = /^\d*[.,]?\d*$/;
const limpio = (v: string) => String(Number(v));

/**
 * Resultados de un análisis de laboratorio del producto (E11).
 *
 * La cátedra pide poder determinar la tabla "en base a los datos de los
 * ingredientes y/o análisis de laboratorio" o combinando ambos: un valor
 * cargado acá reemplaza al calculado y se marca ** en la tabla, como el sodio
 * de la milanesa de referencia.
 */
export function LaboratorioProducto({ info, onGuardado }: { info: InfoNutricional; onGuardado: () => Promise<void> }) {
  const primero = info.laboratorio[0];
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(info.laboratorio.map((v) => [v.nutriente, limpio(v.valor_100)])),
  );
  const [referencia, setReferencia] = useState(primero?.referencia ?? "");
  const [fecha, setFecha] = useState(primero?.fecha_analisis ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = (clave: string, valor: string) => {
    if (!PARCIAL_NUMERICO.test(valor.trim())) return;
    setValores((previos) => ({ ...previos, [clave]: valor }));
  };

  const guardar = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await guardarLaboratorio(info.producto_id, {
        referencia: referencia.trim() || null,
        fecha_analisis: fecha || null,
        valores: Object.entries(valores)
          .filter(([, v]) => v.trim() !== "")
          .map(([nutriente, v]) => ({ nutriente, valor_100: v.trim().replace(",", ".") })),
      });
      toaster.create({ type: "success", title: "Resultados de laboratorio guardados. La tabla se recalculó." });
      await onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los resultados.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SeccionDetalle
      titulo="Análisis de laboratorio"
      descripcion="Opcional. Un valor cargado acá reemplaza al calculado desde los ingredientes y se marca ** en la tabla."
      mb="0"
    >
      <Box as="form" {...{ noValidate: true }} onSubmit={guardar}>
        {error && <BannerError mb="4">{error}</BannerError>}
        <Stack gap="1.5" mb="4">
          {info.filas.map((f) => (
            <HStack key={f.clave} justify="space-between" gap="3">
              <Text fontSize="sm" pl={SUBNUTRIENTES.includes(f.clave) ? "4" : "0"} color={valores[f.clave] ? "fg" : "fg.muted"}>
                {f.nombre}
              </Text>
              <InputGroup endElement={<Text fontSize="xs" color="fg.muted">{f.unidad}</Text>} w="130px" flexShrink={0}>
                <FormInput
                  size="sm"
                  value={valores[f.clave] ?? ""}
                  onChange={(e) => cambiar(f.clave, e.target.value)}
                  inputMode="decimal"
                  textAlign="right"
                  placeholder="—"
                  aria-label={`${f.nombre} por 100 ${info.expresar_en} según laboratorio`}
                />
              </InputGroup>
            </HStack>
          ))}
        </Stack>
        <Text fontSize="xs" color="fg.muted" mb="4">Valores por 100 {info.expresar_en} de producto terminado.</Text>
        <FormField label="Laboratorio o informe" mb="3">
          <FormInput value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={300} placeholder="Ej: INTI, informe 2026-0412" />
        </FormField>
        <FormField label="Fecha del análisis" mb="4">
          <FormInput type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </FormField>
        {primero && (
          <Text fontSize="xs" color="fg.subtle" mb="3">
            Cargado el {formatoFecha(primero.cargado_en)}
            {primero.cargado_por ? ` por ${primero.cargado_por}` : ""}.
          </Text>
        )}
        <BotonGuardar loading={guardando} w="100%">Guardar resultados</BotonGuardar>
      </Box>
    </SeccionDetalle>
  );
}
