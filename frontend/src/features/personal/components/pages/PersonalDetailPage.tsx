import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { usePersonal } from "../../hooks/usePersonal";
import { useVencimientosPersonal } from "../../../vencimientoPersonal/hooks/useVencimientosPersonal";
import { useAptitudes } from "../../../aptitud/hooks/useAptitudes";
import { hoyISO } from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonVolver,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../../components/ui/patrones";

/** Par etiqueta/valor de la ficha. */
function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
        {etiqueta}
      </Text>
      <Text fontSize="md" color="gray.800">
        {valor}
      </Text>
    </Box>
  );
}

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

  if (loading) {
    return (
      <Box p="5">
        <Stack direction="row" gap="3" align="center" color="gray.600">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando información...</Text>
        </Stack>
      </Box>
    );
  }

  if (error || !persona) {
    return (
      <Box p="5">
        <BannerError mb="0">{error || "No se encontró el empleado"}</BannerError>
      </Box>
    );
  }

  // `hoyISO()` y no `toISOString()`: en UTC-3, entre las 21:00 y las 24:00
  // el `toISOString()` devuelve el día siguiente.
  const hoy = hoyISO();

  return (
    <Box p="5" maxW="600px" mx="auto">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Ficha de Personal #{persona.id}
        </Heading>
        <BotonVolver onClick={() => navigate("/personal")}>
          Volver a la lista
        </BotonVolver>
      </HStack>

      <Tarjeta p="5">
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
          <Campo
            etiqueta="Nombre completo"
            valor={`${persona.nombre} ${persona.apellido || ""}`}
          />
          <Campo etiqueta="DNI" valor={persona.dni} />
          <Campo etiqueta="Email" valor={persona.email} />
          <Campo etiqueta="Teléfono" valor={persona.telefono || "No registrado"} />
        </SimpleGrid>

        <Box mt="5" pt="5" borderTopWidth="1px" borderColor="gray.200">
          <Heading as="h4" size="sm" mb="3">
            Permisos en el sistema:
          </Heading>
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="2">
            <Text fontSize="sm" color="gray.800">
              {persona.puede_operar ? "✅" : "❌"} Puede Operar
            </Text>
            <Text fontSize="sm" color="gray.800">
              {persona.puede_administrar ? "✅" : "❌"} Puede Administrar
            </Text>
          </SimpleGrid>
        </Box>

        <Box mt="5" pt="5" borderTopWidth="1px" borderColor="gray.200">
          <Heading as="h4" size="sm" mb="3">
            Vencimientos de aptitud:
          </Heading>

          {cargandoVencimientos && (
            <Text fontSize="sm" color="gray.500" fontStyle="italic">
              Cargando...
            </Text>
          )}

          {!cargandoVencimientos && vencimientos.length === 0 && (
            <Text fontSize="sm" color="gray.500" fontStyle="italic">
              No tiene vencimientos cargados.
            </Text>
          )}

          {!cargandoVencimientos && vencimientos.length > 0 && (
            <Table.Root variant="outline" w="100%">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro>Aptitud</EncabezadoOscuro>
                  <EncabezadoOscuro>Vence</EncabezadoOscuro>
                  <EncabezadoOscuro center>Estado</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {vencimientos.map((v) => {
                  const vencido = v.fecha_vencimiento < hoy;
                  return (
                    <Table.Row key={v.id}>
                      <Celda p="3">
                        {nombrePorAptitud.get(v.aptitud_id) || "Aptitud eliminada"}
                      </Celda>
                      <Celda p="3">{v.fecha_vencimiento}</Celda>
                      <Celda p="3" center>
                        <Badge colorPalette={vencido ? "red" : "green"}>
                          {vencido ? "Vencido" : "Vigente"}
                        </Badge>
                      </Celda>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Tarjeta>
    </Box>
  );
}