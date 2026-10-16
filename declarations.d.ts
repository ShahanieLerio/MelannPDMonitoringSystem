declare module '*.jpg';
declare module '*.png';
declare module '*.svg';

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_GEOCODING_BASE_URL?: string;
  readonly VITE_ROUTING_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
