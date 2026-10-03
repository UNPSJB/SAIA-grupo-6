import { useState } from "react";
import { Box, Button, Field, HStack, Input } from "@chakra-ui/react";
import { useAptitudes } from "../../aptitud/hooks/useAptitudes";
import type { VencimientosPorAptitud } from "../hooks/useVencimientosPersonal";

const estiloInput = {
  backgroundColor: "#fff",
  padding: "12px",
  width: "100%",
  borderRadius: "8px",
  border: "2px solid #90BEBB",
  fontSize: "16px",
  outline: "none",
  color: "#333",
};
const estiloLabel = {
  display: "block",
  fontSize: "14px",
  fontWeight: "bold" as const,
  marginBottom: "8px",
  color: "#555",
};

interface VencimientosPersonalFormProps {
  valores: VencimientosPorAptitud;
  onChange: (valores: VencimientosPorAptitud) => void;
}

export function VencimientosPersonalForm({ valores, onChange }: VencimientosPersonalFormProps) {
  const { aptitudes, loading } = useAptitudes(); // por defecto, solo las activas

  const idsCargados = Object.keys(valores).map(Number);
  const aptitudesDisponibles = aptitudes.filter((a) => !idsCargados.includes(a.id));
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

  return (
    <Box
      style={{
        backgroundColor: "#ffffff",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        marginBottom: "30px",
      }}
    >
      <Box as="h3" style={{ marginTop: 0, fontSize: "22px", color: "#468189", marginBottom: "8px" }}>
        Vencimientos de Aptitud
      </Box>
      <Box style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>
        Opcional — cargá solo los que tengas a mano.
      </Box>

      {loading && (
        <Box style={{ fontSize: "14px", color: "#888", fontStyle: "italic" }}>
          Cargando aptitudes...
        </Box>
      )}

      {!loading && aptitudesCargadas.length > 0 && (
        <Box mb="20px">
          {aptitudesCargadas.map((apt) => (
            <HStack
              key={apt.id}
              justify="space-between"
              style={{ padding: "10px 14px", backgroundColor: "#f4f9f8", borderRadius: "8px", marginBottom: "8px" }}
            >
              <Box style={{ fontSize: "15px", color: "#333" }}>
                <strong>{apt.nombre}</strong> — vence el {valores[apt.id]}
              </Box>
              <Button
                type="button"
                onClick={() => quitarVencimiento(apt.id)}
                style={{ background: "none", border: "none", color: "#c92a2a", fontWeight: "bold", cursor: "pointer", padding: 0 }}
              >
                Quitar
              </Button>
            </HStack>
          ))}
        </Box>
      )}

      {!loading && (
        aptitudesDisponibles.length > 0 ? (
          <HStack gap="15px" align="flex-end" flexWrap="wrap">
            <Field.Root>
              <Box as="label" style={estiloLabel}>APTITUD</Box>
              <select
                value={aptitudSeleccionada}
                onChange={(e) => setAptitudSeleccionada(e.target.value)}
                style={{ ...estiloInput, minWidth: "200px" }}
              >
                <option value="">Seleccionar...</option>
                {aptitudesDisponibles.map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    {apt.nombre}
                  </option>
                ))}
              </select>
            </Field.Root>
            <Field.Root>
              <Box as="label" style={estiloLabel}>FECHA DE VENCIMIENTO</Box>
              <Input
                type="date"
                value={fechaSeleccionada}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFechaSeleccionada(e.target.value)}
                style={estiloInput}
              />
            </Field.Root>
            <Button
              type="button"
              onClick={agregarVencimiento}
              disabled={!aptitudSeleccionada || !fechaSeleccionada}
              style={{
                backgroundColor: "#468189",
                color: "white",
                padding: "12px 20px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
                opacity: !aptitudSeleccionada || !fechaSeleccionada ? 0.5 : 1,
              }}
            >
              Agregar
            </Button>
          </HStack>
        ) : (
          <Box style={{ fontSize: "14px", color: "#888", fontStyle: "italic" }}>
            {aptitudes.length === 0
              ? "Todavía no hay aptitudes cargadas en el sistema. Creá una desde la sección Aptitudes."
              : "Ya cargaste todas las aptitudes disponibles."}
          </Box>
        )
      )}
    </Box>
  );
}