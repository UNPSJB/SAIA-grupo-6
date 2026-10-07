import { useState } from "react";
import { Box, Button, Input, Portal, Text } from "@chakra-ui/react";
import { actualizarVencimiento } from "../../vencimientoPersonal/services/vencimientoPersonalService";
import type { Notificacion } from "../types/notificacion";

interface CambiarFechaVencimientoDialogProps {
  notificacion: Notificacion;
  onClose: () => void;
  onSaved: () => void;
}

// Fecha de hoy en hora LOCAL (toISOString() usa UTC y de noche daría "mañana")
function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function formatearFecha(fecha?: string) {
  if (!fecha) return "-";
  return new Date(`${fecha.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR");
}

export function CambiarFechaVencimientoDialog({
  notificacion,
  onClose,
  onSaved,
}: CambiarFechaVencimientoDialogProps) {
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoy = hoyISO();

  const handleGuardar = async () => {
    if (!fecha) {
      setError("Ingresá la nueva fecha de vencimiento.");
      return;
    }
    if (fecha < hoy) {
      setError("La fecha de vencimiento no puede ser anterior a hoy.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      await actualizarVencimiento(notificacion.entidad_id, { fecha_vencimiento: fecha });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el vencimiento.");
      setGuardando(false);
    }
  };

  return (
    <Portal>
      <Box style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
        <Box style={{ backgroundColor: "white", padding: "25px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.2)", width: "400px", maxWidth: "90vw" }}>
          <Box as="h3" style={{ marginTop: 0, color: "#333" }}>Renovar vencimiento</Box>
          <Text style={{ color: "#555", marginBottom: "6px" }}>{notificacion.mensaje}</Text>
          <Text style={{ color: "#777", fontSize: "14px", marginBottom: "16px" }}>
            Fecha actual: <strong>{formatearFecha(notificacion.fecha_referencia)}</strong>
          </Text>

          <Text style={{ fontWeight: "bold", color: "#333", marginBottom: "4px" }}>
            Nueva fecha de vencimiento
          </Text>
          <Input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />

          {error && (
            <Text style={{ color: "#c53030", fontSize: "14px", marginTop: "8px" }}>{error}</Text>
          )}

          <Box style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
            <Button onClick={onClose} disabled={guardando} height="auto" minW="auto"
              style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #ccc", backgroundColor: "#fff", cursor: "pointer", fontWeight: "bold" }}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} loading={guardando} height="auto" minW="auto"
              style={{ padding: "8px 16px", borderRadius: "6px", border: "none", backgroundColor: "#3182ce", color: "white", cursor: "pointer", fontWeight: "bold" }}>
              Guardar fecha
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}