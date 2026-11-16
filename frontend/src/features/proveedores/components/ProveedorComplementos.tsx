import { useEffect, useState } from "react";
import { Box, Button, Checkbox, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import { asociarInsumosProveedor, cargarCertificacionProveedor } from "../services/proveedorService";
import type { Proveedor } from "../types/proveedor";

type Insumo = { id: number; nombre: string; activo: boolean };
export function ProveedorComplementos({ proveedor, onActualizado }: { proveedor: Proveedor; onActualizado: () => void }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [tipo, setTipo] = useState("");
  const [numero, setNumero] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    apiFetch(`${API_URL}/insumos`).then((r) => pedir<Insumo[]>(r, "No se pudieron cargar los insumos"))
      .then((data) => { if (activo) setInsumos(data.filter((i) => i.activo)); })
      .catch((e) => { if (activo) setError(e instanceof Error ? e.message : "Error al cargar insumos"); });
    setSeleccionados(proveedor.insumos?.map((i: any) => i.id) ?? []);
    return () => { activo = false; };
  }, [proveedor.id]);

  const guardarAsociaciones = async () => {
    setGuardando(true); setError("");
    try { await asociarInsumosProveedor(proveedor.id, seleccionados); onActualizado(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudieron guardar las asociaciones"); }
    finally { setGuardando(false); }
  };
  const guardarCertificacion = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!archivo || !tipo.trim() || !numero.trim() || !vencimiento) {
      setError("Completá tipo, número, vencimiento y adjuntá el certificado PDF."); return;
    }
    setGuardando(true);
    try {
      await cargarCertificacionProveedor(proveedor.id, { tipo, numero, fecha_vencimiento: vencimiento, archivo });
      setTipo(""); setNumero(""); setVencimiento(""); setArchivo(null); onActualizado();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el certificado"); }
    finally { setGuardando(false); }
  };
  return (
    <Stack gap="5" mt="5">
      <Box borderWidth="1px" borderRadius="lg" p="5">
        <Heading size="md" mb="3">Insumos que provee</Heading>
        <Stack maxH="220px" overflowY="auto" gap="2">
          {insumos.map((i) => (
            <Checkbox.Root key={i.id} checked={seleccionados.includes(i.id)}
              onCheckedChange={(v) => setSeleccionados((prev) => v.checked ? [...prev, i.id] : prev.filter((id) => id !== i.id))}>
              <Checkbox.HiddenInput /><Checkbox.Control /><Checkbox.Label>{i.nombre}</Checkbox.Label>
            </Checkbox.Root>
          ))}
        </Stack>
        <Button mt="3" onClick={guardarAsociaciones} loading={guardando}>Guardar asociaciones</Button>
      </Box>
      <Box borderWidth="1px" borderRadius="lg" p="5">
        <Heading size="md" mb="2">Certificaciones</Heading>
        {proveedor.certificaciones?.length ? proveedor.certificaciones.map((c) => (
          <Text key={c.id} fontSize="sm">{c.tipo} · {c.numero} · vence {c.fecha_vencimiento} · {c.estado}</Text>
        )) : <Text color="fg.muted" mb="3">Todavía no hay certificados cargados.</Text>}
        <Box as="form" onSubmit={guardarCertificacion}>
          <Stack gap="2">
            <Input placeholder="Tipo de certificación" value={tipo} onChange={(e) => setTipo(e.target.value)} />
            <Input placeholder="Número / código" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <Input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
            <Input type="file" accept="application/pdf,.pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            <Button type="submit" loading={guardando}>Agregar certificación</Button>
          </Stack>
        </Box>
      </Box>
      {error && <Text color="red.500">{error}</Text>}
    </Stack>
  );
}
