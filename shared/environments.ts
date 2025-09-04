/**
 * TypeScript environment constants for Node.js scripts
 * Kept in sync with src/lib/shared-constants.ts
 */

import {
  buildApiUrl,
  buildFrontendUrl,
} from './domain-constants.js';

// Type definitions
interface DeploymentEnvironment {
  name: string;
  description: string;
  auth0ClientName: string;
  auth0Description: string;
  isProd: boolean;
  isEphemeral: boolean;
}

interface ResolveEnvironmentOptions {
  deployEnv?: string;
  isEphemeral?: boolean;
}

interface ApiBaseUrlOptions {
  deploymentEnv?: string;
  hostedZone?: string;
  envName?: string;
}

interface FrontendUrlOptions {
  deploymentEnv?: string;
  hostedZone?: string;
  envName?: string;
}

const DEPLOYMENT_ENVIRONMENTS: Record<string, DeploymentEnvironment> = {
  // Development environment (PRs, local dev, testing)
  dev: {
    name: 'Development',
    description: 'Development environment for testing and PRs',
    auth0ClientName: 'Raffle Winner Picker (Development)',
    auth0Description: 'Development environment for Raffle Winner Picker application',
    isProd: false,
    isEphemeral: true, // PRs and dev environments are ephemeral
  },

  // Production environment
  prod: {
    name: 'Production',
    description: 'Production environment for live users',
    auth0ClientName: 'Raffle Winner Picker (Production)',
    auth0Description: 'Production environment for Raffle Winner Picker application',
    isProd: true,
    isEphemeral: false, // Production is persistent
  },
};

/**
 * Get environment configuration by key
 */
export function getEnvironmentConfig(env: string): DeploymentEnvironment {
  return DEPLOYMENT_ENVIRONMENTS[env] ?? DEPLOYMENT_ENVIRONMENTS.dev;
}

/**
 * Determine the deployment environment from various sources
 * This logic is shared between CDK, Auth0 management, and frontend
 */
export function resolveDeploymentEnvironment(options?: ResolveEnvironmentOptions): string {
  const { deployEnv, isEphemeral } = options || {};

  // If explicitly ephemeral (PR environment), use dev
  if (isEphemeral) {
    return 'dev';
  }

  // Check explicit environment variable
  if (deployEnv === 'prod' || deployEnv === 'production') {
    return 'prod';
  }

  // Check if hostname suggests production (for frontend)
  // Note: We cannot determine production from hostname alone in public code
  // as that would expose the production domain pattern
  // This detection relies on explicit environment variables only

  // Default to dev for all other cases (local dev, PR environments, etc.)
  return 'dev';
}

/**
 * Get all environment keys
 */
export function getAllEnvironments(): string[] {
  return Object.keys(DEPLOYMENT_ENVIRONMENTS);
}

/**
 * Check if environment is production
 */
export function isProductionEnvironment(env: string): boolean {
  return DEPLOYMENT_ENVIRONMENTS[env]?.isProd ?? false;
}

/**
 * Check if environment is ephemeral (temporary/PR-based)
 */
export function isEphemeralEnvironment(env: string): boolean {
  return DEPLOYMENT_ENVIRONMENTS[env]?.isEphemeral ?? true;
}

/**
 * Derive API base URL from hosted zone and environment
 */
export function getApiBaseUrl(options?: ApiBaseUrlOptions): string {
  const { deploymentEnv, hostedZone, envName } = options || {};

  if (!hostedZone) {
    return 'https://api.localhost:3000'; // fallback for local development
  }

  return buildApiUrl({
    envName: envName || deploymentEnv || 'dev',
    hostedZone,
    isProd: deploymentEnv === 'prod',
  });
}

/**
 * Derive frontend URL from hosted zone and environment
 */
export function getFrontendUrl(options?: FrontendUrlOptions): string {
  const { deploymentEnv, hostedZone, envName } = options || {};

  if (!hostedZone) {
    return 'http://localhost:5173'; // fallback for local development
  }

  return buildFrontendUrl({
    envName: envName || deploymentEnv || 'dev',
    hostedZone,
    isProd: deploymentEnv === 'prod',
  });
}

// Export the main constant
export { DEPLOYMENT_ENVIRONMENTS };

// Export types for consumers
export type {
  DeploymentEnvironment,
  ResolveEnvironmentOptions,
  ApiBaseUrlOptions,
  FrontendUrlOptions,
};