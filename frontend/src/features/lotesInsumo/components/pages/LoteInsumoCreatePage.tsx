import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Text } from "@chakra-ui/react";
import { LuPackagePlus, LuSave } from "react-icons/lu";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { useLista } from "../../../../common/hooks/useLista";
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
import { listarInsumos } from "../../../insumos/services/insumoService";
import { homologacionVigente, type Insumo } from "../../../insumos/types/insumo";
import { useIngredientesActivos } from "../../hooks/useStockInsumos";
import { crearLoteInsumo } from "../../services/loteInsumoService";

export function LoteInsumoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { ingredientes, loading: cargandoIngredientes } = useIngredientesActivos();
  const { proveedores, loading: cargandoProveedores } = useProveedores(false);

  const [ingredienteId, setIngredienteId] = useState(0);
  const [insumoElegido, setInsumoId] = useState(0);
  const [proveedorElegido, setProveedorId] = useState(0);
  const [numeroLote, setNumeroLote] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [ingreso, setIngreso] = useState(() => hoyISO());
  const [vencimiento, setVencimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const unidad = ingredientes.find((i) => i.id === ingredienteId)?.unidad_medida.simbolo;

  // Marcas del ingrediente elegido.
  const cargarInsumos = useCallback(
    () => (ingredienteId ? listarInsumos({ ingredienteId }) : Promise.resolve([] as Insumo[])),
    [ingredienteId],
  );
  const { items: todosLosInsumos, loading: cargandoInsumos } = useLista<Insumo[]>({
    cargar: cargarInsumos,
    dependencias: [ingredienteId],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los insumos.",
  });
  // Solo se reciben lotes de marcas con la homologación aprobada y vigente.
  const insumos = useMemo(() => todosLosInsumos.filter(homologacionVigente), [todosLosInsumos]);
  const sinAprobar = todosLosInsumos.length - insumos.length;
  // Con una sola marca no hace falta elegirla.
  const insumo =
    insumos.find((i) => i.id === insumoElegido) ?? (insumos.length === 1 ? insumos[0] : undefined);
  const insumoId = insumo?.id ?? 0;

  // Solo los proveedores que venden la marca elegida (y si es uno solo, ya queda elegido).
  const proveedoresDelInsumo = useMemo(() => {
    const ids = new Set(insumo?.proveedores.map((p) => p.id) ?? []);
    return proveedores.filter((p) => ids.has(p.id));
  }, [insumo, proveedores]);
  const proveedorId = proveedoresDelInsumo.some((p) => p.id === proveedorElegido)
    ? proveedorElegido
    : proveedoresDelInsumo.length === 1
      ? proveedoresDelInsumo[0].id
      : 0;

  const elegirIngrediente = (id: number) => {
    setIngredienteId(id);
    setInsumoId(0);
    setProveedorId(0);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!ingredienteId || !insumoId || !proveedorId) {
      setError("Elegí el ingrediente, el insumo (marca) y el proveedor.");
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
        <SeccionFormulario titulo="Origen" ayuda="Qué ingrediente llegó, de qué marca y quién lo entregó.">
          <GrillaFormulario>
            <FormField label="Ingrediente" required completo>
              <FormNativeSelect
                value={ingredienteId}
                onChange={(e) => elegirIngrediente(Number(e.target.value))}
                disabled={cargandoIngredientes}
              >
                <SelectPlaceholder>{cargandoIngredientes ? "Cargando..." : "Seleccioná un ingrediente"}</SelectPlaceholder>
                {ingredientes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad_medida.simbolo})
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField
              label="Insumo (marca)"
              required
              completo
              helper={
                !ingredienteId || cargandoInsumos
                  ? undefined
                  : todosLosInsumos.length === 0
                    ? "Este ingrediente no tiene insumos. Cargalos en la ficha del ingrediente."
                    : insumos.length === 0
                      ? "Ninguna marca de este ingrediente tiene la homologación aprobada y vigente. Homologalas en la ficha del ingrediente."
                      : sinAprobar > 0
                        ? `No se muestran ${sinAprobar === 1 ? "1 marca" : `${sinAprobar} marcas`} sin homologación vigente.`
                        : undefined
              }
            >
              <FormNativeSelect
                value={insumoId}
                onChange={(e) => setInsumoId(Number(e.target.value))}
                disabled={!ingredienteId || cargandoInsumos}
              >
                <SelectPlaceholder>
                  {!ingredienteId ? "Primero elegí el ingrediente" : cargandoInsumos ? "Cargando..." : "Seleccioná una marca"}
                </SelectPlaceholder>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField
              label="Proveedor"
              required
              completo
              helper={
                insumo && proveedoresDelInsumo.length === 0
                  ? "Ningún proveedor activo vende esta marca. Asociáselo en la ficha del ingrediente o del proveedor."
                  : undefined
              }
            >
              <FormNativeSelect
                value={proveedorId}
                onChange={(e) => setProveedorId(Number(e.target.value))}
                disabled={cargandoProveedores || !insumoId}
              >
                <SelectPlaceholder>
                  {cargandoProveedores ? "Cargando..." : !insumoId ? "Primero elegí la marca" : "Seleccioná un proveedor"}
                </SelectPlaceholder>
                {proveedoresDelInsumo.map((p) => (
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
