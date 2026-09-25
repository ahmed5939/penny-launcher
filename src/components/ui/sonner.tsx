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
            'flex w-auto items-center gap-2 rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg max-[600px]:!left-auto max-[600px]:!right-auto max-[600px]:!w-auto',
          /*
           * Tone is carried by an accent edge and the icon, both from theme
           * tokens, so a failure never reads the same as a success. Plain
           * `toast()` stays neutral for purely informational notices.
           */
          success: 'border-l-4 border-l-success [&_[data-icon]]:text-success',
          error:
            'border-l-4 border-l-destructive [&_[data-icon]]:text-destructive',
          warning: 'border-l-4 border-l-warning [&_[data-icon]]:text-warning',
          icon: 'flex shrink-0 items-center',
        },
        duration: 2700,
        unstyled: true,
      }}
      {...props}
    />
  )
}

export { Toaster }
