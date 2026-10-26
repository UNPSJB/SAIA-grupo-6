import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { useEquipo } from "../../hooks/useEquipo";
import { IntervencionEquipo } from "../IntervencionEquipo";
import {
  BannerError,
  BotonVolver,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Box>
      <Text fontSize="sm" fontWeight="medium" color="fg.muted">
        {etiqueta}
      </Text>
      <Text fontSize="md" color="fg">
        {valor}
      </Text>
    </Box>
  );
}

export function EquipoIntervencionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const equipoId = Number(id);

  const { equipo, loading, error } = useEquipo(Number.isFinite(equipoId) ? equipoId : null);

  // Vuelve a la pantalla de donde vino (notificaciones, vencimientos o equipos).
  const volver = () => (window.history.length > 1 ? navigate(-1) : navigate("/equipos"));

  if (loading) {
    return (
      <Box p="5">
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando información...</Text>
        </Stack>
      </Box>
    );
  }

  if (error || !equipo) {
    return (
      <Box p="5">
        <BannerError mb="0">{error || "No se encontró el equipo"}</BannerError>
      </Box>
    );
  }

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Registrar intervención"
        actions={<BotonVolver onClick={volver}>Volver</BotonVolver>}
      />

      <Tarjeta p="5">
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
          <Campo etiqueta="Equipo" valor={equipo.nombre} />
          <Campo etiqueta="Tipo" valor={equipo.tipo} />
          <Campo etiqueta="Sector" valor={equipo.sector.nombre} />
        </SimpleGrid>

        <Box mt="6" pt="6" borderTopWidth="1px" borderColor="border.subtle">
          <Button
            variant="outline"
            onClick={() => navigate(`/equipos/detalle/${equipo.id}`)}
          >
            Ver ficha del equipo
          </Button>
        </Box>
      </Tarjeta>

      {/* El diálogo se abre solo. Al cancelar o terminar, se vuelve a la pantalla de origen. */}
      <IntervencionEquipo equipo={equipo} onCerrar={volver} />
    </Box>
  );
}