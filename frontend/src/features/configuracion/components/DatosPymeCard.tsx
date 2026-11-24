import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, HStack, Image, SimpleGrid, Text } from "@chakra-ui/react";
import { LuBuilding2, LuTrash2, LuUpload } from "react-icons/lu";
import { apiFetchImagen } from "../../../common/api/apiClient";
import {
  AccionesFormulario,
  BannerError,
  BannerExito,
  BotonGuardar,
  EstadoCargando,
  FormField,
  FormInput,
  Tarjeta,
} from "../../../components/ui/patrones";
import {
  actualizarConfiguracionPyme,
  eliminarLogoPyme,
  obtenerConfiguracionPyme,
  subirLogoPyme,
} from "../services/configuracionService";
import type { ConfiguracionPyme } from "../types/configuracion";

type Campo = Exclude<keyof ConfiguracionPyme, "logo_url">;

const VACIO: Record<Campo, string> = {
  razon_social: "",
  domicilio: "",
  telefono: "",
  email: "",
  web: "",
  rnpa_rppa: "",
};

const CAMPOS: Array<{
  clave: Campo;
  etiqueta: string;
  placeholder: string;
  maxLength: number;
  ayuda?: string;
}> = [
  {
    clave: "razon_social",
    etiqueta: "Razón social",
    placeholder: "Dulces del Sur SRL",
    maxLength: 200,
  },
  {
    clave: "domicilio",
    etiqueta: "Domicilio",
    placeholder: "Av. Siempre Viva 742, Ushuaia",
    maxLength: 300,
  },
  {
    clave: "telefono",
    etiqueta: "Teléfono",
    placeholder: "+54 2901 123456",
    maxLength: 80,
  },
  {
    clave: "email",
    etiqueta: "E-mail",
    placeholder: "contacto@mipyme.com",
    maxLength: 200,
  },
  {
    clave: "web",
    etiqueta: "Sitio web",
    placeholder: "www.mipyme.com",
    maxLength: 200,
  },
  {
    clave: "rnpa_rppa",
    etiqueta: "RNPA / RPPA",
    placeholder: "RNPA 123456",
    maxLength: 100,
    ayuda: "Opcional. Se muestra en la cabecera de los documentos.",
  },
];

function aValores(configuracion: ConfiguracionPyme): Record<Campo, string> {
  return {
    razon_social: configuracion.razon_social ?? "",
    domicilio: configuracion.domicilio ?? "",
    telefono: configuracion.telefono ?? "",
    email: configuracion.email ?? "",
    web: configuracion.web ?? "",
    rnpa_rppa: configuracion.rnpa_rppa ?? "",
  };
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudieron guardar los datos de la Pyme";
}

/**
 * Datos de identidad de la Pyme: se cargan una sola vez y alimentan la
 * cabecera de todos los listados y reportes exportados.
 */
