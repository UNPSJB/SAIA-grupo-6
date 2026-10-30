import { useState, type FormEvent } from "react";
import { HStack } from "@chakra-ui/react";
import { DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
import { DialogForm } from "../../../common/components/DialogForm";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
} from "../../../components/ui/patrones";
import type { OperacionAjusteStock, StockInsumoQuimico } from "../types/stock";
import type { Proveedor } from "../../proveedores/types/proveedor";

export type TipoDialogoStock = "ingreso" | "ajuste" | "minimo";

interface StockOperacionDialogProps {
  tipo: TipoDialogoStock;
  insumo: StockInsumoQuimico;
  loading: boolean;
  proveedores: Proveedor[];
  onClose: () => void;
  onIngreso: (cantidad: string, proveedorId: number, numeroLote: string) => Promise<void>;
  onAjuste: (
    cantidad: string,
    operacion: OperacionAjusteStock,
    motivo: string,
  ) => Promise<void>;
  onMinimo: (stockMinimo: string | null) => Promise<void>;
}

const esCantidadPositiva = (valor: string) => Number.isFinite(Number(valor)) && Number(valor) > 0;
const esCantidadNoNegativa = (valor: string) =>
  Number.isFinite(Number(valor)) && Number(valor) >= 0;

export function StockOperacionDialog({
  tipo,
  insumo,
  loading,
  proveedores,
  onClose,
  onIngreso,
  onAjuste,
  onMinimo,
}: StockOperacionDialogProps) {
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [numeroLote, setNumeroLote] = useState("");
  const [operacion, setOperacion] = useState<OperacionAjusteStock>("incremento");
  const [minimo, setMinimo] = useState(
    insumo.stock_minimo === null ? "" : String(insumo.stock_minimo),
  );
  const [error, setError] = useState<string | null>(null);

  const titulo =
    tipo === "ingreso"
      ? "Registrar ingreso"
      : tipo === "ajuste"
        ? "Ajustar stock"
        : "Configurar stock mínimo";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (tipo === "minimo") {
      if (minimo.trim() && !esCantidadNoNegativa(minimo)) {
        setError("El stock mínimo debe ser un número igual o mayor a cero.");
        return;
      }
    } else if (!esCantidadPositiva(cantidad)) {
      setError("La cantidad debe ser un número mayor a cero.");
      return;
    }

    if (tipo === "ajuste" && !motivo.trim()) {
      setError("Indicá el motivo del ajuste.");
      return;
    }
    if (tipo === "ingreso" && !proveedorId) {
      setError("Seleccioná un proveedor activo.");
      return;
    }
    if (tipo === "ingreso" && !numeroLote.trim()) {
      setError("Indicá el número de lote.");
      return;
    }

    try {
      if (tipo === "ingreso") {
        await onIngreso(cantidad.trim(), Number(proveedorId), numeroLote.trim());
      } else if (tipo === "ajuste") {
        await onAjuste(cantidad.trim(), operacion, motivo.trim());
      } else {
        await onMinimo(minimo.trim() || null);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio.");
    }
  };

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={!loading}
      closeOnInteractOutside={!loading}
    >
      <DialogContent bg="bg.panel" p="6" rounded="lg" boxShadow="dialog" width="420px" maxW="calc(100vw - 32px)">
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle as="h3" mt={0} mb="1" fontSize="lg" fontWeight="bold" color="fg">
            {titulo}
          </DialogTitle>
          <HStack mb="5" gap="1" color="fg.muted" fontSize="sm">
            <span>{insumo.nombre}</span>
            {insumo.unidad_simbolo ? <span>({insumo.unidad_simbolo})</span> : null}
          </HStack>

          {error ? <BannerError mb="4">{error}</BannerError> : null}

          {tipo === "minimo" ? (
            <FormField label="Stock mínimo" helper="Dejalo vacío si el producto no requiere una alerta.">
              <FormInput
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={minimo}
                onChange={(event) => setMinimo(event.target.value)}
              />
            </FormField>
          ) : (
            <>
              {tipo === "ingreso" ? (
                <FormField label="Producto" required mb="4">
                  <FormInput readOnly value={`${insumo.nombre}${insumo.unidad_simbolo ? ` (${insumo.unidad_simbolo})` : ""}`} />
                </FormField>
              ) : null}
              {tipo === "ajuste" ? (
                <FormField label="Operación" required mb="4">
                  <FormNativeSelect
                    value={operacion}
                    onChange={(event) => setOperacion(event.target.value as OperacionAjusteStock)}
                  >
                    <option value="incremento">Incrementar stock</option>
                    <option value="decremento">Disminuir stock</option>
                  </FormNativeSelect>
                </FormField>
              ) : null}

              <FormField label="Cantidad" required mb="4">
                <FormInput
                  type="number"
                  min="0.000001"
                  step="any"
                  inputMode="decimal"
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                />
              </FormField>

              {tipo === "ingreso" ? (
                <>
                  <FormField label="Proveedor" required mb="4">
                    <FormNativeSelect value={proveedorId} onChange={(event) => setProveedorId(event.target.value)}>
                      <option value="">Seleccioná un proveedor</option>
                      {proveedores.map((proveedor) => (
                        <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>
                      ))}
                    </FormNativeSelect>
                  </FormField>
                  <FormField label="Número de lote" required>
                    <FormInput value={numeroLote} onChange={(event) => setNumeroLote(event.target.value)} placeholder="Ej.: 000123" />
                  </FormField>
                </>
              ) : (
                <FormField label="Motivo del ajuste" required>
                  <FormInput
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                    placeholder="Ej.: corrección de inventario"
                  />
                </FormField>
              )}
            </>
          )}

          <AccionesFormulario>
            <BotonGuardar loading={loading}>Guardar</BotonGuardar>
            <BotonCancelar onClick={onClose} disabled={loading}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
