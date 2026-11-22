import { Badge, Box, Button, HStack, Table, Text } from "@chakra-ui/react";
import { LuTriangleAlert } from "react-icons/lu";
import {
  BannerError,
  BannerExito,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  FormNativeSelect,
  Tarjeta,
} from "../../../components/ui/patrones";
import { useImpactoSituaciones } from "../hooks/useImpactoSituaciones";
import { ETIQUETA_IMPACTO } from "../types/configuracion";

const PALETA_IMPACTO: Record<number, string> = {
  1: "green",
  2: "orange",
  3: "red",
};

const OPCIONES_IMPACTO = [1, 2, 3];

/**
 * Impacto (criticidad) de cada tipo de evento que genera riesgo.
 *
 * El motor calcula el riesgo de una situación como impacto × probabilidad. El
 * impacto es el de su tipo: SAIA sugiere una clasificación inicial y el
 * administrador la acepta o la modifica según su establecimiento. No se ajusta
 * situación por situación. Cada cambio se guarda al elegirlo.
 */
export function ImpactoSituacionesCard() {
  const {
    impactos,
    cargando,
    errorCarga,
    recargar,
    guardandoTipo,
    errorGuardado,
    exito,
    cambiar,
    restaurar,
  } = useImpactoSituaciones();

  return (
    <Tarjeta p={{ base: "5", md: "6" }}>
      <HStack gap="3" align="flex-start" mb="5">
        <Box color="brand.700" mt="0.5" aria-hidden>
          <LuTriangleAlert size={22} />
        </Box>
        <Box>
          <Text fontWeight="bold" color="fg">
            Impacto de los eventos que generan riesgo
          </Text>
          <Text mt="1" fontSize="sm" color="fg.muted">
            El impacto es la gravedad potencial de cada tipo de evento. Se
            multiplica por su probabilidad (recurrencia y persistencia) para
            calcular el riesgo. SAIA sugiere una clasificación inicial; podés
            aceptarla o modificarla según las características de tu
            establecimiento. El cambio vale para todos los eventos de ese tipo
            y recalcula el riesgo.
          </Text>
          <Text mt="2" fontSize="sm" color="fg.muted">
            Generan riesgo los incidentes de higiene y contaminación, falla de
            equipos, plagas y otros, el stock por debajo del mínimo, los
            checklists incumplidos y los vencimientos. Los reclamos de
            clientes, los retiros de lote y los rechazos de entrega cuentan
            como higiene y contaminación cuando esa es su causa.
          </Text>
        </Box>
      </HStack>

      {errorGuardado ? <BannerError>{errorGuardado}</BannerError> : null}
      {exito ? <BannerExito>{exito}</BannerExito> : null}

      {cargando && impactos.length === 0 ? (
        <EstadoCargando>Cargando impacto de los eventos...</EstadoCargando>
      ) : null}

      {!cargando && errorCarga && impactos.length === 0 ? (
        <>
          <BannerError mb="4">{errorCarga}</BannerError>
          <Button
            type="button"
            variant="outline"
            colorPalette="neutral"
            onClick={() => void recargar()}
          >
            Reintentar
          </Button>
        </>
      ) : null}

      {impactos.length > 0 ? (
        <Box overflowX="auto">
          <Table.Root variant="outline" size="sm" w="100%" minW="560px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Tipo de evento</EncabezadoOscuro>
                <EncabezadoOscuro>Impacto</EncabezadoOscuro>
                <EncabezadoOscuro>Sugerido por SAIA</EncabezadoOscuro>
                <EncabezadoOscuro>
                  <Box as="span" srOnly>
                    Acciones
                  </Box>
                </EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {impactos.map((item) => {
                const guardando = guardandoTipo === item.tipo;
                return (
                  <Table.Row key={item.tipo}>
                    <Celda>
                      <Text fontSize="sm" fontWeight="medium" color="fg">
                        {item.etiqueta}
                      </Text>
                    </Celda>
                    <Celda>
                      <FormNativeSelect
                        value={String(item.impacto)}
                        onChange={(e) => void cambiar(item.tipo, Number(e.target.value))}
                        disabled={guardandoTipo !== null}
                        aria-label={`Impacto de ${item.etiqueta}`}
                        w="140px"
                      >
                        {OPCIONES_IMPACTO.map((valor) => (
                          <option key={valor} value={valor}>
                            {ETIQUETA_IMPACTO[valor]}
                          </option>
                        ))}
                      </FormNativeSelect>
                    </Celda>
                    <Celda>
                      <Badge
                        colorPalette={PALETA_IMPACTO[item.impacto_sugerido] ?? "gray"}
                        variant="subtle"
                        px="2"
                        py="1"
                        borderRadius="md"
                      >
                        {ETIQUETA_IMPACTO[item.impacto_sugerido] ?? item.impacto_sugerido}
                      </Badge>
                    </Celda>
                    <Celda>
                      {item.modificado ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          colorPalette="brand"
                          loading={guardando}
                          disabled={guardandoTipo !== null}
                          onClick={() => void restaurar(item.tipo)}
                          aria-label={`Restaurar el impacto sugerido de ${item.etiqueta}`}
                        >
                          Restaurar sugerido
                        </Button>
                      ) : null}
                    </Celda>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      ) : null}
    </Tarjeta>
  );
}
