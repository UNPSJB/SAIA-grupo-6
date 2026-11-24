import { EtiquetaEstado } from "../../../components/ui/patrones";
import {
  estadoPlanLabel,
  estadoPlanTono,
  estadoSituacionLabel,
  estadoSituacionTono,
  type EstadoPlan,
  type EstadoSituacionPlan,
} from "../types/planAccion";

export function EtiquetaEstadoPlan({ estado }: { estado: EstadoPlan }) {
  return <EtiquetaEstado tono={estadoPlanTono(estado)}>{estadoPlanLabel(estado)}</EtiquetaEstado>;
}

export function EtiquetaEstadoSituacion({ estado }: { estado: EstadoSituacionPlan }) {
  return (
    <EtiquetaEstado tono={estadoSituacionTono(estado)}>
      {estadoSituacionLabel(estado)}
    </EtiquetaEstado>
  );
}

/** La marca de vencido es independiente del estado: un plan En ejecución puede estar vencido. */
export function EtiquetaVencido() {
  return <EtiquetaEstado tono="peligro">Vencido</EtiquetaEstado>;
}
