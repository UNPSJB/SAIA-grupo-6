import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Text } from "@chakra-ui/react";
import { LuPackagePlus, LuSave } from "react-icons/lu";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { hoyISO } from "../../../../common/utils/fechas";
import {
  CeldaCompleta,
  FormularioAlta,
  GrillaFormulario,
  InputFecha,
  InputUnidad,
  PaginaAlta,
  PieFormulario,
  SeccionFormulario,
} from "../../../../components/ui/formularios";
import {
  BotonCancelar,
  BotonGuardar,
  DialogoExito,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
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
    <PaginaAlta
      volver={{ a: "/stock-insumos", etiqueta: "Stock de insumos" }}
      icono={LuPackagePlus}
      titulo="Recibir lote de insumo"
      descripcion="Registrá la recepción de un lote para sumarlo al stock disponible."
      error={error}
    >
      <FormularioAlta onSubmit={handleSubmit}>
        <SeccionFormulario titulo="Origen" ayuda="Qué insumo llegó y quién lo entregó.">
          <GrillaFormulario>
            <FormField label="Insumo" required completo>
              <FormNativeSelect
                value={insumoId}
                onChange={(e) => setInsumoId(Number(e.target.value))}
                disabled={cargandoInsumos}
              >
                <SelectPlaceholder>{cargandoInsumos ? "Cargando..." : "Seleccioná un insumo"}</SelectPlaceholder>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad_medida.simbolo})
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField label="Proveedor" required completo>
              <FormNativeSelect
                value={proveedorId}
                onChange={(e) => setProveedorId(Number(e.target.value))}
                disabled={cargandoProveedores}
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
            {proveedores.find((p) => p.id === proveedorId)?.es_certificado && (
              <CeldaCompleta mt="-2">
                <Text fontSize="sm" color={proveedores.find((p) => p.id === proveedorId)?.estado_certificacion === "vigente" ? "green.fg" : "red.fg"}>
                  Certificación del proveedor: {proveedores.find((p) => p.id === proveedorId)?.estado_certificacion ?? "sin certificación vigente"}.
                  {proveedores.find((p) => p.id === proveedorId)?.estado_certificacion !== "vigente" && " No se podrá registrar la recepción hasta cargar una certificación vigente."}
                </Text>
              </CeldaCompleta>
            )}
          </GrillaFormulario>
        </SeccionFormulario>

        <SeccionFormulario titulo="Datos del lote" ayuda="Tal como figuran en el remito o el rótulo del proveedor.">
          <GrillaFormulario>
            <FormField label="Número de lote del proveedor" required>
              <FormInput
                value={numeroLote}
                onChange={(e) => setNumeroLote(e.target.value)}
                placeholder="Ej: H-2026-0415"
              />
            </FormField>
            <FormField label="Cantidad recibida" required>
              <InputUnidad
                unidad={unidad}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </FormField>

            <FormField label="Fecha de ingreso" opcional>
              <InputFecha value={ingreso} onChange={(e) => setIngreso(e.target.value)} />
            </FormField>
            <FormField label="Fecha de vencimiento" opcional helper="Se usa para sugerir qué lote consumir primero.">
              <InputFecha value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
            </FormField>
          </GrillaFormulario>
        </SeccionFormulario>

        <PieFormulario>
          <BotonCancelar onClick={() => navigate("/stock-insumos")} disabled={guardando}>
            Cancelar
          </BotonCancelar>
          <BotonGuardar loading={guardando} loadingText="Guardando...">
            <LuSave aria-hidden />
            Registrar lote
          </BotonGuardar>
        </PieFormulario>
      </FormularioAlta>

      <DialogoExito isOpen={exito} mensaje="Lote de insumo registrado correctamente." />
    </PaginaAlta>
  );
}
