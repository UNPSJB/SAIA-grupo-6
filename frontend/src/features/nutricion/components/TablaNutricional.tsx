import { Box, Text, chakra } from "@chakra-ui/react";
import { formatoCantidad } from "../../../common/utils/numeros";
import { formatoFechaHora } from "../../../common/utils/fechas";
import { SUBNUTRIENTES, type FilaTabla, type InfoNutricional } from "../types/nutricion";
import { Aviso } from "./piezas";

/**
 * Tabla en formato de rotulado nutricional (E11, historia 4): columnas por
 * 100 g (o ml), por porción y % VD, con la leyenda de "valores calculados"
 * siempre visible (también al imprimir: todo lo de `#zona-impresion` sale en
 * papel y el resto de la pantalla no).
 */
export function TablaNutricional({ info }: { info: InfoNutricional }) {
  const cfg = info.configuracion;
  const incompleta = info.estado !== "completa";

  return (
    <Box id="zona-impresion" maxW="620px">
      {/* Encabezado que solo aparece en papel: en pantalla ya lo dice la página. */}
      <Box display="none" css={{ "@media print": { display: "block" } }} mb="3">
        <Text fontSize="lg" fontWeight="bold">{info.producto}</Text>
        <Text fontSize="sm">
          Receta versión {info.version?.numero} · calculada el {formatoFechaHora(info.calculado_en)}
        </Text>
      </Box>

      <Aviso tono="alerta" mb="3">{info.leyenda_calculo}</Aviso>

      {incompleta && (
        <Aviso tono="peligro" titulo="TABLA INCOMPLETA" mb="3">
          Los valores se calcularon con datos faltantes. No usar en un rótulo.
        </Aviso>
      )}

      <CuadroNutricional
        filas={info.filas}
        porcion={cfg.porcion}
        medidaCasera={cfg.medida_casera}
        expresarEn={info.expresar_en}
        mostrarPor100={info.mostrar_por_100}
        incompleta={incompleta}
        leyendaNoSignificativo={info.leyenda_no_significativo}
        leyendaVd={info.leyenda_vd}
        leyendaLaboratorio={info.leyenda_laboratorio}
      />
    </Box>
  );
}

/** Lo que el cuadro necesita de cada fila (sirve la tabla calculada y la instantánea del rótulo). */
export type FilaCuadro = Pick<
  FilaTabla,
  "clave" | "nombre" | "unidad" | "por_100_texto" | "por_porcion_texto" | "vd_texto" | "faltan_datos" | "de_laboratorio"
>;

/**
 * El cuadro tal como va impreso en el envase: título, porción, columnas
 * "Por 100", "Cantidad por porción" y "% VD (*)", línea gruesa bajo la
 * energía y notas al pie. Lo usan la información nutricional del producto y
 * la vista previa del rótulo.
 */
export function CuadroNutricional({
  filas,
  porcion,
  medidaCasera,
  expresarEn,
  mostrarPor100 = true,
  incompleta = false,
  leyendaNoSignificativo,
  leyendaVd,
  leyendaLaboratorio,
}: {
  filas: FilaCuadro[];
  porcion: string | number | null | undefined;
  medidaCasera?: string | null;
  expresarEn: string;
  mostrarPor100?: boolean;
  incompleta?: boolean;
  leyendaNoSignificativo?: string | null;
  leyendaVd?: string | null;
  leyendaLaboratorio?: string | null;
}) {
  const textoPorcion = porcion
    ? `Porción ${formatoCantidad(porcion)} ${expresarEn}${medidaCasera ? ` (${medidaCasera})` : ""}`
    : "Porción sin declarar";
  const hayLaboratorio = filas.some((f) => f.de_laboratorio);
  const con100 = mostrarPor100;
  const columnas = con100 ? 4 : 3;

  const borde = "1px solid #9ca3af";
  const celda = { px: "3", py: "1.5", borderTop: borde } as const;

  return (
    <Box overflowX="auto">
    <chakra.table
      w="100%"
      minW="480px"
      bg="white"
      color="black"
      fontSize="sm"
      fontVariantNumeric="tabular-nums"
      style={{ borderCollapse: "collapse", border: "2px solid black" }}
      data-sin-tarjetas=""
      opacity={incompleta ? 0.75 : 1}
    >
      <thead>
        <tr>
          <chakra.th colSpan={columnas} textAlign="left" px="3" pt="2.5" pb="0.5" fontSize="lg" fontWeight="extrabold" letterSpacing="tight">
            INFORMACIÓN NUTRICIONAL
          </chakra.th>
        </tr>
        <tr>
          <chakra.th colSpan={columnas} textAlign="left" px="3" pb="2" fontWeight="normal" style={{ borderBottom: "6px solid black" }}>
            {textoPorcion}
          </chakra.th>
        </tr>
        <tr>
          <chakra.th {...celda} />
          {con100 && <chakra.th {...celda} textAlign="right" fontWeight="bold">Por 100 {expresarEn}</chakra.th>}
          <chakra.th {...celda} textAlign="right" fontWeight="bold">Cantidad por porción</chakra.th>
          <chakra.th {...celda} textAlign="right" fontWeight="bold">% VD (*)</chakra.th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => {
          const unidad = f.clave === "energia" ? "" : ` ${f.unidad}`;
          // "**": valor determinado en laboratorio (nota al pie).
          const marca = f.de_laboratorio ? "**" : "";
          const conUnidad = (t: string) => (t === "—" ? t : `${t}${unidad}${marca}`);
          const sub = SUBNUTRIENTES.includes(f.clave);
          // Línea gruesa después de la energía, como en los rótulos.
          const separador = i === 1 ? { borderTop: "3px solid black" } : {};
          return (
            <tr key={f.clave}>
              <chakra.td {...celda} style={separador} pl={sub ? "7" : "3"} fontWeight={sub ? "normal" : "semibold"}>
                {f.nombre}
                {f.faltan_datos && (
                  <Text as="span" ml="2" fontSize="xs" fontWeight="normal" color="red.fg">
                    faltan datos
                  </Text>
                )}
              </chakra.td>
              {con100 && <chakra.td {...celda} style={separador} textAlign="right">{conUnidad(f.por_100_texto)}</chakra.td>}
              <chakra.td {...celda} style={separador} textAlign="right">{conUnidad(f.por_porcion_texto)}</chakra.td>
              <chakra.td {...celda} style={separador} textAlign="right" fontWeight="semibold">{f.vd_texto}</chakra.td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <chakra.td colSpan={columnas} px="3" py="2" fontSize="xs" lineHeight="1.45" style={{ borderTop: "3px solid black" }}>
            {leyendaNoSignificativo && <Text mb="1">{leyendaNoSignificativo}</Text>}
            {leyendaVd && <Text>{leyendaVd}</Text>}
            {hayLaboratorio && <Text>{leyendaLaboratorio}</Text>}
          </chakra.td>
        </tr>
      </tfoot>
    </chakra.table>
    </Box>
  );
}
