import { Dialog as ChakraDialog, Portal } from "@chakra-ui/react"
import { CloseButton } from "./close-button"
import * as React from "react"

interface DialogContentProps extends ChakraDialog.ContentProps {
  portalled?: boolean
  portalRef?: React.RefObject<HTMLElement | null>
  backdrop?: boolean
}

/*
 * Modales con contenido alto.
 *
 * Cada modal fijaba (o no) su propio tope: unos con `maxHeight="85vh"` y
 * scroll, otros con `maxH` y sin scroll (el contenido se salía por abajo) y
 * otros sin tope, que en una pantalla baja empujaban los botones fuera de la
 * vista. Ahora todo `DialogContent` nace con tope de alto y scroll interno; el
 * modal que pasa su propio `maxH`/`overflow` lo sigue pisando.
 *
 * Al desplazarse, el título y la fila de botones (`AccionesFormulario`, marcada
 * con `data-acciones-formulario`) quedan pegados arriba y abajo, con el fondo
 * del modal para que el contenido pase por debajo sin transparentarse.
 *
 * `sticky` se pega al borde del contenido, no al del modal: por la franja del
 * padding se asomaba lo que pasaba por detrás. La sombra sólida del color del
 * modal tapa esa franja (hasta 32px) hacia afuera, sin pisar el contenido.
 */
const PARTES_FIJAS = {
  "& > [data-part=title]": {
    position: "sticky",
    top: "0",
    zIndex: 1,
    background: "bg.panel",
    boxShadow: "0 -16px 0 16px {colors.bg.panel}",
  },
  "& [data-acciones-formulario]": {
    position: "sticky",
    bottom: "0",
    zIndex: 1,
    background: "bg.panel",
    boxShadow: "0 16px 0 16px {colors.bg.panel}",
    paddingY: "3",
  },
} as const

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(function DialogContent(props, ref) {
  const {
    children,
    portalled = true,
    portalRef,
    backdrop = true,
    ...rest
  } = props

  return (
    <Portal disabled={!portalled} container={portalRef}>
      {backdrop && <ChakraDialog.Backdrop />}
      <ChakraDialog.Positioner>
        <ChakraDialog.Content
          ref={ref}
          maxH="calc(100dvh - 2rem)"
          overflowY="auto"
          css={PARTES_FIJAS}
          {...rest}
          asChild={false}
        >
          {children}
        </ChakraDialog.Content>
      </ChakraDialog.Positioner>
    </Portal>
  )
})

export const DialogCloseTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraDialog.CloseTriggerProps
>(function DialogCloseTrigger(props, ref) {
  return (
    <ChakraDialog.CloseTrigger
      position="absolute"
      top="2"
      insetEnd="2"
      {...props}
      asChild
    >
      <CloseButton size="sm" ref={ref}>
        {props.children}
      </CloseButton>
    </ChakraDialog.CloseTrigger>
  )
})

export const DialogRoot = ChakraDialog.Root
export const DialogFooter = ChakraDialog.Footer
export const DialogHeader = ChakraDialog.Header
export const DialogBody = ChakraDialog.Body
export const DialogBackdrop = ChakraDialog.Backdrop
export const DialogTitle = ChakraDialog.Title
export const DialogDescription = ChakraDialog.Description
export const DialogTrigger = ChakraDialog.Trigger
export const DialogActionTrigger = ChakraDialog.ActionTrigger
