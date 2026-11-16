import { useEffect, useState } from "react";
import { Text, Textarea, VStack } from "@chakra-ui/react";
import { ConfirmDialog } from "../../../common/components/ConfirmDialog";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  AvisoFaltantes,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  MensajeError,
  faltantes,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  crearCertificacion,
  listarCertificaciones,
} from "../services/certificacionService";
import {
  SUGERENCIAS_TIPO_CERTIFICACION,
  normalizarTipo,
  type CertificacionFormValues,
} from "../types/certificacion";

interface ModalNuevaCertificacionProps {
  isOpen: boolean;
  transportistaId: number;
  transportistaNombre: string;
  /** Tipo precargado. En una renovación llega con el tipo de la certificación. */
  tipoInicial?: string;
  /** En una renovación el tipo no se puede cambiar. */
  tipoBloqueado?: boolean;
  /**
   * Tipos que ya tienen una certificación activa. Si no se pasa, el modal los
   * consulta al abrirse (lo usa la acción rápida de la tabla de transportistas).
   */
  tiposActivos?: string[];
  onClose: () => void;
  onCertificacionCreada: () => void;
}

const VALORES_INICIALES: CertificacionFormValues = {
  tipo: "",
  numero: "",
  fecha_emision: "",
  fecha_vencimiento: "",
  observaciones: "",
};

/**
 * Alta de una certificación del transportista.
 *
 * También se usa para renovar: el tipo llega precargado y bloqueado, y el
 * backend desactiva la certificación anterior del mismo tipo en la misma
 * transacción.
 */
