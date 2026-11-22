import { Badge, HStack, Text } from "@chakra-ui/react";
import type { PropuestaDeclaraciones } from "../types/declaraciones";

/** Lo que necesita la lista del rótulo de la declaración de alérgenos. */
export interface ResumenDeclaracion {
  texto: string;
  estado: "sugerida" | "confirmada";
  vigencia: "vigente" | "desactualizada";
  /** 0 si la propuesta todavía no se guardó: el texto sale de la vista previa. */
  revision: number;
}

/**
 * Texto de alérgenos de una propuesta, con la misma regla que arma el backend:
 * primero lo que está presente de forma directa y después lo que llega como derivado.
 * Los sulfitos quedan afuera hasta que se evalúe su concentración, y en una propuesta
 * sin guardar todavía no hay evaluaciones.
 */
export function textoAlergenosDePropuesta(
  propuesta: Pick<PropuestaDeclaraciones, "detectados">,
): string {
  const directos: string[] = [];
  const derivados: string[] = [];
  for (const item of propuesta.detectados) {
    // Los condicionados (sulfitos) esperan su evaluación; las propuestas viejas no traen la marca.
    if (item.condicionada ?? item.codigo === "sulfitos") continue;
    const esDirecto = item.fuentes.some((f) => f.forma === "directa");
    (esDirecto ? directos : derivados).push(item.nombre.toUpperCase());
  }
  const partes: string[] = [];
  if (directos.length) partes.push(`CONTIENE ${directos.join(", ")}`);
  if (derivados.length) partes.push(`CONTIENE DERIVADOS DE ${derivados.join(", ")}`);
  return partes.length ? `${partes.join(". ")}.` : "";
}

/**
 * Qué declaración mostrar: la guardada si ya se generó una propuesta; si no, la que sale
 * de la vista previa, así los alérgenos se ven antes de guardar el borrador.
 */
export function declaracionEfectiva(
  guardada: ResumenDeclaracion | null,
  propuesta?: PropuestaDeclaraciones | null,
): ResumenDeclaracion | null {
  if (guardada && guardada.revision > 0) return guardada;
  if (propuesta) {
    return {
      texto: textoAlergenosDePropuesta(propuesta),
      estado: "sugerida",
      vigencia: "vigente",
      revision: 0,
    };
  }
  return null;
}

/**
 * Une la cadena de ingredientes y aditivos con la declaración de alérgenos, como se lee en un rótulo:
 * "Ingredientes: harina; azúcar; Conservante: sorbato de potasio (INS 202). CONTIENE LECHE."
 *
 * Solo arma el texto para mostrarlo: la cadena y la declaración se guardan por separado, cada una
 * con su propio flujo de confirmación.
 */
export function armarTextoRotulo(lista: string, declaracion?: string | null): string {
  const cadena = lista.trim().replace(/[\s;.]+$/, "");
  if (!cadena) return "";
  const base = `Ingredientes: ${cadena}.`;
  const alergenos = (declaracion ?? "").trim();
  return alergenos ? `${base} ${alergenos}` : base;
}

/** Estado de la declaración de alérgenos que va al final de la lista. */
export function EstadoAlergenos({ declaracion }: { declaracion?: ResumenDeclaracion | null }) {
  if (!declaracion) {
    return (
      <Badge colorPalette="gray" variant="subtle" alignSelf="flex-start">
        Alérgenos: sin propuesta todavía
      </Badge>
    );
  }

  const confirmada = declaracion.estado === "confirmada" && declaracion.vigencia === "vigente";
  const sinGuardar = declaracion.revision === 0;
  const sinAlergenos = declaracion.texto.trim() === "";
  const etiqueta = confirmada
    ? "Alérgenos confirmados"
    : sinGuardar
      ? "Alérgenos sugeridos, sin guardar ni confirmar"
      : "Alérgenos sugeridos, falta confirmar";

  return (
    <HStack gap="2" wrap="wrap" data-testid="estado-alergenos">
      <Badge colorPalette={confirmada ? "green" : "orange"} variant="subtle">
        {etiqueta}
      </Badge>
      {sinAlergenos && (
        <Text fontSize="xs" color="fg.subtle">
          La propuesta no declara ningún alérgeno.
        </Text>
      )}
    </HStack>
  );
}
