import {
  type DeploymentEnvironment,
  resolveDeploymentEnvironment,
  getApiBaseUrl as deriveApiBaseUrl,
} from './shared-constants';

/**
 * Get the appropriate deployment environment for the current frontend context
 */
export function getDeploymentEnvironment(): DeploymentEnvironment {
  return resolveDeploymentEnvironment({
    deployEnv: import.meta.env.VITE_DEPLOY_ENV,
    isEphemeral: import.meta.env.VITE_DEPLOY_EPHEMERAL === 'true',
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
  });
}

/**
 * Get the Auth0 client ID for the current environment
 */
export function getAuth0ClientId(): string {
  const env = getDeploymentEnvironment();

  if (env === 'prod') {
    return import.meta.env.VITE_AUTH0_CLIENT_ID_PROD || import.meta.env.VITE_AUTH0_CLIENT_ID || '';
  } else {
    return import.meta.env.VITE_AUTH0_CLIENT_ID_DEV || import.meta.env.VITE_AUTH0_CLIENT_ID || '';
  }
}

/**
 * Get the API base URL for the current environment
 */
export function getApiBaseUrl(): string {
  const env = getDeploymentEnvironment();

  // Get hosted zone from environment variables
  const hostedZone = env === 'prod'
    ? import.meta.env.VITE_PROD_HOSTED_ZONE
    : import.meta.env.VITE_NONPROD_HOSTED_ZONE;

  if (hostedZone) {
    return deriveApiBaseUrl({
      deploymentEnv: env,
      hostedZone,
      envName: import.meta.env.VITE_DEPLOY_ENV,
    });
  }

  // Fallback for local development when hosted zones aren't available
  console.warn('No hosted zone available. Using local development API URL.');
  return 'http://localhost:3000/api';
}