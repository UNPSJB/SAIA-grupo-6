import { useState, type FormEvent } from "react";
import { Box, Checkbox, Stack, Text } from "@chakra-ui/react";
import { DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
import { DialogForm } from "../../../common/components/DialogForm";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
} from "../../../components/ui/patrones";
import type { Insumo } from "../types/insumo";

export interface DatosInsumoDialog {
  marca: string;
  descripcion: string | null;
  codigo_fabricante: string | null;
  proveedor_ids: number[];
}

interface InsumoDialogProps {
  insumo?: Insumo;
  /** Nombre del ingrediente, para el título. */
  ingrediente: string;
  proveedores: { id: number; nombre: string }[];
  /** Debe lanzar si falla: el diálogo muestra el mensaje y sigue abierto. */
  onGuardar: (datos: DatosInsumoDialog) => Promise<void>;
  onCancel: () => void;
}

/** Alta o edición de un insumo: una marca del ingrediente y quién la vende. */
export function InsumoDialog({ insumo, ingrediente, proveedores, onGuardar, onCancel }: InsumoDialogProps) {
  const [marca, setMarca] = useState(insumo?.marca ?? "");
  const [descripcion, setDescripcion] = useState(insumo?.descripcion ?? "");
  const [codigo, setCodigo] = useState(insumo?.codigo_fabricante ?? "");
  const [seleccionados, setSeleccionados] = useState<number[]>(
    () => insumo?.proveedores.map((p) => p.id) ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alternar = (id: number, marcado: boolean) =>
    setSeleccionados((prev) =>
      marcado ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
    );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!marca.trim()) return setError("Indicá la marca.");
    if (seleccionados.length === 0) {
      return setError("Elegí al menos un proveedor: sin proveedor no se pueden recibir lotes.");
    }
    setLoading(true);
    setError(null);
    try {
      await onGuardar({
        marca: marca.trim(),
        descripcion: descripcion.trim() || null,
        codigo_fabricante: codigo.trim() || null,
        proveedor_ids: seleccionados,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el insumo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={!loading}
      closeOnInteractOutside={!loading}
      onOpenChange={(detalle) => {
        if (!detalle.open && !loading) onCancel();
      }}
    >
      <DialogContent bg="bg.panel" p="6" rounded="lg" boxShadow="dialog" width="520px" maxW="calc(100vw - 32px)">
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="fg">
            {insumo ? "Modificar insumo" : "Nuevo insumo"}
          </DialogTitle>
          <Text fontSize="sm" color="fg.muted" mb="5">
            Marca de {ingrediente} que se compra.
          </Text>

          {error ? <BannerError mb="4">{error}</BannerError> : null}

          <FormField label="Marca" required>
            <FormInput
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              maxLength={120}
              placeholder="Ej: Don Ramón"
            />
          </FormField>

          <FormField
            label="Descripción"
            helper="Opcional. Para distinguir dos productos de la misma marca."
          >
            <FormInput
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={200}
              placeholder="Ej: Integral"
            />
          </FormField>

          <FormField label="Código del fabricante" helper="Opcional.">
            <FormInput
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              maxLength={60}
              maxW="240px"
            />
          </FormField>

          <FormField label="Proveedores que la venden" required mb="0">
            <Box
              w="100%"
              maxH="200px"
              overflowY="auto"
              borderWidth="1px"
              borderColor="border.subtle"
              borderRadius="md"
              bg="bg.subtle"
              p="3"
            >
              {proveedores.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  No hay proveedores activos. Cargalos en Inventario → Proveedores.
                </Text>
              ) : (
                <Stack gap="2.5">
                  {proveedores.map((p) => (
                    <Checkbox.Root
                      key={p.id}
                      checked={seleccionados.includes(p.id)}
                      onCheckedChange={(v) => alternar(p.id, !!v.checked)}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label fontSize="sm">{p.nombre}</Checkbox.Label>
                    </Checkbox.Root>
                  ))}
                </Stack>
              )}
            </Box>
          </FormField>

          <AccionesFormulario>
            <BotonGuardar loading={loading}>Guardar</BotonGuardar>
            <BotonCancelar onClick={onCancel} disabled={loading}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
