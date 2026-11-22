import { useState } from "react";
import { Box, Button, HStack, Text } from "@chakra-ui/react";
import {
  BotonTexto,
  FormField,
  FormNativeSelect,
  SelectPlaceholder,
} from "../../../components/ui/patrones";
import { InputFecha, SeccionFormulario } from "../../../components/ui/formularios";
import { useAptitudes } from "../../aptitud/hooks/useAptitudes";
import { hoyISO } from "../../../common/utils/fechas";
import type { VencimientosPorAptitud } from "../hooks/useVencimientosPersonal";

interface VencimientosPersonalFormProps {
  valores: VencimientosPorAptitud;
  onChange: (valores: VencimientosPorAptitud) => void;
}

/**
 * Sub-formulario embebido en el alta/edición de Personal: no es una página,
 * así que es una `SeccionFormulario` más del formulario de Personal (llega
 * por su prop `extra`), con su título y el filete que la separa.
 */
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
    <SeccionFormulario
      titulo="Vencimientos de aptitud"
      ayuda="Opcional: cargá solo los que tengas a mano."
    >

      {loading && (
        <Text fontSize="sm" color="fg.muted" fontStyle="italic">
          Cargando aptitudes...
        </Text>
      )}

      {!loading && aptitudesCargadas.length > 0 && (
        <Box mb="6">
          {aptitudesCargadas.map((apt) => (
            <HStack
              key={apt.id}
              justify="space-between"
              p="3"
              bg="brand.subtle"
              rounded="lg"
              mb="2"
            >
              <Text fontSize="sm" color="fg">
                <strong>{apt.nombre}</strong> — vence el {valores[apt.id]}
                {!apt.activo && (
                  <Text as="span" color="red.fg" fontSize="xs" fontWeight="bold">
                    {" "}
                    (aptitud dada de baja)
                  </Text>
                )}
              </Text>
              <BotonTexto
                color="red.fg"
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
            <Box flex="1" minW="200px">
              <FormField label="Aptitud" mb="0">
                <FormNativeSelect
                  value={aptitudSeleccionada}
                  onChange={(e) => setAptitudSeleccionada(e.target.value)}
                >
                  <SelectPlaceholder value="">Seleccionar...</SelectPlaceholder>
                  {aptitudesDisponibles.map((apt) => (
                    <option key={apt.id} value={apt.id}>
                      {apt.nombre}
                    </option>
                  ))}
                </FormNativeSelect>
              </FormField>
            </Box>
            <Box flex="1" minW="200px">
              <FormField label="Fecha de vencimiento" mb="0">
                <InputFecha
                  value={fechaSeleccionada}
                  min={hoyISO()}
                  onChange={(e) => setFechaSeleccionada(e.target.value)}
                />
              </FormField>
            </Box>
            <Button
              type="button"
              onClick={agregarVencimiento}
              disabled={!puedeAgregar}
              colorPalette="brand"
              variant="outline"
              h="11"
            >
              Agregar
            </Button>
          </HStack>
        ) : (
          <Text fontSize="sm" color="fg.muted" fontStyle="italic">
            {aptitudes.length === 0
              ? "Todavía no hay aptitudes cargadas en el sistema. Creá una desde la sección Aptitudes."
              : "Ya cargaste todas las aptitudes disponibles."}
          </Text>
        )
      )}
    </SeccionFormulario>
  );
}
