import { useEffect, useState } from "react";
import { Box, Button, Portal, Table, Text, HStack, Spinner } from "@chakra-ui/react";
import { obtenerHistorialCalibraciones } from "../services/equipoService";
import type { Equipo } from "../types/equipo";

interface HistorialCalibracionesDialogProps {
  isOpen: boolean;
  equipo: Equipo | null;
  onClose: () => void;
}

export function HistorialCalibracionesDialog({ isOpen, equipo, onClose }: HistorialCalibracionesDialogProps) {
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    // Si se abre el modal y hay un equipo seleccionado, vamos a buscar el historial al backend
    if (isOpen && equipo) {
      setCargando(true);
      obtenerHistorialCalibraciones(equipo.id)
        .then(data => setHistorial(data))
        .catch(err => console.error("Error cargando historial", err))
        .finally(() => setCargando(false));
    }
  }, [isOpen, equipo]);

  if (!isOpen || !equipo) return null;

  return (
    <Portal>
      <Box style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
        <Box style={{ backgroundColor: "white", padding: "25px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.2)", width: "650px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
          
          <Box as="h3" style={{ marginTop: 0, color: "#468189", marginBottom: "15px" }}>
            Historial de Calibraciones: <br /><strong>{equipo.nombre}</strong>
          </Box>

          <Box style={{ overflowY: "auto", marginBottom: "20px" }}>
            {cargando ? (
              <HStack justify="center" p="20px"><Spinner color="#468189" /></HStack>
            ) : historial.length === 0 ? (
              <Text color="gray.500" textAlign="center" p="20px">No hay calibraciones registradas para este equipo.</Text>
            ) : (
              <Table.Root variant="outline" style={{ width: "100%", borderCollapse: "collapse" }}>
                <Table.Header>
                  <Table.Row bg="#468189">
                    <Table.ColumnHeader style={{ color: "white", padding: "10px", textAlign: "center" }}>Fecha Realización</Table.ColumnHeader>
                    <Table.ColumnHeader style={{ color: "white", padding: "10px", textAlign: "center" }}>Próx. Vencimiento</Table.ColumnHeader>
                    <Table.ColumnHeader style={{ color: "white", padding: "10px", textAlign: "center" }}>Certificado</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {historial.map((calib) => (
                    <Table.Row key={calib.id} style={{ borderBottom: "1px solid #eee" }}>
                      <Table.Cell style={{ padding: "10px", textAlign: "center" }}>{calib.fecha_realizacion}</Table.Cell>
                      <Table.Cell style={{ padding: "10px", textAlign: "center", fontWeight: "bold" }}>{calib.proximo_vencimiento}</Table.Cell>
                      <Table.Cell style={{ padding: "10px", textAlign: "center" }}>
                        {/* El link redirige a la carpeta pública del backend */}
                        <a 
                          href={`http://localhost:8000${calib.certificado_url}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ color: "#17a2b8", fontWeight: "bold", textDecoration: "underline" }}
                        >
                          Ver archivo 📄
                        </a>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Box>

          <HStack justify="center">
            <Button onClick={onClose} style={{ padding: "8px 24px", borderRadius: "6px", border: "none", backgroundColor: "#e0e0e0", color: "#333", cursor: "pointer", fontWeight: "bold" }}>
              Cerrar
            </Button>
          </HStack>

        </Box>
      </Box>
    </Portal>
  );
}