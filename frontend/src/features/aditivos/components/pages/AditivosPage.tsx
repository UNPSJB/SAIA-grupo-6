import { useCallback, useState } from "react";
import { Badge, HStack, Table, Text } from "@chakra-ui/react";
import { useLista } from "../../../../common/hooks/useLista";
import { BotonExportar } from "../../../exportacion";
import { BarraFiltros } from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
  ToggleInactivos,
  DatoPrincipal,
} from "../../../../components/ui/patrones";
import {
  crearClase,
  darDeBajaClase,
  listarClases,
  modificarClase,
} from "../../services/aditivoService";
import type { ClaseFuncional } from "../../types/aditivo";
import { ClaseFuncionalDialog } from "../ClaseFuncionalDialog";

/*
 * Antes esta página tenía también la pestaña "Aditivos" (la lista de
 * referencia con nombre e INS). Ahora cada ingrediente aditivo guarda su
 * propia clase e INS, y la lista de referencia solo se ofrece como sugerencia
 * en el formulario del ingrediente. Queda la pestaña de clases funcionales.
 */

function useClases(incluirInactivas: boolean) {
  const cargar = useCallback(() => listarClases(incluirInactivas), [incluirInactivas]);
  const { items, loading, error, recargar } = useLista<ClaseFuncional[]>({
    cargar,
    dependencias: [incluirInactivas],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las clases funcionales",
  });
  return { clases: items, loading, error, recargar };
}

export function TabClases() {
  const [verBajas, setVerBajas] = useState(false);
  const [editando, setEditando] = useState<ClaseFuncional | "nueva" | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const { clases, loading, error, recargar } = useClases(verBajas);

  const accion = async (fn: () => Promise<unknown>) => {
    setErrorAccion(null);
    try {
      await fn();
      await recargar();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se pudo completar la acción.");
    }
  };

  return (
    <>
      <BarraFiltros
        herramientas={
          <>
            {/* Orden de las sub-opciones: alta, ver bajas y exportar. */}
            <BotonAgregar onClick={() => setEditando("nueva")}>Nueva clase</BotonAgregar>
            <ToggleInactivos enBarra checked={verBajas} onChange={setVerBajas}>
              Ver dadas de baja
            </ToggleInactivos>
            <BotonExportar
              nombreTabla="las clases funcionales"
              disabled={clases.length === 0}
              datos={() => ({
                titulo: verBajas ? "Clases funcionales (con dadas de baja)" : "Clases funcionales",
                nombre: "clases-funcionales",
                encabezados: ["Clase funcional", "Número INS", "Estado"],
                filas: clases.map((c) => [
                  c.nombre,
                  c.ins_opcional ? "Opcional (solo por su función)" : "Obligatorio",
                  c.activo ? "Activa" : "Dada de baja",
                ]),
              })}
            />
          </>
        }
      />
      <Text fontSize="sm" color="fg.muted" mb="4" maxW="640px">
        Funciones tecnológicas de los aditivos. En las marcadas como "solo por su función" el número
        INS es opcional.
      </Text>

      {error && <BannerError>{error}</BannerError>}
      {errorAccion && <BannerError>{errorAccion}</BannerError>}
      {loading && <EstadoCargando>Cargando clases...</EstadoCargando>}

      {!loading && !error && clases.length === 0 && <EstadoVacio>No hay clases funcionales.</EstadoVacio>}

      {!loading && !error && clases.length > 0 && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="560px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Clase funcional</EncabezadoOscuro>
                <EncabezadoOscuro ancho="amplia">Número INS</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {clases.map((c) => (
                <Table.Row key={c.id} opacity={c.activo ? 1 : 0.65}>
                  <Celda>
                    <DatoPrincipal titulo={c.nombre} />
                  </Celda>
                  <Celda>
                    <Badge colorPalette={c.ins_opcional ? "gray" : "blue"} variant="subtle" rounded="full">
                      {c.ins_opcional ? "Opcional (solo por su función)" : "Obligatorio"}
                    </Badge>
                  </Celda>
                  <Celda center>
                    <HStack justify="center" gap="2">
                      {c.activo ? (
                        <>
                          <BotonAccion accion="editar" label="Modificar" onClick={() => setEditando(c)} />
                          <BotonAccion
                            accion="eliminar"
                            label="Dar de baja"
                            onClick={() => accion(() => darDeBajaClase(c.id))}
                          />
                        </>
                      ) : (
                        <BotonAccion
                          accion="reactivar"
                          label="Reactivar"
                          onClick={() => accion(() => modificarClase(c.id, { activo: true }))}
                        />
                      )}
                    </HStack>
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}

      {editando && (
        <ClaseFuncionalDialog
          clase={editando === "nueva" ? undefined : editando}
          onCancel={() => setEditando(null)}
          onGuardar={async (datos) => {
            if (editando === "nueva") await crearClase(datos);
            else await modificarClase(editando.id, datos);
            setEditando(null);
            await recargar();
          }}
        />
      )}
    </>
  );
}
