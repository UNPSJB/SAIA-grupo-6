import { Box, Text } from "@chakra-ui/react";

export function ReportarIncidenteEmptyState() {
  return (
    <Box
      style={{
        textAlign: "center",
        padding: "60px 20px",
        backgroundColor: "#fafafa",
        border: "2px dashed #d8e7e5",
        borderRadius: "12px",
        marginTop: "20px",
      }}
    >
      <Box style={{ fontSize: "64px", marginBottom: "16px" }}>
        📋
      </Box>
      <Text fontSize="20px" fontWeight="bold" color="#333" mb="8px">
        Aún no has reportado incidentes
      </Text>
      <Text fontSize="15px" color="#666" maxW="400px" mx="auto" lineHeight="1.6">
        Cuando reportes tu primer incidente, aparecerá aquí con su estado,
        fecha y tipo. Podrás ver el detalle haciendo clic en "Ver".
      </Text>
      <Box style={{ marginTop: "20px", fontSize: "13px", color: "#999" }}>
        💡 Usa la pestaña {" "}
        <Text fontWeight="bold">"Nuevo Incidente"</Text>
        {" "} para crear uno.
      </Box>
    </Box>
  );
}