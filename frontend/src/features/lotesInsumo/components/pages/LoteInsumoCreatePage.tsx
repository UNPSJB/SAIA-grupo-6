import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HStack, Box } from "@chakra-ui/react";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { hoyISO } from "../../../../common/utils/fechas";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  DialogoExito,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../../components/ui/patrones";
import { useProveedores } from "../../../proveedores/hooks/useProveedores";
import { useInsumosActivos } from "../../hooks/useStockInsumos";
import { crearLoteInsumo } from "../../services/loteInsumoService";

export function LoteInsumoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { insumos, loading: cargandoInsumos } = useInsumosActivos();
  const { proveedores, loading: cargandoProveedores } = useProveedores(false);

  const [insumoId, setInsumoId] = useState(0);
  const [proveedorId, setProveedorId] = useState(0);
  const [numeroLote, setNumeroLote] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [ingreso, setIngreso] = useState(() => hoyISO());
  const [vencimiento, setVencimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const unidad = insumos.find((i) => i.id === insumoId)?.unidad_medida.simbolo;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!insumoId || !proveedorId) {
      setError("Elegí el insumo y el proveedor.");
      return;
    }
    if (!numeroLote.trim()) {
      setError("Indicá el número de lote del proveedor.");
      return;
    }
    if (!(Number(cantidad) > 0)) {
      setError("La cantidad recibida debe ser mayor a cero.");
      return;
    }
    if (vencimiento && ingreso && vencimiento < ingreso) {
      setError("El vencimiento no puede ser anterior al ingreso.");
      return;
    }

    setGuardando(true);
    try {
      await crearLoteInsumo({
        insumo_id: insumoId,
        proveedor_id: proveedorId,
        numero_lote: numeroLote.trim(),
        cantidad_recibida: cantidad,
        fecha_ingreso: ingreso || null,
        fecha_vencimiento: vencimiento || null,
      });
      setExito(true);
      delayedNavigate("/stock-insumos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el lote.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PaginaFormulario
      volver={{ a: "/stock-insumos", etiqueta: "Stock de insumos" }}
      titulo="Recibir lote de insumo"
      error={error}
    >

      <Box as="form" onSubmit={handleSubmit}>
        <TarjetaFormulario>
          <TituloFormulario>Datos del lote recibido</TituloFormulario>

          <FormField label="Insumo" required mb="4">
            <FormNativeSelect
              value={insumoId}
              onChange={(e) => setInsumoId(Number(e.target.value))}
              disabled={cargandoInsumos}
              maxW="500px"
            >
              <SelectPlaceholder>{cargandoInsumos ? "Cargando..." : "Seleccioná un insumo"}</SelectPlaceholder>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({i.unidad_medida.simbolo})
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField label="Proveedor" required mb="4">
            <FormNativeSelect
              value={proveedorId}
              onChange={(e) => setProveedorId(Number(e.target.value))}
              disabled={cargandoProveedores}
              maxW="500px"
            >
              <SelectPlaceholder>
                {cargandoProveedores ? "Cargando..." : "Seleccioná un proveedor"}
              </SelectPlaceholder>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <HStack gap="5" align="flex-start" flexWrap="wrap" mb="4">
            <FormField label="Número de lote del proveedor" required mb="0">
              <FormInput
                value={numeroLote}
                onChange={(e) => setNumeroLote(e.target.value)}
                placeholder="Ej: H-2026-0415"
                maxW="260px"
              />
            </FormField>
            <FormField label={`Cantidad recibida${unidad ? ` (${unidad})` : ""}`} required mb="0">
              <FormInput
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                maxW="200px"
              />
            </FormField>
          </HStack>

          <HStack gap="5" align="flex-start" flexWrap="wrap">
            <FormField label="Fecha de ingreso" mb="0">
              <FormInput type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} maxW="220px" />
            </FormField>
            <FormField label="Fecha de vencimiento" mb="0" helper="Opcional. Se usa para sugerir qué lote consumir primero.">
              <FormInput
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                maxW="220px"
              />
            </FormField>
          </HStack>

          <AccionesFormulario>
            <BotonGuardar loading={guardando}>Registrar lote</BotonGuardar>
            <BotonCancelar onClick={() => navigate("/stock-insumos")} disabled={guardando}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </TarjetaFormulario>
      </Box>

      <DialogoExito isOpen={exito} mensaje="Lote de insumo registrado correctamente." />
    </PaginaFormulario>
  );
}
