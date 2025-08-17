import { awscdk } from 'projen';
import { JobPermission } from 'projen/lib/github/workflows-model';
import { NodePackageManager, TypescriptConfigExtends, TypeScriptModuleResolution } from 'projen/lib/javascript';
import { BUILD_CONSTANTS } from './projen-config/constants';
import { generateGitHubActions } from './projen-config/github-actions';

const buildWorkflowCallConfig = {
  inputs: {
    upload_artifacts: {
      description: 'Upload build artifacts',
      required: false,
      default: false,
      type: 'boolean',
    },
  },
};

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
          'audience': BUILD_CONSTANTS.AWS_STS_AUDIENCE,
          'role-to-assume': 'arn:aws:iam::${{ secrets.NONPROD_AWS_ACCOUNT_ID }}:role/github-actions-deployer',
        },
      },
    ],
    env: {
      NONPROD_AWS_ACCOUNT_ID: '${{ secrets.NONPROD_AWS_ACCOUNT_ID }}',
      PROD_AWS_ACCOUNT_ID: '${{ secrets.PROD_AWS_ACCOUNT_ID }}',
      NONPROD_HOSTED_ZONE: '${{ secrets.NONPROD_HOSTED_ZONE }}',
      PROD_HOSTED_ZONE: '${{ secrets.PROD_HOSTED_ZONE }}',
      // Auth0 environment variables for client management
      VITE_AUTH0_DOMAIN: '${{ secrets.AUTH0_DOMAIN }}',
      AUTH0_DOMAIN: '${{ secrets.AUTH0_DOMAIN }}',
      AUTH0_CLIENT_ID: '${{ secrets.AUTH0_CLIENT_ID }}',
      AUTH0_CLIENT_SECRET: '${{ secrets.AUTH0_CLIENT_SECRET }}',
      DEPLOY_ENV: 'dev', // Set deployment environment for Auth0 client creation
    },
    workflowTriggers: {
      push: {
        branches: ['**', '!main'],
      },
      workflowDispatch: buildWorkflowCallConfig, // Allows manual workflow runs
      workflowCall: buildWorkflowCallConfig,
    },
  },
  projenrcTs: true,
  projenVersion: '^0.95.0',
  licensed: false,
  vscode: true,
  packageManager: NodePackageManager.BUN,
  // TODO: Extract Svelte config to separate project
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
    '@playwright/test',
    'dotenv',
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

  // Vite
  'vite.config.js.timestamp-*',
  'vite.config.ts.timestamp-*',
  // CDK
  'cdk.context.json', // excluded for security concerns in public repo

  // Playwright
  'playwright-report',
  'playwright.config.ts.timestamp-*',
  'playwright.config.js.timestamp-*',
  'test-results',
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
// Auth0 client management tasks
const getAuth0ClientTask = project.addTask('get-auth0-client', {
  description: 'Get Auth0 SPA client ID for build (no updates)',
  exec: 'bun run scripts/manage-auth0-client.js get-for-build',
  condition: '[ -n "$DEPLOY_ENV" ]',
});

const setupAuth0ClientTask = project.addTask('setup-auth0-client', {
  description: 'Setup/update Auth0 SPA client for deployment',
  exec: 'bun run scripts/manage-auth0-client.js ensure-client',
  condition: '[ -n "$DEPLOY_ENV" ]',
});

// Use get-for-build during compile to avoid updating clients during PR builds
project.compileTask.prependSpawn(setupAuth0ClientTask);
project.cdkTasks.deploy.prependExec('echo Deploying to environment: $DEPLOY_ENV');
project.cdkTasks.deploy.prependSpawn(project.compileTask);
// Svelte/Vite tasks
project.addTask('dev', { exec: 'vite dev' });
project.addTask('preview', { exec: 'vite preview' });
project.addTask('prepare', { exec: 'svelte-kit sync || echo ""' });
project.addTask('check', { exec: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json' });
project.addTask('check:watch', { exec: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch' });
project.compileTask.exec('vite build');

// Testing tasks
project.addTask('test:integration', {
  exec: 'jest --config jest.config.integration.js --runInBand',
  description: 'Run API integration tests',
});
project.addTask('test:e2e', {
  exec: 'playwright test',
  description: 'Run end-to-end browser tests',
});
project.addTask('test:e2e:local', {
  exec: 'BASE_URL=http://localhost:5173 NODE_ENV=development playwright test',
  description: 'Run end-to-end tests against local dev server',
});
project.addTask('test:all', {
  exec: 'bun run test && bun run test:integration && bun run test:e2e',
  description: 'Run all tests (unit, integration, and e2e)',
});

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