/**
 * Build-time constants for projen configuration
 * These constants are used in build workflows and GitHub Actions
 */

// Import domain constants (using relative path since this is build-time)
import { AWS_ENDPOINTS } from '../src/lib/domain-constants';

/**
 * AWS service endpoints for build workflows
 */
export const BUILD_CONSTANTS = {
  /**
   * AWS STS audience for OIDC token exchange in GitHub Actions
   */
  AWS_STS_AUDIENCE: AWS_ENDPOINTS.STS_AUDIENCE,
  
  /**
   * GitHub Actions bot email for commits
   */
  GITHUB_ACTIONS_EMAIL: 'github-actions@github.com',
  
  /**
   * Example domains used in CDK diff obfuscation
   */
  EXAMPLE_DOMAINS: {
    NONPROD: 'nonprod.example.com',
    PROD: 'example.com',
  },
} as const;