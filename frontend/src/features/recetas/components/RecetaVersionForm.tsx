import { useState, type ReactNode } from "react";
import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { LuCircleCheck, LuTriangleAlert } from "react-icons/lu";
import { formatoCantidad } from "../../../common/utils/numeros";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  BotonCancelar,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  FormularioAlta,
  GrillaFormulario,
  InputUnidad,
  SeccionFormulario,
} from "../../../components/ui/formularios";
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

/**
 * Recuadro de una fila repetible (un insumo, una tarea): fondo apenas
 * distinto y borde, para que cada fila se lea como una unidad.
 */
const ESTILO_FILA = {
  p: { base: "3", md: "4" },
  bg: "bg.subtle",
  borderWidth: "1px",
  borderColor: "border",
  rounded: "lg",
} as const;

/**
 * Columnas de una fila: el selector se lleva el espacio, la cantidad tiene
 * ancho fijo y el botón de quitar va al final. En el celular, una columna.
 */
const COLUMNAS_FILA = {
  display: "grid",
  gridTemplateColumns: { base: "minmax(0, 1fr)", md: "minmax(0, 1fr) 200px auto" },
  columnGap: "3",
  rowGap: "3",
  alignItems: "end",
} as const;

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

  const { intentado, puedeEnviar } = useIntentoEnvio();
  // El producto se elige en el encabezado (lo pone la página): si falta, no
  // se envía y se avisa, en vez de dejar "Crear receta" deshabilitado.
  const faltaProducto = bloqueado ? ["el producto"] : [];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!puedeEnviar(faltaProducto)) return;
    const problema = validar(estado, insumos);
    setError(problema);
    if (problema) return;
    await onSubmit(aInput(estado, insumos));
  };

  return (
    <FormularioAlta onSubmit={handleSubmit} sinValidacionNativa>
      <SeccionFormulario titulo={titulo}>
        <GrillaFormulario>
          {encabezado}

          <FormField label="Rendimiento" required helper="Cantidad que produce la receta completa.">
            <InputUnidad
              unidad={unidades.find((u) => u.id === estado.unidad_medida_id)?.simbolo}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={estado.rendimiento}
              onChange={(e) => setEstado((prev) => ({ ...prev, rendimiento: e.target.value }))}
              placeholder="Ej: 20"
            />
          </FormField>
          <FormField label="Unidad del rendimiento" required>
            <FormNativeSelect
              value={estado.unidad_medida_id}
              onChange={(e) =>
                setEstado((prev) => ({ ...prev, unidad_medida_id: Number(e.target.value) }))
              }
            >
              <SelectPlaceholder>Seleccioná una unidad</SelectPlaceholder>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.simbolo})
                </option>
              ))}
            </FormNativeSelect>
          </FormField>
          <FormField
            label="Vida útil"
            opcional
            helper="Para calcular automáticamente el vencimiento de los lotes elaborados con esta versión."
          >
            <InputUnidad
              unidad="días"
              type="number"
              min={1}
              value={estado.vida_util_dias}
              onChange={(e) => setEstado((prev) => ({ ...prev, vida_util_dias: e.target.value }))}
              placeholder="Ej: 180"
            />
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>

      <SeccionFormulario
        titulo="Porción o unidad de venta"
        ayuda="Opcional. Cómo se vende o se sirve el producto, por ejemplo un frasco de 454 g o una caja de 12 unidades."
      >
        <GrillaFormulario>
          <FormField label="Descripción" completo>
            <FormInput
              value={estado.porcion_descripcion}
              onChange={(e) => setEstado((prev) => ({ ...prev, porcion_descripcion: e.target.value }))}
              placeholder="Ej: Frasco"
              maxLength={100}
            />
          </FormField>
          <FormField label="Cantidad">
            <InputUnidad
              unidad={unidades.find((u) => u.id === estado.porcion_unidad_medida_id)?.simbolo}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={estado.porcion_cantidad}
              onChange={(e) => setEstado((prev) => ({ ...prev, porcion_cantidad: e.target.value }))}
              placeholder="Ej: 454"
            />
          </FormField>
          <FormField label="Unidad">
            <FormNativeSelect
              value={estado.porcion_unidad_medida_id}
              onChange={(e) =>
                setEstado((prev) => ({ ...prev, porcion_unidad_medida_id: Number(e.target.value) }))
              }
            >
              <SelectPlaceholder>Sin porción</SelectPlaceholder>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.simbolo})
                </option>
              ))}
            </FormNativeSelect>
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>

      <SeccionFormulario
        titulo="Insumos"
        ayuda="Cantidad total de cada ingrediente y aditivo para el rendimiento indicado. Si es ingrediente o aditivo lo define el maestro de insumos."
      >
        <Stack gap="3">
          {estado.insumos.map((fila) => {
            const elegido = insumoPor(fila.insumo_id);
            return (
              <Box key={fila.clave} {...ESTILO_FILA}>
                <Box {...COLUMNAS_FILA}>
                  <FormField label="Insumo" mb="0">
                    <FormNativeSelect
                      value={fila.insumo_id}
                      onChange={(e) => editarInsumo(fila.clave, { insumo_id: Number(e.target.value) })}
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
                  <FormField label="Cantidad" mb="0">
                    <InputUnidad
                      unidad={fila.insumo_id ? simbolo(fila.insumo_id) : undefined}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={fila.cantidad}
                      onChange={(e) => editarInsumo(fila.clave, { cantidad: e.target.value })}
                    />
                  </FormField>
                  <BotonAccion
                    accion="eliminar"
                    label="Quitar insumo"
                    onClick={() => quitarInsumo(fila.clave)}
                    mb="1"
                    justifySelf="end"
                  />
                </Box>
                {elegido && (
                  <HStack gap="2" mt="2" flexWrap="wrap">
                    <Badge
                      colorPalette={elegido.tipo === "aditivo" ? "purple" : "gray"}
                      variant="subtle"
                    >
                      {ETIQUETA_CLASIFICACION[elegido.tipo]}
                    </Badge>
                    {elegido.aditivo && (
                      <Text fontSize="xs" color="fg.muted">
                        {etiquetaAditivo(elegido.aditivo)}
                      </Text>
                    )}
                  </HStack>
                )}
              </Box>
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
      </SeccionFormulario>

      <SeccionFormulario
        titulo="Tareas"
        ayuda="Etapas de elaboración, en orden. Repartí cada insumo entre las tareas donde se usa."
      >
        <Stack gap="4">
          {estado.tareas.map((tarea, indice) => (
            <Box key={tarea.clave} {...ESTILO_FILA}>
              <HStack gap="3" align="flex-end" mb="4">
                <Box flex="1" minW="0">
                  <FormField label={`Tarea ${indice + 1}`} mb="0">
                    <FormInput
                      value={tarea.descripcion}
                      onChange={(e) => editarTarea(tarea.clave, { descripcion: e.target.value })}
                      placeholder="Ej: Amasar y dejar reposar"
                    />
                  </FormField>
                </Box>
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

              <Stack gap="3" pl={{ base: "0", md: "4" }} borderLeftWidth={{ base: "0", md: "2px" }} borderColor="brand.muted">
                {tarea.usos.map((uso) => (
                  <Box key={uso.clave} {...COLUMNAS_FILA}>
                    <FormField label="Insumo usado" mb="0">
                      <FormNativeSelect
                        value={uso.insumo_id}
                        onChange={(e) =>
                          editarUso(tarea.clave, uso.clave, { insumo_id: Number(e.target.value) })
                        }
                      >
                        <SelectPlaceholder>Seleccioná un insumo</SelectPlaceholder>
                        {insumosDeLaReceta.map((i) => (
                          <option key={i.clave} value={i.insumo_id}>
                            {insumoPor(i.insumo_id)?.nombre ?? i.insumo_id}
                          </option>
                        ))}
                      </FormNativeSelect>
                    </FormField>
                    <FormField label="Cantidad" mb="0">
                      <InputUnidad
                        unidad={uso.insumo_id ? simbolo(uso.insumo_id) : undefined}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={uso.cantidad}
                        onChange={(e) => editarUso(tarea.clave, uso.clave, { cantidad: e.target.value })}
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
                      justifySelf="end"
                    />
                  </Box>
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
            </Box>
          ))}
        </Stack>
        <BotonAgregar
          mt="4"
          variant="outline"
          onClick={() => setEstado((prev) => ({ ...prev, tareas: [...prev.tareas, nuevaFilaTarea()] }))}
        >
          Agregar tarea
        </BotonAgregar>
      </SeccionFormulario>

      {reparto.length > 0 && (
        <SeccionFormulario titulo="Control del reparto">
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
        </SeccionFormulario>
      )}

      {error && (
        <Box px={{ base: "4", md: "8" }} pb="5">
          <BannerError mb="0">{error}</BannerError>
        </Box>
      )}

      <AccionesAlta
        etiqueta={submitLabel}
        guardando={isLoading}
        onCancelar={onCancel}
        faltantes={faltaProducto}
        mostrarFaltantes={intentado}
      />
    </FormularioAlta>
  );
}
