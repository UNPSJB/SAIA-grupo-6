import { useEffect, useState } from "react";
import { Box, Button, Input, Text } from "@chakra-ui/react";
import {
  actualizarConfiguracionAlertas,
  obtenerConfiguracionAlertas,
} from "../services/notificacionService";

interface ConfiguracionAlertasPanelProps {
  onGuardado: () => void;
}

export function ConfiguracionAlertasPanel({
  onGuardado,
}: ConfiguracionAlertasPanelProps) {
  const [dias, setDias] = useState("");
  const [diasGuardados, setDiasGuardados] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const config = await obtenerConfiguracionAlertas();
        setDias(String(config.dias_alerta_vencimiento_personal));
        setDiasGuardados(config.dias_alerta_vencimiento_personal);
      } catch {
        setError("No se pudo cargar la configuración.");
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const valor = Number(dias);
  const valido = Number.isInteger(valor) && valor >= 1 && valor <= 365;

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      setError(null);
      const config = await actualizarConfiguracionAlertas(valor);
      setDiasGuardados(config.dias_alerta_vencimiento_personal);
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Box
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
        padding: "12px 16px",
        marginBottom: "16px",
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
      }}
    >
      <Text style={{ color: "#4a5568", fontWeight: "bold" }}>
        Alertar vencimientos de personal con
      </Text>
      <Input
        type="number"
        min={1}
        max={365}
        value={dias}
        onChange={(e) => setDias(e.target.value)}
        width="90px"
        bg="white"
      />
      <Text style={{ color: "#4a5568", fontWeight: "bold" }}>
        días de antelación
      </Text>
      <Button
        onClick={handleGuardar}
        loading={guardando}
        disabled={!valido || valor === diasGuardados}
        size="sm"
        bg="#3182ce"
        color="white"
        _hover={{ bg: "#2b6cb0" }}
        fontWeight="bold"
        borderRadius="6px"
      >
        Guardar
      </Button>
      {!valido && dias !== "" && (
        <Text style={{ color: "#c53030", fontSize: "14px" }}>
          Ingresá un número entre 1 y 365.
        </Text>
      )}
      {error && (
        <Text style={{ color: "#c53030", fontSize: "14px" }}>{error}</Text>
      )}
    </Box>
  );
}