export function ModalNuevaCertificacion({
  isOpen,
  transportistaId,
  transportistaNombre,
  tipoInicial,
  tipoBloqueado = false,
  tiposActivos,
  onClose,
  onCertificacionCreada,
}: ModalNuevaCertificacionProps) {
  const [values, setValues] = useState<CertificacionFormValues>(VALORES_INICIALES);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmarRenovacion, setConfirmarRenovacion] = useState(false);
  const [tiposActivosDetectados, setTiposActivosDetectados] = useState<
    string[] | null
  >(null);
  const { intentado, puedeEnviar } = useIntentoEnvio();

  // Cada apertura arranca limpia: si no, se arrastra el borrador (o el error)
  // del transportista anterior. Se ajusta en render, sin efecto extra.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) {
      setValues({ ...VALORES_INICIALES, tipo: tipoInicial ?? "" });
      setArchivo(null);
      setError(null);
      setConfirmarRenovacion(false);
      setTiposActivosDetectados(
        tiposActivos ? tiposActivos.map(normalizarTipo) : null,
      );
    }
  }

  // Sin la lista de tipos activos por props, se consulta al abrir.
  useEffect(() => {
    if (!isOpen || tiposActivos !== undefined) return;

    let vigente = true;
    void listarCertificaciones(transportistaId)
      .then((certificaciones) => {
        if (!vigente) return;
        setTiposActivosDetectados(
          certificaciones
            .filter((certificacion) => certificacion.activa)
            .map((certificacion) => normalizarTipo(certificacion.tipo)),
        );
      })
      .catch(() => {
        if (vigente) setTiposActivosDetectados([]);
      });

    return () => {
      vigente = false;
    };
  }, [isOpen, transportistaId, tiposActivos]);

  const faltan = faltantes({
    tipo: [!values.tipo.trim(), "el tipo"],
    numero: [!values.numero.trim(), "el número"],
    fecha_emision: [!values.fecha_emision.trim(), "la fecha de emisión"],
    fecha_vencimiento: [
      !values.fecha_vencimiento.trim(),
      "la fecha de vencimiento",
    ],
  });

  const fechasInvalidas =
    values.fecha_emision.trim() !== "" &&
    values.fecha_vencimiento.trim() !== "" &&
    values.fecha_vencimiento < values.fecha_emision;

  const guardar = async () => {
    setEnviando(true);
    setError(null);

    const formData = new FormData();
    formData.append("tipo", values.tipo);
    formData.append("numero", values.numero);
    formData.append("fecha_emision", values.fecha_emision);
    formData.append("fecha_vencimiento", values.fecha_vencimiento);
    if (values.observaciones?.trim()) {
      formData.append("observaciones", values.observaciones.trim());
    }
    if (archivo) {
      formData.append("archivo", archivo);
    }

    try {
      await crearCertificacion(transportistaId, formData);
      onCertificacionCreada();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la certificación.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmit = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!puedeEnviar(faltan.lista) || fechasInvalidas) return;

    const tipoNuevo = normalizarTipo(values.tipo);
    const yaTieneActiva =
      !tipoBloqueado && (tiposActivosDetectados ?? []).includes(tipoNuevo);

    if (yaTieneActiva) {
      // El backend lo trata como renovación; acá se confirma antes de pisar
      // la certificación que ya está activa.
      setConfirmarRenovacion(true);
      return;
    }

    await guardar();
  };

  if (!isOpen) return null;

  return (
    <>
      <DialogRoot
        open
        placement="center"
        motionPreset="none"
        closeOnEscape={false}
        closeOnInteractOutside={false}
      >
        <DialogContent
          bg="bg.panel"
          p="6"
          rounded="lg"
          boxShadow="dialog"
          width="480px"
          maxWidth="90vw"
          maxHeight="85vh"
          overflowY="auto"
          textAlign="left"
        >
          <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="brand.fg">
            {tipoBloqueado ? "Renovar certificación" : "Nueva certificación"}
          </DialogTitle>
          <Text fontSize="sm" color="fg.muted" mb="5">
            Transportista:{" "}
            <Text as="span" fontWeight="medium" color="fg">
              {transportistaNombre}
            </Text>
          </Text>

          <form onSubmit={handleSubmit} noValidate>
            <VStack align="stretch" gap="4">
              {error ? <MensajeError>{error}</MensajeError> : null}
              <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />

              <FormField
                label="Tipo"
                required
                mb="0"
                invalid={intentado && faltan.tiene("tipo")}
                helper={
                  tipoBloqueado
                    ? "El tipo no se puede modificar en una renovación."
                    : "Escribí el tipo o elegí una sugerencia."
                }
              >
                <FormInput
                  list="sugerencias-tipo-certificacion"
                  value={values.tipo}
                  readOnly={tipoBloqueado}
                  bg={tipoBloqueado ? "bg.muted" : undefined}
                  onChange={(evento) =>
                    setValues({ ...values, tipo: evento.target.value })
                  }
                  placeholder="Ej: SENASA"
                />
                <datalist id="sugerencias-tipo-certificacion">
                  {SUGERENCIAS_TIPO_CERTIFICACION.map((tipo) => (
                    <option key={tipo} value={tipo} />
                  ))}
                </datalist>
              </FormField>

              <FormField
                label="Número de certificado"
                required
                mb="0"
                invalid={intentado && faltan.tiene("numero")}
              >
                <FormInput
                  value={values.numero}
                  onChange={(evento) =>
                    setValues({ ...values, numero: evento.target.value })
                  }
                  placeholder="Ej: SENASA-2026-001"
                />
              </FormField>

              <FormField
                label="Fecha de emisión"
                required
                mb="0"
                invalid={intentado && faltan.tiene("fecha_emision")}
              >
                <FormInput
                  type="date"
                  value={values.fecha_emision}
                  onChange={(evento) =>
                    setValues({ ...values, fecha_emision: evento.target.value })
                  }
                />
              </FormField>

              <FormField
                label="Fecha de vencimiento"
                required
                mb="0"
                invalid={
                  (intentado && faltan.tiene("fecha_vencimiento")) || fechasInvalidas
                }
                helper={
                  fechasInvalidas
                    ? "La fecha de vencimiento tiene que ser igual o posterior a la de emisión."
                    : undefined
                }
              >
                <FormInput
                  type="date"
                  value={values.fecha_vencimiento}
                  onChange={(evento) =>
                    setValues({ ...values, fecha_vencimiento: evento.target.value })
                  }
                />
              </FormField>

              <FormField label="Observaciones" mb="0">
                <Textarea
                  value={values.observaciones ?? ""}
                  onChange={(evento) =>
                    setValues({ ...values, observaciones: evento.target.value })
                  }
                  placeholder="Observaciones adicionales..."
                  rows={3}
                  resize="vertical"
                />
              </FormField>

              <FormField
                label="Comprobante (PDF o imagen)"
                mb="0"
                helper="Formatos aceptados: PDF, PNG, JPG o JPEG. Máximo 10 MB."
              >
                <FormInput
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  p="2"
                  h="auto"
                  onChange={(evento) =>
                    setArchivo(evento.target.files?.[0] ?? null)
                  }
                />
              </FormField>

              <AccionesFormulario>
                <BotonGuardar loading={enviando} disabled={enviando}>
                  {tipoBloqueado ? "Guardar renovación" : "Guardar certificación"}
                </BotonGuardar>
                <BotonCancelar onClick={onClose} disabled={enviando}>
                  Cancelar
                </BotonCancelar>
              </AccionesFormulario>
            </VStack>
          </form>
        </DialogContent>
      </DialogRoot>

      <ConfirmDialog
        isOpen={confirmarRenovacion}
        titulo="Ya existe una certificación activa de este tipo"
        mensaje="¿Querés renovarla? La certificación anterior va a pasar al historial como Reemplazada."
        textoConfirmar="Sí, renovar"
        confirmPalette="brand"
        isLoading={enviando}
        onCancel={() => setConfirmarRenovacion(false)}
        onConfirm={() => {
          setConfirmarRenovacion(false);
          void guardar();
        }}
      />
    </>
  );
}
