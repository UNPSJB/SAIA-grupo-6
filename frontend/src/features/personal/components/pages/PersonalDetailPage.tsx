import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { usePersonal } from "../../hooks/usePersonal";

export function PersonalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { persona, loading, error } = usePersonal(Number(id));

  if (loading) return <Box p="20px">Cargando información...</Box>;
  if (error || !persona) return <Box p="20px" color="red.500">{error || "No se encontró el empleado"}</Box>;

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">Ficha de Personal #{persona.id}</Heading>
        <Button bg="#6c757d" color="white" height="auto" onClick={() => navigate("/personal")} style={{ padding: "8px 16px", borderRadius: "6px" }}>Volver a la lista</Button>
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
      </Box>
    </Box>
  );
}