import { useState, type ReactNode } from "react";
import { Badge, Box, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
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
import { ConfirmDialog } from "../../../common/components/ConfirmDialog";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import {
  type IngredienteOpcion,
  type VersionFormState,
  type VersionInput,
} from "../types/receta";
import {
  aInput,
  calcularReparto,
  nuevaFilaIngrediente,
  nuevaFilaTarea,
  nuevaFilaUso,
  validar,
} from "../utils/versionForm";

interface RecetaVersionFormProps {
  titulo: string;
  inicial: VersionFormState;
  ingredientes: IngredienteOpcion[];
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
 * Recuadro de una fila repetible (un ingrediente, una tarea): fondo apenas
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
  ingredientes,
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
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  // Cancelar descartaba lo editado sin preguntar: si hay cambios, se confirma.
  const hayCambios = JSON.stringify(estado) !== JSON.stringify(inicial);
  const cancelar = () => (hayCambios ? setConfirmarSalida(true) : onCancel());

  const ingredientePor = (id: number) => ingredientes.find((i) => i.id === id);
  const simbolo = (id: number) => ingredientePor(id)?.unidad_medida.simbolo ?? "";
  const reparto = calcularReparto(estado);
  const ingredientesDeLaReceta = estado.ingredientes.filter((i) => i.ingrediente_id > 0);
  const noAditivos = ingredientes.filter((i) => !i.es_aditivo && !i.inactivo);
  const aditivos = ingredientes.filter((i) => i.es_aditivo && !i.inactivo);
  const dadosDeBaja = ingredientes.filter((i) => i.inactivo);

  const editarIngrediente = (clave: string, cambios: Partial<VersionFormState["ingredientes"][number]>) =>
    setEstado((prev) => ({
      ...prev,
      ingredientes: prev.ingredientes.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)),
    }));

  const quitarIngrediente = (clave: string) =>
    setEstado((prev) => {
      const quitado = prev.ingredientes.find((i) => i.clave === clave);
      return {
        ...prev,
        ingredientes: prev.ingredientes.filter((i) => i.clave !== clave),
        tareas: prev.tareas.map((t) => ({
          ...t,
          usos: t.usos.filter((u) => u.ingrediente_id !== quitado?.ingrediente_id || !quitado?.ingrediente_id),
        })),
      };
    });

  const editarTarea = (clave: string, cambios: { descripcion?: string; procedimiento?: string }) =>
    setEstado((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t) => (t.clave === clave ? { ...t, ...cambios } : t)),
    }));

  const editarUso = (
    tareaClave: string,
    usoClave: string,
    cambios: { ingrediente_id?: number; cantidad?: string },
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
    const problema = validar(estado, ingredientes);
    setError(problema);
    if (problema) return;
    await onSubmit(aInput(estado, ingredientes));
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
          <FormField label="Descripción" completo="hasta-xl">
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
        titulo="Ingredientes"
        ayuda="Cantidad total de cada ingrediente y aditivo para el rendimiento indicado. Si es ingrediente o aditivo lo define el maestro de ingredientes."
      >
        <Stack gap="3">
          {estado.ingredientes.map((fila) => {
            const elegido = ingredientePor(fila.ingrediente_id);
            return (
              <Box key={fila.clave} {...ESTILO_FILA}>
                <Box {...COLUMNAS_FILA}>
                  <FormField label="Ingrediente" mb="0">
                    <FormNativeSelect
                      value={fila.ingrediente_id}
                      onChange={(e) => editarIngrediente(fila.clave, { ingrediente_id: Number(e.target.value) })}
                    >
                      <SelectPlaceholder>Seleccioná un ingrediente</SelectPlaceholder>
                      <optgroup label="No aditivos">
                        {noAditivos.map((i) => (
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
                      {dadosDeBaja.length > 0 && (
                        <optgroup label="Dados de baja">
                          {dadosDeBaja.map((i) => (
                            <option key={i.id} value={i.id} disabled={i.id !== fila.ingrediente_id}>
                              {i.nombre} ({i.unidad_medida.simbolo}) · dado de baja
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </FormNativeSelect>
                  </FormField>
                  <FormField label="Cantidad" mb="0">
                    <InputUnidad
                      unidad={fila.ingrediente_id ? simbolo(fila.ingrediente_id) : undefined}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={fila.cantidad}
                      onChange={(e) => editarIngrediente(fila.clave, { cantidad: e.target.value })}
                    />
                  </FormField>
                  <BotonAccion
                    accion="eliminar"
                    label="Quitar ingrediente"
                    onClick={() => quitarIngrediente(fila.clave)}
                    mb="1"
                    justifySelf="end"
                  />
                </Box>
                {elegido?.inactivo && (
                  <HStack gap="2" mt="2" fontSize="sm" color="orange.fg">
                    <LuTriangleAlert aria-hidden />
                    <Text as="span">
                      Está dado de baja en el maestro de ingredientes: reemplazalo por uno activo o quitalo.
                    </Text>
                  </HStack>
                )}
                {elegido && !elegido.inactivo && (
                  <HStack gap="2" mt="2" flexWrap="wrap">
                    {elegido.es_aditivo && (
                      <Badge colorPalette="purple" variant="subtle">
                        Aditivo
                      </Badge>
                    )}
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
          onClick={() => setEstado((prev) => ({ ...prev, ingredientes: [...prev.ingredientes, nuevaFilaIngrediente()] }))}
        >
          Agregar ingrediente
        </BotonAgregar>
      </SeccionFormulario>

      <SeccionFormulario
        titulo="Tareas"
        ayuda="Etapas de elaboración, en orden. Repartí cada ingrediente entre las tareas donde se usa."
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

              <FormField
                label="Procedimiento"
                opcional
                helper="Cómo se hace la etapa, paso a paso. Es lo que lee quien la ejecuta en cada lote."
                mb="4"
              >
                <Textarea
                  value={tarea.procedimiento}
                  onChange={(e) => editarTarea(tarea.clave, { procedimiento: e.target.value })}
                  placeholder={"Ej: 1. Tamizar la harina con la sal.\n2. Agregar la levadura disuelta y amasar 10 minutos."}
                  rows={3}
                  maxLength={4000}
                />
              </FormField>

              <Stack gap="3" pl={{ base: "0", md: "4" }} borderLeftWidth={{ base: "0", md: "2px" }} borderColor="brand.muted">
                {tarea.usos.map((uso) => (
                  <Box key={uso.clave} {...COLUMNAS_FILA}>
                    <FormField label="Ingrediente usado" mb="0">
                      <FormNativeSelect
                        value={uso.ingrediente_id}
                        onChange={(e) =>
                          editarUso(tarea.clave, uso.clave, { ingrediente_id: Number(e.target.value) })
                        }
                      >
                        <SelectPlaceholder>Seleccioná un ingrediente</SelectPlaceholder>
                        {ingredientesDeLaReceta.map((i) => (
                          <option key={i.clave} value={i.ingrediente_id}>
                            {ingredientePor(i.ingrediente_id)?.nombre ?? i.ingrediente_id}
                          </option>
                        ))}
                      </FormNativeSelect>
                    </FormField>
                    <FormField label="Cantidad" mb="0">
                      <InputUnidad
                        unidad={uso.ingrediente_id ? simbolo(uso.ingrediente_id) : undefined}
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
                      label="Quitar ingrediente de la tarea"
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
                    + Ingrediente de esta tarea
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
                key={r.ingrediente_id}
                gap="2"
                fontSize="sm"
                color={r.completo ? "green.fg" : "orange.fg"}
              >
                {r.completo ? <LuCircleCheck aria-hidden /> : <LuTriangleAlert aria-hidden />}
                <Text as="span">
                  {ingredientePor(r.ingrediente_id)?.nombre}: repartido {formatoCantidad(r.repartido)} de{" "}
                  {formatoCantidad(r.total)} {simbolo(r.ingrediente_id)}
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
        onCancelar={cancelar}
        faltantes={faltaProducto}
        mostrarFaltantes={intentado}
      />
      <ConfirmDialog
        isOpen={confirmarSalida}
        titulo="¿Descartar los cambios?"
        mensaje="Lo que editaste en esta receta no se guardó y se va a perder."
        textoConfirmar="Descartar cambios"
        textoCancelar="Seguir editando"
        onConfirm={onCancel}
        onCancel={() => setConfirmarSalida(false)}
      />
    </FormularioAlta>
  );
}
