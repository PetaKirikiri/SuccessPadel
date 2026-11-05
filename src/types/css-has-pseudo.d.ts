declare module 'css-has-pseudo/browser' {
  export default function cssHasPseudo(document: Document, options?: {
    observedAttributes?: string[]
    forcePolyfill?: boolean
    hover?: boolean
    debug?: boolean
  }): void
}
