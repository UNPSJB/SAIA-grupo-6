import { Box, Text } from "@chakra-ui/react";

export function ReportarIncidenteEmptyState() {
  return (
    <Box
      textAlign="center"
      p="15"
      mt="5"
      bg="gray.50"
      borderWidth="2px"
      borderStyle="dashed"
      borderColor="brand.200"
      rounded="xl"
    >
      <Text fontSize="5xl" mb="4" aria-hidden>
        📋
      </Text>
      <Text fontSize="xl" fontWeight="bold" color="gray.800" mb="2">
        Aún no has reportado incidentes
      </Text>
      <Text fontSize="sm" color="gray.600" maxW="400px" mx="auto" lineHeight="1.6">
        Cuando reportes tu primer incidente, aparecerá aquí con su estado,
        fecha y tipo. Podrás ver el detalle haciendo clic en "Ver".
      </Text>
      <Text mt="5" fontSize="xs" color="gray.500">
        💡 Usa la pestaña <Text as="span" fontWeight="bold">"Nuevo Incidente"</Text>{" "}
        para crear uno.
      </Text>
    </Box>
  );
}