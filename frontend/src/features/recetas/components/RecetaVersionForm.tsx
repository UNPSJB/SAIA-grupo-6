import { useState, type ReactNode } from "react";
import { Badge, Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { LuCircleCheck, LuTriangleAlert } from "react-icons/lu";
import { formatoCantidad } from "../../../common/utils/numeros";
import {
  AccionesFormulario,
  BannerError,
  BotonAccion,
  BotonAgregar,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  Tarjeta,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import {
  ETIQUETA_CLASIFICACION,
  type InsumoOpcion,
  type VersionFormState,
  type VersionInput,
} from "../types/receta";
import {
  aInput,
  calcularReparto,
  nuevaFilaInsumo,
  nuevaFilaTarea,
  nuevaFilaUso,
  validar,
} from "../utils/versionForm";

interface RecetaVersionFormProps {
  titulo: string;
  inicial: VersionFormState;
  insumos: InsumoOpcion[];
  unidades: UnidadMedida[];
  onSubmit: (datos: VersionInput) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel: string;
  onCancel: () => void;
  /** Campos previos al cuerpo de la receta (por ejemplo, elegir el producto). */
  encabezado?: ReactNode;
  /** Deshabilita el envío por un motivo externo (por ejemplo, producto sin elegir). */
  bloqueado?: boolean;
}

function Seccion({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <Box mt="8">
      <Heading as="h4" size="md" color="fg" mb="1">
        {titulo}
      </Heading>
      {ayuda ? (
        <Text fontSize="sm" color="fg.muted" mb="4">
          {ayuda}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}

export function RecetaVersionForm({
  titulo,
  inicial,
  insumos,
  unidades,
  onSubmit,
  isLoading = false,
  submitLabel,
  onCancel,
  encabezado,
  bloqueado = false,
}: RecetaVersionFormProps) {
  const [estado, setEstado] = useState<VersionFormState>(inicial);
  const [error, setError] = useState<string | null>(null);

  const insumoPor = (id: number) => insumos.find((i) => i.id === id);
  const simbolo = (id: number) => insumoPor(id)?.unidad_medida.simbolo ?? "";
  const reparto = calcularReparto(estado);
  const insumosDeLaReceta = estado.insumos.filter((i) => i.insumo_id > 0);
  const ingredientes = insumos.filter((i) => i.tipo === "ingrediente");
  const aditivos = insumos.filter((i) => i.tipo === "aditivo");

  const editarInsumo = (clave: string, cambios: Partial<VersionFormState["insumos"][number]>) =>
    setEstado((prev) => ({
      ...prev,
      insumos: prev.insumos.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)),
    }));

  const quitarInsumo = (clave: string) =>
    setEstado((prev) => {
      const quitado = prev.insumos.find((i) => i.clave === clave);
      return {
        ...prev,
        insumos: prev.insumos.filter((i) => i.clave !== clave),
        tareas: prev.tareas.map((t) => ({
          ...t,
          usos: t.usos.filter((u) => u.insumo_id !== quitado?.insumo_id || !quitado?.insumo_id),
        })),
      };
    });

  const editarTarea = (clave: string, cambios: { descripcion?: string }) =>
    setEstado((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t) => (t.clave === clave ? { ...t, ...cambios } : t)),
    }));

  const editarUso = (
    tareaClave: string,
    usoClave: string,
    cambios: { insumo_id?: number; cantidad?: string },
  ) =>
    setEstado((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t) =>
        t.clave === tareaClave
          ? { ...t, usos: t.usos.map((u) => (u.clave === usoClave ? { ...u, ...cambios } : u)) }
          : t,
      ),
    }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problema = validar(estado, insumos);
    setError(problema);
    if (problema) return;
    await onSubmit(aInput(estado, insumos));
  };

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <TarjetaFormulario>
        <TituloFormulario>{titulo}</TituloFormulario>

        {encabezado}

        <HStack gap="5" align="flex-start" flexWrap="wrap">
          <FormField label="Rendimiento" required mb="0" helper="Cantidad que produce la receta completa.">
            <FormInput
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={estado.rendimiento}
              onChange={(e) => setEstado((prev) => ({ ...prev, rendimiento: e.target.value }))}
              placeholder="Ej: 20"
              maxW="220px"
            />
          </FormField>
          <FormField label="Unidad del rendimiento" required mb="0">
            <FormNativeSelect
              value={estado.unidad_medida_id}
              onChange={(e) =>
                setEstado((prev) => ({ ...prev, unidad_medida_id: Number(e.target.value) }))
              }
              minW="220px"
            >
              <SelectPlaceholder>Seleccioná una unidad</SelectPlaceholder>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.simbolo})
                </option>
              ))}
            </FormNativeSelect>
          </FormField>
        </HStack>

        <Seccion
          titulo="Porción o unidad de venta"
          ayuda="Opcional. Cómo se vende o se sirve el producto, por ejemplo un frasco de 454 g o una caja de 12 unidades."
        >
          <HStack gap="5" align="flex-start" flexWrap="wrap">
            <FormField label="Descripción" mb="0">
              <FormInput
                value={estado.porcion_descripcion}
                onChange={(e) => setEstado((prev) => ({ ...prev, porcion_descripcion: e.target.value }))}
                placeholder="Ej: Frasco"
                maxLength={100}
                maxW="220px"
              />
            </FormField>
            <FormField label="Cantidad" mb="0">
              <FormInput
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={estado.porcion_cantidad}
                onChange={(e) => setEstado((prev) => ({ ...prev, porcion_cantidad: e.target.value }))}
                placeholder="Ej: 454"
                maxW="160px"
              />
            </FormField>
            <FormField label="Unidad" mb="0">
              <FormNativeSelect
                value={estado.porcion_unidad_medida_id}
                onChange={(e) =>
                  setEstado((prev) => ({ ...prev, porcion_unidad_medida_id: Number(e.target.value) }))
                }
                minW="200px"
              >
                <SelectPlaceholder>Sin porción</SelectPlaceholder>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.simbolo})
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>
          </HStack>
        </Seccion>

        <Seccion
          titulo="Insumos"
          ayuda="Cantidad total de cada ingrediente y aditivo para el rendimiento indicado. Si es ingrediente o aditivo lo define el maestro de insumos."
        >
          <Stack gap="3">
            {estado.insumos.map((fila) => {
              const elegido = insumoPor(fila.insumo_id);
              return (
              <HStack key={fila.clave} gap="3" align="flex-end" flexWrap="wrap">
                <FormField label="Insumo" mb="0">
                  <FormNativeSelect
                    value={fila.insumo_id}
                    onChange={(e) => editarInsumo(fila.clave, { insumo_id: Number(e.target.value) })}
                    minW="240px"
                  >
                    <SelectPlaceholder>Seleccioná un insumo</SelectPlaceholder>
                    <optgroup label="Ingredientes">
                      {ingredientes.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} ({i.unidad_medida.simbolo})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Aditivos">
                      {aditivos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} ({i.unidad_medida.simbolo})
                        </option>
                      ))}
                    </optgroup>
                  </FormNativeSelect>
                </FormField>
                <FormField label={`Cantidad${fila.insumo_id ? ` (${simbolo(fila.insumo_id)})` : ""}`} mb="0">
                  <FormInput
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={fila.cantidad}
                    onChange={(e) => editarInsumo(fila.clave, { cantidad: e.target.value })}
                    maxW="160px"
                  />
                </FormField>
                {elegido && (
                  <Stack gap="0" pb="1" minW="180px">
                    <Badge
                      colorPalette={elegido.tipo === "aditivo" ? "purple" : "gray"}
                      variant="subtle"
                      alignSelf="flex-start"
                    >
                      {ETIQUETA_CLASIFICACION[elegido.tipo]}
                    </Badge>
                    {elegido.aditivo && (
                      <Text fontSize="xs" color="fg.muted" mt="1">
                        {etiquetaAditivo(elegido.aditivo)}
                      </Text>
                    )}
                  </Stack>
                )}
                <BotonAccion
                  accion="eliminar"
                  label="Quitar insumo"
                  onClick={() => quitarInsumo(fila.clave)}
                  mb="1"
                />
              </HStack>
              );
            })}
          </Stack>
          <BotonAgregar
            mt="4"
            variant="outline"
            onClick={() => setEstado((prev) => ({ ...prev, insumos: [...prev.insumos, nuevaFilaInsumo()] }))}
          >
            Agregar insumo
          </BotonAgregar>
        </Seccion>

        <Seccion
          titulo="Tareas"
          ayuda="Etapas de elaboración, en orden. Repartí cada insumo entre las tareas donde se usa."
        >
          <Stack gap="4">
            {estado.tareas.map((tarea, indice) => (
              <Tarjeta key={tarea.clave} p="4" bg="bg.subtle">
                <HStack gap="3" align="flex-end" mb="3" flexWrap="wrap">
                  <Text fontWeight="bold" color="brand.fg" pb="2">
                    {indice + 1}.
                  </Text>
                  <FormField label="Descripción de la tarea" mb="0">
                    <FormInput
                      value={tarea.descripcion}
                      onChange={(e) => editarTarea(tarea.clave, { descripcion: e.target.value })}
                      placeholder="Ej: Amasar y dejar reposar"
                      minW="320px"
                    />
                  </FormField>
                  <BotonAccion
                    accion="eliminar"
                    label="Quitar tarea"
                    onClick={() =>
                      setEstado((prev) => ({
                        ...prev,
                        tareas: prev.tareas.filter((t) => t.clave !== tarea.clave),
                      }))
                    }
                    mb="1"
                  />
                </HStack>

                <Stack gap="3" pl={{ base: "0", md: "6" }}>
                  {tarea.usos.map((uso) => (
                    <HStack key={uso.clave} gap="3" align="flex-end" flexWrap="wrap">
                      <FormField label="Insumo usado" mb="0">
                        <FormNativeSelect
                          value={uso.insumo_id}
                          onChange={(e) =>
                            editarUso(tarea.clave, uso.clave, { insumo_id: Number(e.target.value) })
                          }
                          minW="240px"
                        >
                          <SelectPlaceholder>Seleccioná un insumo</SelectPlaceholder>
                          {insumosDeLaReceta.map((i) => (
                            <option key={i.clave} value={i.insumo_id}>
                              {insumoPor(i.insumo_id)?.nombre ?? i.insumo_id}
                            </option>
                          ))}
                        </FormNativeSelect>
                      </FormField>
                      <FormField
                        label={`Cantidad${uso.insumo_id ? ` (${simbolo(uso.insumo_id)})` : ""}`}
                        mb="0"
                      >
                        <FormInput
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={uso.cantidad}
                          onChange={(e) => editarUso(tarea.clave, uso.clave, { cantidad: e.target.value })}
                          maxW="160px"
                        />
                      </FormField>
                      <BotonAccion
                        accion="eliminar"
                        label="Quitar insumo de la tarea"
                        onClick={() =>
                          setEstado((prev) => ({
                            ...prev,
                            tareas: prev.tareas.map((t) =>
                              t.clave === tarea.clave
                                ? { ...t, usos: t.usos.filter((u) => u.clave !== uso.clave) }
                                : t,
                            ),
                          }))
                        }
                        mb="1"
                      />
                    </HStack>
                  ))}
                  <Box>
                    <BotonCancelar
                      size="sm"
                      onClick={() =>
                        setEstado((prev) => ({
                          ...prev,
                          tareas: prev.tareas.map((t) =>
                            t.clave === tarea.clave ? { ...t, usos: [...t.usos, nuevaFilaUso()] } : t,
                          ),
                        }))
                      }
                    >
                      + Insumo de esta tarea
                    </BotonCancelar>
                  </Box>
                </Stack>
              </Tarjeta>
            ))}
          </Stack>
          <BotonAgregar
            mt="4"
            variant="outline"
            onClick={() => setEstado((prev) => ({ ...prev, tareas: [...prev.tareas, nuevaFilaTarea()] }))}
          >
            Agregar tarea
          </BotonAgregar>
        </Seccion>

        {reparto.length > 0 && (
          <Seccion titulo="Control del reparto">
            <Stack gap="2">
              {reparto.map((r) => (
                <HStack
                  key={r.insumo_id}
                  gap="2"
                  fontSize="sm"
                  color={r.completo ? "green.fg" : "orange.fg"}
                >
                  {r.completo ? <LuCircleCheck aria-hidden /> : <LuTriangleAlert aria-hidden />}
                  <Text as="span">
                    {insumoPor(r.insumo_id)?.nombre}: repartido {formatoCantidad(r.repartido)} de{" "}
                    {formatoCantidad(r.total)} {simbolo(r.insumo_id)}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </Seccion>
        )}

        {error && (
          <Box mt="6">
            <BannerError mb="0">{error}</BannerError>
          </Box>
        )}

        <AccionesFormulario>
          <BotonGuardar loading={isLoading} disabled={bloqueado}>
            {submitLabel}
          </BotonGuardar>
          <BotonCancelar onClick={onCancel} disabled={isLoading}>
            Cancelar
          </BotonCancelar>
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}
