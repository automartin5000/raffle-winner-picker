import {
  type DeploymentEnvironment,
  resolveAwsAccount,
} from './shared-constants';

/**
 * Get the Auth0 client ID for the current environment
 * Dynamically selects between dev and prod client IDs based on the current hostname
 */
export function getAuth0ClientId(): string {
  const currentHostname = window.location.hostname;

  // Determine if we're in production based on hostname
  const isNonProd = currentHostname.endsWith(import.meta.env.nonprod_hosted_zone);
  const isProduction = !isNonProd && currentHostname.endsWith(import.meta.env.prod_hosted_zone);

  let clientId = '';
  let environment = 'unknown';

  if (isProduction) {
    clientId = import.meta.env.VITE_AUTH0_CLIENT_ID_PROD || '';
    environment = 'production';
  } else if (isNonProd) {
    clientId = import.meta.env.VITE_AUTH0_CLIENT_ID_DEV || '';
    environment = 'development';
  } else {
    // Fallback to the generic SPA client ID (for localhost or unknown domains)
    clientId = import.meta.env.VITE_SPA_AUTH0_CLIENT_ID ||
               import.meta.env.VITE_AUTH0_CLIENT_ID || '';
    environment = 'localhost/fallback';
  }

  console.log('🔐 Auth0 Environment Detection:');
  console.log(`   Hostname: ${currentHostname}`);
  console.log(`   Environment: ${environment}`);
  console.log(`   Client ID: ${clientId ? clientId.substring(0, 8) + '...' : 'MISSING'}`);

  if (!clientId) {
    console.error('❌ Auth0 client ID is missing for environment:', environment);
    console.error('   Available env vars:', {
      VITE_AUTH0_CLIENT_ID_PROD: import.meta.env.VITE_AUTH0_CLIENT_ID_PROD ? 'SET' : 'MISSING',
      VITE_AUTH0_CLIENT_ID_DEV: import.meta.env.VITE_AUTH0_CLIENT_ID_DEV ? 'SET' : 'MISSING',
      VITE_SPA_AUTH0_CLIENT_ID: import.meta.env.VITE_SPA_AUTH0_CLIENT_ID ? 'SET' : 'MISSING',
    });
  }

  return clientId;
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