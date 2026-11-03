import { useRef, useState } from "react";
import { Box, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import {
  BannerError,
  BannerExito,
  BotonCancelar,
  BotonGuardar,
  FormInput,
  FormNativeSelect,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import { asociarInsumos } from "../services/loteService";
import type {
  InsumoLote,
  InsumoResumen,
  Lote,
} from "../types/lote";

interface FilaInsumo {
  id: number;
  insumoId: string;
  cantidad: string;
}

interface AsociarInsumosProps {
  lote: Lote;
  insumos: InsumoResumen[];
  onNuevoLote: () => void;
  insumosIniciales?: InsumoLote[];
  textoCancelar?: string;
}

function filaVacia(id: number): FilaInsumo {
  return { id, insumoId: "", cantidad: "" };
}

export function AsociarInsumos({
  lote,
  insumos,
  onNuevoLote,
  insumosIniciales = [],
  textoCancelar = "Registrar otro lote",
}: AsociarInsumosProps) {
  const siguienteId = useRef(2);
  const [filas, setFilas] = useState<FilaInsumo[]>([filaVacia(1)]);
  const [asociados, setAsociados] = useState<InsumoLote[]>(insumosIniciales);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const disponibles = insumos.filter(
    (insumo) => !asociados.some((item) => item.insumo_id === insumo.id)
  );

  const actualizarFila = (id: number, cambios: Partial<FilaInsumo>) => {
    setFilas((prev) =>
      prev.map((fila) => (fila.id === id ? { ...fila, ...cambios } : fila))
    );
  };

  const agregarFila = () => {
    const id = siguienteId.current++;
    setFilas((prev) => [...prev, filaVacia(id)]);
  };

  const quitarFila = (id: number) => {
    setFilas((prev) => prev.filter((fila) => fila.id !== id));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    const seleccionados = filas.filter(
      (fila) => fila.insumoId !== "" || fila.cantidad.trim() !== ""
    );
    if (seleccionados.length === 0) {
      setError("Seleccioná al menos un insumo para asociar.");
      return;
    }

    const incompletos = seleccionados.some(
      (fila) => fila.insumoId === "" || Number(fila.cantidad) <= 0
    );
    if (incompletos) {
      setError("Completá el insumo y una cantidad mayor a cero en cada fila.");
      return;
    }

    const ids = seleccionados.map((fila) => Number(fila.insumoId));
    if (new Set(ids).size !== ids.length) {
      setError("No se puede repetir un insumo en la misma asociación.");
      return;
    }

    setLoading(true);
    try {
      const creados = await asociarInsumos(
        lote.id,
        seleccionados.map((fila) => ({
          insumo_id: Number(fila.insumoId),
          cantidad: fila.cantidad,
        }))
      );
      setAsociados((prev) => [...prev, ...creados]);
      setFilas([filaVacia(siguienteId.current++)]);
      setMensaje("Insumos asociados correctamente al lote.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron asociar los insumos."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TarjetaFormulario>
      <TituloFormulario>Asociar insumos al lote</TituloFormulario>

      <Text fontSize="sm" color="fg.muted" mb="5">
        Lote <b>{lote.codigo_lote}</b> · {lote.producto_nombre}
      </Text>

      {error && <BannerError>{error}</BannerError>}
      {mensaje && <BannerExito>{mensaje}</BannerExito>}

      {asociados.length > 0 && (
        <Box mb="5">
          <Text fontSize="sm" fontWeight="semibold" color="fg" mb="2">
            Insumos ya asociados
          </Text>
          <Stack gap="1">
            {asociados.map((item) => (
              <Text key={item.id} fontSize="sm" color="fg.muted">
                · {item.insumo.nombre}: {item.cantidad}{" "}
                {item.insumo.unidad_medida.simbolo}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      {disponibles.length === 0 ? (
        <Text fontSize="sm" color="fg.subtle" mb="5">
          {asociados.length > 0
            ? "Ya asociaste todos los insumos disponibles a este lote."
            : "No hay insumos disponibles para asociar. Cargalos desde el maestro de insumos."}
        </Text>
      ) : (
        <Box as="form" onSubmit={handleSubmit}>
          <Stack gap="3" mb="5">
            {filas.map((fila) => {
              const insumo = disponibles.find(
                (item) => String(item.id) === fila.insumoId
              );

              return (
                <Flex
                  key={fila.id}
                  gap="3"
                  align={{ base: "stretch", md: "end" }}
                  direction={{ base: "column", md: "row" }}
                >
                  <Box flex="1">
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Insumo
                    </Text>
                    <FormNativeSelect
                      value={fila.insumoId}
                      onChange={(event) =>
                        actualizarFila(fila.id, {
                          insumoId: event.target.value,
                        })
                      }
                      aria-label="Insumo"
                    >
                      <option value="">Seleccioná un insumo</option>
                      {disponibles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre} ({item.unidad_medida.simbolo})
                        </option>
                      ))}
                    </FormNativeSelect>
                  </Box>

                  <Box w={{ base: "full", md: "160px" }}>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Cantidad{insumo ? ` (${insumo.unidad_medida.simbolo})` : ""}
                    </Text>
                    <FormInput
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={fila.cantidad}
                      onChange={(event) =>
                        actualizarFila(fila.id, {
                          cantidad: event.target.value,
                        })
                      }
                      aria-label="Cantidad"
                    />
                  </Box>

                  <Button
                    type="button"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => quitarFila(fila.id)}
                    disabled={filas.length === 1}
                  >
                    Quitar
                  </Button>
                </Flex>
              );
            })}
          </Stack>

          <HStack gap="3" flexWrap="wrap" mb="5">
            <Button type="button" variant="outline" onClick={agregarFila}>
              Agregar otro insumo
            </Button>
          </HStack>

          <HStack gap="3" flexWrap="wrap">
            <BotonGuardar loading={loading} disabled={loading}>
              Asociar insumos
            </BotonGuardar>
            <BotonCancelar onClick={onNuevoLote} disabled={loading}>
              {textoCancelar}
            </BotonCancelar>
          </HStack>
        </Box>
      )}

      {disponibles.length === 0 && (
        <HStack gap="3" flexWrap="wrap">
          <BotonCancelar onClick={onNuevoLote}>{textoCancelar}</BotonCancelar>
        </HStack>
      )}
    </TarjetaFormulario>
  );
}
