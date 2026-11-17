import { useEffect, useMemo, useState } from "react";
import { Text } from "@chakra-ui/react";
import {
  AccionesFormulario,
  AvisoFaltantes,
  BotonCancelar,
  BotonGuardar,
  faltantes,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  TarjetaFormulario,
  TituloFormulario,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  TIPOS_INSUMO,
  type InsumoFormValues,
  type InsumoInput,
  type TipoInsumo,
} from "../types/insumo";
import { listarUnidadesMedida } from "../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
import { listarAditivos } from "../../aditivos/services/aditivoService";
import type { Aditivo } from "../../aditivos/types/aditivo";

interface InsumoFormProps {
  initialValues?: InsumoFormValues;
  onSubmit: (values: InsumoInput) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: InsumoFormValues = {
  nombre: "",
  unidad_medida_id: 0,
  tipo: "ingrediente",
  aditivo_id: null,
  densidad_g_ml: "",
  peso_unitario_g: "",
};

export function InsumoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de insumo",
  onCancel,
}: InsumoFormProps) {
  const [values, setValues] = useState<InsumoFormValues>(initialValues);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [cargandoUnidades, setCargandoUnidades] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [listaUnidades, listaAditivos] = await Promise.all([
          listarUnidadesMedida(false),
          listarAditivos(false),
        ]);
        setUnidades(listaUnidades);
        setAditivos(listaAditivos);
      } catch (err) {
        console.error("Error al cargar unidades o aditivos:", err);
      } finally {
        setCargandoUnidades(false);
      }
    };
    cargar();
  }, []);

  // Agrupados por clase funcional, como se leen en la lista de referencia.
  const porClase = useMemo(() => {
    const grupos = new Map<string, Aditivo[]>();
    aditivos.forEach((a) => {
      const lista = grupos.get(a.clase_funcional.nombre) ?? [];
      lista.push(a);
      grupos.set(a.clase_funcional.nombre, lista);
    });
    return [...grupos.entries()];
  }, [aditivos]);

  const esAditivo = values.tipo === "aditivo";
  const faltaAditivo = esAditivo && !values.aditivo_id;

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
    aditivo: [faltaAditivo, "el aditivo de la lista de referencia"],
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
      aditivo_id: esAditivo ? values.aditivo_id : null,
      densidad_g_ml: parseNumero(values.densidad_g_ml),
      peso_unitario_g: parseNumero(values.peso_unitario_g),
    });
  };

  return (
    <TarjetaFormulario as="form" onSubmit={handleSubmit}>
      <TituloFormulario>{title}</TituloFormulario>

      <FormField label="Nombre" required invalid={intentado && faltan.tiene("nombre")}>
        <FormInput
          value={values.nombre}
          onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
          placeholder="Ej: Harina 000"
          maxW="500px"
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
          maxW="500px"
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

      <FormField
        label="Tipo"
        required
        mb={esAditivo ? undefined : "0"}
        helper="Define cómo se clasifica en las recetas. Los aditivos se declaran por su clase funcional y número INS."
      >
        <FormNativeSelect
          value={values.tipo}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, tipo: e.target.value as TipoInsumo }))
          }
          maxW="500px"
        >
          {TIPOS_INSUMO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </FormNativeSelect>
      </FormField>

      {esAditivo && (
        <FormField
          label="Aditivo de la lista de referencia"
          required
          invalid={intentado && faltan.tiene("aditivo")}
          mb="0"
          helper="Clase funcional, nombre completo y número INS. Si no está, agregalo en Inventario → Aditivos."
        >
          <FormNativeSelect
            value={values.aditivo_id ?? 0}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, aditivo_id: Number(e.target.value) || null }))
            }
            disabled={cargandoUnidades}
            maxW="500px"
          >
            <SelectPlaceholder>Seleccioná un aditivo</SelectPlaceholder>
            {porClase.map(([clase, lista]) => (
              <optgroup key={clase} label={clase}>
                {lista.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                    {a.numero_ins ? ` (INS ${a.numero_ins})` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </FormNativeSelect>
        </FormField>
      )}

      {faltaAditivo && (
        <Text fontSize="sm" color="orange.fg" mt="3">
          Un aditivo no se puede guardar sin su clase funcional: elegilo de la lista.
        </Text>
      )}

      {/* Densidad: obligatoria si la unidad es Volumen */}
      {esVolumen && (
        <FormField
          label="Densidad (g/ml)"
          required
          invalid={intentado && faltan.tiene("densidad")}
          helper="Densidad del insumo en gramos por mililitro. Usá punto o coma decimal."
        >
          <FormInput
            type="text"
            inputMode="decimal"
            value={values.densidad_g_ml}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, densidad_g_ml: e.target.value }))
            }
            placeholder="Ej: 1.2000"
            maxW="500px"
          />
        </FormField>
      )}

      {/* Peso unitario: obligatorio si la unidad es Unidad */}
      {esUnidad && (
        <FormField
          label="Peso unitario (g)"
          required
          invalid={intentado && faltan.tiene("peso")}
          helper="Peso de una unidad del insumo en gramos. Usá punto o coma decimal."
        >
          <FormInput
            type="text"
            inputMode="decimal"
            value={values.peso_unitario_g}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, peso_unitario_g: e.target.value }))
            }
            placeholder="Ej: 500"
            maxW="500px"
          />
        </FormField>
      )}

      <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
      <AccionesFormulario>
        <BotonGuardar loading={isLoading}>
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}
