import { avisarExito } from "../../../../components/ui/patrones";
import { useEffect, useState } from "react";
import { Box, Button, HStack, Image, Skeleton, Stack, Text } from "@chakra-ui/react";
import { LuCamera, LuCheck, LuHistory, LuX } from "react-icons/lu";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import { formatoFechaHora } from "../../../../common/utils/fechas";
import { DialogContent, DialogRoot, DialogTitle } from "../../../../components/ui/dialog";
import {
  BotonCancelar,
  EstadoCargando,
  FormField,
  FormNativeSelect,
  MensajeError,
  SelectPlaceholder,
} from "../../../../components/ui/patrones";
import { usePersonales } from "../../../personal/hooks/usePersonales";
import { asignarCobertura, obtenerHistorialRegistro } from "../../services/checklistService";
import type { HistorialRegistroTareaItem, TareaDelDia } from "../../types/checklist";

/** Marco común de los diálogos del checklist (portal, foco atrapado). */
function Dialogo({ ancho, children }: { ancho: string; children: React.ReactNode }) {
  return (
    <DialogRoot open placement="center" motionPreset="scale" closeOnEscape={false} closeOnInteractOutside={false}>
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="xl"
        boxShadow="dialog"
        width={ancho}
        maxW="92vw"
        maxH="85vh"
        overflowY="auto"
        textAlign="left"
      >
        {children}
      </DialogContent>
    </DialogRoot>
  );
}

/* ─────────────────────────── Evidencia ─────────────────────────── */

export function FotoEvidenciaDialog({ ruta, onCerrar }: { ruta: string; onCerrar: () => void }) {
  // /uploads exige token: la imagen se baja con la sesión, y solo con el diálogo abierto.
  const imagen = useImagenAutenticada(ruta);
  return (
    <Dialogo ancho="auto">
      <DialogTitle fontSize="lg" fontWeight="semibold" color="fg" mb="4">
        Evidencia fotográfica
      </DialogTitle>
      {imagen.loading && <Skeleton h="300px" w="400px" maxW="100%" rounded="lg" />}
      {!imagen.loading && imagen.error && <MensajeError>{imagen.error}</MensajeError>}
      {imagen.src && (
        <Image src={imagen.src} alt="Evidencia fotográfica" maxW="100%" maxH="60vh" objectFit="contain" rounded="lg" />
      )}
      <HStack justify="flex-end" mt="5">
        <BotonCancelar onClick={onCerrar}>Cerrar</BotonCancelar>
      </HStack>
    </Dialogo>
  );
}

/* ─────────────────────────── Historial ─────────────────────────── */

/**
 * Historial auditable de una tarea como línea de tiempo: cada evento es un
 * punto sobre un eje vertical, con la acción destacada, quién la hizo y la
 * fecha y hora en dígitos tabulares (se alinean de un evento a otro).
 */
