import { 
  type DeploymentEnvironment, 
  resolveDeploymentEnvironment 
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