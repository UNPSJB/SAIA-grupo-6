import { useMemo, useState } from "react";
import { Box, Button, Checkbox, HStack, Stack, Table, Text, chakra } from "@chakra-ui/react";
import { LuBrush, LuFlaskConical, LuPencil, LuPlus, LuSearch } from "react-icons/lu";
import { DialogContent, DialogRoot, DialogTitle } from "../../../../components/ui/dialog";
import { BotonCancelar, MensajeError } from "../../../../components/ui/patrones";
import type { ElementoLimpiezaOpcion } from "../../../elementoLimpieza/types/elementoLimpieza";
import type { InsumoQuimicoOpcion } from "../../../insumoQuimico/types/insumoQuimico";
import { CampoRegistro } from "./campos";
import { filaConsumoVacia, type FilaConsumo } from "./modelo";

const formatoCantidad = (valor: string) =>
  Number(valor).toLocaleString("es-AR", { maximumFractionDigits: 3 });

/**
 * Elementos de limpieza y productos químicos usados en una tarea.
 *
 * En la tarjeta se ve un resumen (una tabla con lo elegido) y un botón que
 * abre una ventana con las dos listas completas: se tilda lo que se usó y, de
 * cada producto, cuánto. Antes eran desplegables de a uno, incómodos para
 * cargar varios. Controlado: el estado vive en `TarjetaTarea`.
 */
