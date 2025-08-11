/**
 * CommonJS environment constants for Node.js scripts
 * Kept in sync with src/lib/shared-constants.ts
 */

const { 
  buildApiUrl, 
  buildFrontendUrl 
} = require('./domain-constants.js');

const DEPLOYMENT_ENVIRONMENTS = {
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
  }
};

/**
 * Get environment configuration by key
 */
function getEnvironmentConfig(env) {
  return DEPLOYMENT_ENVIRONMENTS[env] ?? DEPLOYMENT_ENVIRONMENTS['dev'];
}

/**
 * Determine the deployment environment from various sources
 * This logic is shared between CDK, Auth0 management, and frontend
 */
function resolveDeploymentEnvironment(options) {
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
function getAllEnvironments() {
  return Object.keys(DEPLOYMENT_ENVIRONMENTS);
}

/**
 * Check if environment is production
 */
function isProductionEnvironment(env) {
  return DEPLOYMENT_ENVIRONMENTS[env].isProd;
}

/**
 * Check if environment is ephemeral (temporary/PR-based)
 */
function isEphemeralEnvironment(env) {
  return DEPLOYMENT_ENVIRONMENTS[env].isEphemeral;
}

/**
 * Derive API base URL from hosted zone and environment
 */
function getApiBaseUrl(options) {
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
function getFrontendUrl(options) {
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

module.exports = {
  DEPLOYMENT_ENVIRONMENTS,
  getEnvironmentConfig,
  resolveDeploymentEnvironment,
  getAllEnvironments,
  isProductionEnvironment,
  isEphemeralEnvironment,
  getApiBaseUrl,
  getFrontendUrl,
};