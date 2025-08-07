/**
 * Shared environment configuration constants
 * This file defines the canonical list of deployment environments and their properties
 */

export const DEPLOYMENT_ENVIRONMENTS = {
  // Development environment (PRs, local dev, testing)
  dev: {
    name: 'Development',
    description: 'Development environment for testing and PRs',
    auth0ClientName: 'Raffle Winner Picker (Development)',
    auth0Description: 'Development environment for Raffle Winner Picker application',
    isProd: false,
    isEphemeral: false, // PRs and dev environments are ephemeral
  },
  
  // Production environment
  prod: {
    name: 'Production',
    description: 'Production environment for live users',
    auth0ClientName: 'Raffle Winner Picker (Production)', 
    auth0Description: 'Production environment for Raffle Winner Picker application',
    isProd: true,
    isEphemeral: false, // Production is persistent
  }
} as const;

export type DeploymentEnvironment = keyof typeof DEPLOYMENT_ENVIRONMENTS;

/**
 * Get environment configuration by key
 */
export function getEnvironmentConfig(env: DeploymentEnvironment) {
  return DEPLOYMENT_ENVIRONMENTS[env];
}

/**
 * Determine the deployment environment from various sources
 * This logic is shared between CDK, Auth0 management, and frontend
 */
export function resolveDeploymentEnvironment(options: {
  deployEnv?: string;
  isEphemeral?: boolean;
  hostname?: string;
}): DeploymentEnvironment {
  const { deployEnv, isEphemeral, hostname } = options;
  
  // If explicitly ephemeral (PR environment), use dev
  if (isEphemeral) {
    return 'dev';
  }
  
  // Check explicit environment variable
  if (deployEnv === 'prod' || deployEnv === 'production') {
    return 'prod';
  }
  
  // Check if hostname suggests production (for frontend)
  if (hostname) {
    if (hostname.includes('rafflewinnerpicker.com') && !hostname.includes('dev.')) {
      return 'prod';
    }
  }
  
  // Default to dev for all other cases (local dev, PR environments, etc.)
  return 'dev';
}

/**
 * Get all environment keys
 */
export function getAllEnvironments(): DeploymentEnvironment[] {
  return Object.keys(DEPLOYMENT_ENVIRONMENTS) as DeploymentEnvironment[];
}

/**
 * Check if environment is production
 */
export function isProductionEnvironment(env: DeploymentEnvironment): boolean {
  return DEPLOYMENT_ENVIRONMENTS[env].isProd;
}

/**
 * Check if environment is ephemeral (temporary/PR-based)
 */
export function isEphemeralEnvironment(env: DeploymentEnvironment): boolean {
  return DEPLOYMENT_ENVIRONMENTS[env].isEphemeral;
}