import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, HStack, Portal, Spinner, Table, Text } from "@chakra-ui/react";

import { apiFetchImagen } from "../../../common/api/apiClient";
import {
  BLANCO,
  BORDE_SUAVE,
  GRIS_CLARO,
  TEAL,
  TEXTO_SECUNDARIO,
  TEXTO_TENUE,
} from "../../../common/theme/tokens";
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
    <HStack justify="center" gap="8px">
      <Button
        size="sm"
        variant="plain"
        color={TEAL}
        fontWeight="bold"
        textDecoration="underline"
        disabled={cargando}
        onClick={abrir}
      >
        {cargando ? "Abriendo…" : "Ver archivo"}
      </Button>
      {error && (
        <Text color={TEXTO_TENUE} fontSize="12px">
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
    <Portal>
      <Box
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <Box
          style={{
            backgroundColor: BLANCO,
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            width: "650px",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box as="h3" style={{ marginTop: 0, color: TEAL, marginBottom: "15px" }}>
            Historial de Calibraciones: <br />
            <strong>{equipo.nombre}</strong>
          </Box>

          <Box style={{ overflowY: "auto", marginBottom: "20px" }}>
            {cargando ? (
              <HStack justify="center" p="20px">
                <Spinner color={TEAL} />
              </HStack>
            ) : error ? (
              <Text color="red.500" textAlign="center" p="20px">
                {error}
              </Text>
            ) : historial.length === 0 ? (
              <Text color={TEXTO_TENUE} textAlign="center" p="20px">
                No hay calibraciones registradas para este equipo.
              </Text>
            ) : (
              <Table.Root
                variant="outline"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <Table.Header>
                  <Table.Row bg={TEAL}>
                    <Table.ColumnHeader
                      style={{ color: "white", padding: "10px", textAlign: "center" }}
                    >
                      Fecha realización
                    </Table.ColumnHeader>
                    <Table.ColumnHeader
                      style={{ color: "white", padding: "10px", textAlign: "center" }}
                    >
                      Próx. vencimiento
                    </Table.ColumnHeader>
                    <Table.ColumnHeader
                      style={{ color: "white", padding: "10px", textAlign: "center" }}
                    >
                      Certificado
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {historial.map((calib) => (
                    <Table.Row
                      key={calib.id}
                      style={{ borderBottom: `1px solid ${BORDE_SUAVE}` }}
                    >
                      <Table.Cell style={{ padding: "10px", textAlign: "center" }}>
                        {calib.fecha_realizacion}
                      </Table.Cell>
                      <Table.Cell
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          fontWeight: "bold",
                        }}
                      >
                        {calib.proximo_vencimiento}
                      </Table.Cell>
                      <Table.Cell style={{ padding: "10px", textAlign: "center" }}>
                        <BotonVerCertificado ruta={calib.certificado_url} />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Box>

          <HStack justify="center">
            <Button
              onClick={onClose}
              style={{
                padding: "8px 24px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: GRIS_CLARO,
                color: TEXTO_SECUNDARIO,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cerrar
            </Button>
          </HStack>
        </Box>
      </Box>
    </Portal>
  );
}