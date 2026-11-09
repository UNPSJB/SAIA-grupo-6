import { DialogBody, DialogCloseTrigger, DialogContent, DialogRoot, DialogTitle } from "../../../components/ui/dialog";
import type { DatosNutricionales } from "../types/nutricion";
import { FormDatosNutricionales } from "./FormDatosNutricionales";

/**
 * Completar los datos de un insumo sin salir de la tabla del producto
 * (E11, historia 3: "desde la misma pantalla de advertencia").
 */
export function DatosNutricionalesDialog({
  insumoId,
  onGuardado,
  onCerrar,
}: {
  insumoId: number;
  onGuardado: (datos: DatosNutricionales) => void;
  onCerrar: () => void;
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
          Completar datos nutricionales
        </DialogTitle>
        <DialogBody p="6">
          <FormDatosNutricionales insumoId={insumoId} onGuardado={onGuardado} onCancel={onCerrar} />
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
