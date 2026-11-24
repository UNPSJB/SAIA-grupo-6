import { Box, HStack, Text } from "@chakra-ui/react";
import { LuBuilding2 } from "react-icons/lu";
import { setEstablecimientoElegido } from "../../../common/api/apiClient";
import { FormField, FormNativeSelect, MensajeError, Tarjeta } from "../../../components/ui/patrones";
import { useSedes } from "../hooks/useSedes";

/**
 * Sede en la que trabaja el super admin, en Configuración.
 *
 * El super admin es de la empresa: no tiene sede propia y elige en cuál
 * trabajar. La elección viaja en cada request (`X-Establecimiento-Id`, ver
 * `apiClient`). Al cambiarla se vuelve al Inicio y se recarga la app: así no
 * queda en pantalla ningún dato de la sede anterior.
 */
export function SedeDeTrabajoCard() {
  const { sedes, elegida, error } = useSedes(true);

  return (
    <Tarjeta p={{ base: "5", md: "6" }}>
      <HStack gap="3" align="flex-start" mb="5">
        <Box color="brand.700" mt="0.5" aria-hidden>
          <LuBuilding2 size={22} />
        </Box>
        <Box>
          <Text fontWeight="bold" color="fg">
            Sede de trabajo
          </Text>
          <Text mt="1" fontSize="sm" color="fg.muted">
            Establecimiento del que se muestran y se cargan los datos. El menú de usuario (tu avatar) dice en cuál
            estás trabajando.
          </Text>
        </Box>
      </HStack>

      <FormField label="Establecimiento" helper="Al cambiarlo se vuelve al Inicio, con los datos de esa sede." mb="0">
        <FormNativeSelect
          value={sedes ? String(elegida) : ""}
          disabled={!sedes}
          aria-label="Establecimiento en el que estás trabajando"
          maxW="420px"
          onChange={(e) => {
            const id = Number(e.target.value);
            if (!id || id === elegida) return;
            setEstablecimientoElegido(id);
            window.location.assign("/");
          }}
        >
          {!sedes && <option value="">Cargando...</option>}
          {sedes?.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.nombre}
            </option>
          ))}
        </FormNativeSelect>
        {error ? <MensajeError>No se pudieron cargar los establecimientos.</MensajeError> : null}
      </FormField>
    </Tarjeta>
  );
}
