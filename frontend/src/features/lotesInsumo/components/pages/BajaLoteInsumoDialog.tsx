import { avisarExito } from "../../../../components/ui/patrones";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { HStack, Image, Input, Stack, Text } from "@chakra-ui/react";
import { DialogForm } from "../../../../common/components/DialogForm";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import { DialogContent, DialogRoot, DialogTitle } from "../../../../components/ui/dialog";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
} from "../../../../components/ui/patrones";
import { darDeBajaLoteInsumo } from "../../services/loteInsumoService";
import {
  MOTIVOS_BAJA_INSUMO,
  type MotivoBajaInsumo,
  type StockLoteInsumo,
} from "../../types/loteInsumo";

/** Lo que el diálogo necesita del lote (viene de la ficha del lote). */
export type LoteParaBaja = Pick<
  StockLoteInsumo,
  "lote_insumo_id" | "numero_lote" | "ingrediente_nombre" | "proveedor_nombre" | "saldo" | "unidad" | "vencido"
>;

interface BajaLoteInsumoDialogProps {
  lote: LoteParaBaja;
  onConfirmado: () => Promise<void> | void;
  onClose: () => void;
}

const MAX_FOTO_BYTES = 1_500_000; // ~1.5 MB

export function BajaLoteInsumoDialog({
  lote,
  onConfirmado,
  onClose,
}: BajaLoteInsumoDialogProps) {
  const [motivo, setMotivo] = useState<MotivoBajaInsumo>(
    lote.vencido ? "vencido" : "danado",
  );
  const [observaciones, setObservaciones] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setFotoDataUrl(null);
      setNombreArchivo(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("El archivo seleccionado debe ser una imagen.");
      return;
    }
    if (file.size > MAX_FOTO_BYTES) {
      setError("La foto no puede superar 1,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFotoDataUrl(reader.result);
        setNombreArchivo(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    setGuardando(true);
    try {
      await darDeBajaLoteInsumo(lote.lote_insumo_id, {
        motivo,
        // Se da de baja el lote entero: todo su saldo, y queda inhabilitado.
        cantidad: lote.saldo,
        observaciones: observaciones.trim() || null,
        foto_data_url: fotoDataUrl,
        dar_de_baja_lote_completo: true,
      });
      avisarExito("Baja del lote de insumo registrada correctamente.");
      await onConfirmado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la baja.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={!guardando}
      closeOnInteractOutside={!guardando}
      onOpenChange={(detalle) => {
        if (!detalle.open && !guardando) onClose();
      }}
    >
      <DialogContent
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="520px"
        maxW="calc(100vw - 32px)"
      >
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="fg">
            Dar de baja el lote {lote.numero_lote}
          </DialogTitle>
          <Text mb="2" fontSize="sm" color="fg.muted">
            {lote.ingrediente_nombre} · Proveedor: {lote.proveedor_nombre}
          </Text>
          <Text mb="4" fontSize="sm" color="fg">
            Se da de baja el lote entero: su saldo de{" "}
            <Text as="span" fontWeight="semibold">
              {cantidadConUnidad(lote.saldo, lote.unidad)}
            </Text>{" "}
            sale del stock y el lote ya no se puede usar en producción.
          </Text>

          {error && <BannerError mb="4">{error}</BannerError>}

          <FormField label="Motivo de la baja" required mb="4">
            <FormNativeSelect
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoBajaInsumo)}
            >
              {MOTIVOS_BAJA_INSUMO.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField label="Observaciones (opcional)" mb="4">
            <FormInput
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              maxLength={300}
              placeholder="Ej: envase roto en depósito, humedad detectada..."
            />
          </FormField>

          <FormField
            label="Foto de evidencia (opcional)"
            mb="4"
            helper="Formatos JPG, PNG o WebP (máx. 1,5 MB)."
          >
            <Stack gap="2">
              <Input
                type="file"
                accept="image/*"
                p="1"
                fontSize="sm"
                onChange={handleFotoChange}
              />
              {fotoDataUrl && (
                <HStack gap="3" align="center">
                  <Image
                    src={fotoDataUrl}
                    alt="Vista previa de baja"
                    boxSize="64px"
                    objectFit="cover"
                    rounded="md"
                    borderWidth="1px"
                  />
                  <Stack gap="0">
                    <Text fontSize="xs" color="fg.muted">
                      {nombreArchivo}
                    </Text>
                    <Text
                      as="button"
                      fontSize="xs"
                      color="red.fg"
                      textAlign="left"
                      onClick={() => {
                        setFotoDataUrl(null);
                        setNombreArchivo(null);
                      }}
                    >
                      Quitar foto
                    </Text>
                  </Stack>
                </HStack>
              )}
            </Stack>
          </FormField>

          <AccionesFormulario>
            <BotonGuardar loading={guardando}>Confirmar baja</BotonGuardar>
            <BotonCancelar onClick={onClose} disabled={guardando}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
