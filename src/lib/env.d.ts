/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH0_DOMAIN: string;
  readonly VITE_AUTH0_CLIENT_ID: string;
  readonly VITE_AUTH0_AUDIENCE: string;
  readonly VITE_DEPLOY_ENV: string;
  readonly VITE_DEPLOY_EPHEMERAL: string;
  readonly VITE_PROD_HOSTED_ZONE: string;
  readonly VITE_NONPROD_HOSTED_ZONE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}