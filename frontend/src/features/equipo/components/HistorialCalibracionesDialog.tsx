import { useCallback, useEffect, useRef, useState } from "react";
import { Box, HStack, Spinner, Table, Text } from "@chakra-ui/react";

import { apiFetchImagen } from "../../../common/api/apiClient";
import {
  BotonCancelar,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
} from "../../../components/ui/patrones";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import { obtenerHistorialCalibraciones } from "../services/equipoService";
import type { Calibracion, Equipo } from "../types/equipo";

/**
 * Abre el certificado en una pestaña nueva.
 *
 * No puede ser un `<a href>` común: el endpoint /uploads exige el token JWT y
 * un link directo se descargaría con un 401. Por eso el archivo se pide con
 * `apiFetch` (que adjunta el token y renueva la sesión ante un 401) y se abre
 * la URL de objeto que devuelve.
 */
function BotonVerCertificado({ ruta }: { ruta: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La URL del blob se libera al cambiar o al desmontar, pero NO apenas se
  // abre: revocar antes de que la pestaña termine de leerla la deja en blanco.
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  const abrir = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const url = await apiFetchImagen(ruta);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("No se pudo abrir el certificado.");
    } finally {
      setCargando(false);
    }
  }, [ruta]);

  return (
    <HStack justify="center" gap="2">
      <BotonTexto onClick={abrir} disabled={cargando}>
        {cargando ? "Abriendo…" : "Ver archivo"}
      </BotonTexto>
      {error && (
        <Text color="red.fg" fontSize="xs">
          {error}
        </Text>
      )}
    </HStack>
  );
}

interface HistorialCalibracionesDialogProps {
  isOpen: boolean;
  equipo: Equipo | null;
  onClose: () => void;
}

export function HistorialCalibracionesDialog({
  isOpen,
  equipo,
  onClose,
}: HistorialCalibracionesDialogProps) {
  // El estado guarda también el `equipoId` para el que se pidió, así durante
  // el render se puede derivar `cargando` (y descartar un resultado que ya no
  // corresponde) sin setState dentro del efecto.
  const [carga, setCarga] = useState<{
    equipoId: number;
    historial: Calibracion[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !equipo) return;

    let vigente = true;

    obtenerHistorialCalibraciones(equipo.id)
      .then((historial) => {
        if (vigente) setCarga({ equipoId: equipo.id, historial, error: null });
      })
      .catch((err) => {
        if (!vigente) return;
        setCarga({
          equipoId: equipo.id,
          historial: [],
          error:
            err instanceof Error
              ? err.message
              : "No se pudo cargar el historial de calibraciones.",
        });
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, equipo]);

  if (!isOpen || !equipo) return null;

  // Todavía no hay resultado para este equipo: la petición está en curso.
  const cargando = !carga || carga.equipoId !== equipo.id;
  const historial = cargando ? [] : carga.historial;
  const error = cargando ? null : carga.error;

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="400px"
        maxWidth="90vw"
        maxHeight="80vh"
        display="flex"
        flexDirection="column"
      >
        <DialogTitle
          as="h3"
          mt={0}
          mb="4"
          fontSize="lg"
          fontWeight="bold"
          color="fg"
        >
          Historial de calibraciones: <br />
          <strong>{equipo.nombre}</strong>
        </DialogTitle>

        <Box overflowY="auto" mb="5">
          {cargando ? (
            <HStack justify="center" p="5">
              <Spinner color="brand.500" />
            </HStack>
          ) : error ? (
            <Text color="red.fg" textAlign="center" p="5" role="alert">
              {error}
            </Text>
          ) : historial.length === 0 ? (
            <Text color="fg.subtle" textAlign="center" p="5">
              No hay calibraciones registradas para este equipo.
            </Text>
          ) : (
            <Table.Root variant="outline" w="100%">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro center>Fecha realización</EncabezadoOscuro>
                  <EncabezadoOscuro center>Próx. vencimiento</EncabezadoOscuro>
                  <EncabezadoOscuro center>Certificado</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {historial.map((calib) => (
                  <Table.Row
                    key={calib.id}
                    borderBottomWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Celda p="3" center>
                      {calib.fecha_realizacion}
                    </Celda>
                    <Celda p="3" center fontWeight="bold">
                      {calib.proximo_vencimiento}
                    </Celda>
                    <Celda p="3" center>
                      <BotonVerCertificado ruta={calib.certificado_url} />
                    </Celda>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>

        <HStack justify="center">
          <BotonCancelar onClick={onClose}>Cerrar</BotonCancelar>
        </HStack>
      </DialogContent>
    </DialogRoot>
  );
}
