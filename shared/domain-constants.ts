/**
 * Domain and Service Constants (TypeScript)
 *
 * This file contains all domain patterns, service endpoints, and URL structures
 * used throughout the application. This ensures consistency and makes it easy
 * to update domain patterns in one place.
 */

// Type definitions
interface DomainBuildOptions {
  envName: string;
  hostedZone: string;
  isProd: boolean;
}

// =============================================================================
// DOMAIN STRUCTURE
// =============================================================================

/**
 * Core domain structure patterns
 */
const DOMAIN_STRUCTURE = {
  /**
   * API subdomain pattern for the raffle service
   * Results in: api.winners.{domain}
   */
  API_SUBDOMAIN: 'api.winners',
};

// =============================================================================
// AWS SERVICE ENDPOINTS
// =============================================================================

/**
 * AWS service endpoints
 */
const AWS_ENDPOINTS = {
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
const EXTERNAL_SERVICES = {
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
export function buildApiDomain(options: DomainBuildOptions): string {
  const { envName, hostedZone, isProd } = options;
  const envPrefix = isProd ? '' : `${envName}.`;
  return `${envPrefix}${DOMAIN_STRUCTURE.API_SUBDOMAIN}.${hostedZone}`;
}

/**
 * Construct frontend domain from environment and hosted zone
 */
export function buildFrontendDomain(options: DomainBuildOptions): string {
  const { envName, hostedZone, isProd } = options;
  const envPrefix = isProd ? '' : `${envName}.`;
  return `${envPrefix}${hostedZone}`;
}

/**
 * Construct full API URL with protocol
 */
export function buildApiUrl(options: DomainBuildOptions): string {
  return `https://${buildApiDomain(options)}`;
}

/**
 * Construct full frontend URL with protocol
 */
export function buildFrontendUrl(options: DomainBuildOptions): string {
  return `https://${buildFrontendDomain(options)}`;
}

// Export constants
export { DOMAIN_STRUCTURE, AWS_ENDPOINTS, EXTERNAL_SERVICES };

// Export types
export type { DomainBuildOptions };