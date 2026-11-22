import { Alert, Button } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { formatoCantidad } from "../../../common/utils/numeros";
import { ResumenEntidadDialog } from "../../../components/ui/ResumenEntidadDialog";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import { catalogoAlergenos } from "../../rotulado/services/declaracionesService";
import type { Sustancia } from "../../rotulado/types/declaraciones";
import { TIPOS_INSUMO, type Insumo } from "../types/insumo";

export function ResumenInsumoDialog({
  insumo, onCerrar, onNutricion,
}: {
  insumo: Insumo;
  onCerrar: () => void;
  onNutricion: () => void;
}) {
  const perfil = insumo.perfil_declaracion;
  const tieneMarcas = Boolean(perfil?.marcas.length);
  const [catalogo, setCatalogo] = useState<Sustancia[]>([]);

  useEffect(() => {
    if (!tieneMarcas) return;
    let vigente = true;
    catalogoAlergenos().then(
      sustancias => { if (vigente) setCatalogo(sustancias); },
      () => { /* Los códigos del perfil siguen disponibles si falla el catálogo. */ },
    );
    return () => { vigente = false; };
  }, [tieneMarcas]);

  const alergenos = perfil?.marcas.map(({ codigo, forma }) => {
    const nombre = catalogo.find(sustancia => sustancia.codigo === codigo)?.nombre ?? codigo.replaceAll("_", " ");
    return forma === "derivado" ? `${nombre} (derivado)` : nombre;
  }).join(", ");

  return (
    <ResumenEntidadDialog
      nombre={insumo.nombre}
      activo={insumo.activo}
      campos={[
        { etiqueta: "Tipo", valor: insumo.aditivo
          ? etiquetaAditivo(insumo.aditivo) : TIPOS_INSUMO.find(tipo => tipo.valor === insumo.tipo)?.etiqueta },
        { etiqueta: "Unidad de medida", valor: insumo.unidad_medida
          ? `${insumo.unidad_medida.nombre} (${insumo.unidad_medida.simbolo})` : "Sin unidad registrada" },
        { etiqueta: "Densidad", valor: insumo.densidad_g_ml == null
          ? "Sin registrar" : `${formatoCantidad(insumo.densidad_g_ml)} g/ml` },
        { etiqueta: "Peso unitario", valor: insumo.peso_unitario_g == null
          ? "Sin registrar" : `${formatoCantidad(insumo.peso_unitario_g)} g` },
        { etiqueta: "Alérgenos", valor: alergenos || (perfil?.evaluacion === "evaluada"
          ? "Sin alérgenos declarados" : "Sin datos confirmados") },
        { etiqueta: "Gluten", valor: perfil?.gluten === "presente" ? "Presente"
          : perfil?.gluten === "ausencia_declarada" ? "Ausencia declarada" : "Sin datos confirmados" },
        { etiqueta: "Proveedores", valor: insumo.proveedores?.map(proveedor => proveedor.nombre).join(", ") || "Sin asociar" },
      ]}
      onCerrar={onCerrar}
      acciones={insumo.activo && <Button variant="ghost" onClick={onNutricion}>Datos nutricionales</Button>}
    >
      {perfil?.evaluacion !== "evaluada" && (
        <Alert.Root status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Evaluación de alérgenos pendiente</Alert.Title>
            <Alert.Description>Completá el perfil de declaración del insumo para confirmar estos datos.</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
    </ResumenEntidadDialog>
  );
}
