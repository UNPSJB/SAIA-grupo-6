import { DialogBody, DialogCloseTrigger, DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
import type { DatosNutricionales } from "../types/nutricion";
import { FormDatosNutricionales } from "./FormDatosNutricionales";

/**
 * Datos nutricionales de un ingrediente sin salir de la pantalla del producto.
 *
 * * Para completar lo que falta (E11, historia 3: "desde la misma pantalla de
 *   advertencia"): editable.
 * * Para consultar desde el detalle del cálculo: `soloLectura`.
 */
export function DatosNutricionalesDialog({
  ingredienteId,
  onGuardado,
  onCerrar,
  soloLectura = false,
}: {
  ingredienteId: number;
  onGuardado?: (datos: DatosNutricionales) => void;
  onCerrar: () => void;
  soloLectura?: boolean;
}) {
  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      scrollBehavior="inside"
      onOpenChange={(detalle) => {
        if (!detalle.open) onCerrar();
      }}
    >
      <DialogContent bg="bg.panel" rounded="lg" boxShadow="dialog" width="900px" maxW="calc(100vw - 32px)">
        <DialogCloseTrigger />
        <DialogTitle as="h3" px="6" pt="6" mb="0" fontSize="lg" fontWeight="bold" color="fg">
          {soloLectura ? "Datos nutricionales del ingrediente" : "Completar datos nutricionales"}
        </DialogTitle>
        <DialogBody p="6">
          <FormDatosNutricionales ingredienteId={ingredienteId} onGuardado={onGuardado} onCancel={onCerrar} soloLectura={soloLectura} />
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
