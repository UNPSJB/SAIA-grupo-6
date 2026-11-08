import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Text } from "@chakra-ui/react";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { cantidadConUnidad, formatoCantidad } from "../../../../common/utils/numeros";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../../components/ui/patrones";
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
    <PaginaFormulario
      ancho="ancho"
      // Se llega desde la lista de lotes o desde una receta.
      volver={{ a: "/lotes", etiqueta: "Lotes", historial: true }}
      titulo="Nuevo lote de producción"
      descripcion="Calculá las cantidades de cada insumo para lo que vas a elaborar. El lote se crea recién al confirmar, con la versión vigente de la receta y su checklist."
      error={error}
    >
      {errorRecetas && <BannerError>{errorRecetas}</BannerError>}

      <TarjetaFormulario as="form" onSubmit={handleSubmit}>
        <TituloFormulario>Datos del lote</TituloFormulario>

        <FormField
          label="Producto"
          required
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
            maxW="500px"
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
            maxW="500px"
          >
            <option value="cantidad">Cantidad objetivo de producto terminado</option>
            <option value="factor">Factor multiplicador de la receta</option>
          </FormNativeSelect>
        </FormField>

        <FormField
          label={modo === "cantidad" ? `Cantidad objetivo${simbolo ? ` (${simbolo})` : ""}` : "Factor (×)"}
          required
          mb="0"
          helper={
            vigente
              ? `La receta v${vigente.numero} rinde ${cantidadConUnidad(vigente.rendimiento, simbolo)}.`
              : undefined
          }
        >
          <FormInput
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={modo === "cantidad" ? "Ej: 40" : "Ej: 2"}
            maxW="220px"
          />
        </FormField>

        {escalado && (
          <Box mt="6">
            <Text fontSize="sm" color="fg.muted" mb="4">
              Se elaborará a escala ×{formatoCantidad(escalado.factor)} de la receta (
              {cantidadConUnidad(escalado.cantidad_objetivo, simbolo)}). Estas son las cantidades
              planificadas:
            </Text>
            <TablaEscalado escalado={escalado} />
          </Box>
        )}

        <AccionesFormulario>
          <BotonGuardar loading={guardando} disabled={guardando}>
            Crear lote
          </BotonGuardar>
          <BotonCancelar onClick={() => navigate(-1)} disabled={guardando}>
            Cancelar
          </BotonCancelar>
        </AccionesFormulario>
      </TarjetaFormulario>
    </PaginaFormulario>
  );
}
