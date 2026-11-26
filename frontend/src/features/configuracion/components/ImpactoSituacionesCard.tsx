import { Fragment, useState } from "react";
import { Badge, Box, Button, Checkbox, HStack, SimpleGrid, Table, Text } from "@chakra-ui/react";
import { LuChevronDown, LuChevronRight, LuTriangleAlert } from "react-icons/lu";
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
import { ETIQUETA_IMPACTO, type ImpactoSituacion } from "../types/configuracion";

const PALETA_IMPACTO: Record<number, string> = {
  1: "green",
  2: "orange",
  3: "red",
};

const OPCIONES_IMPACTO = [1, 2, 3];

function Casilla({
  marcada,
  onCambio,
  deshabilitada,
  etiqueta,
  visible,
}: {
  marcada: boolean;
  onCambio: (valor: boolean) => void;
  deshabilitada: boolean;
  /** Texto para lectores de pantalla (o visible si `visible`). */
  etiqueta: string;
  visible?: boolean;
}) {
  return (
    <Checkbox.Root
      checked={marcada}
      onCheckedChange={(e) => onCambio(e.checked === true)}
      disabled={deshabilitada}
      colorPalette="brand"
      size="sm"
    >
      <Checkbox.HiddenInput />
      <Checkbox.Control />
      <Checkbox.Label fontSize="sm" color="fg" srOnly={!visible}>
        {etiqueta}
      </Checkbox.Label>
    </Checkbox.Root>
  );
}

/** Lo que sugiere SAIA, en una línea: "Alto · plan obligatorio". */
function sugerido(item: ImpactoSituacion): string {
  if (!item.activo_sugerido) return "No genera riesgo";
  const partes = [ETIQUETA_IMPACTO[item.impacto_sugerido] ?? String(item.impacto_sugerido)];
  if (item.plan_obligatorio_sugerido) partes.push("plan obligatorio");
  return partes.join(" · ");
}

