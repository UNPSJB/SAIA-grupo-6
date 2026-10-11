import { Box, Text } from "@chakra-ui/react";
import { LuClipboardList, LuLightbulb } from "react-icons/lu";

export function ReportarIncidenteEmptyState() {
  return (
    <Box
      textAlign="center"
      p="8"
      mt="4"
      bg="bg.subtle"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border"
      rounded="lg"
    >
      <Box color="brand.fg" display="flex" justifyContent="center" mb="4" aria-hidden>
        <LuClipboardList size={40} />
      </Box>
      <Text fontSize="lg" fontWeight="bold" color="fg" mb="2">
        Aún no has reportado incidentes
      </Text>
      <Text fontSize="sm" color="fg.muted" maxW="400px" mx="auto" lineHeight={1.6}>
        Cuando reportes tu primer incidente, aparecerá aquí con su estado,
        fecha y tipo. Podrás ver el detalle haciendo clic sobre el reporte.
      </Text>
      <Text
        mt="4"
        fontSize="xs"
        color="fg.muted"
        display="inline-flex"
        alignItems="center"
        gap="2"
      >
        <LuLightbulb size={14} aria-hidden />
        <span>
          Usa la pestaña <Text as="span" fontWeight="bold">"Nuevo incidente"</Text>{" "}
          para crear uno.
        </span>
      </Text>
    </Box>
  );
}