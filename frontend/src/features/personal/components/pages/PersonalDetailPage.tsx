import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Table, Text } from "@chakra-ui/react";
import { usePersonal } from "../../hooks/usePersonal";
import { useVencimientosPersonal } from "../../../vencimientoPersonal/hooks/useVencimientosPersonal";
import { useAptitudes } from "../../../aptitud/hooks/useAptitudes";
import {
  EXITO_ALT,
  GRIS_MEDIO,
  PELIGRO_TEXTO,
  TEXTO_SECUNDARIO,
  TEXTO_TENUE,
} from "../../../../common/theme/tokens";

export function PersonalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const personaId = Number(id);

  const { persona, loading, error } = usePersonal(personaId);
  const { vencimientos, loading: cargandoVencimientos } = useVencimientosPersonal(
    Number.isFinite(personaId) ? personaId : null
  );
  const { aptitudes } = useAptitudes(true); // incluir inactivas: si una aptitud
  // vieja se dio de baja, igual queremos poder mostrar su nombre acá.

  const nombrePorAptitud = new Map(aptitudes.map((a) => [a.id, a.nombre]));

  if (loading) return <Box p="20px">Cargando información...</Box>;
  if (error || !persona) return <Box p="20px" color="red.500">{error || "No se encontró el empleado"}</Box>;

  const hoy = new Date().toISOString().split("T")[0];

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">Ficha de Personal #{persona.id}</Heading>
        <Button bg={GRIS_MEDIO} color="white" height="auto" onClick={() => navigate("/personal")} style={{ padding: "8px 16px", borderRadius: "6px" }}>Volver a la lista</Button>
      </HStack>

      <Box style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <Text mb="2"><strong>Nombre completo:</strong> {persona.nombre} {persona.apellido}</Text>
        <Text mb="2"><strong>DNI:</strong> {persona.dni}</Text>
        <Text mb="2"><strong>Email:</strong> {persona.email}</Text>
        <Text mb="2"><strong>Teléfono:</strong> {persona.telefono || "No registrado"}</Text>

        <Box style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
          <Heading as="h4" size="sm" mb="3">Permisos en el sistema:</Heading>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            <li style={{ marginBottom: "10px" }}>{persona.puede_operar ? "✅" : "❌"} Puede Operar</li>
            <li>{persona.puede_administrar ? "✅" : "❌"} Puede Administrar</li>
          </ul>
        </Box>

        <Box style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
          <Heading as="h4" size="sm" mb="3">Vencimientos de aptitud:</Heading>

          {cargandoVencimientos && (
            <Text style={{ fontSize: "14px", color: TEXTO_TENUE, fontStyle: "italic" }}>Cargando...</Text>
          )}

          {!cargandoVencimientos && vencimientos.length === 0 && (
            <Text style={{ fontSize: "14px", color: TEXTO_TENUE, fontStyle: "italic" }}>
              No tiene vencimientos cargados.
            </Text>
          )}

          {!cargandoVencimientos && vencimientos.length > 0 && (
            <Table.Root style={{ width: "100%" }}>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader style={{ fontSize: "13px", color: TEXTO_SECUNDARIO }}>Aptitud</Table.ColumnHeader>
                  <Table.ColumnHeader style={{ fontSize: "13px", color: TEXTO_SECUNDARIO }}>Vence</Table.ColumnHeader>
                  <Table.ColumnHeader style={{ fontSize: "13px", color: TEXTO_SECUNDARIO }}>Estado</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {vencimientos.map((v) => {
                  const vencido = v.fecha_vencimiento < hoy;
                  return (
                    <Table.Row key={v.id}>
                      <Table.Cell style={{ fontSize: "14px" }}>
                        {nombrePorAptitud.get(v.aptitud_id) || "Aptitud eliminada"}
                      </Table.Cell>
                      <Table.Cell style={{ fontSize: "14px" }}>{v.fecha_vencimiento}</Table.Cell>
                      <Table.Cell>
                        <Text
                          as="span"
                          style={{
                            fontSize: "13px",
                            fontWeight: "bold",
                            color: vencido ? PELIGRO_TEXTO : EXITO_ALT,
                          }}
                        >
                          {vencido ? "Vencido" : "Vigente"}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Box>
    </Box>
  );
}