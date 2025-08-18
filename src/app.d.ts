// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

interface ImportMetaEnv {
	readonly VITE_AUTH0_DOMAIN: string;
	readonly VITE_AUTH0_CLIENT_ID: string;
	readonly VITE_DEPLOY_ENV: string;
	readonly VITE_DEPLOY_EPHEMERAL: string;
	readonly VITE_PROD_HOSTED_ZONE: string;
	readonly VITE_NONPROD_HOSTED_ZONE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
