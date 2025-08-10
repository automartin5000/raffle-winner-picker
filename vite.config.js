import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [sveltekit()],
    define: {
        "import.meta.env.nonprod_hosted_zone": JSON.stringify(process.env.NONPROD_HOSTED_ZONE),
        "import.meta.env.prod_hosted_zone": JSON.stringify(process.env.PROD_HOSTED_ZONE),
        "import.meta.env.deploy_env": JSON.stringify(process.env.DEPLOY_ENV),
    }
});