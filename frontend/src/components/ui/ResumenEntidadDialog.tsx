import { Badge, Box, Button, Dialog, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";
import { DialogCloseTrigger, DialogContent } from "./dialog";

export function EstadoEntidad({ activo }: { activo: boolean }) {
  return (
    <Badge variant="subtle" colorPalette={activo ? "green" : "gray"}>
      {activo ? "Activo" : "Dado de baja"}
    </Badge>
  );
}

export function ResumenEntidadDialog({
  nombre,
  activo,
  campos,
  children,
  acciones,
  onCerrar,
}: {
  nombre: string;
  activo: boolean;
  campos: { etiqueta: string; valor: ReactNode }[];
  children?: ReactNode;
  acciones?: ReactNode;
  onCerrar: () => void;
}) {
  const [abierto, setAbierto] = useState(true);

  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={({ open }) => setAbierto(open)}
      onExitComplete={onCerrar}
      size={{ smDown: "full", sm: "lg" }}
      scrollBehavior="inside"
    >
      <DialogContent>
        <Dialog.Header bg="teal.subtle" pe="12">
          <Stack gap="1.5" align="start">
            <Dialog.Title overflowWrap="anywhere">{nombre}</Dialog.Title>
            <EstadoEntidad activo={activo} />
          </Stack>
        </Dialog.Header>
        <DialogCloseTrigger aria-label="Cerrar resumen" />
        <Dialog.Body pt="5">
          <Stack gap="4">
            <SimpleGrid as="dl" columns={{ base: 1, sm: 2 }} gap="4">
              {campos.map(({ etiqueta, valor }) => (
                <Box key={etiqueta}>
                  <Text as="dt" fontSize="sm" fontWeight="semibold" color="fg.muted">{etiqueta}</Text>
                  <Text as="dd" overflowWrap="anywhere">{valor}</Text>
                </Box>
              ))}
            </SimpleGrid>
            {children}
          </Stack>
        </Dialog.Body>
        <Dialog.Footer borderTopWidth="1px">
          <HStack flexWrap="wrap" justify="end">
            {acciones}
            <Dialog.ActionTrigger asChild>
              <Button variant="outline">Cerrar</Button>
            </Dialog.ActionTrigger>
          </HStack>
        </Dialog.Footer>
      </DialogContent>
    </Dialog.Root>
  );
}
