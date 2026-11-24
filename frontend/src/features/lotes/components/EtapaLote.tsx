import { useEffect, useRef, useState } from "react";
import { Badge, Box, Button, Flex, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { LuCheck, LuChevronDown, LuCircleCheck, LuLock } from "react-icons/lu";
import { formatoFechaHora } from "../../../common/utils/fechas";
import { cantidadConUnidad, redondear } from "../../../common/utils/numeros";
import { BotonAccion, BotonCancelar, Celda, FormNativeSelect, Tarjeta } from "../../../components/ui/patrones";
import { nombrePersona } from "../hooks/useOperarios";
import type { Persona } from "../../personal/types/personal";
import type { Consumo, ItemChecklist } from "../types/lote";

/**
 * Estado de una etapa en el lote, como en el checklist de limpieza:
 * - `hecha`: cerrada, se ve plegada (se puede desplegar para consultarla);
 * - `actual`: la primera pendiente, abierta, con sus acciones;
 * - `espera`: se habilita cuando se completa la anterior.
 */
export type EstadoEtapa = "hecha" | "actual" | "espera";

/** Quién hace la etapa y, para quien administra, el selector para reasignarla. */
function AsignacionTarea({
  item,
  operarios,
  reasignable,
  procesando,
  onAsignar,
}: {
  item: ItemChecklist;
  operarios: Persona[];
  reasignable: boolean;
  procesando: boolean;
  onAsignar: (personaId: number | null) => void;
}) {
  if (!reasignable) {
    return (
      <Text as="span">
        {item.asignado_a_nombre ? `Asignada a ${item.asignado_a_nombre}` : "Sin asignar: la puede hacer cualquiera"}
      </Text>
    );
  }
  // Si la persona asignada ya no figura entre quienes operan (dejó de operar o
  // se dio de baja), se la sigue mostrando para no perder el dato.
  const fuera = item.asignado_a_id !== null && !operarios.some((p) => p.id === item.asignado_a_id);
  return (
    <HStack gap="2" onClick={(e) => e.stopPropagation()}>
      <Text as="span" flexShrink={0}>
        Asignada a
      </Text>
      <Box w="220px">
        <FormNativeSelect
          aria-label={`Asignar la etapa ${item.orden}`}
          value={item.asignado_a_id ?? 0}
          onChange={(e) => onAsignar(Number(e.target.value) || null)}
          disabled={procesando}
        >
          <option value={0}>Sin asignar (cualquiera)</option>
          {fuera && <option value={item.asignado_a_id!}>{item.asignado_a_nombre ?? "—"}</option>}
          {operarios.map((p) => (
            <option key={p.id} value={p.id}>
              {nombrePersona(p)}
            </option>
          ))}
        </FormNativeSelect>
      </Box>
    </HStack>
  );
}

/**
 * Los consumos de un ingrediente, dentro de su fila: de qué lote salió cada
 * uno, cuánto, quién lo registró y, en la etapa en curso, corregir o borrar.
 * Antes había una segunda tabla de consumos que repetía ingrediente y cantidad.
 */
function ConsumosDelIngrediente({
  consumos,
  unidad,
  editables,
  procesando,
  onCorregir,
  onBorrar,
}: {
  consumos: Consumo[];
  unidad: string;
  editables: boolean;
  procesando: boolean;
  onCorregir: (consumo: Consumo) => void;
  onBorrar: (consumo: Consumo) => void;
}) {
  if (consumos.length === 0) {
    return (
      <Text fontSize="sm" color="fg.subtle">
        Sin consumos
      </Text>
    );
  }
  return (
    <Stack gap="2">
      {consumos.map((c) => (
        <Flex key={c.id} gap="2" align="flex-start" justify="space-between">
          <Box minW="0">
            <HStack gap="2" flexWrap="wrap">
              <Text as="span" fontFamily="mono" fontSize="sm" color="fg">
                {c.numero_lote_insumo}
              </Text>
              <Text as="span" fontSize="sm" fontWeight="medium" color={c.tipo === "real" ? "fg" : "orange.fg"}>
                {cantidadConUnidad(c.cantidad, unidad)}
              </Text>
              {c.tipo === "desperdicio" && (
                <Badge colorPalette="orange" variant="subtle" size="sm">
                  Desperdicio
                </Badge>
              )}
            </HStack>
            <Text fontSize="xs" color="fg.muted">
              {c.insumo_nombre} · {c.proveedor_nombre} · {c.registrado_por_nombre ?? "—"},{" "}
              {formatoFechaHora(c.registrado_en)}
              {c.motivo ? ` · ${c.motivo}` : ""}
            </Text>
          </Box>
          {editables && (
            <HStack gap="1" flexShrink={0}>
              <BotonAccion
                accion="editar"
                label="Corregir la cantidad"
                onClick={() => onCorregir(c)}
                disabled={procesando}
              />
              <BotonAccion accion="eliminar" label="Borrar el consumo" onClick={() => onBorrar(c)} disabled={procesando} />
            </HStack>
          )}
        </Flex>
      ))}
    </Stack>
  );
}

export function EtapaLote({
  item,
  estado,
  anterior,
  editable,
  puedeRegistrar,
  operarios,
  reasignable,
  procesando,
  versionNumero,
  onConsumir,
  onCompletar,
  onAsignar,
  onCorregirConsumo,
  onBorrarConsumo,
}: {
  item: ItemChecklist;
  estado: EstadoEtapa;
  /** La etapa que hay que completar antes (para el aviso de "en espera"). */
  anterior: ItemChecklist | null;
  /** Lote en proceso. */
  editable: boolean;
  /** Quien administra, quien tiene la etapa asignada o cualquiera si está libre. */
  puedeRegistrar: boolean;
  operarios: Persona[];
  /** Quien administra, con el lote en proceso y la etapa pendiente. */
  reasignable: boolean;
  procesando: boolean;
  versionNumero: number | null;
  onConsumir: () => void;
  onCompletar: () => void;
  onAsignar: (personaId: number | null) => void;
  onCorregirConsumo: (consumo: Consumo) => void;
  onBorrarConsumo: (consumo: Consumo) => void;
}) {
  const actual = estado === "actual";
  // La etapa en curso está siempre abierta; las otras se despliegan a mano.
  const [desplegada, setDesplegada] = useState(false);
  const abierta = actual || desplegada;

  // Al completar la anterior, esta pasa a ser la actual: se la trae a la vista.
  const tarjeta = useRef<HTMLDivElement>(null);
  const eraActual = useRef(actual);
  useEffect(() => {
    if (actual && !eraActual.current) tarjeta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    eraActual.current = actual;
  }, [actual]);

  // Se completa cuando el consumo real de cada ingrediente llega a lo que pide
  // la receta (el desperdicio no cuenta).
  const faltan = item.ingredientes.filter((i) => Number(i.consumo_real) < Number(i.cantidad_planificada));
  const accionable = actual && editable && puedeRegistrar;

  return (
    <Box ref={tarjeta} scrollMarginTop="24">
    <Tarjeta
      p="0"
      overflow="hidden"
      borderColor={actual && editable ? "brand.solid" : estado === "hecha" ? "green.border" : "border.subtle"}
      borderWidth={actual && editable ? "2px" : "1px"}
      opacity={estado === "espera" && !desplegada ? 0.75 : 1}
    >
      {/* Encabezado: número, nombre y estado. Plegable salvo la etapa en curso. */}
      <Flex
        as={actual ? "div" : "button"}
        w="full"
        textAlign="left"
        align="center"
        gap="3"
        px="5"
        py="4"
        cursor={actual ? "default" : "pointer"}
        _hover={actual ? undefined : { bg: "bg.subtle" }}
        onClick={actual ? undefined : () => setDesplegada((v) => !v)}
        aria-expanded={actual ? undefined : desplegada}
      >
        <Flex
          align="center"
          justify="center"
          w="8"
          h="8"
          rounded="full"
          flexShrink={0}
          fontWeight="bold"
          fontSize="sm"
          bg={estado === "hecha" ? "green.solid" : actual ? "brand.solid" : "bg.muted"}
          color={estado === "espera" ? "fg.muted" : "white"}
          aria-hidden
        >
          {estado === "hecha" ? <LuCheck /> : estado === "espera" ? <LuLock size={14} /> : item.orden}
        </Flex>
        <Box flex="1" minW="0">
          <Text fontWeight="bold" color="fg">
            {item.orden}. {item.descripcion}
          </Text>
          <Box fontSize="sm" color="fg.muted" mt="0.5">
            {estado === "hecha" ? (
              <HStack gap="1" color="green.fg">
                <LuCircleCheck aria-hidden />
                <Text as="span">
                  Hecha por {item.completado_por_nombre ?? "—"} · {formatoFechaHora(item.completado_en)}
                </Text>
              </HStack>
            ) : (
              <Flex gap="2" align="center" flexWrap="wrap">
                {actual ? (
                  editable && (
                    <Badge colorPalette="brand" variant="solid">
                      En curso
                    </Badge>
                  )
                ) : (
                  <Text as="span">
                    En espera{anterior ? `: se habilita al completar la etapa ${anterior.orden}` : ""} ·
                  </Text>
                )}
                <AsignacionTarea
                  item={item}
                  operarios={operarios}
                  reasignable={reasignable}
                  procesando={procesando}
                  onAsignar={onAsignar}
                />
              </Flex>
            )}
          </Box>
        </Box>
        {!actual && (
          <Box color="fg.muted" transform={desplegada ? "rotate(180deg)" : undefined} transition="transform 0.15s">
            <LuChevronDown aria-hidden />
          </Box>
        )}
      </Flex>

      {abierta && (
        <Stack gap="4" px="5" pb="5">
          {item.procedimiento && (
            <Box bg="bg.subtle" rounded="md" px="4" py="3">
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="0.04em" mb="1">
                Procedimiento
              </Text>
              <Text fontSize="sm" color="fg" whiteSpace="pre-line">
                {item.procedimiento}
              </Text>
            </Box>
          )}

          {item.ingredientes.length > 0 ? (
            <Box overflowX="auto">
              <Table.Root variant="outline" size="sm" w="100%" minW="760px">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader fontSize="sm" minW="160px">Ingrediente</Table.ColumnHeader>
                    <Table.ColumnHeader fontSize="sm" textAlign="right">Planificado</Table.ColumnHeader>
                    <Table.ColumnHeader fontSize="sm" textAlign="right">Consumo real</Table.ColumnHeader>
                    <Table.ColumnHeader fontSize="sm" textAlign="right">Desperdicio</Table.ColumnHeader>
                    <Table.ColumnHeader fontSize="sm" w="42%">Lotes de insumo usados</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {item.ingredientes.map((i) => {
                    const completo = Number(i.consumo_real) >= Number(i.cantidad_planificada);
                    const excede = Number(i.consumo_real) > Number(i.cantidad_planificada);
                    return (
                      <Table.Row key={i.ingrediente_id} verticalAlign="top">
                        <Celda fontWeight="medium">{i.ingrediente_nombre}</Celda>
                        <Celda numero>{cantidadConUnidad(i.cantidad_planificada, i.unidad)}</Celda>
                        <Celda
                          numero
                          color={excede ? "orange.fg" : completo ? "green.fg" : undefined}
                          fontWeight={completo ? "bold" : undefined}
                          title={excede ? "Supera lo planificado" : undefined}
                        >
                          {cantidadConUnidad(i.consumo_real, i.unidad)}
                        </Celda>
                        <Celda numero>{cantidadConUnidad(i.desperdicio, i.unidad)}</Celda>
                        <Celda>
                          <ConsumosDelIngrediente
                            consumos={item.consumos.filter((c) => c.ingrediente_id === i.ingrediente_id)}
                            unidad={i.unidad}
                            editables={accionable}
                            procesando={procesando}
                            onCorregir={onCorregirConsumo}
                            onBorrar={onBorrarConsumo}
                          />
                        </Celda>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          ) : (
            <Text fontSize="sm" color="fg.subtle">
              Esta etapa no usa ingredientes de la receta (v{versionNumero}).
            </Text>
          )}

          {/* Pie de la etapa en curso: qué falta y las dos acciones. */}
          {actual && editable && !puedeRegistrar && (
            <Text fontSize="sm" color="fg.muted">
              Esta etapa la registra {item.asignado_a_nombre ?? "otra persona"} (o quien administra).
            </Text>
          )}
          {accionable && (
            <Flex
              align={{ base: "stretch", md: "center" }}
              direction={{ base: "column", md: "row" }}
              gap="3"
              pt="4"
              borderTopWidth="1px"
              borderColor="border.subtle"
            >
              <Text fontSize="sm" color={faltan.length > 0 ? "fg.muted" : "green.fg"} flex="1">
                {faltan.length > 0
                  ? `Falta registrar el consumo real de ${faltan
                      .map(
                        (i) =>
                          `${i.ingrediente_nombre} (${cantidadConUnidad(
                            redondear(Number(i.cantidad_planificada) - Number(i.consumo_real)),
                            i.unidad,
                          )})`,
                      )
                      .join(", ")}.`
                  : "Ya se registró lo que pide la receta: podés completar la etapa."}
              </Text>
              <HStack gap="2" flexShrink={0}>
                {item.ingredientes.length > 0 && (
                  <BotonCancelar size="sm" onClick={onConsumir} disabled={procesando}>
                    Registrar consumo
                  </BotonCancelar>
                )}
                <Button
                  size="sm"
                  colorPalette="brand"
                  onClick={onCompletar}
                  loading={procesando}
                  disabled={procesando || faltan.length > 0}
                  title={faltan.length > 0 ? "Primero registrá el consumo de lo que pide la receta" : undefined}
                >
                  <LuCircleCheck aria-hidden />
                  Completar etapa
                </Button>
              </HStack>
            </Flex>
          )}
        </Stack>
      )}
    </Tarjeta>
    </Box>
  );
}
