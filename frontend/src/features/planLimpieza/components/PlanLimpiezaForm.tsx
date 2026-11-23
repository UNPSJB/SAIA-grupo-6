
import { useMemo, useState } from "react";
import { Box, Button, HStack, Stack, Textarea } from "@chakra-ui/react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import type { PlanLimpiezaInput } from "../services/planLimpiezaService";
import { TIPOS_TAREA, type TipoTarea } from "../types/planLimpieza";
import { useOpcionesPlanLimpieza } from "../hooks/useOpcionesPlanLimpieza";
import { useAuth } from "../../../common/context/useAuth";
import {
  BannerError,
  BotonCancelar,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  CeldaCompleta,
  FormularioAlta,
  GrillaFormulario,
  InputUnidad,
  SeccionFormulario,
} from "../../../components/ui/formularios";
import type { SectorResumen } from "../../sector/types/sector";
interface PlanLimpiezaFormProps {
  initialValues?: PlanLimpiezaInput;
  onSubmit: (values: PlanLimpiezaInput) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyValues: PlanLimpiezaInput = {
  nombre: "",
  tareas: [
    {
      nombre: "",
      frecuencia: 1,
      tipo: "operacional",
      descripcion: "",
      observaciones: "",
      operador_id: null,
    },
  ],
  equipo_id: 0,
  autor_id: 0,
};

/**
 * El aspecto de los controles lo dan `FormInput` y `FormNativeSelect`: este
 * último arma el `NativeSelect.Root`/`Indicator` para que el desplegable
 * tenga el mismo lenguaje visual que los inputs.
 */
export function PlanLimpiezaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  onCancel,
}: PlanLimpiezaFormProps) {
  const { user } = useAuth();
  const [values, setValues] = useState<PlanLimpiezaInput>({
    ...initialValues,
    /*
     * El autor arranca en quien tiene la sesión abierta. Antes se pedía a
     * mano (el helper decía "el sistema todavía no tiene sesión", que ya no
     * es cierto): quedaba un select en "Seleccioná quién crea el plan" que
     * nadie notaba, y el botón de guardar deshabilitado sin explicación.
     */
    autor_id: initialValues.autor_id || user?.id || 0,
  });
  const {
    equipos,
    personal,
    loading: cargandoOpciones,
    error: errorOpciones,
  } = useOpcionesPlanLimpieza();


  const [sectorElegido, setSectorElegido] = useState<number | null>(null);

  const equipoSeleccionado = equipos.find((e) => e.id === values.equipo_id);
  const sectorId = sectorElegido ?? equipoSeleccionado?.sector_id ?? 0;

  // Sectores que realmente tienen equipos, sin repetir y ordenados.
  const sectoresDisponibles = useMemo(() => {
    const porId = new Map<number, SectorResumen>();
    equipos.forEach((equipo) => porId.set(equipo.sector.id, equipo.sector));
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [equipos]);

  const equiposDelSector = equipos.filter((e) => e.sector_id === sectorId);
  // Responsables posibles de una tarea: quienes pueden operar (son los que
  // la marcan en el checklist del día).
  const operadores = personal.filter((persona) => persona.puede_operar);
  // Un responsable que ya no está en la lista (dado de baja o sin permiso de
  // operar): se muestra marcado y hay que elegir otro para poder guardar.
  const responsableNoDisponible = (operadorId: number | null) =>
    operadorId !== null && !cargandoOpciones && !operadores.some((o) => o.id === operadorId);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, nombre: e.target.value }));

  const handleEquipoChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({ ...prev, equipo_id: Number(e.target.value) }));

  const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSectorElegido(Number(e.target.value));
    // El equipo anterior puede no pertenecer al sector nuevo.
    setValues((prev) => ({ ...prev, equipo_id: 0 }));
  };
  const handleAutorChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({ ...prev, autor_id: Number(e.target.value) }));

  // Las tareas ahora son propias de este plan: se cargan como una lista
  // editable, no como un <select> sobre un catálogo compartido. Cada una
  // tiene su propio nombre y su propia frecuencia (en días).
  const handleTareaNombreChange = (index: number, nombre: string) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) => (i === index ? { ...t, nombre } : t)),
    }));

  const handleTareaDescripcionChange = (index: number, descripcion: string) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) =>
        i === index ? { ...t, descripcion } : t,
      ),
    }));

  const handleTareaFrecuenciaChange = (index: number, frecuencia: number) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) =>
        i === index ? { ...t, frecuencia } : t,
      ),
    }));

  const handleTareaTipoChange = (index: number, tipo: TipoTarea) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) => (i === index ? { ...t, tipo } : t)),
    }));

  const handleTareaObservacionesChange = (index: number, observaciones: string) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) =>
        i === index ? { ...t, observaciones } : t,
      ),
    }));

  const handleTareaOperadorChange = (index: number, operador_id: number | null) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) => (i === index ? { ...t, operador_id } : t)),
    }));

  const handleAgregarTarea = () =>
    setValues((prev) => ({
      ...prev,
      tareas: [
        ...prev.tareas,
        {
          nombre: "",
          frecuencia: 1,
          tipo: "operacional",
          descripcion: "",
          observaciones: "",
          operador_id: null,
        },
      ],
    }));

  const handleQuitarTarea = (index: number) =>
    setValues((prev) => ({
      ...prev,
      tareas:
        prev.tareas.length > 1
          ? prev.tareas.filter((_, i) => i !== index)
          : prev.tareas,
    }));

  const { intentado, puedeEnviar } = useIntentoEnvio();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar(faltantes)) return;
    onSubmit(values);
  };

  /*
   * Lo que falta para poder guardar, en una sola fuente de verdad: el botón
   * se deshabilita con esta lista y el mensaje de abajo la muestra. Antes
   * el botón quedaba grisado sin decir por qué, y no se entendía qué
   * faltaba completar.
   */
  const faltantes: string[] = [];
  if (!values.nombre.trim()) faltantes.push("el nombre del plan");
  values.tareas.forEach((tarea, indice) => {
    if (!tarea.nombre.trim()) faltantes.push(`el nombre de la tarea ${indice + 1}`);
    if (!tarea.frecuencia || tarea.frecuencia <= 0)
      faltantes.push(`la frecuencia de la tarea ${indice + 1}`);
    if (!tarea.operador_id) faltantes.push(`el operador responsable de la tarea ${indice + 1}`);
    else if (responsableNoDisponible(tarea.operador_id))
      faltantes.push(`otro operador responsable para la tarea ${indice + 1} (el actual ya no está disponible)`);
  });
  if (!sectorId) faltantes.push("el sector");
  else if (!values.equipo_id) faltantes.push("el equipo");
  if (!values.autor_id) faltantes.push("el autor");

  return (
    <FormularioAlta onSubmit={handleSubmit} sinValidacionNativa>
      <SeccionFormulario titulo="Datos del plan">
        <GrillaFormulario>
          {errorOpciones && (
            <CeldaCompleta>
              <BannerError mb="0">{errorOpciones}</BannerError>
            </CeldaCompleta>
          )}

          <FormField label="Nombre" required completo>
            <FormInput
              value={values.nombre}
              onChange={handleNombreChange}
              placeholder="Ej: Limpieza diaria de heladeras"
            />
          </FormField>

          <FormField label="Sector" required>
            <FormNativeSelect
              value={sectorId}
              onChange={handleSectorChange}
              disabled={cargandoOpciones}
            >
              <SelectPlaceholder value={0}>
                {cargandoOpciones ? "Cargando..." : "Seleccioná un sector"}
              </SelectPlaceholder>
              {sectoresDisponibles.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.nombre}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField
            label="Equipo"
            required
            helper="Solo se muestran los equipos del sector elegido."
          >
            <FormNativeSelect
              value={values.equipo_id}
              onChange={handleEquipoChange}
              disabled={cargandoOpciones || !sectorId}
            >
              <SelectPlaceholder value={0}>
                {cargandoOpciones
                  ? "Cargando..."
                  : !sectorId
                    ? "Primero elegí un sector"
                    : equiposDelSector.length === 0
                      ? "Este sector no tiene equipos"
                      : "Seleccioná un equipo"}
              </SelectPlaceholder>
              {equiposDelSector.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField
            label="Autor"
            required
            completo="hasta-xl"
            helper="Arranca en quien tiene la sesión abierta; podés cambiarlo si el plan lo firma otra persona."
          >
            <FormNativeSelect
              value={values.autor_id}
              onChange={handleAutorChange}
              disabled={cargandoOpciones}
            >
              <SelectPlaceholder value={0}>
                {cargandoOpciones ? "Cargando..." : "Seleccioná quién crea el plan"}
              </SelectPlaceholder>
              {/*
                Solo se ofrecen quienes pueden administrar: el backend rechaza
                a cualquier otro como autor (`AUTOR_SIN_PERMISO_DE_ADMINISTRAR`,
                "Se requiere permiso de administrar..."). Antes la lista traía a
                todo el personal, se podía elegir a un operador, y el rechazo
                aparecía recién al guardar.
              */}
              {personal
                .filter(
                  (persona) => persona.puede_administrar || persona.es_super_admin,
                )
                .map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre} {persona.apellido || ""}
                  </option>
                ))}
            </FormNativeSelect>
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>

      {/*
        Tareas, cada una con su propia frecuencia, en un recuadro anidado con
        su propia grilla: nombre y procedimiento a lo ancho, frecuencia y tipo
        emparejados.
      */}
      <SeccionFormulario
        titulo={
          <>
            Tareas{" "}
            <Box as="span" color="brand.fg" aria-hidden>
              *
            </Box>
          </>
        }
        ayuda="Cada tarea tiene su propia frecuencia. Tiene que haber al menos una."
      >
        <Stack gap="4" w="100%">
          {values.tareas.map((tarea, index) => (
            <Box
              key={index}
              p={{ base: "4", md: "5" }}
              w="100%"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border"
              rounded="lg"
            >
              <GrillaFormulario>
                <FormField label={`Tarea ${index + 1}`} completo="hasta-xl">
                  <FormInput
                    value={tarea.nombre}
                    onChange={(e) =>
                      handleTareaNombreChange(index, e.target.value)
                    }
                    placeholder={`Ej: Limpiar bandeja ${index + 1}`}
                  />
                </FormField>

                <FormField label="Frecuencia" helper="Cada cuántos días se repite.">
                  <InputUnidad
                    unidad="días"
                    type="number"
                    min={1}
                    value={tarea.frecuencia}
                    onChange={(e) =>
                      handleTareaFrecuenciaChange(index, Number(e.target.value))
                    }
                    placeholder="Ej: 7"
                    title="Frecuencia en días"
                  />
                </FormField>

                <FormField
                  label="Operador responsable"
                  required
                  helper={
                    responsableNoDisponible(tarea.operador_id)
                      ? "El responsable actual fue dado de baja o ya no puede operar: elegí otro."
                      : "Quien la hace en el checklist del día. Si falta, se le asigna un suplente desde el checklist."
                  }
                >
                  <FormNativeSelect
                    value={tarea.operador_id ?? 0}
                    onChange={(e) => handleTareaOperadorChange(index, Number(e.target.value) || null)}
                    disabled={cargandoOpciones}
                  >
                    <SelectPlaceholder value={0}>
                      {cargandoOpciones ? "Cargando..." : "Seleccioná un operador"}
                    </SelectPlaceholder>
                    {responsableNoDisponible(tarea.operador_id) && (
                      <option value={tarea.operador_id ?? 0} disabled>
                        Responsable no disponible (dado de baja)
                      </option>
                    )}
                    {operadores.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nombre} {persona.apellido || ""}
                      </option>
                    ))}
                  </FormNativeSelect>
                </FormField>

                {/*
                  El tipo y las observaciones se editan junto al resto de la
                  tarea: son parte de la definición, no un dato derivado.
                */}
                <FormField
                  label="Tipo de tarea"
                  helper="Define en qué momento del proceso se ejecuta."
                >
                  <FormNativeSelect
                    value={tarea.tipo}
                    onChange={(e) =>
                      handleTareaTipoChange(index, e.target.value as TipoTarea)
                    }
                  >
                    {TIPOS_TAREA.map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </FormNativeSelect>
                </FormField>

                <FormField label="Procedimiento" opcional completo="doble">
                  <Textarea
                    value={tarea.descripcion ?? ""}
                    onChange={(e) =>
                      handleTareaDescripcionChange(index, e.target.value)
                    }
                    placeholder={
                      "Ej:\n1. Desconectar la energía eléctrica.\n2. Retirar residuos..."
                    }
                    rows={4}
                    resize="vertical"
                  />
                </FormField>

                <FormField
                  label="Observaciones"
                  opcional
                  completo
                  helper="Se muestran al lado de la tarea en el checklist del día."
                >
                  <Textarea
                    value={tarea.observaciones ?? ""}
                    onChange={(e) =>
                      handleTareaObservacionesChange(index, e.target.value)
                    }
                    placeholder="Ej: Usar guantes y verificar la temperatura antes de empezar."
                    rows={2}
                    resize="vertical"
                  />
                </FormField>

                <CeldaCompleta>
                  <HStack justify="flex-end">
                    <BotonCancelar
                      size="sm"
                      aria-label={`Quitar tarea ${index + 1}`}
                      onClick={() => handleQuitarTarea(index)}
                      disabled={values.tareas.length === 1}
                    >
                      <LuTrash2 aria-hidden />
                      Quitar tarea
                    </BotonCancelar>
                  </HStack>
                </CeldaCompleta>
              </GrillaFormulario>
            </Box>
          ))}

          <Button
            type="button"
            variant="outline"
            colorPalette="brand"
            size="sm"
            alignSelf="flex-start"
            onClick={handleAgregarTarea}
          >
            <LuPlus aria-hidden />
            Agregar tarea
          </Button>
        </Stack>
      </SeccionFormulario>

      {/*
       * El aviso de qué falta va pegado a los botones (lo pone `AccionesAlta`),
       * y recién después de intentar guardar: antes aparecía apenas se abría
       * el formulario vacío, como si ya hubiera un error.
       */}
      <AccionesAlta
        etiqueta={submitLabel}
        guardando={isLoading}
        onCancelar={onCancel}
        faltantes={faltantes}
        mostrarFaltantes={intentado}
      />
    </FormularioAlta>
  );
}