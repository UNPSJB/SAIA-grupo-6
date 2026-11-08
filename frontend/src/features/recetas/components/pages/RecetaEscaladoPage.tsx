import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, HStack, Text } from "@chakra-ui/react";
import { LuFactory, LuInfo } from "react-icons/lu";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { cantidadConUnidad, formatoCantidad } from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonCancelar,
  EstadoCargando,
  FormField,
  FormInput,
  FormNativeSelect,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { PaginaDetalle } from "../../../../components/ui/plantillas";
import { useEscalado } from "../../hooks/useEscalado";
import { obtenerReceta } from "../../services/recetaService";
import type { ModoEscalado } from "../../types/receta";
import { TablaEscalado } from "../TablaEscalado";

const FACTORES_RAPIDOS = ["0.5", "2", "3"];

/**
 * E9 – Escalar receta a mi lote. Vista de cálculo de la versión vigente:
 * multiplica cada cantidad sin tocar la receta guardada y permite iniciar un
 * lote precargado con esas cantidades.
 */
export function RecetaEscaladoPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const recetaId = Number(id);
  const idValido = Number.isFinite(recetaId) ? recetaId : null;

  const { registro: receta, loading, error } = useRegistro({
    cargar: obtenerReceta,
    id: idValido,
    etiqueta: "la receta",
  });

  const [modo, setModo] = useState<ModoEscalado>("cantidad");
  const [valor, setValor] = useState("");
  const { escalado, loading: calculando, error: errorEscalado, valido } = useEscalado(
    idValido,
    modo,
    valor,
  );

  const vigente = receta?.version_vigente;
  const simbolo = vigente?.unidad_medida.simbolo ?? "";

  return (
    <PaginaDetalle
      volver={receta ? { a: `/recetas/${receta.id}`, etiqueta: "la receta" } : { a: "/recetas", etiqueta: "Recetas" }}
      titulo={receta ? `Escalar ${receta.producto_nombre}` : "Escalar receta"}
      descripcion="Calculá las cantidades exactas de cada ingrediente para lo que vas a elaborar hoy."
    >
      {loading && <EstadoCargando>Cargando receta...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {receta && !vigente && <BannerError>La receta todavía no tiene versiones.</BannerError>}

      {receta && vigente && (
        <>
          <Tarjeta p="6" mb="6">
            <HStack gap="2" fontSize="sm" color="fg.muted" mb="5">
              <LuInfo aria-hidden />
              <Text as="span">
                Vista de cálculo sobre la versión vigente (v{vigente.numero}, rinde{" "}
                {cantidadConUnidad(vigente.rendimiento, simbolo)}). No modifica la receta guardada.
              </Text>
            </HStack>

            <HStack gap="5" align="flex-end" flexWrap="wrap">
              <FormField label="Calcular por" mb="0">
                <FormNativeSelect
                  value={modo}
                  onChange={(e) => {
                    setModo(e.target.value as ModoEscalado);
                    setValor("");
                  }}
                  minW="240px"
                >
                  <option value="cantidad">Cantidad objetivo de producto</option>
                  <option value="factor">Factor multiplicador</option>
                </FormNativeSelect>
              </FormField>
              <FormField
                label={modo === "cantidad" ? `Cantidad a elaborar (${simbolo})` : "Factor (×)"}
                mb="0"
              >
                <FormInput
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={modo === "cantidad" ? `Ej: ${formatoCantidad(Number(vigente.rendimiento) * 2)}` : "Ej: 2"}
                  maxW="200px"
                  autoFocus
                />
              </FormField>
              {modo === "factor" && (
                <HStack gap="2" pb="1">
                  {FACTORES_RAPIDOS.map((f) => (
                    <BotonCancelar key={f} size="sm" onClick={() => setValor(f)}>
                      ×{formatoCantidad(f)}
                    </BotonCancelar>
                  ))}
                </HStack>
              )}
            </HStack>

            {escalado && (
              <HStack gap="8" mt="6" flexWrap="wrap">
                <Text fontSize="sm" color="fg.muted">
                  Factor:{" "}
                  <Text as="span" fontWeight="bold" color="fg">
                    ×{formatoCantidad(escalado.factor)}
                  </Text>
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  Producto terminado:{" "}
                  <Text as="span" fontWeight="bold" color="fg">
                    {cantidadConUnidad(escalado.cantidad_objetivo, simbolo)}
                  </Text>
                </Text>
              </HStack>
            )}
          </Tarjeta>

          {errorEscalado && <BannerError>{errorEscalado}</BannerError>}
          {!valido && (
            <Text color="fg.muted" fontSize="sm">
              {modo === "cantidad"
                ? "Indicá cuánto producto vas a elaborar para ver las cantidades."
                : "Indicá por cuánto multiplicar la receta para ver las cantidades."}
            </Text>
          )}
          {calculando && !escalado && <EstadoCargando>Calculando...</EstadoCargando>}

          {escalado && (
            <>
              <TablaEscalado escalado={escalado} />
              <HStack mt="6" justify="flex-end">
                <Button
                  colorPalette="brand"
                  onClick={() =>
                    navigate(
                      `/lotes/nuevo?receta=${escalado.receta_id}&cantidad=${Number(escalado.cantidad_objetivo)}`,
                    )
                  }
                >
                  <LuFactory aria-hidden />
                  Iniciar lote con estas cantidades
                </Button>
              </HStack>
            </>
          )}
        </>
      )}
    </PaginaDetalle>
  );
}
