import { useNavigate, useParams } from "react-router-dom";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { TarjetaFormulario } from "../../../../components/ui/patrones";
import { FormDatosNutricionales } from "../FormDatosNutricionales";

/** Datos nutricionales por 100 g de un ingrediente (E11, historia 1). */
export function DatosNutricionalesIngredientePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  return (
    <PaginaFormulario
      ancho="ancho"
      volver={{ a: "/ingredientes", etiqueta: "Ingredientes", historial: true }}
      titulo="Datos nutricionales del ingrediente"
      descripcion="Valores por 100 g que se usan para calcular la información nutricional de los productos."
    >
      <TarjetaFormulario>
        <FormDatosNutricionales ingredienteId={Number(id)} onCancel={() => navigate("/ingredientes")} />
      </TarjetaFormulario>
    </PaginaFormulario>
  );
}
