import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Text } from "@chakra-ui/react";
import { LuFactory } from "react-icons/lu";
import {
  cantidadConUnidad,
  cantidadValidaParaUnidad,
  formatoCantidad,
  propsCampoCantidad,
} from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormNativeSelect,
  SelectPlaceholder,
} from "../../../../components/ui/patrones";
import {
  CeldaCompleta,
  FormularioAlta,
  GrillaFormulario,
  InputUnidad,
  PaginaAlta,
  PieFormulario,
  SeccionFormulario,
} from "../../../../components/ui/formularios";
import { useEscalado } from "../../../recetas/hooks/useEscalado";
import { useRecetas } from "../../../recetas/hooks/useRecetas";
import type { ModoEscalado } from "../../../recetas/types/receta";
import { TablaEscalado } from "../../../recetas/components/TablaEscalado";
import { crearLote } from "../../services/loteService";

/**
 * Nuevo lote de producción, que también es la calculadora de escalado (E9).
 *
 * Antes había una pantalla aparte "Escalar receta" con la misma calculadora
 * (producto, cantidad o factor y tabla escalada) que terminaba en "Iniciar
 * lote con estas cantidades" y traía de vuelta acá. Desde una receta se llega
 * con `?receta=ID` (y opcionalmente `&cantidad=N` o `&factor=N`); calcular no
 * crea nada hasta tocar "Crear lote".
 */
export function LoteCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Las recetas las puede leer quien opera; el listado de productos no.
  const { recetas, loading: cargando, error: errorRecetas } = useRecetas();

  const [recetaId, setRecetaId] = useState(Number(params.get("receta")) || 0);
  const [modo, setModo] = useState<ModoEscalado>(params.get("factor") ? "factor" : "cantidad");
  const [valor, setValor] = useState(params.get("cantidad") ?? params.get("factor") ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disponibles = recetas.filter((r) => r.version_vigente);
  const receta = disponibles.find((r) => r.id === recetaId);
  const vigente = receta?.version_vigente;
  const simbolo = vigente?.unidad_medida.simbolo ?? "";
  const { escalado } = useEscalado(receta ? receta.id : null, modo, valor);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!receta) {
      setError("Elegí el producto que se va a elaborar.");
      return;
    }
    if (!(Number(valor) > 0)) {
      setError(
        modo === "cantidad"
          ? "La cantidad objetivo debe ser mayor a cero."
          : "El factor debe ser mayor a cero.",
      );
      return;
    }
    if (modo === "cantidad" && !cantidadValidaParaUnidad(valor, simbolo)) {
      setError("El producto se elabora por unidad: la cantidad objetivo tiene que ser un número entero.");
      return;
    }

    setGuardando(true);
    try {
      const lote = await crearLote({
        producto_id: receta.producto_id,
        ...(modo === "cantidad" ? { cantidad_objetivo: valor } : { factor: valor }),
      });
      navigate(`/lotes/${lote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el lote.");
      setGuardando(false);
    }
  };

  return (
    <PaginaAlta
      ancho="extenso"
      // Se llega desde la lista de lotes o desde una receta.
      volver={{ a: "/lotes", etiqueta: "Lotes", historial: true }}
      icono={LuFactory}
      titulo="Nuevo lote de producción"
      descripcion="Calculá las cantidades de cada insumo para lo que vas a elaborar. El lote se crea recién al confirmar, con la versión vigente de la receta y su checklist."
      error={error}
    >
      {errorRecetas && <BannerError>{errorRecetas}</BannerError>}

      <FormularioAlta onSubmit={handleSubmit} sinValidacionNativa>
        <SeccionFormulario titulo="Datos del lote">
          <GrillaFormulario>
            <FormField
              label="Producto"
              required
              completo
              helper={
                !cargando && disponibles.length === 0
                  ? "No hay productos con receta. La receta se crea desde el menú Recetas."
                  : undefined
              }
            >
              <FormNativeSelect
                value={recetaId}
                onChange={(e) => setRecetaId(Number(e.target.value))}
                disabled={cargando}
              >
                <SelectPlaceholder>{cargando ? "Cargando..." : "Seleccioná un producto"}</SelectPlaceholder>
                {disponibles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.producto_nombre}
                  </option>
                ))}
              </FormNativeSelect>
            </FormField>

            <FormField label="Indicar por" required>
              <FormNativeSelect
                value={modo}
                onChange={(e) => {
                  setModo(e.target.value as ModoEscalado);
                  setValor("");
                }}
              >
                <option value="cantidad">Cantidad objetivo de producto terminado</option>
                <option value="factor">Factor multiplicador de la receta</option>
              </FormNativeSelect>
            </FormField>

            <FormField
              label={modo === "cantidad" ? "Cantidad objetivo" : "Factor"}
              required
              helper={
                vigente
                  ? `La receta v${vigente.numero} rinde ${cantidadConUnidad(vigente.rendimiento, simbolo)}.`
                  : undefined
              }
            >
              <InputUnidad
                unidad={modo === "cantidad" ? simbolo || undefined : "×"}
                type="number"
                min="0"
                {...(modo === "cantidad"
                  ? propsCampoCantidad(simbolo)
                  : { step: "any", inputMode: "decimal" as const })}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={modo === "cantidad" ? "Ej: 40" : "Ej: 2"}
              />
            </FormField>

            {escalado && (
              <CeldaCompleta>
                <Text fontSize="sm" color="fg.muted" mb="4">
                  Se elaborará a escala ×{formatoCantidad(escalado.factor)} de la receta (
                  {cantidadConUnidad(escalado.cantidad_objetivo, simbolo)}). Estas son las cantidades
                  planificadas:
                </Text>
                <TablaEscalado escalado={escalado} />
              </CeldaCompleta>
            )}
          </GrillaFormulario>
        </SeccionFormulario>

        <PieFormulario>
          <BotonCancelar onClick={() => navigate(-1)} disabled={guardando}>
            Cancelar
          </BotonCancelar>
          <BotonGuardar loading={guardando} loadingText="Guardando..." disabled={guardando}>
            <LuFactory aria-hidden />
            Crear lote
          </BotonGuardar>
        </PieFormulario>
      </FormularioAlta>
    </PaginaAlta>
  );
}
