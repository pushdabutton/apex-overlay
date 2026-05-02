// Asset module declarations for Vite
// SVG files imported as default export resolve to their URL string at build time.
declare module '*.svg' {
  const src: string;
  export default src;
}
