import { useParams } from "react-router-dom";
import { Button, HStack } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { BannerError, EstadoCargando, Tarjeta } from "../../../../components/ui/patrones";
import { PaginaDetalle } from "../../../../components/ui/plantillas";
import { GrafoTrazabilidad } from "../GrafoTrazabilidad";
import { obtenerGrafoTrazabilidad } from "../../services/trazabilidadService";
import { BotonDescargaGrafico } from "../../../exportacion";

export function TrazabilidadLoteCompletoPage() {
  const { id } = useParams<{ id: string }>();
  const loteId = Number(id);

  const {
    registro: grafo,
    loading,
    error,
    recargar,
  } = useRegistro({
    cargar: obtenerGrafoTrazabilidad,
    id: Number.isFinite(loteId) ? loteId : null,
    etiqueta: "el grafo de trazabilidad del lote",
  });

  return (
    <PaginaDetalle
      volver={{ a: `/lotes/${id}`, etiqueta: `Lote #${grafo?.numero_lote || id}` }}
      titulo={`Trazabilidad Completa: Lote ${grafo?.numero_lote || ""}`}
      descripcion={`Árbol genealógico de inocuidad: origen de insumos, transformación en planta y distribución a clientes de ${grafo?.producto_nombre || ""}.`}
      acciones={
        <HStack gap="2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => recargar()}
            disabled={loading}
          >
            <LuRefreshCw aria-hidden /> Refrescar
          </Button>
        </HStack>
      }
    >
      {loading && <EstadoCargando>Cargando árbol de trazabilidad...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {grafo && (
        <Tarjeta p="4">
          <BotonDescargaGrafico alDerecha titulo={`Trazabilidad del lote ${grafo.numero_lote}`} />
          <GrafoTrazabilidad grafo={grafo} />
        </Tarjeta>
      )}
    </PaginaDetalle>
  );
}
