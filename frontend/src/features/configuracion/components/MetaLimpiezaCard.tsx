import { useState } from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { LuSprayCan } from "react-icons/lu";
import {
  AccionesFormulario,
  BotonGuardar,
  FormField,
  FormInput,
  MensajeError,
  Tarjeta,
} from "../../../components/ui/patrones";

// Mismo rango que valida el backend (`ConfiguracionAlertasUpdate`).
const MINIMO = 1;
const MAXIMO = 100;

/** El texto tiene que ser un entero dentro del rango; si no, `null`. */
function parsearPorcentaje(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;
  const valor = Number(limpio);
  return valor >= MINIMO && valor <= MAXIMO ? valor : null;
}

interface MetaLimpiezaCardProps {
  /** Valor que hoy está guardado en el servidor. */
  metaGuardada: number;
  guardando: boolean;
  /** Devuelve `true` si se guardó. */
  onGuardar: (porcentaje: number) => Promise<boolean>;
  /** Se llama al editar el campo, para limpiar mensajes de un guardado anterior. */
  onEditar: () => void;
}

/**
 * Meta de cumplimiento de las tareas de limpieza: por debajo, el inicio marca
 * Limpieza como "Para revisar" y su gráfico dibuja la línea de la meta.
 *
 * Por defecto es 100%: las BPM y los POES piden registrar todas las tareas
 * programadas. Se puede bajar para tener un umbral de aviso propio, pero cada
 * tarea sin hacer sigue siendo un desvío.
 */
export function MetaLimpiezaCard({ metaGuardada, guardando, onGuardar, onEditar }: MetaLimpiezaCardProps) {
  const [texto, setTexto] = useState(String(metaGuardada));

  const porcentaje = parsearPorcentaje(texto);
  const invalido = porcentaje === null;
  const sinCambios = porcentaje === metaGuardada;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (porcentaje === null || sinCambios) return;
    void onGuardar(porcentaje);
  };

  return (
    <Tarjeta p={{ base: "5", md: "6" }}>
      <form onSubmit={handleSubmit} noValidate>
        <HStack gap="3" align="flex-start" mb="5">
          <Box color="brand.700" mt="0.5" aria-hidden>
            <LuSprayCan size={22} />
          </Box>
          <Box>
            <Text fontWeight="bold" color="fg">
              Meta de cumplimiento de limpieza
            </Text>
            <Text mt="1" fontSize="sm" color="fg.muted">
              Porcentaje de tareas de limpieza que se espera completar. Si el
              cumplimiento de los últimos 30 días queda por debajo, el inicio
              marca Limpieza como “Para revisar”. Las BPM y los POES piden
              registrar todas las tareas programadas, por eso el valor
              recomendado es 100%.
            </Text>
          </Box>
        </HStack>

        <FormField
          label="Meta de cumplimiento de limpieza (%)"
          invalid={texto !== "" && invalido}
          helper={`Entre ${MINIMO}% y ${MAXIMO}%. Actualmente la meta es ${metaGuardada}%.`}
          mb="0"
        >
          <FormInput
            type="number"
            inputMode="numeric"
            min={MINIMO}
            max={MAXIMO}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              onEditar();
            }}
            maxW="160px"
          />
          {texto !== "" && invalido ? (
            <MensajeError>
              Ingresá un número entero entre {MINIMO} y {MAXIMO}.
            </MensajeError>
          ) : null}
          {!invalido && porcentaje < MAXIMO ? (
            <Text mt="2" fontSize="sm" color="#8a5a12">
              Con una meta menor a 100%, un período con tareas sin hacer puede
              figurar como al día. Cada tarea sin hacer sigue siendo un desvío
              para las BPM.
            </Text>
          ) : null}
        </FormField>

        <AccionesFormulario>
          <BotonGuardar loading={guardando} disabled={invalido || sinCambios}>
            Guardar cambios
          </BotonGuardar>
        </AccionesFormulario>
      </form>
    </Tarjeta>
  );
}
