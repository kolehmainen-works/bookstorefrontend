/// <reference types="vite/client" />

interface ImportMetaEnv {
  // bookstorebackend address, e.g. https://softala.haaga-helia.fi:8090
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