export function RegistroInsumos({
  nombreTarea,
  elementos,
  quimicos,
  elementosSeleccionados,
  filasConsumo,
  onGuardar,
}: {
  nombreTarea: string;
  elementos: ElementoLimpiezaOpcion[];
  quimicos: InsumoQuimicoOpcion[];
  elementosSeleccionados: number[];
  filasConsumo: FilaConsumo[];
  onGuardar: (elementos: number[], filas: FilaConsumo[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const consumos = filasConsumo.filter((f) => f.insumoId !== "");
  const hayAlgo = elementosSeleccionados.length > 0 || consumos.length > 0;
  return (
    <CampoRegistro etiqueta="Elementos y productos químicos utilizados">
      <Stack gap="2">
        {hayAlgo && (
          <ResumenInsumos
            elementos={elementos}
            quimicos={quimicos}
            elementosIds={elementosSeleccionados}
            consumos={consumos.map((f) => ({ insumoId: Number(f.insumoId), cantidad: f.cantidad }))}
          />
        )}
        <Button
          type="button"
          h="11"
          alignSelf="flex-start"
          variant="outline"
          colorPalette={hayAlgo ? "gray" : "teal"}
          borderStyle={hayAlgo ? "solid" : "dashed"}
          onClick={() => setAbierto(true)}
        >
          {hayAlgo ? <LuPencil aria-hidden /> : <LuPlus aria-hidden />}
          {hayAlgo ? "Editar elementos y productos" : "Agregar elementos y productos"}
        </Button>
      </Stack>

      {abierto && (
        <SelectorInsumosDialog
          nombreTarea={nombreTarea}
          elementos={elementos}
          quimicos={quimicos}
          elementosIniciales={elementosSeleccionados}
          consumosIniciales={consumos}
          onCancelar={() => setAbierto(false)}
          onGuardar={(ids, filas) => {
            onGuardar(ids, filas.length ? filas : [filaConsumoVacia()]);
            setAbierto(false);
          }}
        />
      )}
    </CampoRegistro>
  );
}

/**
 * Tabla de lo usado en una tarea, armada con los nombres y unidades de los
 * catálogos. La usan la tarea en curso (lo elegido, antes de marcarla) y la
 * tarea ya hecha (lo que quedó registrado, de solo lectura).
 */
export function ResumenInsumos({
  elementos,
  quimicos,
  elementosIds,
  consumos,
}: {
  elementos: ElementoLimpiezaOpcion[];
  quimicos: InsumoQuimicoOpcion[];
  elementosIds: number[];
  consumos: { insumoId: number; cantidad: string | number }[];
}) {
  return (
    <TablaInsumos
      filas={[
        ...elementosIds.map((id) => ({
          clave: `e-${id}`,
          tipo: "elemento" as const,
          nombre: elementos.find((e) => e.id === id)?.nombre ?? `Elemento ${id}`,
        })),
        ...consumos.map((c) => {
          const q = quimicos.find((o) => o.id === c.insumoId);
          return {
            clave: `q-${c.insumoId}`,
            tipo: "producto" as const,
            nombre: q?.nombre ?? `Producto ${c.insumoId}`,
            cantidad: formatoCantidad(String(c.cantidad)),
            unidad: q?.unidad_simbolo ?? null,
          };
        }),
      ]}
    />
  );
}

interface FilaResumen {
  clave: string;
  tipo: "elemento" | "producto";
  nombre: string;
  cantidad?: string;
  unidad?: string | null;
}

/**
 * Resumen de lo elegido como tabla compacta: tipo, nombre y cantidad (los
 * elementos no llevan cantidad). Primero los elementos, después los productos.
 * `data-sin-tarjetas`: en el celular sigue siendo tabla (tiene tres columnas
 * cortas), no la vista de tarjetas del resto de los listados.
 */
function TablaInsumos({ filas }: { filas: FilaResumen[] }) {
  const encabezado = {
    px: "3",
    py: "2",
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.muted",
    bg: "bg.subtle",
    borderBottomWidth: "1px",
    borderColor: "border.subtle",
  } as const;
  const celda = {
    px: "3",
    py: "2",
    fontSize: "sm",
    color: "fg",
    borderBottomWidth: "1px",
    borderColor: "border.subtle",
  } as const;

  return (
    // Todo el ancho de su columna: termina donde termina la alerta de observaciones.
    <Box
      w="100%"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="lg"
      overflow="hidden"
      css={{ "& tbody tr:last-of-type td": { borderBottomWidth: 0 } }}
    >
      <Table.Root size="sm" data-sin-tarjetas="" css={{ tableLayout: "auto" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader {...encabezado} w="160px">
              Tipo
            </Table.ColumnHeader>
            <Table.ColumnHeader {...encabezado}>Nombre</Table.ColumnHeader>
            <Table.ColumnHeader {...encabezado} textAlign="right" w="120px">
              Cantidad
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {filas.map((f) => (
            <Table.Row key={f.clave} bg="transparent">
              <Table.Cell {...celda}>
                <HStack gap="1.5" color="fg.muted" whiteSpace="nowrap">
                  <Box as="span" display="inline-flex" aria-hidden>
                    {f.tipo === "elemento" ? <LuBrush size={14} /> : <LuFlaskConical size={14} />}
                  </Box>
                  <Text as="span" fontSize="xs" fontWeight="medium">
                    {f.tipo === "elemento" ? "Elemento" : "Producto químico"}
                  </Text>
                </HStack>
              </Table.Cell>
              <Table.Cell {...celda} fontWeight="medium">
                {f.nombre}
              </Table.Cell>
              <Table.Cell {...celda} textAlign="right" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
                {f.cantidad ? (
                  <>
                    <Text as="span" fontWeight="semibold">
                      {f.cantidad}
                    </Text>
                    {f.unidad ? (
                      <Text as="span" color="fg.muted">
                        {" "}
                        {f.unidad}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text as="span" color="fg.subtle">
                    —
                  </Text>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

/* ───────────────────────────── Ventana ───────────────────────────── */

/**
 * Ventana de selección, con el mismo marco que el historial de cambios: un
 * buscador arriba y dos listas con casillas de 44px. Al tildar un producto
 * aparece su campo de cantidad. Trabaja sobre un borrador: solo al guardar
 * se aplica a la tarea; "Cancelar" deja todo como estaba.
 */
function SelectorInsumosDialog({
  nombreTarea,
  elementos,
  quimicos,
  elementosIniciales,
  consumosIniciales,
  onCancelar,
  onGuardar,
}: {
  nombreTarea: string;
  elementos: ElementoLimpiezaOpcion[];
  quimicos: InsumoQuimicoOpcion[];
  elementosIniciales: number[];
  consumosIniciales: FilaConsumo[];
  onCancelar: () => void;
  onGuardar: (elementos: number[], filas: FilaConsumo[]) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [elegidos, setElegidos] = useState<Set<number>>(() => new Set(elementosIniciales));
  // Producto tildado → cantidad escrita (texto, como el input).
  const [cantidades, setCantidades] = useState<Map<string, string>>(
    () => new Map(consumosIniciales.map((f) => [f.insumoId, f.cantidad])),
  );
  const [intentado, setIntentado] = useState(false);

  const texto = busqueda.trim().toLowerCase();
  const elementosVisibles = useMemo(
    () => elementos.filter((e) => !texto || e.nombre.toLowerCase().includes(texto)),
    [elementos, texto],
  );
  const quimicosVisibles = useMemo(
    () => quimicos.filter((q) => !texto || q.nombre.toLowerCase().includes(texto)),
    [quimicos, texto],
  );

  const cantidadInvalida = (valor: string | undefined) => {
    const n = Number(valor);
    return !valor || !Number.isFinite(n) || n <= 0;
  };
  const faltanCantidades = [...cantidades.entries()].filter(([, v]) => cantidadInvalida(v));

  const alternarElemento = (id: number) =>
    setElegidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  const alternarQuimico = (id: string) =>
    setCantidades((prev) => {
      const nuevo = new Map(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.set(id, "");
      return nuevo;
    });

  const guardar = () => {
    setIntentado(true);
    if (faltanCantidades.length > 0) return;
    // Se conserva el orden de las listas, no el de los clics.
    const ids = elementos.map((e) => e.id).filter((id) => elegidos.has(id));
    const filas = quimicos
      .filter((q) => cantidades.has(String(q.id)))
      .map((q) => filaConsumoVacia(String(q.id), cantidades.get(String(q.id)) ?? ""));
    onGuardar(ids, filas);
  };

  return (
    <DialogRoot open placement="center" motionPreset="scale" closeOnEscape={false} closeOnInteractOutside={false}>
      <DialogContent
        bg="bg.panel"
        p="0"
        rounded="xl"
        boxShadow="dialog"
        // Ancha: las dos listas van una al lado de la otra.
        width="960px"
        maxW="94vw"
        // Alto fijo: al buscar, la ventana no se achica ni salta de lugar.
        h="min(680px, 88vh)"
        display="flex"
        flexDirection="column"
        overflow="hidden"
        textAlign="left"
      >
        {/* Encabezado + buscador (fijos) */}
        <Box px="6" pt="6" pb="4" borderBottomWidth="1px" borderColor="border.subtle">
          <DialogTitle fontSize="lg" fontWeight="semibold" color="fg">
            Elementos y productos utilizados
          </DialogTitle>
          <Text fontSize="sm" color="fg.muted" mt="1" mb="4">
            {nombreTarea}
          </Text>
          <Box position="relative">
            <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color="fg.muted" zIndex="1" display="inline-flex" aria-hidden>
              <LuSearch size={16} />
            </Box>
            <chakra.input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar elemento o producto..."
              aria-label="Buscar elemento o producto"
              w="100%"
              h="11"
              ps="9"
              pe="3"
              rounded="lg"
              borderWidth="1px"
              borderColor="border"
              bg="bg.panel"
              color="fg"
              fontSize="sm"
              outline="none"
              _focusVisible={{ borderColor: "teal.solid", boxShadow: "0 0 0 1px var(--chakra-colors-teal-solid)" }}
            />
          </Box>
        </Box>

        {/*
          Listas lado a lado desde tablet; cada una scrollea por su cuenta, así
          se puede tildar un elemento sin perder de vista los productos. En el
          celular van una debajo de la otra y scrollea el bloque entero.
        */}
        <Box
          flex="1"
          minH="0"
          display="grid"
          gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap={{ base: "5", md: "6" }}
          px="6"
          py="4"
          overflowY={{ base: "auto", md: "hidden" }}
        >
          <Seccion
            titulo="Elementos de limpieza"
            icono={<LuBrush size={15} />}
            contador={elegidos.size}
            vacio={elementos.length === 0 ? "No hay elementos de limpieza cargados." : "Ningún elemento coincide con la búsqueda."}
            hayItems={elementosVisibles.length > 0}
          >
            {elementosVisibles.map((e) => (
              <FilaOpcion
                key={e.id}
                etiqueta={e.nombre}
                marcada={elegidos.has(e.id)}
                onAlternar={() => alternarElemento(e.id)}
              />
            ))}
          </Seccion>

          <Seccion
            titulo="Productos químicos"
            icono={<LuFlaskConical size={15} />}
            contador={cantidades.size}
            vacio={quimicos.length === 0 ? "No hay productos químicos cargados." : "Ningún producto coincide con la búsqueda."}
            hayItems={quimicosVisibles.length > 0}
          >
            {quimicosVisibles.map((q) => {
              const id = String(q.id);
              const marcada = cantidades.has(id);
              const invalida = intentado && marcada && cantidadInvalida(cantidades.get(id));
              return (
                <FilaOpcion
                  key={q.id}
                  etiqueta={q.nombre}
                  detalle={q.unidad_simbolo ? `Se mide en ${q.unidad_simbolo}` : undefined}
                  marcada={marcada}
                  onAlternar={() => alternarQuimico(id)}
                >
                  {marcada && (
                    <HStack
                      gap="0"
                      h="10"
                      borderWidth="1px"
                      borderColor={invalida ? "red.solid" : "border"}
                      rounded="lg"
                      bg="bg.panel"
                      overflow="hidden"
                      flexShrink={0}
                      _focusWithin={{ borderColor: "teal.solid", boxShadow: "0 0 0 1px var(--chakra-colors-teal-solid)" }}
                    >
                      <chakra.input
                        type="number"
                        min="0.01"
                        step="0.01"
                        // Recién tildado, el foco va a la cantidad.
                        autoFocus={!cantidades.get(id)}
                        value={cantidades.get(id) ?? ""}
                        onChange={(e) =>
                          setCantidades((prev) => new Map(prev).set(id, e.target.value))
                        }
                        placeholder="Cant."
                        aria-label={`Cantidad usada de ${q.nombre}`}
                        aria-invalid={invalida || undefined}
                        w="20"
                        h="full"
                        px="3"
                        bg="transparent"
                        color="fg"
                        fontSize="sm"
                        textAlign="right"
                        outline="none"
                        fontVariantNumeric="tabular-nums"
                      />
                      {q.unidad_simbolo && (
                        <Box px="2.5" h="full" display="flex" alignItems="center" bg="bg.muted" color="fg.muted" fontSize="sm" fontWeight="semibold">
                          {q.unidad_simbolo}
                        </Box>
                      )}
                    </HStack>
                  )}
                </FilaOpcion>
              );
            })}
          </Seccion>
        </Box>

        {/* Pie (fijo) */}
        <Box px="6" py="4" borderTopWidth="1px" borderColor="border.subtle" bg="bg.subtle">
          {intentado && faltanCantidades.length > 0 && (
            <MensajeError mt="0" mb="3">
              Indicá cuánto usaste de cada producto tildado (mayor que 0).
            </MensajeError>
          )}
          <HStack justify="space-between" gap="3" flexWrap="wrap">
            <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
              {elegidos.size} {elegidos.size === 1 ? "elemento" : "elementos"} · {cantidades.size}{" "}
              {cantidades.size === 1 ? "producto" : "productos"}
            </Text>
            <HStack gap="3">
              <BotonCancelar onClick={onCancelar}>Cancelar</BotonCancelar>
              <Button type="button" colorPalette="teal" onClick={guardar}>
                Guardar selección
              </Button>
            </HStack>
          </HStack>
        </Box>
      </DialogContent>
    </DialogRoot>
  );
}

function Seccion({
  titulo,
  icono,
  contador,
  vacio,
  hayItems,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  contador: number;
  vacio: string;
  hayItems: boolean;
  children: React.ReactNode;
}) {
  return (
    // `minH` 0 solo en dos columnas: ahí cada lista scrollea adentro. Apiladas
    // (celular), con 0 la grilla las achicaba y se superponían.
    <Box role="group" aria-label={titulo} display="flex" flexDirection="column" minH={{ base: "auto", md: "0" }}>
      <HStack gap="2" mb="2" color="fg.muted">
        <Box as="span" display="inline-flex" aria-hidden>
          {icono}
        </Box>
        <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.06em">
          {titulo}
        </Text>
        {contador > 0 && (
          <Box as="span" px="1.5" rounded="full" bg="teal.subtle" color="teal.fg" fontSize="xs" fontWeight="bold">
            {contador}
          </Box>
        )}
      </HStack>
      {hayItems ? (
        <Stack
          gap="1"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="lg"
          p="1"
          // En dos columnas, cada lista scrollea dentro de su columna.
          flex={{ base: "none", md: "1" }}
          minH="0"
          overflowY={{ base: "visible", md: "auto" }}
        >
          {children}
        </Stack>
      ) : (
        <Text fontSize="sm" color="fg.muted" py="2">
          {vacio}
        </Text>
      )}
    </Box>
  );
}

/** Una opción de la lista: toda la fila (44px) alterna la casilla. */
function FilaOpcion({
  etiqueta,
  detalle,
  marcada,
  onAlternar,
  children,
}: {
  etiqueta: string;
  detalle?: string;
  marcada: boolean;
  onAlternar: () => void;
  children?: React.ReactNode;
}) {
  return (
    <HStack
      gap="3"
      minH="11"
      px="2"
      rounded="md"
      bg={marcada ? "teal.subtle" : "transparent"}
      _hover={{ bg: marcada ? "teal.subtle" : "bg.subtle" }}
      transition="background-color 0.15s ease"
    >
      <Checkbox.Root
        checked={marcada}
        onCheckedChange={onAlternar}
        colorPalette="teal"
        flex="1"
        minW="0"
        minH="11"
        cursor="pointer"
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control w="5" h="5" rounded="md" />
        <Checkbox.Label minW="0">
          <Text fontSize="sm" color="fg" fontWeight={marcada ? "semibold" : "normal"} lineClamp={1}>
            {etiqueta}
          </Text>
          {detalle && (
            <Text fontSize="xs" color="fg.muted">
              {detalle}
            </Text>
          )}
        </Checkbox.Label>
      </Checkbox.Root>
      {children}
    </HStack>
  );
}
