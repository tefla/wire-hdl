/// <reference types="vite/client" />

// Vite raw imports
declare module '*.asm?raw' {
  const content: string;
  export default content;
}
