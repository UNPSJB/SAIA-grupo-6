import { useEffect, useMemo, useState } from "react";
import { Checkbox, Text } from "@chakra-ui/react";
import {
  faltantes,
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
import {
  type IngredienteFormValues,
  type IngredienteInput,
} from "../types/ingrediente";
import { listarUnidadesMedida } from "../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
import { listarClases, listarSugerencias } from "../../aditivos/services/aditivoService";
import type { ClaseFuncional, SugerenciaAditivo } from "../../aditivos/types/aditivo";

interface IngredienteFormProps {
  initialValues?: IngredienteFormValues;
  onSubmit: (values: IngredienteInput) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyValues: IngredienteFormValues = {
  nombre: "",
  unidad_medida_id: 0,
  es_aditivo: false,
  clase_funcional_id: null,
  numero_ins: "",
  densidad_g_ml: "",
  peso_unitario_g: "",
};

export function IngredienteForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  onCancel,
}: IngredienteFormProps) {
  const [values, setValues] = useState<IngredienteFormValues>(initialValues);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [clases, setClases] = useState<ClaseFuncional[]>([]);
  const [sugerencias, setSugerencias] = useState<SugerenciaAditivo[]>([]);
  const [cargandoUnidades, setCargandoUnidades] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [listaUnidades, listaClases, listaSugerencias] = await Promise.all([
          listarUnidadesMedida(false),
          listarClases(false),
          listarSugerencias(),
        ]);
        setUnidades(listaUnidades);
        setClases(listaClases);
        setSugerencias(listaSugerencias);
      } catch (err) {
        console.error("Error al cargar unidades o clases funcionales:", err);
      } finally {
        setCargandoUnidades(false);
      }
    };
    cargar();
  }, []);

  // Sugerencias agrupadas por clase funcional, como se leen en la lista de referencia.
  const sugerenciasPorClase = useMemo(() => {
    const grupos = new Map<string, { indice: number; s: SugerenciaAditivo }[]>();
    sugerencias.forEach((s, indice) => {
      const lista = grupos.get(s.clase_funcional) ?? [];
      lista.push({ indice, s });
      grupos.set(s.clase_funcional, lista);
    });
    return [...grupos.entries()];
  }, [sugerencias]);

  const esAditivo = values.es_aditivo;
  const clase = clases.find((c) => c.id === values.clase_funcional_id);
  const faltaClase = esAditivo && !values.clase_funcional_id;
  const faltaIns = esAditivo && !!clase && !clase.ins_opcional && !values.numero_ins.trim();

  // Completa clase e INS (y el nombre, si está vacío) desde la lista de referencia.
  const usarSugerencia = (indice: number) => {
    const s = sugerencias[indice];
    if (!s) return;
    setValues((prev) => ({
      ...prev,
      nombre: prev.nombre.trim() ? prev.nombre : s.nombre,
      clase_funcional_id: s.clase_funcional_id ?? prev.clase_funcional_id,
      numero_ins: s.numero_ins ?? "",
    }));
  };

  // Unidad seleccionada para saber si es volumen o unidad (reglas de densidad/peso).
  const unidadSeleccionada = unidades.find(
    (u) => u.id === values.unidad_medida_id
  );
  const esVolumen = unidadSeleccionada?.tipo === "volumen";
  const esUnidad = unidadSeleccionada?.tipo === "unidad";
  const faltaDensidad = esVolumen && !values.densidad_g_ml.trim();
  const faltaPeso = esUnidad && !values.peso_unitario_g.trim();

  const faltan = faltantes({
    nombre: [!values.nombre.trim(), "el nombre"],
    unidad: [!values.unidad_medida_id, "la unidad de medida"],
    clase: [faltaClase, "la clase funcional del aditivo"],
    ins: [faltaIns, "el número INS"],
    densidad: [faltaDensidad, "la densidad (g/ml)"],
    peso: [faltaPeso, "el peso unitario (g)"],
  });
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const parseNumero = (v: string): number | null => {
    const limpio = v.replace(/,/g, ".").trim();
    return limpio === "" ? null : Number(limpio);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar(faltan.lista)) return;
    onSubmit({
      ...values,
      clase_funcional_id: esAditivo ? values.clase_funcional_id : null,
      numero_ins: esAditivo && values.numero_ins.trim() ? values.numero_ins.trim() : null,
      densidad_g_ml: parseNumero(values.densidad_g_ml),
      peso_unitario_g: parseNumero(values.peso_unitario_g),
    });
  };

  return (
    <FormularioAlta onSubmit={handleSubmit} sinValidacionNativa>
      <SeccionFormulario titulo="Identificación">
        <GrillaFormulario>
          <FormField label="Nombre" required completo="doble" invalid={intentado && faltan.tiene("nombre")}>
            <FormInput
              value={values.nombre}
              onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej: Harina 000"
            />
          </FormField>

          <FormField
            label="Unidad de medida"
            required
            invalid={intentado && faltan.tiene("unidad")}
          >
            <FormNativeSelect
              invalid={intentado && faltan.tiene("unidad")}
              value={values.unidad_medida_id}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, unidad_medida_id: Number(e.target.value) }))
              }
              disabled={cargandoUnidades}
            >
              <SelectPlaceholder>
                {cargandoUnidades ? "Cargando..." : "Seleccioná una unidad"}
              </SelectPlaceholder>
              {unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {unidad.nombre} ({unidad.simbolo})
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <CeldaCompleta>
            <Checkbox.Root
              checked={values.es_aditivo}
              onCheckedChange={(e) => setValues((prev) => ({ ...prev, es_aditivo: !!e.checked }))}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>Es un aditivo</Checkbox.Label>
            </Checkbox.Root>
            <Text fontSize="xs" color="fg.subtle" mt="1">
              Los aditivos se declaran en el rótulo por su clase funcional y número INS.
            </Text>
          </CeldaCompleta>

          {esAditivo && (
            <FormField
              label="Completar desde la lista de referencia"
              completo
              helper="Opcional. Lista del Codex / CAA: completa la clase funcional y el número INS."
            >
              <FormNativeSelect
                value=""
                onChange={(e) => usarSugerencia(Number(e.target.value))}
                disabled={cargandoUnidades}
              >
                {/* value="" y no 0: el 0 es el índice de la primera sugerencia. */}
                <SelectPlaceholder value="">Buscar en la lista de referencia</SelectPlaceholder>
                {sugerenciasPorClase.map(([nombreClase, lista]) => (
                  <optgroup key={nombreClase} label={nombreClase}>
                    {lista.map(({ indice, s }) => (
                      <option key={indice} value={indice}>
                        {s.nombre}
                        {s.numero_ins ? ` (INS ${s.numero_ins})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </FormNativeSelect>
            </FormField>
          )}

          {esAditivo && (
            <FormField
              label="Clase funcional"
              required
              invalid={intentado && faltan.tiene("clase")}
              helper="Si no está, agregala en Inventario → Ingredientes → Clases funcionales."
            >
              <FormNativeSelect
                value={values.clase_funcional_id ?? 0}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, clase_funcional_id: Number(e.target.value) || null }))
                }
                disabled={cargandoUnidades}
              >
                <SelectPlaceholder>Seleccioná una clase</SelectPlaceholder>
                {clases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>
          )}

          {esAditivo && (
            <FormField
              label="Número INS"
              required={!clase?.ins_opcional}
              invalid={intentado && faltan.tiene("ins")}
              helper={
                clase?.ins_opcional
                  ? "Opcional: esta clase se declara solo por su función."
                  : "Formato del Codex, por ejemplo 202, 160a o 500(ii)."
              }
            >
              <FormInput
                value={values.numero_ins}
                onChange={(e) => setValues((prev) => ({ ...prev, numero_ins: e.target.value }))}
                maxLength={20}
                placeholder="Ej: 202"
              />
            </FormField>
          )}
        </GrillaFormulario>
      </SeccionFormulario>

      {(esVolumen || esUnidad) && (
        <SeccionFormulario titulo="Conversión a gramos">
          <GrillaFormulario>
            {/* Densidad: obligatoria si la unidad es Volumen */}
            {esVolumen && (
              <FormField
                label="Densidad"
                required
                invalid={intentado && faltan.tiene("densidad")}
                helper="Gramos por mililitro. Usá punto o coma decimal."
              >
                <InputUnidad
                  unidad="g/ml"
                  type="text"
                  inputMode="decimal"
                  value={values.densidad_g_ml}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, densidad_g_ml: e.target.value }))
                  }
                  placeholder="Ej: 1.2000"
                />
              </FormField>
            )}

            {/* Peso unitario: obligatorio si la unidad es Unidad */}
            {esUnidad && (
              <FormField
                label="Peso unitario"
                required
                invalid={intentado && faltan.tiene("peso")}
                helper="Peso de una unidad en gramos. Usá punto o coma decimal."
              >
                <InputUnidad
                  unidad="g"
                  type="text"
                  inputMode="decimal"
                  value={values.peso_unitario_g}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, peso_unitario_g: e.target.value }))
                  }
                  placeholder="Ej: 500"
                />
              </FormField>
            )}
          </GrillaFormulario>
        </SeccionFormulario>
      )}
      <AccionesAlta
        etiqueta={submitLabel}
        guardando={isLoading}
        onCancelar={onCancel}
        faltantes={faltan.lista}
        mostrarFaltantes={intentado}
      />
    </FormularioAlta>
  );
}
