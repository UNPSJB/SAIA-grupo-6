import { useEffect, type RefObject } from "react";

/**
 * Columnas que identifican la fila, de la más a la menos específica: en el
 * celular van como título de la tarjeta. Si la celda usa `DatoPrincipal`
 * (`data-dato-principal`), gana esa.
 */
const TITULOS = [
  "Título", "Situación", "Detalle", "Producto / Lote", "Razón Social", "Nombre", "Documento",
  "Establecimiento", "Ingrediente e insumo", "Ingrediente y marca", "Ingrediente", "Producto", "Equipo",
  "Alérgeno", "Clase funcional", "Nutriente", "Cliente", "Marca", "Tipo de evento", "Número de lote",
  "Borrador", "Sello", "Versión", "Entidad", "Alimento", "Norma",
];
/** Columnas de estado: van al lado del título, sin etiqueta. */
const ESTADOS = [
  "Estado", "Homologación", "Certificación", "Habilitación", "Comparación", "Resultado", "Criticidad", "Prioridad",
];
const ACCIONES = ["Acciones", "Acción", "Ver"];
/** Lo que se escribe cuando no hay dato. */
const SIN_DATO = new Set(["", "-", "–", "—"]);
const CON_CONTENIDO = "svg, img, button, a, input, select, textarea";

type Rol = "titulo" | "estado" | "acciones" | "alternar" | "vacia";

/** Qué papel cumple cada celda de la fila en la tarjeta del celular. */
function rolesDe(celdas: HTMLTableCellElement[], encabezados: string[]): (Rol | null)[] {
  const conBoton = celdas.map((c) => c.querySelector("button, a") !== null);
  let titulo = celdas.findIndex((c) => c.querySelector("[data-dato-principal]"));
  for (let i = 0; titulo < 0 && i < TITULOS.length; i++) titulo = encabezados.indexOf(TITULOS[i]);
  let estado = encabezados.findIndex((e) => ESTADOS.includes(e));
  // En la bitácora, "Acción" no lleva botones: es qué se hizo (alta, baja).
  if (estado < 0) estado = celdas.findIndex((_, i) => encabezados[i] === "Acción" && !conBoton[i]);

  return celdas.map((celda, i) => {
    if (i === titulo) return "titulo";
    const vacia = SIN_DATO.has(celda.textContent?.trim() ?? "") && !celda.querySelector(CON_CONTENIDO);
    if (vacia) return "vacia";
    if (i === estado && titulo >= 0 && !celda.querySelector("input, select")) return "estado";
    if (i === 0 && encabezados[i] === "" && conBoton[i]) return "alternar";
    if (conBoton[i] && (ACCIONES.includes(encabezados[i]) || encabezados[i] === "")) return "acciones";
    return null;
  });
}

/**
 * Etiqueta cada celda de las tablas con el nombre de su columna
 * (`data-label`), para que en pantallas chicas se puedan mostrar como
 * tarjetas: "Producto: Salsa de tomate", "Objetivo: 7,5 Kg"...
 *
 * El cambio visual lo hace CSS (`index.css`, bloque "TABLAS EN TARJETAS");
 * este hook solo pone las etiquetas. Va una vez en el layout y cubre todas
 * las tablas de la app, sin tocar cada una: lee el texto de los encabezados
 * y lo copia a las celdas de la misma posición. Se vuelve a correr cuando el
 * contenido cambia (otra página, otro filtro, carga de datos).
 *
 * También marca qué papel cumple cada celda (`data-rol`): el título y el estado
 * encabezan la tarjeta, las acciones la cierran y lo vacío no se muestra.
 *
 * Una tabla puede quedar afuera con `data-sin-tarjetas` en su `<table>`.
 */
export function useTablasResponsivas(contenedor: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return;

    let pendiente = 0;

    const etiquetar = () => {
      pendiente = 0;
      raiz.querySelectorAll("table").forEach((tabla) => {
        const filasEncabezado = tabla.tHead?.rows;
        if (!filasEncabezado || filasEncabezado.length === 0) return;
        const encabezados = Array.from(filasEncabezado[filasEncabezado.length - 1].cells).map(
          (celda) => celda.textContent?.trim() ?? "",
        );
        Array.from(tabla.tBodies).forEach((cuerpo) => {
          Array.from(cuerpo.rows).forEach((fila) => {
            // Filas que ocupan todo el ancho (detalle desplegado): sin etiqueta.
            if (fila.cells.length === 1 && fila.cells[0].colSpan > 1) return;
            const celdas = Array.from(fila.cells);
            const roles = rolesDe(celdas, encabezados);
            celdas.forEach((celda, indice) => {
              const etiqueta = encabezados[indice] ?? "";
              if (celda.getAttribute("data-label") !== etiqueta) {
                celda.setAttribute("data-label", etiqueta);
              }
              const rol = roles[indice];
              if (celda.getAttribute("data-rol") !== rol) {
                if (rol) celda.setAttribute("data-rol", rol);
                else celda.removeAttribute("data-rol");
              }
            });
          });
        });
      });
    };

    const programar = () => {
      if (!pendiente) pendiente = requestAnimationFrame(etiquetar);
    };

    etiquetar();
    // Solo se observan altas y bajas de nodos: los atributos que pone este
    // mismo hook no disparan otra vuelta.
    const observador = new MutationObserver(programar);
    observador.observe(raiz, { childList: true, subtree: true, characterData: true });

    return () => {
      observador.disconnect();
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, [contenedor]);
}
