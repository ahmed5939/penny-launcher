/**
 * Vite resolves asset imports to a URL string at build time. The project does
 * not reference `vite/client`, so the module shapes are declared here.
 */
declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}
