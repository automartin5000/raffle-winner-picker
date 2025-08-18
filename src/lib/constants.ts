import {
  type DeploymentEnvironment,
  resolveAwsAccount,
} from './shared-constants';

/**
 * Get the Auth0 client ID for the current environment
 */
export function getAuth0ClientId(): string {
  const spaAuth0ClientId = import.meta.env.VITE_SPA_AUTH0_CLIENT_ID || '';
  console.log(`Using Auth0 client ID: ${spaAuth0ClientId || 'MISSING'}`);

  if (!spaAuth0ClientId) {
    console.error('❌ VITE_SPA_AUTH0_CLIENT_ID is not set!');
  }

  return spaAuth0ClientId;
}

/**
 * Get the base hosted zone for the current environment
 */
export function getHostedZone(): string {
  const currentHostname = window.location.hostname;
  // Match against non-production hosted zone or production
  // We match against the non-production hosted zone first
  // because it is a subdomain of the production hosted zone
  const isNonProd = currentHostname.endsWith(import.meta.env.nonprod_hosted_zone);
  console.log('Running in environment:', isNonProd ? 'non-production' : 'production');
  const hostedZone = isNonProd
    ? import.meta.env.nonprod_hosted_zone
    : import.meta.env.prod_hosted_zone;

  return hostedZone;

}