import { awscdk } from 'projen';
import { JobPermission } from 'projen/lib/github/workflows-model';
import { NodePackageManager, TypescriptConfigExtends, TypeScriptModuleResolution } from 'projen/lib/javascript';
import { generateGitHubActions } from './projen-config/github-actions';

const project = new awscdk.AwsCdkTypeScriptApp({
  defaultReleaseBranch: 'main',
  name: 'raffle-winner-picker',
  appEntrypoint: '../infra/bin/app.ts',
  depsUpgrade: false,
  githubOptions: {
    mergify: false,
  },
  renovatebot: true,
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
          'aws-region': 'us-east-1',
          'audience': 'sts.amazonaws.com',
          'role-to-assume': 'arn:aws:iam::${{ secrets.NONPROD_AWS_ACCOUNT_ID }}:role/github-actions-deployer',
        },
      },
    ],
    env: {
      NONPROD_AWS_ACCOUNT_ID: '${{ secrets.NONPROD_AWS_ACCOUNT_ID }}',
      PROD_AWS_ACCOUNT_ID: '${{ secrets.PROD_AWS_ACCOUNT_ID }}',
      NONPROD_HOSTED_ZONE: '${{ secrets.NONPROD_HOSTED_ZONE }}',
      PROD_HOSTED_ZONE: '${{ secrets.PROD_HOSTED_ZONE }}',
    },
    workflowTriggers: {
      push: {
        branches: ['**', '!main'],
      },
      workflowDispatch: {}, // Allows manual workflow runs
    },
  },
  projenrcTs: true,
  projenVersion: '^0.95.0',
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
      inlineSourceMap: false,
      sourceMap: true,
      strict: true,
      moduleResolution: TypeScriptModuleResolution.BUNDLER,
      target: 'ESNext',
      noEmit: true,
      module: 'esnext',
    },
    include: ['src/**/*'],
  },
  deps: [
    'csv-parser',
    '@auth0/auth0-spa-js',
    'uuid',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
    'svelte',
    '@smui/button',
    '@smui/card',
    '@smui/textfield',
    '@smui/select',
    '@smui/top-app-bar',
    '@smui/list',
    '@smui/paper',
    '@smui/fab',
  ],
  cdkVersion: '2.190.0',
  devDeps: [
    '@sveltejs/adapter-auto',
    '@sveltejs/adapter-static',
    '@sveltejs/kit',
    '@sveltejs/vite-plugin-svelte',
    'amplify-adapter',
    'svelte-check',
    'vite',
    'svelte-preprocess',
    'vite-plugin-svelte',
    '@types/uuid',
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
  type: 'module',
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
project.addDevDeps('aws-cdk@^2.1022.0');
project.addTask('cdk-bootstrap', {
  description: 'Bootstrap the CDK environment',
  exec: 'cdk bootstrap',
  receiveArgs: true,
});
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
generateGitHubActions(project);

project.synth();