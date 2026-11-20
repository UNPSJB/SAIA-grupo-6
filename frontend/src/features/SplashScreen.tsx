import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { LuShieldCheck } from "react-icons/lu";
import "./SplashScreen.css";

const INTEGRANTES = [
  "Florencia Anahí Argañarás",
  "Facundo Emiliano Cuell",
  "Alan Oscar James",
  "Joaquín Gabriel Lobos Glass",
  "María Ángeles Magni Taddei",
  "Lautaro Ezequiel Moraga",
];

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [saliendo, setSaliendo] = useState(false);
  const nombresRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const contenedor = nombresRef.current;
    if (!contenedor) return;

    let frame = 0;

    const marcarIniciosDeFila = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!contenedor.isConnected) return;

        const nombres = Array.from(
          contenedor.querySelectorAll<HTMLElement>(".saia-splash__name"),
        );
        nombres.forEach((nombre, indice) => {
          const anterior = nombres[indice - 1];
          const iniciaFila =
            indice === 0 ||
            (anterior !== undefined &&
              Math.abs(nombre.offsetTop - anterior.offsetTop) >= 2);

          nombre.classList.toggle(
            "saia-splash__name--inicio-fila",
            iniciaFila,
          );
        });
      });
    };

    marcarIniciosDeFila();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(marcarIniciosDeFila);
    observer?.observe(contenedor);
    window.addEventListener("resize", marcarIniciosDeFila);
    void document.fonts?.ready.then(marcarIniciosDeFila);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", marcarIniciosDeFila);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const reducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const espera = reducido ? 1000 : 4400;
    const salida = reducido ? 150 : 500;
    const inicioSalida = window.setTimeout(() => setSaliendo(true), espera);
    const fin = window.setTimeout(() => onFinish(), espera + salida);

    return () => {
      window.clearTimeout(inicioSalida);
      window.clearTimeout(fin);
    };
  }, [onFinish]);

  return (
    <Flex
      className={`saia-splash${saliendo ? " saia-splash--saliendo" : ""}`}
      minH="100dvh"
      direction="column"
      align="center"
      justify="center"
      position="fixed"
      inset="0"
      zIndex="9999"
      overflow="hidden"
      px="6"
      py="8"
      color="white"
      textAlign="center"
      role="status"
      aria-label="Bienvenida a SAIA"
    >
      <Box className="saia-splash__orbit saia-splash__orbit--uno" aria-hidden />
      <Box className="saia-splash__orbit saia-splash__orbit--dos" aria-hidden />
      <Box className="saia-splash__glow saia-splash__glow--uno" aria-hidden />
      <Box className="saia-splash__glow saia-splash__glow--dos" aria-hidden />

      <Flex className="saia-splash__content" direction="column" align="center">
        <Text className="saia-splash__eyebrow">Bienvenido a</Text>
        <Box className="saia-splash__emblem">
          <Box className="saia-splash__ring">
            <LuShieldCheck size={84} strokeWidth={1.35} aria-hidden />
          </Box>
        </Box>
        <Text className="saia-splash__title" as="h1" m="0">
          SAIA
        </Text>
        <Text className="saia-splash__tagline">
          Sistema de apoyo para la inocuidad alimentaria
        </Text>
      </Flex>

      <Box
        className="saia-splash__credits"
        position="absolute"
        bottom={{ base: "5", md: "8" }}
        left="0"
        right="0"
        px={{ base: "3", md: "6" }}
        zIndex="1"
      >
        <Box
          className="saia-splash__credit-card"
          w="100%"
          maxW="600px"
          mx="auto"
          px={{ base: "4", md: "6" }}
          py={{ base: "3", md: "3.5" }}
        >
          <Text className="saia-splash__by">By:</Text>
          <Box className="saia-splash__names" ref={nombresRef}>
            {INTEGRANTES.map((nombre, indice) => (
              <Text
                as="span"
                key={nombre}
                className="saia-splash__name"
                style={{
                  animationDelay: `${1.2 + indice * 0.1}s`,
                }}
              >
                {nombre}
              </Text>
            ))}
          </Box>
        </Box>
      </Box>

      <Box className="saia-splash__progress" aria-hidden>
        <Box className="saia-splash__progress-bar" />
      </Box>
    </Flex>
  );
}
