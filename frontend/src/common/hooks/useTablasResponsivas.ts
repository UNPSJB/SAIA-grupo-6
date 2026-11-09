import { useEffect, type RefObject } from "react";

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
            Array.from(fila.cells).forEach((celda, indice) => {
              const etiqueta = encabezados[indice] ?? "";
              if (celda.getAttribute("data-label") !== etiqueta) {
                celda.setAttribute("data-label", etiqueta);
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
