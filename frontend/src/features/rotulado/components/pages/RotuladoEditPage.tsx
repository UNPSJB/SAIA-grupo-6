import { Button } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PaginaDetalle } from "../../../../components/ui/plantillas";
import {
  BannerError,
  BotonVolver,
  EstadoCargando,
} from "../../../../components/ui/patrones";
import { toaster } from "../../../../components/ui/toaster";
import { useRotulado } from "../../hooks/useRotulado";
import { RotuladoForm } from "../RotuladoForm";
import { listarLotes } from "../../../lotes/services/loteService";
import { previewAutocompletado } from "../../services/rotuladoService";
import type {
  BorradorRotuladoOut,
  VistaPreviaAutocompletado,
} from "../../types/rotulado";

interface LoteSimple {
  id: number;
  numero_lote: string;
  producto_id: number;
  version_receta_id: number | null;
}

export function RotuladoEditPage() {
  const { id, producto_id } = useParams();
  return <RotuladoEditor key={`${id ?? "nuevo"}-${producto_id ?? ""}`} />;
}

function RotuladoEditor() {
  const navigate = useNavigate();
  const { id, producto_id } = useParams<{ id?: string; producto_id?: string }>();
  const borradorId = id ? Number(id) : null;
  const productoId = producto_id ? Number(producto_id) : null;

  const {
    borrador,
    loading,
    error,
    crearBorrador,
    actualizarBorrador,
    obtenerBorrador: obtenerBorradorHook,
    autocompletarBorrador,
  } = useRotulado();

  const activo = useRef(true);
  useEffect(() => { activo.current = true; return () => { activo.current = false; }; }, []);

  const [guardando, setGuardando] = useState(false);
  const [lotes, setLotes] = useState<LoteSimple[]>([]);
  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaAutocompletado | null>(
    null,
  );
  const [previewCargada, setPreviewCargada] = useState(false);
  const [reintento, setReintento] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (borradorId) {
      obtenerBorradorHook(borradorId);
    }
  }, [borradorId, obtenerBorradorHook]);

  useEffect(() => {
    let montado = true;
    if (!productoId) return;
    listarLotes()
      .then((data: LoteSimple[]) => {
        if (montado) setLotes(data.filter((l) => l.producto_id === productoId));
      })
      .catch((err: unknown) => { if (montado) setPreviewError(err instanceof Error ? err.message : "Error al consultar lotes"); });
    return () => {
      montado = false;
    };
  }, [productoId, reintento]);

  // En modo creación, cargar la vista previa de autocompletado al montar
  useEffect(() => {
    let montado = true;
    if (borradorId || !productoId) return;

    previewAutocompletado(productoId, null)
      .then((vista) => {
        if (montado) {
          setVistaPrevia(vista);
          setPreviewCargada(true);
        }
      })
      .catch((err: unknown) => {
        if (montado) { setPreviewError(err instanceof Error ? err.message : "Error al cargar vista previa"); setPreviewCargada(true); }
      });
    return () => {
      montado = false;
    };
  }, [productoId, borradorId, reintento]);

  const handleGuardar = async (datos: Partial<BorradorRotuladoOut>) => {
    setGuardando(true);
    try {
      if (borradorId) {
        const actualizado = await actualizarBorrador(borradorId, {
          denominacion_venta: datos.denominacion_venta ?? undefined,
          lista_ingredientes: datos.lista_ingredientes ?? undefined,
          contenido_neto: datos.contenido_neto ?? undefined,
          rnpa_rppa: datos.rnpa_rppa ?? undefined,
          razon_social: datos.razon_social ?? undefined,
          domicilio: datos.domicilio ?? undefined,
          identificacion_lote: datos.identificacion_lote ?? undefined,
          fecha_produccion: datos.fecha_produccion,
          fecha_cierre: datos.fecha_cierre,
          fecha_duracion: datos.fecha_duracion,
          instrucciones_uso: datos.instrucciones_uso ?? undefined,
          es_importado: datos.es_importado ?? undefined,
          importador_razon_social: datos.importador_razon_social ?? undefined,
          importador_domicilio: datos.importador_domicilio ?? undefined,
          estado: datos.estado ?? undefined,
          datos_nutricionales_json: datos.datos_nutricionales_json ?? undefined,
          sellos_disponibles: datos.sellos_disponibles ?? undefined,
        });
        if (!actualizado || !activo.current) return;
        toaster.create({ type: "success", title: "Borrador guardado", duration: 3000 });
      } else if (productoId) {
        const resultado = await crearBorrador({
          producto_id: productoId,
          version_receta_id: datos.version_receta_id ?? null,
          lote_producto_id: datos.lote_producto_id ?? null,
          denominacion_venta: datos.denominacion_venta ?? null,
          lista_ingredientes: datos.lista_ingredientes ?? null,
          contenido_neto: datos.contenido_neto ?? null,
          rnpa_rppa: datos.rnpa_rppa ?? null,
          razon_social: datos.razon_social ?? null,
          domicilio: datos.domicilio ?? null,
          identificacion_lote: datos.identificacion_lote ?? null,
          fecha_produccion: datos.fecha_produccion ?? null,
          fecha_cierre: datos.fecha_cierre ?? null,
          fecha_duracion: datos.fecha_duracion ?? null,
          instrucciones_uso: datos.instrucciones_uso ?? null,
          es_importado: datos.es_importado ?? false,
          importador_razon_social: datos.importador_razon_social ?? null,
          importador_domicilio: datos.importador_domicilio ?? null,
          estado: datos.estado ?? "borrador",
          datos_nutricionales_json: datos.datos_nutricionales_json ?? null,
          sellos_disponibles: datos.sellos_disponibles ?? false,
        });
        if (resultado && activo.current) {
          toaster.create({ type: "success", title: "Borrador creado", duration: 3000 });
          navigate(`/rotulado/borradores/${resultado.id}`);
        }
      }
    } catch {
      toaster.create({ type: "error", title: "Error al guardar borrador", duration: 3000 });
    } finally {
      setGuardando(false);
    }
  };

  if (loading || (!borradorId && !previewCargada)) {
    return (
      <PaginaDetalle
        titulo="Rotulado"
        acciones={<BotonVolver onClick={() => navigate(-1)} />}
      >
        <EstadoCargando>Cargando borrador...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || previewError) {
    return (
      <PaginaDetalle
        titulo="Rotulado"
        acciones={<BotonVolver onClick={() => navigate(-1)} />}
      >
        <BannerError>{error ?? previewError}</BannerError>
        <Button onClick={() => { setPreviewError(null); setPreviewCargada(false); setReintento(n => n + 1); if (borradorId) void obtenerBorradorHook(borradorId); }}>Reintentar</Button>
      </PaginaDetalle>
    );
  }

  // Valores iniciales del formulario: vista previa si hay, borrador si es edición, vacío si creación
  const esCreacion = !borradorId;
  const productoNombre =
    borrador?.producto_nombre ??
    vistaPrevia?.producto_nombre ??
    (esCreacion ? "Nuevo producto" : "");

  const valoresIniciales: BorradorRotuladoOut | null = esCreacion && vistaPrevia && productoId
    ? {
        id: 0,
        producto_id: productoId,
        version_receta_id: vistaPrevia.version_receta_id,
        lote_producto_id: null,
        version_receta_numero: vistaPrevia.version_receta_numero,
        lote_numero: null,
        producto_nombre: vistaPrevia.producto_nombre,
        denominacion_venta: vistaPrevia.denominacion_venta ?? "",
        lista_ingredientes: vistaPrevia.lista_ingredientes ?? "",
        contenido_neto: "",
        rnpa_rppa: "",
        razon_social: "",
        domicilio: "",
        identificacion_lote: "",
        fecha_produccion: null,
        fecha_cierre: null,
        fecha_duracion: null,
        instrucciones_uso: "",
        es_importado: false,
        importador_razon_social: "",
        importador_domicilio: "",
        estado: "borrador",
        datos_nutricionales_json: vistaPrevia.datos_nutricionales_json ?? null,
        sellos_disponibles: vistaPrevia.sellos_disponibles,
        creado_en: null,
        actualizado_en: null,
        creado_por_id: null,
        actualizado_por_id: null,
      }
    : borrador ?? null;

  return (
    <PaginaDetalle
      titulo={esCreacion ? "Nuevo borrador de rotulado" : `Rotulado — ${productoNombre}`}
      acciones={
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="submit" form="rotulado-form" loading={guardando}>
            Guardar borrador
          </Button>
          <BotonVolver onClick={() => navigate(-1)}>Volver</BotonVolver>
        </div>
      }
    >
      {vistaPrevia?.mensaje && <BannerError>{vistaPrevia.mensaje}</BannerError>}
      <RotuladoForm
        key={`${productoId}-${borradorId}-${borrador?.actualizado_en ?? "nuevo"}`}
        borrador={valoresIniciales}
        esCreacion={esCreacion}
        productoNombre={esCreacion ? productoNombre : undefined}
        onGuardar={handleGuardar}
        onAutocompletar={
          borradorId
            ? async (versionId, loteId, forzar) => {
                await autocompletarBorrador(borradorId, versionId, loteId, forzar);
                obtenerBorradorHook(borradorId);
              }
            : async () => {}
        }
        lotes={lotes}
        isLoading={guardando}
        hayFaltantes={false}
      />
    </PaginaDetalle>
  );
}
