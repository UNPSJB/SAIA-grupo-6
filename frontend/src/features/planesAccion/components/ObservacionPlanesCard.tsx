import { useCallback, useEffect, useState } from "react";
import { Badge, Box, Button, HStack, Table, Text } from "@chakra-ui/react";
import { LuClipboardCheck } from "react-icons/lu";
import {
  BannerError,
  BannerExito,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  FormInput,
  Tarjeta,
} from "../../../components/ui/patrones";
import {
  fijarObservacion,
  listarObservacion,
  restablecerObservacion,
} from "../services/planAccionService";
import type { ObservacionTipo } from "../types/planAccion";

const DIAS_MINIMO = 30;
const DIAS_MAXIMO = 365;

/**
 * Período de observación de los planes, por tipo de situación: los días que
 * SAIA vigila, después de implementado el plan, que la situación no vuelva
 * antes de darlo por eficaz. Cada fila se guarda sola con su botón.
 */
export function ObservacionPlanesCard() {
  const [tipos, setTipos] = useState<ObservacionTipo[]>([]);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const datos = await listarObservacion();
      setTipos(datos);
      setBorradores({});
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : "No se pudo cargar la configuración.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const reemplazar = (nuevo: ObservacionTipo) => {
    setTipos((actuales) => actuales.map((t) => (t.tipo === nuevo.tipo ? nuevo : t)));
    setBorradores((actuales) => {
      const resto = { ...actuales };
      delete resto[nuevo.tipo];
      return resto;
    });
  };

  const guardar = async (item: ObservacionTipo) => {
    const dias = Number(borradores[item.tipo]);
    if (!Number.isInteger(dias) || dias < DIAS_MINIMO || dias > DIAS_MAXIMO) {
      setExito(null);
      setErrorGuardado(`Indicá un número de días entre ${DIAS_MINIMO} y ${DIAS_MAXIMO}.`);
      return;
    }
    setGuardando(item.tipo);
    setErrorGuardado(null);
    setExito(null);
    try {
      reemplazar(await fijarObservacion(item.tipo, dias));
      setExito(`Observación de "${item.etiqueta}" actualizada.`);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(null);
    }
  };

  const restablecer = async (item: ObservacionTipo) => {
    setGuardando(item.tipo);
    setErrorGuardado(null);
    setExito(null);
    try {
      reemplazar(await restablecerObservacion(item.tipo));
      setExito(`Observación de "${item.etiqueta}" restablecida.`);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo restablecer.");
    } finally {
      setGuardando(null);
    }
  };

  return (
    <Tarjeta p={{ base: "5", md: "6" }}>
      <HStack gap="3" align="flex-start" mb="5">
        <Box color="brand.700" mt="0.5" aria-hidden>
          <LuClipboardCheck size={22} />
        </Box>
        <Box>
          <Text fontWeight="bold" color="fg">
            Observación de los planes de acción
          </Text>
          <Text mt="1" fontSize="sm" color="fg.muted">
            Una vez implementado un plan, SAIA observa durante estos días que la situación no vuelva
            a aparecer. Si vuelve, queda como no eficaz; si no, el plan se cierra como eficaz. Va de{" "}
            {DIAS_MINIMO} a {DIAS_MAXIMO} días y se define por tipo de situación. El cambio vale
            para los planes que todavía no empezaron su observación.
          </Text>
        </Box>
      </HStack>

      {errorGuardado ? <BannerError>{errorGuardado}</BannerError> : null}
      {exito ? <BannerExito>{exito}</BannerExito> : null}

      {cargando && tipos.length === 0 ? (
        <EstadoCargando>Cargando períodos de observación...</EstadoCargando>
      ) : null}

      {!cargando && errorCarga && tipos.length === 0 ? (
        <>
          <BannerError mb="4">{errorCarga}</BannerError>
          <Button type="button" variant="outline" colorPalette="neutral" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </>
      ) : null}

      {tipos.length > 0 ? (
        <Box overflowX="auto">
          <Table.Root variant="outline" size="sm" w="100%" minW="560px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Tipo de situación</EncabezadoOscuro>
                <EncabezadoOscuro>Días de observación</EncabezadoOscuro>
                <EncabezadoOscuro>Por defecto</EncabezadoOscuro>
                <EncabezadoOscuro>
                  <Box as="span" srOnly>
                    Acciones
                  </Box>
                </EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {tipos.map((item) => {
                const texto = borradores[item.tipo] ?? String(item.dias);
                const cambio = texto !== String(item.dias);
                const ocupada = guardando === item.tipo;
                return (
                  <Table.Row key={item.tipo}>
                    <Celda>
                      <Text fontSize="sm" fontWeight="medium" color="fg">
                        {item.etiqueta}
                      </Text>
                    </Celda>
                    <Celda>
                      <FormInput
                        type="number"
                        min={DIAS_MINIMO}
                        max={DIAS_MAXIMO}
                        value={texto}
                        onChange={(e) =>
                          setBorradores((actuales) => ({ ...actuales, [item.tipo]: e.target.value }))
                        }
                        disabled={guardando !== null}
                        aria-label={`Días de observación de ${item.etiqueta}`}
                        w="120px"
                      />
                    </Celda>
                    <Celda>
                      <Badge colorPalette="gray" variant="subtle" px="2" py="1" borderRadius="md">
                        {item.dias_por_defecto} días
                      </Badge>
                    </Celda>
                    <Celda>
                      <HStack gap="2">
                        {cambio ? (
                          <Button
                            type="button"
                            size="xs"
                            colorPalette="brand"
                            loading={ocupada}
                            disabled={guardando !== null}
                            onClick={() => void guardar(item)}
                          >
                            Guardar
                          </Button>
                        ) : null}
                        {item.modificado && !cambio ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            colorPalette="brand"
                            loading={ocupada}
                            disabled={guardando !== null}
                            onClick={() => void restablecer(item)}
                            aria-label={`Restablecer el valor por defecto de ${item.etiqueta}`}
                          >
                            Restablecer
                          </Button>
                        ) : null}
                      </HStack>
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
