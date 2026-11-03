import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, HStack, Text } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BannerError,
  BannerExito,
  BotonCancelar,
  BotonGuardar,
  EstadoCargando,
  FormField,
  FormInput,
  PageHeader,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../../components/ui/patrones";
import { hoyISO } from "../../../../common/utils/fechas";
import { useInsumosDisponibles, useProductos } from "../../hooks/useLotes";
import { crearLote } from "../../services/loteService";
import type { Lote } from "../../types/lote";
import { AsociarInsumos } from "../AsociarInsumos";

export function LoteCreatePage() {
  const navigate = useNavigate();
  const { productos, error: errorProductos } = useProductos();
  const {
    insumos,
    loading: cargandoInsumos,
    error: errorInsumos,
  } = useInsumosDisponibles();

  const [producto, setProducto] = useState("");
  const [fecha, setFecha] = useState(() => hoyISO());
  const [cantidad, setCantidad] = useState("");
  const [loteCreado, setLoteCreado] = useState<Lote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const cantidadNumero = Number(cantidad);
    if (!producto.trim()) {
      setError("Indicá el producto que se elaboró.");
      return;
    }
    if (!fecha) {
      setError("Indicá la fecha de producción.");
      return;
    }
    if (!Number.isInteger(cantidadNumero) || cantidadNumero <= 0) {
      setError("La cantidad producida debe ser un número entero mayor a cero.");
      return;
    }

    setLoading(true);
    try {
      const lote = await crearLote({
        producto_nombre: producto.trim(),
        cantidad_producida: cantidadNumero,
        fecha_inicio: fecha,
      });
      setLoteCreado(lote);
      setCantidad("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el lote."
      );
    } finally {
      setLoading(false);
    }
  };

  const registrarOtro = () => {
    setLoteCreado(null);
    setProducto("");
    setFecha(hoyISO());
    setCantidad("");
    setError(null);
  };

  return (
    <Box p="5" maxW="760px" mx="auto">
      <PageHeader
        title="Registrar lote de producción"
        description="Cargá el producto, la fecha y la cantidad producida. Después podés asociar los insumos utilizados."
      />

      {error && <BannerError>{error}</BannerError>}

      {loteCreado ? (
        <>
          <BannerExito>
            Lote {loteCreado.codigo_lote} de {loteCreado.producto_nombre}{" "}
            registrado correctamente.
          </BannerExito>

          {cargandoInsumos && <EstadoCargando>Cargando insumos...</EstadoCargando>}

          {!cargandoInsumos && errorInsumos && (
            <BannerError>{errorInsumos}</BannerError>
          )}

          {!cargandoInsumos && !errorInsumos && (
            <AsociarInsumos
              lote={loteCreado}
              insumos={insumos}
              onNuevoLote={registrarOtro}
            />
          )}
        </>
      ) : (
        <TarjetaFormulario as="form" onSubmit={handleSubmit}>
          <TituloFormulario>Datos de producción</TituloFormulario>

          {errorProductos && <BannerError>{errorProductos}</BannerError>}

          <FormField
            label="Producto"
            required
            helper="Elegí un producto existente o escribí uno nuevo para crearlo."
          >
            <FormInput
              list="productos-disponibles"
              value={producto}
              onChange={(event) => setProducto(event.target.value)}
              placeholder="Ej: Mermelada de frutilla"
              maxW="500px"
            />
            <datalist id="productos-disponibles">
              {productos.map((item) => (
                <option key={item.id} value={item.nombre} />
              ))}
            </datalist>
          </FormField>

          <HStack gap="5" align="flex-start" flexWrap="wrap">
            <FormField label="Fecha de producción" required mb="0">
              <FormInput
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                maxW="220px"
              />
            </FormField>

            <FormField label="Cantidad producida" required mb="0">
              <FormInput
                type="number"
                min="1"
                step="1"
                value={cantidad}
                onChange={(event) => setCantidad(event.target.value)}
                placeholder="Ej: 100"
                maxW="220px"
              />
            </FormField>
          </HStack>

          <Text fontSize="xs" color="fg.subtle" mt="4">
            No se solicitan puntos críticos ni curvas de temperatura para este
            registro.
          </Text>

          <AccionesFormulario>
            <BotonGuardar loading={loading} disabled={loading}>
              Registrar lote
            </BotonGuardar>
            <BotonCancelar onClick={() => navigate("/")} disabled={loading}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </TarjetaFormulario>
      )}
    </Box>
  );
}
