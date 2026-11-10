import { useNavigate, useParams } from "react-router-dom";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { TarjetaFormulario } from "../../../../components/ui/patrones";
import { FormDatosNutricionales } from "../FormDatosNutricionales";

/** Datos nutricionales por 100 g de un insumo (E11, historia 1). */
export function DatosNutricionalesInsumoPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  return (
    <PaginaFormulario
      ancho="ancho"
      volver={{ a: "/insumos", etiqueta: "Insumos", historial: true }}
      titulo="Datos nutricionales del insumo"
      descripcion="Valores por 100 g que se usan para calcular la información nutricional de los productos."
    >
      <TarjetaFormulario>
        <FormDatosNutricionales insumoId={Number(id)} onCancel={() => navigate("/insumos")} />
      </TarjetaFormulario>
    </PaginaFormulario>
  );
}
