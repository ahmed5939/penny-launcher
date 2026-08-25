import { ColorInput, MantineProvider, createTheme } from '@mantine/core'

import '@mantine/core/styles.css'

/**
 * The colour picker is the only Mantine component in the app, so both the
 * library and its stylesheet are scoped to this module instead of wrapping
 * the whole tree. It lives behind the lazily loaded settings route, which
 * keeps ~90KB of JS plus Mantine's CSS out of the startup path.
 */
const theme = createTheme({
  /** Match the Penny DB indigo/violet accent. */
  primaryColor: 'pink',
  primaryShade: { light: 6, dark: 5 },
})

export function TagColorInput({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void
  placeholder?: string
  value?: string
}) {
  return (
    <MantineProvider theme={theme}>
      <ColorInput
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        withEyeDropper={false}
      />
    </MantineProvider>
  )
}
