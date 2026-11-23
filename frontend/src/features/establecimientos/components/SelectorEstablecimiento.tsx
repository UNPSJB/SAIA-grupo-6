import { useEffect, useState } from "react";
import { NativeSelect } from "@chakra-ui/react";
import { LuBuilding2 } from "react-icons/lu";
import { getEstablecimientoElegido, setEstablecimientoElegido } from "../../../common/api/apiClient";
import { EVENTO_ESTABLECIMIENTOS, listarEstablecimientos } from "../services/establecimientoService";
import type { Establecimiento } from "../types/establecimiento";

/** Sede en la que trabaja el super admin cuando todavía no eligió ninguna. */
const ID_PRINCIPAL = 1;

/**
 * Selector de sede del super admin, en la barra superior.
 *
 * El super admin es de la empresa: no tiene sede propia y elige en cuál
 * trabajar. La elección viaja en cada request (`X-Establecimiento-Id`, ver
 * `apiClient`). Al cambiarla se vuelve al Inicio y se recarga la app: así no
 * queda en pantalla ningún dato de la sede anterior.
 */
export function SelectorEstablecimiento() {
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const elegido = getEstablecimientoElegido() ?? ID_PRINCIPAL;

  const [version, setVersion] = useState(0);

  // Una sede creada, renombrada o dada de baja se refleja sin recargar la app.
  useEffect(() => {
    const recargar = () => setVersion((v) => v + 1);
    window.addEventListener(EVENTO_ESTABLECIMIENTOS, recargar);
    return () => window.removeEventListener(EVENTO_ESTABLECIMIENTOS, recargar);
  }, []);

  useEffect(() => {
    let vigente = true;
    listarEstablecimientos()
      .then((lista) => {
        if (!vigente) return;
        setEstablecimientos(lista);
        // La sede guardada pudo darse de baja: se vuelve a la principal.
        if (lista.length > 0 && !lista.some((e) => e.id === elegido)) {
          setEstablecimientoElegido(null);
          window.location.assign("/");
        }
      })
      .catch(() => setEstablecimientos([]));
    return () => {
      vigente = false;
    };
  }, [elegido, version]);

  if (establecimientos.length === 0) return null;

  return (
    <NativeSelect.Root
      size="sm"
      width={{ base: "36", md: "52" }}
      flexShrink={0}
      title="Establecimiento en el que estás trabajando"
    >
      <NativeSelect.Field
        aria-label="Establecimiento en el que estás trabajando"
        value={String(elegido)}
        onChange={(evento) => {
          const id = Number(evento.target.value);
          if (id === elegido) return;
          setEstablecimientoElegido(id);
          window.location.assign("/");
        }}
        color="white"
        bg="whiteAlpha.200"
        borderColor="whiteAlpha.400"
        fontWeight="medium"
        ps="8"
        _focusVisible={{ outline: "2px solid", outlineColor: "white", outlineOffset: "2px" }}
        // La lista desplegada usa los colores del tema, no el blanco de la barra.
        // Con tokens (no `var(--chakra-colors-bg-panel)`, que no existe: los
        // tokens con punto no generan esa variable y el fondo quedaba blanco
        // con el texto claro del modo oscuro).
        css={{ "& option": { color: "fg", bg: "bg.panel" } }}
      >
        {establecimientos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </NativeSelect.Field>
      <LuBuilding2
        aria-hidden
        size={16}
        style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      />
      <NativeSelect.Indicator color="white" />
    </NativeSelect.Root>
  );
}
