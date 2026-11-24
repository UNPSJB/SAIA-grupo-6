import type { ReactNode } from "react";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { LuFlag, LuLock, LuLockOpen } from "react-icons/lu";
import { BannerError, EstadoCargando } from "../../../components/ui/patrones";
import { SeccionDetalle } from "../../../components/ui/plantillas";
import { useHistorialIncidente } from "../hooks/useHistorialIncidente";
import type { Incidente } from "../types/incidente";
import { formatoFecha } from "../types/incidente";

function Evento({
  icono,
  titulo,
  fecha,
  usuario,
  observacion,
}: {
  icono: ReactNode;
  titulo: string;
  fecha: string;
  usuario: string;
  observacion?: string | null;
}) {
  return (
    <Box borderLeftWidth="3px" borderLeftColor="brand.500" pl="3">
      <HStack gap="2" fontSize="sm" fontWeight="bold" color="fg">
        <Box as="span" display="inline-flex" aria-hidden>
          {icono}
        </Box>
        <Text as="span">{titulo}</Text>
      </HStack>
      <Text fontSize="xs" color="fg.muted">
        {formatoFecha(fecha)} — {usuario}
      </Text>
      {observacion && (
        <Text fontSize="sm" color="fg" mt="1" whiteSpace="pre-line" wordBreak="break-word">
          {observacion}
        </Text>
      )}
    </Box>
  );
}

/**
 * Línea de tiempo del incidente: el reporte y cada cierre o reapertura. El
 * reporte no es una fila del historial; se arma con los datos del incidente.
 */
export function HistorialIncidente({ incidente }: { incidente: Incidente }) {
  const { historial, loading, error } = useHistorialIncidente(incidente.id);

  return (
    <SeccionDetalle titulo="Historial">
      <VStack align="stretch" gap="4">
        <Evento
          icono={<LuFlag size={16} />}
          titulo="Reporte"
          fecha={incidente.fecha_reporte}
          usuario={incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
        />
        {loading && <EstadoCargando>Cargando historial...</EstadoCargando>}
        {error && <BannerError mb="0">{error}</BannerError>}
        {historial.map((evento) => {
          const reabre = evento.estado_nuevo === "abierto";
          return (
            <Evento
              key={evento.id}
              icono={reabre ? <LuLockOpen size={16} /> : <LuLock size={16} />}
              titulo={reabre ? "Reapertura" : "Cierre"}
              fecha={evento.fecha_evento}
              usuario={evento.usuario_nombre ?? `Usuario #${evento.usuario_id}`}
              observacion={evento.observacion}
            />
          );
        })}
      </VStack>
    </SeccionDetalle>
  );
}
