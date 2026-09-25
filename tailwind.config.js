/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      /*
       * The width below which the shell stops being able to hold a full
       * mission brief: a 208px rail plus the row's five fixed columns squeeze
       * the flexible one until the mission's own name is two words and an
       * ellipsis. Mirrored by a plain media query in `globals.css`, where the
       * brief's grid tracks live — keep the two numbers in step.
       */
      screens: {
        compact: {
          max: '900px',
        },
      },
      /*
       * The type scale. Every size a screen uses has a name here, so pages
       * line up and `text-[…]` never appears in a component. Font size only —
       * line height stays with the element, as the arbitrary sizes had it.
       * Registered with tailwind-merge in `src/lib/utils.ts`; keep in step.
       *
       *   3xs      9px  corner badges on item art
       *   2xs     10px  micro labels, tile captions
       *   caption 11px  section labels, secondary facts
       *   xs      12px  hints (Tailwind's own)
       *   ui      13px  body text in dense panels, list rows
       *   title   15px  small headings, brand text
       *   display-sm / display / display-lg  22 / 28 / 32px  page and hero titles
       */
      fontSize: {
        '3xs': '0.5625rem',
        '2xs': '0.625rem',
        caption: '0.6875rem',
        ui: '0.8125rem',
        title: '0.9375rem',
        'display-sm': '1.375rem',
        display: '1.75rem',
        'display-lg': '2rem',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: 'hsl(var(--surface))',
        elevated: 'hsl(var(--elevated))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        brand: {
          from: 'hsl(var(--brand-from))',
          via: 'hsl(var(--brand-via))',
          to: 'hsl(var(--brand-to))',
          teal: 'hsl(var(--brand-teal))',
        },
        stonewood: 'var(--zone-color-stonewood)',
        plankerton: 'var(--zone-color-plankerton)',
        'canny-valley': 'var(--zone-color-canny-valley)',
        'twine-peaks': 'var(--zone-color-twine-peaks)',
        ventures: 'var(--zone-color-ventures)',
      },
      /*
       * Fluent has two radii, not four: 4px for controls and 8px for surfaces
       * and flyouts. `md` and `lg` deliberately collapse onto the control
       * value so a button lands at 4px whichever one a component reaches for.
       */
      borderRadius: {
        xl: 'var(--radius-surface)',
        lg: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)',
      },
      /*
       * Segoe UI Variable ships three optical sizes in one family, and the
       * base layer already opts headings into Display. This exposes the same
       * face to figures — power levels, quantities, counts — so numerals get
       * the size they were drawn for instead of Text's tighter fitting.
       */
      fontFamily: {
        display: [
          "'Segoe UI Variable Display'",
          "'Segoe UI Variable'",
          "'Segoe UI'",
          'system-ui',
          'sans-serif',
        ],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
