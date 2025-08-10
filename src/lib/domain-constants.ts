/**
 * Domain and Service Constants
 *
 * This file contains all domain patterns, service endpoints, and URL structures
 * used throughout the application. This ensures consistency and makes it easy
 * to update domain patterns in one place.
 */
export interface ServiceConfig {
  subdomain: string;
  name: string;
};

// =============================================================================
// DOMAIN STRUCTURE
// =============================================================================
/**
 * Core Service Names
 */
export const CORE_SERVICES = {
  WINNERS: {
    subdomain: 'api.winners',
    name: 'Raffle Winners Service',
  },
};

// =============================================================================
// AWS SERVICE ENDPOINTS
// =============================================================================

/**
 * AWS service endpoints
 */
export const AWS_ENDPOINTS = {
  /**
   * AWS STS service endpoint for OIDC token exchange
   */
  STS_AUDIENCE: 'sts.amazonaws.com',
};

// =============================================================================
// EXTERNAL SERVICE DOMAINS
// =============================================================================

/**
 * External service domain patterns
 */
export const EXTERNAL_SERVICES = {
  /**
   * Auth0 service domain pattern
   * Used in CSP headers and documentation
   */
  AUTH0_DOMAIN: '*.auth0.com',

  /**
   * GitHub service domain
   */
  GITHUB_DOMAIN: 'github.com',
};

// =============================================================================
// URL CONSTRUCTION UTILITIES
// =============================================================================

/**
 * Construct API domain from environment and hosted zone
 */
export function buildApiDomain(options: {
  envName: string;
  service: ServiceConfig;
  hostedZone: string;
}): string {
  const { envName, hostedZone, service } = options;
  const isProd = envName === 'prod';
  const envPrefix = isProd ? '' : `${envName}.`;
  return `${envPrefix}${service.subdomain}.${hostedZone}`;
}

/**
 * Construct frontend domain from environment and hosted zone
 */
export function buildFrontendDomain(options: {
  envName: string;
  hostedZone: string;
}): string {
  const { envName, hostedZone } = options;
  const isProd = envName === 'prod';
  const envPrefix = isProd ? '' : `${envName}.`;
  return `${envPrefix}${hostedZone}`;
}

/**
 * Construct full API URL with protocol
 */
export function getApiUrl(options: {
  envName: string;
  hostedZone: string;
  service: ServiceConfig;
}): string {
  return `https://${buildApiDomain(options)}`;
}

/**
 * Construct full frontend URL with protocol
 */
export function buildFrontendUrl(options: {
  envName: string;
  hostedZone: string;
}): string {
  return `https://${buildFrontendDomain(options)}`;
}