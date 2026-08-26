import { useTheme } from 'next-themes'
// eslint-disable-next-line import/no-unresolved
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'light' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="flex h-auto justify-center text-sm z-50"
      toastOptions={{
        classNames: {
          /*
           * Popover tokens, so a toast follows the theme. `bg-zinc-50` was a
           * raw palette colour: a near-white card in a near-black app, and
           * the only surface in it that never went dark.
           */
          toast:
            'w-auto rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg max-[600px]:!left-auto max-[600px]:!right-auto max-[600px]:!w-auto',
        },
        duration: 2700,
        unstyled: true,
      }}
      {...props}
    />
  )
}

export { Toaster }