/**
 * Qué genera riesgo y cómo, tipo por tipo de evento.
 *
 * El motor calcula el riesgo de una situación como impacto × probabilidad. SAIA
 * sugiere una clasificación inicial y el administrador decide, según su
 * establecimiento: si el tipo genera riesgo o solo se notifica, su impacto, si
 * exige plan de acción desde la primera detección y, en reclamos, retiros y
 * rechazos, con qué causas cuenta. Cada cambio se guarda al elegirlo.
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
  const [abierto, setAbierto] = useState<string | null>(null);
  const ocupado = guardandoTipo !== null;

  return (
    <Tarjeta p={{ base: "5", md: "6" }}>
      <HStack gap="3" align="flex-start" mb="5">
        <Box color="brand.700" mt="0.5" aria-hidden>
          <LuTriangleAlert size={22} />
        </Box>
        <Box>
          <Text fontWeight="bold" color="fg">
            Eventos que generan riesgo
          </Text>
          <Text mt="1" fontSize="sm" color="fg.muted">
            El impacto es la gravedad potencial de cada tipo de evento. Se
            multiplica por su probabilidad (recurrencia y persistencia) para
            calcular el riesgo. SAIA sugiere una clasificación inicial; podés
            cambiarla según tu establecimiento. Cada cambio vale para todos los
            eventos de ese tipo y recalcula el riesgo.
          </Text>
          <Text mt="2" fontSize="sm" color="fg.muted">
            Un tipo que no genera riesgo se sigue notificando. Todo elemento en
            riesgo alto exige un plan de acción; marcá “Plan obligatorio” para
            exigirlo además desde la primera vez (por ejemplo, en un retiro de
            lote). En reclamos, retiros y rechazos elegís con qué causas cuentan.
          </Text>
        </Box>
      </HStack>

      {errorGuardado ? <BannerError>{errorGuardado}</BannerError> : null}
      {exito ? <BannerExito>{exito}</BannerExito> : null}

      {cargando && impactos.length === 0 ? (
        <EstadoCargando>Cargando los tipos de evento...</EstadoCargando>
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
          <Table.Root variant="outline" size="sm" w="100%" minW="720px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Tipo de evento</EncabezadoOscuro>
                <EncabezadoOscuro>Genera riesgo</EncabezadoOscuro>
                <EncabezadoOscuro>Impacto</EncabezadoOscuro>
                <EncabezadoOscuro>Plan obligatorio</EncabezadoOscuro>
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
                const conCausas = item.causas.length > 0;
                const cuentan = item.causas.filter((c) => c.cuenta).map((c) => c.valor);
                const verCausas = abierto === item.tipo;
                return (
                  <Fragment key={item.tipo}>
                    <Table.Row>
                      <Celda>
                        <Text
                          fontSize="sm"
                          fontWeight="medium"
                          color={item.activo ? "fg" : "fg.muted"}
                        >
                          {item.etiqueta}
                        </Text>
                        {conCausas ? (
                          <Button
                            type="button"
                            size="2xs"
                            variant="plain"
                            colorPalette="brand"
                            px="0"
                            onClick={() => setAbierto(verCausas ? null : item.tipo)}
                            aria-expanded={verCausas}
                          >
                            {verCausas ? <LuChevronDown /> : <LuChevronRight />}
                            Cuenta con {cuentan.length} de {item.causas.length} causas
                          </Button>
                        ) : null}
                      </Celda>
                      <Celda>
                        <Casilla
                          marcada={item.activo}
                          deshabilitada={ocupado}
                          etiqueta={`${item.etiqueta} genera riesgo`}
                          onCambio={(activo) => void cambiar(item.tipo, { activo })}
                        />
                      </Celda>
                      <Celda>
                        <FormNativeSelect
                          value={String(item.impacto)}
                          onChange={(e) =>
                            void cambiar(item.tipo, { impacto: Number(e.target.value) })
                          }
                          disabled={ocupado || !item.activo}
                          aria-label={`Impacto de ${item.etiqueta}`}
                          w="120px"
                        >
                          {OPCIONES_IMPACTO.map((valor) => (
                            <option key={valor} value={valor}>
                              {ETIQUETA_IMPACTO[valor]}
                            </option>
                          ))}
                        </FormNativeSelect>
                      </Celda>
                      <Celda>
                        <Casilla
                          marcada={item.plan_obligatorio}
                          deshabilitada={ocupado || !item.activo}
                          etiqueta={`${item.etiqueta} exige plan de acción desde la primera vez`}
                          onCambio={(plan_obligatorio) =>
                            void cambiar(item.tipo, { plan_obligatorio })
                          }
                        />
                      </Celda>
                      <Celda>
                        <Badge
                          colorPalette={
                            item.activo_sugerido
                              ? (PALETA_IMPACTO[item.impacto_sugerido] ?? "gray")
                              : "gray"
                          }
                          variant="subtle"
                          px="2"
                          py="1"
                          borderRadius="md"
                        >
                          {sugerido(item)}
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
                            disabled={ocupado}
                            onClick={() => void restaurar(item.tipo)}
                            aria-label={`Volver a lo sugerido para ${item.etiqueta}`}
                          >
                            Restaurar sugerido
                          </Button>
                        ) : null}
                      </Celda>
                    </Table.Row>
                    {conCausas && verCausas ? (
                      <Table.Row bg="bg.subtle">
                        <Table.Cell colSpan={6} px="3" py="3">
                          <Text fontSize="xs" color="fg.muted" mb="2">
                            Con las causas marcadas, el evento genera riesgo; con las
                            demás solo se notifica.
                          </Text>
                          <SimpleGrid columns={{ base: 1, md: 2 }} gap="2">
                            {item.causas.map((causa) => (
                              <Casilla
                                key={causa.valor}
                                visible
                                marcada={causa.cuenta}
                                deshabilitada={ocupado || !item.activo}
                                etiqueta={
                                  causa.sugerida
                                    ? `${causa.etiqueta} (sugerida)`
                                    : causa.etiqueta
                                }
                                onCambio={(cuenta) =>
                                  void cambiar(item.tipo, {
                                    causas: cuenta
                                      ? [...cuentan, causa.valor]
                                      : cuentan.filter((v) => v !== causa.valor),
                                  })
                                }
                              />
                            ))}
                          </SimpleGrid>
                        </Table.Cell>
                      </Table.Row>
                    ) : null}
                  </Fragment>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      ) : null}
    </Tarjeta>
  );
}
