import { avisarExito } from "../../../components/ui/patrones";
import { useCallback, useState } from "react";
import { HStack, Table, Text } from "@chakra-ui/react";
import { useLista } from "../../../common/hooks/useLista";
import { BarraFiltros } from "../../../components/ui/filtros";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
  ToggleInactivos,
} from "../../../components/ui/patrones";
import {
  crearAlergeno,
  darDeBajaAlergeno,
  listarAlergenos,
  modificarAlergeno,
} from "../services/alergenoService";
import type { Alergeno } from "../types/alergeno";
import { AlergenoDialog } from "./AlergenoDialog";

/** Pestaña "Alérgenos" de Ingredientes: el catálogo que se asigna a cada ingrediente. */
export function TabAlergenos() {
  const [verBajas, setVerBajas] = useState(false);
  const [editando, setEditando] = useState<Alergeno | "nuevo" | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const cargar = useCallback(() => listarAlergenos(verBajas), [verBajas]);
  const { items: alergenos, loading, error, recargar } = useLista<Alergeno[]>({
    cargar,
    dependencias: [verBajas],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los alérgenos.",
  });

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
            <BotonAgregar onClick={() => setEditando("nuevo")}>Nuevo alérgeno</BotonAgregar>
            <ToggleInactivos enBarra checked={verBajas} onChange={setVerBajas}>
              Ver dados de baja
            </ToggleInactivos>
          </>
        }
      />
      <Text fontSize="sm" color="fg.muted" mb="4" maxW="640px">
        Alérgenos de declaración obligatoria. La lista inicial es la del CAA; verificala con la
        profesional de referencia. Uno dado de baja ya no se ofrece, pero los ingredientes que lo
        tienen lo siguen declarando.
      </Text>

      {error && <BannerError>{error}</BannerError>}
      {errorAccion && <BannerError>{errorAccion}</BannerError>}
      {loading && <EstadoCargando>Cargando alérgenos...</EstadoCargando>}

      {!loading && !error && alergenos.length === 0 && <EstadoVacio>No hay alérgenos cargados.</EstadoVacio>}

      {!loading && !error && alergenos.length > 0 && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="480px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Alérgeno</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {alergenos.map((a) => (
                <Table.Row key={a.id} opacity={a.activo ? 1 : 0.65}>
                  <Celda>
                    <DatoPrincipal titulo={a.nombre} />
                  </Celda>
                  <Celda center>
                    <HStack justify="center" gap="2">
                      {a.activo ? (
                        <>
                          <BotonAccion accion="editar" label="Modificar" onClick={() => setEditando(a)} />
                          <BotonAccion
                            accion="eliminar"
                            label="Dar de baja"
                            onClick={() => accion(() => darDeBajaAlergeno(a.id))}
                          />
                        </>
                      ) : (
                        <BotonAccion
                          accion="reactivar"
                          label="Reactivar"
                          onClick={() => accion(() => modificarAlergeno(a.id, { activo: true }))}
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
        <AlergenoDialog
          alergeno={editando === "nuevo" ? undefined : editando}
          onCancel={() => setEditando(null)}
          onGuardar={async (nombre) => {
            if (editando === "nuevo") await crearAlergeno(nombre);
            else await modificarAlergeno(editando.id, { nombre });
            avisarExito(editando === "nuevo" ? "Alérgeno agregado correctamente." : "Alérgeno modificado correctamente.");
            setEditando(null);
            await recargar();
          }}
        />
      )}
    </>
  );
}