export function DatosPymeCard() {
  const [valores, setValores] = useState<Record<Campo, string>>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const logoUrlRef = useRef<string | null>(null);

  /** Cambia el logo visible y libera la URL de objeto anterior. */
  const reemplazarLogo = useCallback((url: string | null) => {
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    logoUrlRef.current = url;
    setLogoUrl(url);
  }, []);

  useEffect(
    () => () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    },
    []
  );

  useEffect(() => {
    let vigente = true;
    obtenerConfiguracionPyme()
      .then((datos) => {
        if (!vigente) return;
        setValores(aValores(datos));
        if (datos.logo_url) {
          apiFetchImagen(datos.logo_url)
            .then((url) => {
              if (vigente) reemplazarLogo(url);
            })
            .catch(() => {
              if (vigente) reemplazarLogo(null);
            });
        }
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [reemplazarLogo]);

  const cambiar = (clave: Campo, valor: string) => {
    setValores((actual) => ({ ...actual, [clave]: valor }));
    setExito(null);
  };

  const limpiar = (valor: string) => {
    const limpio = valor.trim();
    return limpio === "" ? null : limpio;
  };

  const guardar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    setExito(null);
    setGuardando(true);
    try {
      const datos = await actualizarConfiguracionPyme({
        razon_social: limpiar(valores.razon_social),
        domicilio: limpiar(valores.domicilio),
        telefono: limpiar(valores.telefono),
        email: limpiar(valores.email),
        web: limpiar(valores.web),
        rnpa_rppa: limpiar(valores.rnpa_rppa),
      });
      setValores(aValores(datos));
      setExito("Datos de la Pyme guardados.");
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const subirLogo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setExito(null);
    setSubiendo(true);
    try {
      const datos = await subirLogoPyme(archivo);
      if (datos.logo_url) {
        const url = await apiFetchImagen(datos.logo_url).catch(() => null);
        reemplazarLogo(url);
      } else {
        reemplazarLogo(null);
      }
      setExito("Logo actualizado.");
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setSubiendo(false);
    }
  };

  const quitarLogo = async () => {
    setError(null);
    setExito(null);
    setSubiendo(true);
    try {
      await eliminarLogoPyme();
      reemplazarLogo(null);
      setExito("Logo quitado. Los documentos se generan igual, sin logo.");
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Tarjeta p={{ base: "5", md: "6" }}>
      <HStack gap="3" align="flex-start" mb="5">
        <Box color="brand.700" mt="0.5" aria-hidden>
          <LuBuilding2 size={22} />
        </Box>
        <Box>
          <Text fontWeight="bold" color="fg">
            Datos de la Pyme
          </Text>
          <Text mt="1" fontSize="sm" color="fg.muted">
            Se cargan una sola vez y aparecen en la cabecera de todos los
            listados y reportes exportados (logo, razón social, contacto, fecha
            de emisión y usuario). Si no hay logo, los documentos se generan
            igual.
          </Text>
        </Box>
      </HStack>

      {error ? <BannerError mb="4">{error}</BannerError> : null}
      {exito ? <BannerExito mb="4">{exito}</BannerExito> : null}

      {cargando ? (
        <EstadoCargando>Cargando datos de la Pyme...</EstadoCargando>
      ) : (
        <form onSubmit={guardar} noValidate>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mb="5">
            {CAMPOS.map((campo) => (
              <FormField
                key={campo.clave}
                label={campo.etiqueta}
                helper={campo.ayuda}
                mb="0"
              >
                <FormInput
                  value={valores[campo.clave]}
                  maxLength={campo.maxLength}
                  placeholder={campo.placeholder}
                  onChange={(e) => cambiar(campo.clave, e.target.value)}
                />
              </FormField>
            ))}
          </SimpleGrid>

          <FormField
            label="Logo"
            helper="PNG, JPG o WEBP de hasta 2 MB. Opcional."
            mb="5"
          >
            <HStack gap="4" align="center" flexWrap="wrap">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Logo de la Pyme"
                  maxH="56px"
                  maxW="180px"
                  objectFit="contain"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  rounded="md"
                  p="1"
                  bg="white"
                />
              ) : (
                <Text fontSize="sm" color="fg.muted">
                  Sin logo cargado.
                </Text>
              )}
              <Button
                type="button"
                variant="outline"
                colorPalette="neutral"
                loading={subiendo}
                onClick={() => inputArchivo.current?.click()}
              >
                <LuUpload />
                {logoUrl ? "Reemplazar logo" : "Subir logo"}
              </Button>
              <input
                ref={inputArchivo}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  void subirLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  colorPalette="red"
                  onClick={() => void quitarLogo()}
                  loading={subiendo}
                >
                  <LuTrash2 />
                  Quitar logo
                </Button>
              ) : null}
            </HStack>
          </FormField>

          <AccionesFormulario>
            <BotonGuardar loading={guardando}>Guardar datos</BotonGuardar>
          </AccionesFormulario>
        </form>
      )}
    </Tarjeta>
  );
}
