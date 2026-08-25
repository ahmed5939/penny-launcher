import type { SVGProps } from 'react'

/**
 * Penny brand mark.
 *
 * Original artwork (a "penny" coin with a P monogram) drawn in the rose ->
 * hot pink -> magenta sampled from the Penny render. Inline SVG so it stays
 * crisp at any size and carries no third-party image rights — this is the
 * mark to reach for anywhere the character art would be inappropriate.
 */
export function PennyLogo({
  title = 'Penny',
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>{title}</title>
      <defs>
        <linearGradient
          id="penny-coin"
          x1="8"
          y1="6"
          x2="56"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#f08ab4" />
          <stop offset="0.55" stopColor="#d62d74" />
          <stop offset="1" stopColor="#961c60" />
        </linearGradient>
        <linearGradient
          id="penny-ring"
          x1="10"
          y1="10"
          x2="54"
          y2="54"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#f9c2d8" />
          <stop offset="1" stopColor="#c02a6a" />
        </linearGradient>
      </defs>

      {/* coin body */}
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="url(#penny-coin)"
      />
      {/* inner rim */}
      <circle
        cx="32"
        cy="32"
        r="23.5"
        fill="none"
        stroke="url(#penny-ring)"
        strokeWidth="2"
        opacity="0.7"
      />
      {/* P monogram */}
      <path
        d="M25 17h11.5c6.35 0 11 4.3 11 10.6 0 6.3-4.65 10.7-11 10.7H31v9.3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V18a1 1 0 0 1 1-1Zm6 6.1v13h5c2.9 0 5-2.7 5-6.5s-2.1-6.5-5-6.5h-5Z"
        fill="#ffffff"
      />
    </svg>
  )
}
