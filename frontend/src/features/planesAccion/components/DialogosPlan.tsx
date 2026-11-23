import { useState, type FormEvent, type ReactNode } from "react";
import { Box, Input, Text, Textarea } from "@chakra-ui/react";
import { useResponsables } from "../hooks/useResponsables";
import { useCandidatas } from "../hooks/useSituacionesDisponibles";
import { ListaSituacionesElegibles } from "./SituacionesElegibles";
import type { AccionPlan, PlanCambios, PlanDetalle } from "../types/planAccion";
import { DialogForm } from "../../../common/components/DialogForm";
import { hoyISO } from "../../../common/utils/fechas";
import { DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  EstadoCargando,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
} from "../../../components/ui/patrones";

/** Cáscara común: diálogo modal que no se cierra mientras corre la operación. */
function CascaraDialogo({
  titulo,
  mensaje,
  ancho = "520px",
  ocupado,
  onCancel,
  onSubmit,
  children,
}: {
  titulo: ReactNode;
  mensaje?: ReactNode;
  ancho?: string;
  ocupado: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={!ocupado}
      closeOnInteractOutside={!ocupado}
      onOpenChange={(detalle) => {
        if (!detalle.open && !ocupado) onCancel();
      }}
    >
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width={ancho}
        maxW="calc(100vw - 32px)"
        maxH="calc(100vh - 48px)"
        overflowY="auto"
      >
        <DialogForm onSubmit={onSubmit}>
          <DialogTitle as="h3" mt={0} mb="2" fontSize="lg" fontWeight="bold" color="fg">
            {titulo}
          </DialogTitle>
          {mensaje ? (
            <Text mb="5" fontSize="sm" color="fg.muted">
              {mensaje}
            </Text>
          ) : null}
          {children}
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}

/** Corre una operación que puede fallar y deja el error a la vista, sin cerrar el diálogo. */
function useOperacion(onTerminar: () => void) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ejecutar = async (operacion: () => Promise<void>) => {
    setOcupado(true);
    setError(null);
    try {
      await operacion();
      onTerminar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  };
  return { ocupado, error, setError, ejecutar };
}

/** Campo de archivo: un solo adjunto, opcional. */
function CampoArchivo({
  archivo,
  onCambio,
}: {
  archivo: File | null;
  onCambio: (archivo: File | null) => void;
}) {
  return (
    <FormField
      label="Archivo (opcional)"
      helper="PDF, imagen, Word o Excel. Hasta 10 MB."
      mb="0"
    >
      <Input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
        onChange={(e) => onCambio(e.target.files?.[0] ?? null)}
        aria-label="Adjuntar archivo"
        p="1.5"
      />
      {archivo ? (
        <Text mt="1" fontSize="xs" color="fg.muted">
          {archivo.name}
        </Text>
      ) : null}
    </FormField>
  );
}

// ---------------------------------------------------------------------------

/**
 * Evidencia con descripción y archivo opcional. Lo usan "completar acción"
 * (evidencia de implementación) y "verificar situación" (de verificación).
 */
export function EvidenciaDialog({
  titulo,
  mensaje,
  etiquetaDescripcion,
  etiquetaConfirmar,
  obligatoria = true,
  pedirResultado = false,
  onConfirm,
  onCancel,
}: {
  titulo: ReactNode;
  mensaje?: ReactNode;
  etiquetaDescripcion: string;
  etiquetaConfirmar: string;
  /** Si es false, se puede confirmar sin texto ni archivo. */
  obligatoria?: boolean;
  /** Verificación manual: quien verifica indica si quedó corregida o no. */
  pedirResultado?: boolean;
  onConfirm: (
    descripcion: string,
    archivo: File | null,
    resultado?: "corregida" | "no_eficaz",
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<"" | "corregida" | "no_eficaz">("");
  const { ocupado, error, setError, ejecutar } = useOperacion(() => undefined);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pedirResultado && !resultado) {
      setError("Indicá el resultado de la verificación.");
      return;
    }
    if (obligatoria && descripcion.trim().length < 3) {
      setError("Describí la evidencia (al menos 3 caracteres).");
      return;
    }
    void ejecutar(() => onConfirm(descripcion.trim(), archivo, resultado || undefined));
  };

  return (
    <CascaraDialogo
      titulo={titulo}
      mensaje={mensaje}
      ocupado={ocupado}
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      {error ? <BannerError mb="4">{error}</BannerError> : null}
      {pedirResultado ? (
        <FormField label="Resultado" required>
          <FormNativeSelect
            value={resultado}
            onChange={(e) => setResultado(e.target.value as "" | "corregida" | "no_eficaz")}
          >
            <SelectPlaceholder>Elegí el resultado…</SelectPlaceholder>
            <option value="corregida">Corregida</option>
            <option value="no_eficaz">No eficaz: la condición sigue</option>
          </FormNativeSelect>
        </FormField>
      ) : null}
      <FormField label={etiquetaDescripcion} required={obligatoria}>
        <Textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          resize="vertical"
          autoFocus
        />
      </FormField>
      <CampoArchivo archivo={archivo} onCambio={setArchivo} />
      <AccionesFormulario>
        <BotonGuardar loading={ocupado}>{etiquetaConfirmar}</BotonGuardar>
        <BotonCancelar onClick={onCancel} disabled={ocupado}>
          Cancelar
        </BotonCancelar>
      </AccionesFormulario>
    </CascaraDialogo>
  );
}

// ---------------------------------------------------------------------------

/** Alta o edición de una acción (si recibe `accion`, edita). */
export function AccionDialog({
  accion,
  onConfirm,
  onCancel,
}: {
  accion?: AccionPlan;
  onConfirm: (datos: { descripcion: string; responsable_id: number; plazo: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const { responsables } = useResponsables();
  const [descripcion, setDescripcion] = useState(accion?.descripcion ?? "");
  const [responsableId, setResponsableId] = useState(accion?.responsable_id ?? 0);
  const [plazo, setPlazo] = useState(accion?.plazo ?? "");
  const { ocupado, error, setError, ejecutar } = useOperacion(() => undefined);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (descripcion.trim().length < 3 || !responsableId || !plazo) {
      setError("Completá la descripción, el responsable y el plazo.");
      return;
    }
    void ejecutar(() =>
      onConfirm({ descripcion: descripcion.trim(), responsable_id: responsableId, plazo }),
    );
  };

  return (
    <CascaraDialogo
      titulo={accion ? "Editar acción" : "Nueva acción"}
      ocupado={ocupado}
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      {error ? <BannerError mb="4">{error}</BannerError> : null}
      <FormField label="Qué se va a hacer" required>
        <Textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          resize="vertical"
          autoFocus
        />
      </FormField>
      <FormField label="Responsable" required>
        <FormNativeSelect
          value={responsableId}
          onChange={(e) => setResponsableId(Number(e.target.value))}
        >
          <SelectPlaceholder>Elegí una persona…</SelectPlaceholder>
          {responsables.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </FormNativeSelect>
      </FormField>
      <FormField label="Plazo" required mb="0">
        <FormInput type="date" min={hoyISO()} value={plazo} onChange={(e) => setPlazo(e.target.value)} />
      </FormField>
      <AccionesFormulario>
        <BotonGuardar loading={ocupado}>{accion ? "Guardar" : "Agregar"}</BotonGuardar>
        <BotonCancelar onClick={onCancel} disabled={ocupado}>
          Cancelar
        </BotonCancelar>
      </AccionesFormulario>
    </CascaraDialogo>
  );
}

// ---------------------------------------------------------------------------

/**
 * Situaciones nuevas del mismo tipo que el plan podría sumar. SAIA las
 * propone; nunca las agrega sola, y hace falta confirmar la causa compatible.
 */
export function CandidatasDialog({
  planId,
  onConfirm,
  onCancel,
}: {
  planId: number;
  onConfirm: (situacionIds: number[], confirmaCausa: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const { candidatas, loading, error: errorCarga } = useCandidatas(planId, true, 0);
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [confirmaCausa, setConfirmaCausa] = useState(false);
  const { ocupado, error, setError, ejecutar } = useOperacion(() => undefined);

  const alternar = (id: number) =>
    setSeleccionadas((actuales) =>
      actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id],
    );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (seleccionadas.length === 0) {
      setError("Elegí al menos una situación.");
      return;
    }
    if (!confirmaCausa) {
      setError("Confirmá que comparten una causa compatible con la del plan.");
      return;
    }
    void ejecutar(() => onConfirm(seleccionadas, confirmaCausa));
  };

  return (
    <CascaraDialogo
      titulo="Sumar situaciones al plan"
      mensaje="Situaciones del mismo tipo que todavía no están en otro plan activo."
      ancho="640px"
      ocupado={ocupado}
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      {(error ?? errorCarga) ? <BannerError mb="4">{error ?? errorCarga}</BannerError> : null}
      {loading ? (
        <EstadoCargando>Buscando situaciones...</EstadoCargando>
      ) : candidatas.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          No hay situaciones nuevas para sumar.
        </Text>
      ) : (
        <>
          <ListaSituacionesElegibles
            situaciones={candidatas}
            seleccionadas={seleccionadas}
            onAlternar={alternar}
          />
          <Box
            as="label"
            display="flex"
            alignItems="flex-start"
            gap="3"
            mt="4"
            p="3"
            rounded="md"
            bg="bg.subtle"
            cursor="pointer"
          >
            <input
              type="checkbox"
              checked={confirmaCausa}
              onChange={(e) => setConfirmaCausa(e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <Text fontSize="sm">
              Confirmo que las situaciones elegidas comparten una causa compatible con la del plan.
            </Text>
          </Box>
        </>
      )}
      <AccionesFormulario>
        <BotonGuardar loading={ocupado} disabled={candidatas.length === 0}>
          Sumar al plan
        </BotonGuardar>
        <BotonCancelar onClick={onCancel} disabled={ocupado}>
          Cancelar
        </BotonCancelar>
      </AccionesFormulario>
    </CascaraDialogo>
  );
}

// ---------------------------------------------------------------------------

/** Edición de los datos generales del plan (solo Borrador o En ejecución). */
export function EditarPlanDialog({
  plan,
  onConfirm,
  onCancel,
}: {
  plan: PlanDetalle;
  onConfirm: (cambios: PlanCambios) => Promise<void>;
  onCancel: () => void;
}) {
  const { responsables } = useResponsables();
  const [causa, setCausa] = useState(plan.causa);
  const [objetivo, setObjetivo] = useState(plan.objetivo);
  const [criterio, setCriterio] = useState(plan.criterio_eficacia);
  const [responsableId, setResponsableId] = useState(plan.responsable_id);
  const [plazo, setPlazo] = useState(plan.plazo ?? "");
  const { ocupado, error, setError, ejecutar } = useOperacion(() => undefined);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (causa.trim().length < 3 || objetivo.trim().length < 3 || criterio.trim().length < 3) {
      setError("La causa, el objetivo y el criterio de eficacia son obligatorios.");
      return;
    }
    const cambios: PlanCambios = {};
    if (causa.trim() !== plan.causa) cambios.causa = causa.trim();
    if (objetivo.trim() !== plan.objetivo) cambios.objetivo = objetivo.trim();
    if (criterio.trim() !== plan.criterio_eficacia) cambios.criterio_eficacia = criterio.trim();
    if (responsableId !== plan.responsable_id) cambios.responsable_id = responsableId;
    if (plazo !== (plan.plazo ?? "")) {
      if (plazo) cambios.plazo = plazo;
      else cambios.quitar_plazo = true;
    }
    if (Object.keys(cambios).length === 0) {
      onCancel();
      return;
    }
    void ejecutar(() => onConfirm(cambios));
  };

  // El responsable actual puede no figurar entre los activos: se conserva igual.
  const hayActual = responsables.some((p) => p.id === plan.responsable_id);

  return (
    <CascaraDialogo
      titulo="Editar plan"
      ancho="600px"
      ocupado={ocupado}
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      {error ? <BannerError mb="4">{error}</BannerError> : null}
      <FormField label="Causa identificada" required>
        <Textarea value={causa} onChange={(e) => setCausa(e.target.value)} rows={3} resize="vertical" />
      </FormField>
      <FormField label="Objetivo" required>
        <Textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={2} resize="vertical" />
      </FormField>
      <FormField label="Criterio de eficacia" required>
        <Textarea value={criterio} onChange={(e) => setCriterio(e.target.value)} rows={2} resize="vertical" />
      </FormField>
      <FormField label="Responsable general" required>
        <FormNativeSelect
          value={responsableId}
          onChange={(e) => setResponsableId(Number(e.target.value))}
        >
          {!hayActual ? <option value={plan.responsable_id}>{plan.responsable_nombre}</option> : null}
          {responsables.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </FormNativeSelect>
      </FormField>
      <FormField label="Plazo del plan" helper="Dejalo vacío si no tiene plazo." mb="0">
        <FormInput type="date" value={plazo} onChange={(e) => setPlazo(e.target.value)} />
      </FormField>
      <AccionesFormulario>
        <BotonGuardar loading={ocupado}>Guardar</BotonGuardar>
        <BotonCancelar onClick={onCancel} disabled={ocupado}>
          Cancelar
        </BotonCancelar>
      </AccionesFormulario>
    </CascaraDialogo>
  );
}
