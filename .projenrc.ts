import { awscdk } from 'projen';
import { NodePackageManager, TypescriptConfigExtends, TypeScriptModuleResolution } from 'projen/lib/javascript';

const project = new awscdk.AwsCdkTypeScriptApp({
  defaultReleaseBranch: 'main',
  name: 'raffle-winner-picker',
  appEntrypoint: '../infra/bin/app.ts',
  projenrcTs: true,
  licensed: false,
  vscode: true,
  packageManager: NodePackageManager.BUN,
  tsconfig: {
    extends: TypescriptConfigExtends.fromPaths(['./.svelte-kit/tsconfig.json']),
    compilerOptions: {
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      moduleResolution: TypeScriptModuleResolution.BUNDLER,
      target: 'ESNext',
      noEmit: true,
      module: 'esnext',
    },
  },
  tsconfigDev: {
    compilerOptions: {
      verbatimModuleSyntax: false,
      module: 'CommonJS',
    },
  },
  deps: [
    'csv-parser',
    ],
  cdkVersion: '2.180.0',
  devDeps: [
    '@sveltejs/adapter-auto',
    '@sveltejs/adapter-static',
    '@sveltejs/kit',
    '@sveltejs/vite-plugin-svelte',
    'svelte',
    'svelte-check',
    'tsx',
    'vite',
  ],
});
project.gitignore.exclude(
  // Output
  '.output',
  '.vercel',
  '.netlify',
  '.wrangler',
  '/.svelte-kit',
  '/build',
  // OS
  '.DS_Store',
  'Thumbs.db',
  // Env
  '.env',
  '.env.*',
  '!.env.example',
  '!.env.test',
  // Vite
  'vite.config.js.timestamp-*',
  'vite.config.ts.timestamp-*',
  // CDK
  'cdk.context.json', // excluded for security concerns in public rpo
);
project.addFields({
  svelte: {
    kit: {
      adapter: '@sveltejs/adapter-static',
      target: '#svelte',
    },
  },
});

project.addTask('dev', { exec: 'vite dev' });
project.compileTask.reset('vite build');
project.addTask('preview', { exec: 'vite preview' });
project.addTask('prepare', { exec: 'svelte-kit sync || echo ""' });
project.addTask('check', { exec: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json' });
project.addTask('check:watch', { exec: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch' });

project.synth();