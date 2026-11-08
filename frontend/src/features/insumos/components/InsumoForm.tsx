import { useEffect, useMemo, useState } from "react";
import { Text } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import { TIPOS_INSUMO, type InsumoFormValues, type TipoInsumo } from "../types/insumo";
import { listarUnidadesMedida } from "../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
import { listarAditivos } from "../../aditivos/services/aditivoService";
import type { Aditivo } from "../../aditivos/types/aditivo";

interface InsumoFormProps {
  initialValues?: InsumoFormValues;
  onSubmit: (values: InsumoFormValues) => Promise<void> | void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...values, aditivo_id: esAditivo ? values.aditivo_id : null });
  };

  return (
    <TarjetaFormulario as="form" onSubmit={handleSubmit}>
      <TituloFormulario>{title}</TituloFormulario>

      <FormField label="Nombre" required>
        <FormInput
          value={values.nombre}
          onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
          placeholder="Ej: Harina 000"
          maxW="500px"
        />
      </FormField>

      <FormField label="Unidad de medida" required>
        <FormNativeSelect
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

      <AccionesFormulario>
        <BotonGuardar
          loading={isLoading}
          disabled={!values.unidad_medida_id || faltaAditivo}
        >
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}
