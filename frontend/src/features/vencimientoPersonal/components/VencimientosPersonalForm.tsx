import { useState } from "react";
import { Box, Button, Field, Heading, HStack, Input, NativeSelect, Text } from "@chakra-ui/react";
import { BotonTexto } from "../../../components/ui/patrones";
import { useAptitudes } from "../../aptitud/hooks/useAptitudes";
import { hoyISO } from "../../../common/utils/fechas";
import type { VencimientosPorAptitud } from "../hooks/useVencimientosPersonal";

interface VencimientosPersonalFormProps {
  valores: VencimientosPorAptitud;
  onChange: (valores: VencimientosPorAptitud) => void;
}

export function VencimientosPersonalForm({ valores, onChange }: VencimientosPersonalFormProps) {
  // Se piden las aptitudes incluyendo las dadas de baja a propósito: una
  // aptitud con vencimiento cargado puede bajar de baja después, y
  // antes se pedía solo la lista de activas, así que su vencimiento
  // desaparecía de la tabla sin poder quitarlo — pero `guardarVencimientos`
  // seguía mandándolo al backend.
  const { aptitudes, loading } = useAptitudes(true);

  const idsCargados = Object.keys(valores).map(Number);
  const aptitudesDisponibles = aptitudes.filter(
    (a) => a.activo && !idsCargados.includes(a.id)
  );
  const aptitudesCargadas = aptitudes.filter((a) => idsCargados.includes(a.id));

  const [aptitudSeleccionada, setAptitudSeleccionada] = useState<string>("");
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");

  const agregarVencimiento = () => {
    if (!aptitudSeleccionada || !fechaSeleccionada) return;
    onChange({ ...valores, [Number(aptitudSeleccionada)]: fechaSeleccionada });
    setAptitudSeleccionada("");
    setFechaSeleccionada("");
  };

  const quitarVencimiento = (aptitudId: number) => {
    const nuevo = { ...valores };
    delete nuevo[aptitudId];
    onChange(nuevo);
  };

  const puedeAgregar = Boolean(aptitudSeleccionada && fechaSeleccionada);

  return (
    <Box bg="white" p="8" rounded="xl" boxShadow="card" mb="8">
      <Heading as="h3" mt={0} fontSize="2xl" fontWeight="bold" color="brand.500" mb="2">
        Vencimientos de Aptitud
      </Heading>
      <Text fontSize="xs" color="gray.500" mb="5">
        Opcional — cargá solo los que tengas a mano.
      </Text>

      {loading && (
        <Text fontSize="sm" color="gray.500" fontStyle="italic">
          Cargando aptitudes...
        </Text>
      )}

      {!loading && aptitudesCargadas.length > 0 && (
        <Box mb="5">
          {aptitudesCargadas.map((apt) => (
            <HStack
              key={apt.id}
              justify="space-between"
              p="2.5 3.5"
              bg="brand.50"
              rounded="lg"
              mb="2"
            >
              <Text fontSize="sm" color="gray.800">
                <strong>{apt.nombre}</strong> — vence el {valores[apt.id]}
                {!apt.activo && (
                  <Text as="span" color="red.600" fontSize="xs" fontWeight="bold">
                    {" "}
                    (aptitud dada de baja)
                  </Text>
                )}
              </Text>
              <BotonTexto
                color="red.700"
                onClick={() => quitarVencimiento(apt.id)}
                title={`Quitar el vencimiento de ${apt.nombre}`}
              >
                Quitar
              </BotonTexto>
            </HStack>
          ))}
        </Box>
      )}

      {!loading && (
        aptitudesDisponibles.length > 0 ? (
          <HStack gap="4" align="flex-end" flexWrap="wrap">
            <Field.Root>
              <Field.Label color="gray.600">APTITUD</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={aptitudSeleccionada}
                  onChange={(e) => setAptitudSeleccionada(e.target.value)}
                  w="100%"
                  minW="200px"
                  bg="white"
                  borderWidth="2px"
                  borderColor="brand.300"
                  borderRadius="lg"
                >
                  <option value="">Seleccionar...</option>
                  {aptitudesDisponibles.map((apt) => (
                    <option key={apt.id} value={apt.id}>
                      {apt.nombre}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Field.Root>
              <Field.Label color="gray.600">FECHA DE VENCIMIENTO</Field.Label>
              <Input
                type="date"
                value={fechaSeleccionada}
                min={hoyISO()}
                onChange={(e) => setFechaSeleccionada(e.target.value)}
                w="100%"
              />
            </Field.Root>
            <Button
              type="button"
              onClick={agregarVencimiento}
              disabled={!puedeAgregar}
              colorPalette="brand"
              variant="solid"
              rounded="lg"
              fontWeight="bold"
              px="6"
              py="3"
            >
              Agregar
            </Button>
          </HStack>
        ) : (
          <Text fontSize="sm" color="gray.500" fontStyle="italic">
            {aptitudes.length === 0
              ? "Todavía no hay aptitudes cargadas en el sistema. Creá una desde la sección Aptitudes."
              : "Ya cargaste todas las aptitudes disponibles."}
          </Text>
        )
      )}
    </Box>
  );
}