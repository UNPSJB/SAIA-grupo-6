import { chakra } from "@chakra-ui/react";
import azucares from "../assets/azucares.svg";
import calorias from "../assets/calorias.svg";
import grasasSaturadas from "../assets/grasas_saturadas.svg";
import grasasTotales from "../assets/grasas_totales.svg";
import sodio from "../assets/sodio.svg";
import type { ClaveSello } from "../types/rotuladoFrontal";

// Trazados de https://www.argentina.gob.ar/anmat/regulados/alimentos/sifega/sistema-grafico
const sellos: Record<ClaveSello, { archivo: string; nutriente: string }> = {
  sodio: { archivo: sodio, nutriente: "SODIO" },
  azucares: { archivo: azucares, nutriente: "AZÚCARES" },
  grasas_saturadas: { archivo: grasasSaturadas, nutriente: "GRASAS SATURADAS" },
  grasas_totales: { archivo: grasasTotales, nutriente: "GRASAS TOTALES" },
  calorias: { archivo: calorias, nutriente: "CALORÍAS" },
};

export function OctogonoAdvertencia({ clave }: { clave: ClaveSello }) {
  const { archivo, nutriente } = sellos[clave];
  return <chakra.img src={archivo} alt={`EXCESO EN ${nutriente}`}
    w={{ base: "64px", md: "76px" }} aspectRatio="square" objectFit="contain" flexShrink={0} />;
}
