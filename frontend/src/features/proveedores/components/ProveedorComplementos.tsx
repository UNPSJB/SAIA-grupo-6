import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { listarInsumos } from "../../insumos/services/insumoService";
import type { Insumo } from "../../insumos/types/insumo";
import {
  FormField,
  FormInput,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import {
  asociarInsumosProveedor,
  cargarCertificacionProveedor,
} from "../services/proveedorService";
import type { Proveedor } from "../types/proveedor";

export function ProveedorComplementos({
  proveedor,
  onActualizado,
}: {
  proveedor: Proveedor;
  onActualizado: () => void;
}) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  // La página monta este componente con `key={proveedor.id}`, así que la
  // selección arranca siempre de los insumos del proveedor que se está viendo.
  const [seleccionados, setSeleccionados] = useState<number[]>(() =>
    proveedor.insumos.map((i) => i.id)
  );
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [numero, setNumero] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;

    listarInsumos()
      .then((data) => {
        if (activo) setInsumos(data);
      })
      .catch((e) => {
        if (activo) {
          setError(e instanceof Error ? e.message : "Error al cargar los insumos");
        }
      });

    return () => {
      activo = false;
    };
  }, []);

  // Se busca por ingrediente o por marca.
  const insumosFiltrados = insumos.filter((insumo) =>
    `${insumo.ingrediente_nombre} ${insumo.nombre}`
      .toLocaleLowerCase("es")
      .includes(busqueda.trim().toLocaleLowerCase("es"))
  );

  const seleccionarResultados = () => {
    const idsVisibles = insumosFiltrados.map((insumo) => insumo.id);
    setSeleccionados((prev) => [...new Set([...prev, ...idsVisibles])]);
  };

  const limpiarSeleccionResultados = () => {
    const idsVisibles = new Set(insumosFiltrados.map((insumo) => insumo.id));
    setSeleccionados((prev) => prev.filter((id) => !idsVisibles.has(id)));
  };

  const guardarAsociaciones = async () => {
    setGuardando(true);
    setError("");
    try {
      await asociarInsumosProveedor(proveedor.id, seleccionados);
      onActualizado();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron guardar las asociaciones"
      );
    } finally {
      setGuardando(false);
    }
  };

  const guardarCertificacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!archivo || !tipo.trim() || !numero.trim() || !vencimiento) {
      setError(
        "Completá tipo, número, vencimiento y adjuntá el certificado PDF."
      );
      return;
    }

    setGuardando(true);
    try {
      await cargarCertificacionProveedor(proveedor.id, {
        tipo,
        numero,
        fecha_vencimiento: vencimiento,
        archivo,
      });
      setTipo("");
      setNumero("");
      setVencimiento("");
      setArchivo(null);
      onActualizado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el certificado");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Stack gap="5" mt="5">
      <TarjetaFormulario mb="0">
        <TituloFormulario>Insumos que vende</TituloFormulario>
        <Text color="fg.muted" fontSize="sm" mb="3">
          Buscá por ingrediente o marca y seleccioná los insumos que este proveedor
          vende. Solo se le pueden recibir lotes de esos insumos.
        </Text>

        <Stack gap="3" mb="3">
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ingrediente o marca..."
            aria-label="Buscar insumos"
            bg="bg.subtle"
            borderColor="border.subtle"
            color="fg.default"
            _placeholder={{ color: "fg.muted" }}
          />

          <Stack direction={{ base: "column", sm: "row" }} gap="2">
            <Button
              size="sm"
              variant="outline"
              onClick={seleccionarResultados}
              disabled={insumosFiltrados.length === 0}
            >
              Seleccionar todos los resultados
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={limpiarSeleccionResultados}
              disabled={
                insumosFiltrados.length === 0 ||
                !insumosFiltrados.some((i) => seleccionados.includes(i.id))
              }
            >
              Limpiar selección
            </Button>
          </Stack>

          <Text color="fg.muted" fontSize="xs">
            {seleccionados.length} insumo(s) seleccionado(s)
            {busqueda.trim()
              ? ` · ${insumosFiltrados.length} resultado(s)`
              : ""}
          </Text>
        </Stack>

        <Box
          maxH="240px"
          overflowY="scroll"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md"
          bg="bg.subtle"
          p="3"
          css={{
            scrollbarWidth: "thin",
            scrollbarColor:
              "var(--chakra-colors-border-emphasized) var(--chakra-colors-bg-subtle)",
            "&::-webkit-scrollbar": { width: "10px" },
            "&::-webkit-scrollbar-track": {
              background: "var(--chakra-colors-bg-subtle)",
              borderRadius: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "var(--chakra-colors-border-emphasized)",
              borderRadius: "8px",
              border: "2px solid var(--chakra-colors-bg-subtle)",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "var(--chakra-colors-fg-muted)",
            },
          }}
        >
          <Stack gap="3">
            {insumosFiltrados.length > 0 ? (
              insumosFiltrados.map((i) => (
                <Checkbox.Root
                  key={i.id}
                  checked={seleccionados.includes(i.id)}
                  onCheckedChange={(v) =>
                    setSeleccionados((prev) =>
                      v.checked
                        ? prev.includes(i.id)
                          ? prev
                          : [...prev, i.id]
                        : prev.filter((id) => id !== i.id)
                    )
                  }
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label color="fg.default" fontSize="sm">
                    {i.ingrediente_nombre} — {i.nombre}
                  </Checkbox.Label>
                </Checkbox.Root>
              ))
            ) : (
              <Text color="fg.muted" fontSize="sm">
                {insumos.length === 0
                  ? "No hay insumos activos. Los insumos (marcas) se cargan en la ficha de cada ingrediente."
                  : "No se encontraron insumos con esa búsqueda."}
              </Text>
            )}
          </Stack>
        </Box>

        <Button mt="4" onClick={guardarAsociaciones} loading={guardando}>
          Guardar asociaciones
        </Button>
      </TarjetaFormulario>

      <TarjetaFormulario mb="0">
        <TituloFormulario>Certificaciones</TituloFormulario>

        <Stack gap="2" mb="5">
          {proveedor.certificaciones?.length ? (
            proveedor.certificaciones.map((c) => (
              <Box
                key={c.id}
                bg="bg.subtle"
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="md"
                px="3"
                py="2"
              >
                <Text color="fg.default" fontSize="sm" fontWeight="medium">
                  {c.tipo} · {c.numero}
                </Text>
                <Text color="fg.muted" fontSize="xs">
                  Vence {c.fecha_vencimiento} · {c.estado}
                </Text>
              </Box>
            ))
          ) : (
            <Text color="fg.muted" fontSize="sm">
              Todavía no hay certificados cargados.
            </Text>
          )}
        </Stack>

        <Box as="form" onSubmit={guardarCertificacion}>
          <Stack gap="3">
            <FormField label="Tipo de certificación" mb="0">
              <FormInput
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="Ej: RNE, RNPA, BPM..."
              />
            </FormField>
            <FormField label="Número / código" mb="0">
              <FormInput
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Número o código del certificado"
              />
            </FormField>
            <FormField label="Fecha de vencimiento" mb="0">
              <FormInput
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
              />
            </FormField>
            <FormField label="Archivo del certificado (PDF)" mb="0">
              <FormInput
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </FormField>
            <Button type="submit" alignSelf="flex-start" loading={guardando}>
              Agregar certificación
            </Button>
          </Stack>
        </Box>
      </TarjetaFormulario>

      {error && <Text color="red.fg" fontSize="sm">{error}</Text>}
    </Stack>
  );
}
