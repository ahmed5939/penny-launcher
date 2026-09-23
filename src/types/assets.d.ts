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

/** Any file imported with Vite's `?url` suffix (models, HDR images …). */
declare module '*?url' {
  const src: string
  export default src
}
