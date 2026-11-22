import { useState } from "react";
import { Button, HStack } from "@chakra-ui/react";
import { LuDownload } from "react-icons/lu";
import { puedeAdministrar } from "../../../common/api/permissions";
import { useAuth } from "../../../common/context/useAuth";
import { descargarGrafico } from "../services/descargaGrafico";
import type { FormatoDescarga, RangoGrafico } from "../services/nombreArchivoGrafico";

/** Las tarjetas del sistema llevan este atributo (lo pone `Tarjeta`). */
const SELECTOR_TARJETA = "[data-tarjeta]";

interface BotonDescargaGraficoProps {
  /** Título del gráfico: es el nombre del archivo y el texto de adentro. */
  titulo: string;
  /** Período que muestra el gráfico. Sin período, el archivo lleva la fecha de hoy. */
  rango?: RangoGrafico | null;
  /**
   * Para las tarjetas que no tienen encabezado: los botones ocupan su propio renglón arriba, a la
   * derecha. Si la persona no administra no se dibuja nada, así que tampoco queda el espacio.
   */
  alDerecha?: boolean;
}

/**
 * Botones para bajar como PNG o PDF el gráfico de la tarjeta en la que están.
 * Los ve solo quien puede administrar. Captura la tarjeta completa, menos lo marcado con
 * `data-no-exportar` (el título, los controles y estos mismos botones).
 */
export function BotonDescargaGrafico({ titulo, rango, alDerecha = false }: BotonDescargaGraficoProps) {
  const { user } = useAuth();
  const [descargando, setDescargando] = useState<FormatoDescarga | null>(null);

  if (!puedeAdministrar(user)) return null;

  const descargar = async (formato: FormatoDescarga, boton: HTMLElement) => {
    const tarjeta = boton.closest<HTMLElement>(SELECTOR_TARJETA);
    if (!tarjeta) return;
    setDescargando(formato);
    try {
      await descargarGrafico(tarjeta, formato, { titulo, rango });
    } catch {
      // eslint-disable-next-line no-alert
      alert(`No se pudo descargar «${titulo}»`);
    } finally {
      setDescargando(null);
    }
  };

  return (
    // `data-no-exportar`: los botones nunca salen en la imagen que se descarga.
    <HStack gap="1" data-no-exportar="" {...(alDerecha ? { justify: "flex-end", w: "full", mb: "2" } : {})}>
      {(["png", "pdf"] as const).map((formato) => (
        <Button
          key={formato}
          type="button"
          size="xs"
          variant="outline"
          aria-label={`Descargar ${titulo} como ${formato.toUpperCase()}`}
          loading={descargando === formato}
          disabled={descargando !== null}
          onClick={(evento) => descargar(formato, evento.currentTarget)}
        >
          {formato === "png" ? <LuDownload aria-hidden /> : null}
          {formato.toUpperCase()}
        </Button>
      ))}
    </HStack>
  );
}