export function HistorialTareaDialog({
  registroId,
  nombreTarea,
  onCerrar,
}: {
  registroId: number;
  nombreTarea: string;
  onCerrar: () => void;
}) {
  const [eventos, setEventos] = useState<HistorialRegistroTareaItem[] | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerHistorialRegistro(registroId)
      .then((datos) => vigente && setEventos(datos.eventos))
      .catch(() => vigente && setEventos([]));
    return () => {
      vigente = false;
    };
  }, [registroId]);

  return (
    <Dialogo ancho="460px">
      <DialogTitle fontSize="lg" fontWeight="semibold" color="fg">
        Historial de cambios
      </DialogTitle>
      <Text fontSize="sm" color="fg.muted" mt="1" mb="5">
        {nombreTarea}
      </Text>

      {eventos === null ? (
        <Stack gap="4" aria-busy="true" aria-label="Cargando historial">
          {[0, 1, 2].map((i) => (
            <HStack key={i} gap="3" align="flex-start">
              <Skeleton boxSize="8" rounded="full" />
              <Stack gap="2" flex="1">
                <Skeleton h="3.5" w="40%" />
                <Skeleton h="3" w="70%" />
              </Stack>
            </HStack>
          ))}
        </Stack>
      ) : eventos.length === 0 ? (
        <Stack align="center" gap="2" py="8" color="fg.muted" textAlign="center">
          <Box p="3" rounded="full" bg="bg.muted" display="inline-flex" aria-hidden>
            <LuHistory size={22} />
          </Box>
          <Text fontWeight="medium" color="fg">
            Sin eventos registrados
          </Text>
          <Text fontSize="sm">Cuando alguien marque o desmarque esta tarea, va a quedar acá.</Text>
        </Stack>
      ) : (
        <Box as="ol" position="relative" listStyleType="none" m="0" p="0">
          {eventos.map((ev, i) => {
            const ultimo = i === eventos.length - 1;
            return (
              <Box as="li" key={ev.id} position="relative" ps="11" pb={ultimo ? "0" : "5"}>
                {/* Eje vertical */}
                {!ultimo && (
                  <Box position="absolute" left="15px" top="8" bottom="0" w="2px" bg="border.subtle" aria-hidden />
                )}
                {/* Punto del evento */}
                <Box
                  position="absolute"
                  left="0"
                  top="0"
                  boxSize="8"
                  rounded="full"
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={ev.completado ? "green.subtle" : "red.subtle"}
                  color={ev.completado ? "green.fg" : "red.fg"}
                  borderWidth="2px"
                  borderColor="bg.panel"
                  aria-hidden
                >
                  {ev.completado ? <LuCheck size={16} /> : <LuX size={16} />}
                </Box>
                <HStack gap="2" flexWrap="wrap" pt="1">
                  <Text fontWeight="semibold" color="fg" fontSize="sm">
                    {ev.completado ? "Marcada como completada" : "Desmarcada"}
                  </Text>
                  {ev.evidencia_url && (
                    <HStack gap="1" fontSize="xs" color="teal.fg">
                      <LuCamera size={12} aria-hidden />
                      <Text as="span">con foto</Text>
                    </HStack>
                  )}
                </HStack>
                <Text fontSize="sm" color="fg.muted" mt="0.5">
                  {ev.usuario_nombre ?? "Usuario no identificado"}
                </Text>
                <Text fontSize="xs" color="fg.subtle" mt="0.5" fontVariantNumeric="tabular-nums">
                  {formatoFechaHora(ev.fecha_evento)}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      <HStack justify="flex-end" mt="6">
        <BotonCancelar onClick={onCerrar}>Cerrar</BotonCancelar>
      </HStack>
    </Dialogo>
  );
}

/* ─────────────────────────── Cobertura ─────────────────────────── */

export function CoberturaDialog({
  tarea,
  onClose,
  onGuardado,
}: {
  tarea: TareaDelDia;
  onClose: () => void;
  onGuardado: () => Promise<void> | void;
}) {
  // El hook vive acá: solo se ejecuta cuando administración abre el diálogo.
  const { personales: operadoresDisponibles, loading: cargandoOperadores } = usePersonales(
    { rol: "operador" },
    50,
  );
  // Arranca en el suplente actual, si ya tenía uno.
  const [operadorId, setOperadorId] = useState<number | null>(tarea.reemplazado_por_id ?? null);
  const [guardando, setGuardando] = useState(false);
  const responsable = tarea.operador_nombre;

  return (
    <Dialogo ancho="450px">
      <DialogTitle fontSize="lg" fontWeight="semibold" color="fg" mb="2">
        Asignar suplente
      </DialogTitle>
      <Text fontSize="sm" color="fg.muted" mb="4">
        {tarea.nombre}
        {responsable ? ` · Responsable: ${responsable}` : " · Sin responsable"}
      </Text>
      <FormField
        label="Operador suplente"
        mb="4"
        helper="El suplente ve la tarea en su checklist y la puede marcar. El responsable no cambia."
      >
        <FormNativeSelect
          value={operadorId ?? ""}
          onChange={(e) => setOperadorId(e.target.value === "" ? null : Number(e.target.value))}
        >
          <SelectPlaceholder value="">
            {responsable ? `Sin suplente (la hace ${responsable})` : "Elegí un operador"}
          </SelectPlaceholder>
          {operadoresDisponibles
            .filter((operador) => operador.id !== tarea.operador_id)
            .map((operador) => (
              <option key={operador.id} value={operador.id}>
                {operador.nombre} {operador.apellido || ""}
              </option>
            ))}
        </FormNativeSelect>
      </FormField>
      {cargandoOperadores && <EstadoCargando>Cargando operadores...</EstadoCargando>}
      <HStack justify="flex-end" mt="6" gap="3">
        <BotonCancelar onClick={onClose}>Cancelar</BotonCancelar>
        <Button
          type="button"
          colorPalette="brand"
          onClick={async () => {
            setGuardando(true);
            try {
              await asignarCobertura(tarea.registro_id, operadorId);
              avisarExito("Cobertura asignada correctamente.");
              onClose();
              await onGuardado();
            } catch {
              // asignarCobertura ya comunica el error vía pedir
            } finally {
              setGuardando(false);
            }
          }}
          disabled={guardando}
          loading={guardando}
        >
          Guardar
        </Button>
      </HStack>
    </Dialogo>
  );
}
