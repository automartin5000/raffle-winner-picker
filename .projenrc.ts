import { awscdk } from 'projen';
import { JobPermission } from 'projen/lib/github/workflows-model';
import { NodePackageManager, TypescriptConfigExtends, TypeScriptModuleResolution } from 'projen/lib/javascript';

const project = new awscdk.AwsCdkTypeScriptApp({
  defaultReleaseBranch: 'main',
  name: 'raffle-winner-picker',
  appEntrypoint: '../infra/bin/app.ts',
  buildWorkflowOptions: {
    permissions: {
      contents: JobPermission.READ,
      idToken: JobPermission.WRITE,
    },
    preBuildSteps: [
      {
        name: 'AWS Account Login',
        uses: 'aws-actions/configure-aws-credentials@v4',
        with: {
          'aws-region': "${{ vars.AWS_REGION }}",
        },

      }
    ],
    env: {
      NONPROD_AWS_ACCOUNT_ID: "${{ secrets.NONPROD_AWS_ACCOUNT_ID }}",
      PROD_AWS_ACCOUNT_ID: "${{ secrets.PROD_AWS_ACCOUNT_ID }}",
      NONPROD_HOSTED_ZONE: "${{ secrets.NONPROD_HOSTED_ZONE }}",
      PROD_HOSTED_ZONE: "${{ secrets.PROD_HOSTED_ZONE }}",
    },
    workflowTriggers: {
      push: {
        // All branches except main
        branches: ['!main'],
      },
      workflowDispatch: {}
    }
  },
  projenrcTs: true,
  projenVersion: "^0.92.2",
  licensed: false,
  vscode: true,
  packageManager: NodePackageManager.BUN,
  // TODO: Extract Svelete config to separate project
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
  deps: [
    'csv-parser',
  ],
  cdkVersion: '2.190.0',
  devDeps: [
    '@aws-cdk/aws-amplify-alpha@2.187.0-alpha.0',
    '@sveltejs/adapter-auto',
    '@sveltejs/adapter-static',
    '@sveltejs/kit',
    '@sveltejs/vite-plugin-svelte',
    'amplify-adapter',
    'svelte',
    'svelte-check',
    'vite',
  ],
});
project.gitignore.exclude(
  // Output
  '.output',
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
  'cdk.context.json', // excluded for security concerns in public repo
);
project.addFields({
  svelte: {
    kit: {
      adapter: '@sveltejs/adapter-static',
      target: '#svelte',
    },
  },
});
// Svelte/Vite tasks
project.addTask('dev', { exec: 'vite dev' });
project.compileTask.reset('vite build');
project.addTask('preview', { exec: 'vite preview' });
project.addTask('prepare', { exec: 'svelte-kit sync || echo ""' });
project.addTask('check', { exec: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json' });
project.addTask('check:watch', { exec: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch' });

// TODO: Add CDK CLI in projen
project.addDevDeps('aws-cdk@2.1013.0');

// TODO: Fix in projen
project.defaultTask?.reset('bun .projenrc.ts');
// TODO: Extract as a default to Projen
project.vscode?.settings.addSettings(
  {
    'editor.tabSize': 2,
    'editor.insertSpaces': true,
    'editor.detectIndentation': false,
  }, 'typescript',
);
project.synth();