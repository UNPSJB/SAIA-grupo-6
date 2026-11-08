import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@chakra-ui/react";
import { useEquipo } from "../../hooks/useEquipo";
import { IntervencionEquipo } from "../IntervencionEquipo";
import { BannerError, EstadoCargando } from "../../../../components/ui/patrones";
import {
  DatoDetalle,
  GrillaDatos,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";

export function EquipoIntervencionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const equipoId = Number(id);

  const { equipo, loading, error } = useEquipo(Number.isFinite(equipoId) ? equipoId : null);

  // Vuelve a la pantalla de donde vino (notificaciones, vencimientos o equipos).
  const volver = () => (window.history.length > 1 ? navigate(-1) : navigate("/equipos"));

  if (loading) {
    return (
      <PaginaDetalle volver={{ a: "/equipos", etiqueta: "Equipos", historial: true }} titulo="Registrar intervención">
        <EstadoCargando>Cargando información...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !equipo) {
    return (
      <PaginaDetalle volver={{ a: "/equipos", etiqueta: "Equipos", historial: true }} titulo="Registrar intervención">
        <BannerError mb="0">{error || "No se encontró el equipo"}</BannerError>
      </PaginaDetalle>
    );
  }

  return (
    <PaginaDetalle
      ancho="angosto"
      volver={{ a: "/equipos", etiqueta: "Equipos", historial: true }}
      titulo="Registrar intervención"
    >
      <SeccionDetalle
        titulo="Equipo"
        acciones={
          <Button variant="outline" size="sm" onClick={() => navigate(`/equipos/detalle/${equipo.id}`)}>
            Ver ficha del equipo
          </Button>
        }
      >
        <GrillaDatos>
          <DatoDetalle etiqueta="Equipo">{equipo.nombre}</DatoDetalle>
          <DatoDetalle etiqueta="Tipo">{equipo.tipo}</DatoDetalle>
          <DatoDetalle etiqueta="Sector">{equipo.sector.nombre}</DatoDetalle>
        </GrillaDatos>
      </SeccionDetalle>

      {/* El diálogo se abre solo. Al cancelar o terminar, se vuelve a la pantalla de origen. */}
      <IntervencionEquipo equipo={equipo} onCerrar={volver} />
    </PaginaDetalle>
  );
}