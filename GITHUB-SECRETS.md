# GitHub Secrets Configuration

This document lists all the GitHub repository secrets that need to be configured for CI/CD pipelines to work properly.

## Required Secrets

### AWS Infrastructure Secrets

**Required for deployment and CDK operations:**

- `NONPROD_AWS_ACCOUNT_ID` - AWS account ID for non-production environments
- `PROD_AWS_ACCOUNT_ID` - AWS account ID for production environment
- `NONPROD_HOSTED_ZONE` - Route 53 hosted zone domain for dev/PR environments (your actual dev domain)
- `PROD_HOSTED_ZONE` - Route 53 hosted zone domain for production (your actual production domain)

### Auth0 Configuration Secrets

**Required for Auth0 SPA client management:**

- `AUTH0_DOMAIN` - Your Auth0 tenant domain (e.g., `your-tenant.auth0.com`)
- `AUTH0_CLIENT_ID` - Management API Machine-to-Machine application client ID
- `AUTH0_CLIENT_SECRET` - Management API Machine-to-Machine application client secret

**Note:** Callback URLs are automatically derived from hosted zone domains.

### GitHub Integration Secrets

**Required for automated workflows:**

- `PROJEN_GITHUB_TOKEN` - GitHub personal access token for projen self-mutation
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions (no configuration needed)

## Setting Up Secrets

1. Go to your GitHub repository
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret listed above
4. Add the secret name and value

## Auth0 Setup Instructions

1. **Create Management API Application:**
   - Go to Auth0 Dashboard → Applications
   - Click **Create Application**
   - Name: "Raffle Winner Picker - CI/CD"
   - Type: **Machine to Machine**
   - Select the **Auth0 Management API**
   - Grant scopes: `create:clients`, `read:clients`, `update:clients`, `delete:clients`

2. **Get Credentials:**
   - Copy the **Client ID** → Use as `AUTH0_CLIENT_ID`
   - Copy the **Client Secret** → Use as `AUTH0_CLIENT_SECRET`
   - Your tenant domain → Use as `AUTH0_DOMAIN`

3. **Callback URLs:**
   - Automatically derived from `PROD_HOSTED_ZONE` and `NONPROD_HOSTED_ZONE`
   - No manual configuration needed

## AWS Setup Instructions

1. **IAM Role Creation:**
   - Create IAM role: `github-actions-deployer` 
   - Trust policy: Allow GitHub Actions OIDC
   - Permissions: CDK deployment permissions

2. **Account IDs:**
   - Get your AWS account ID from AWS Console
   - Use same account for both NONPROD and PROD if using single account
   - Use different accounts for proper isolation

3. **Route 53 Hosted Zones:**
   - Create hosted zones for your domains
   - Configure DNS nameservers with your domain registrar

## Verification

After setting up all secrets, the following workflows should work:

- ✅ **Build workflow** - Builds and tests on every PR
- ✅ **PR Environment Deploy** - Deploys temporary environments for PRs
- ✅ **Production Deploy** - Deploys to production on main branch merges
- ✅ **Manual Production Deploy** - Manual production deployments
- ✅ **PR Cleanup** - Removes PR environments when PRs are closed

## Security Notes

- Never commit secrets to code
- Never hardcode domain names in public repositories
- Use least-privilege IAM policies
- Rotate secrets regularly
- Monitor secret usage in GitHub Actions logs
- Auth0 Management API tokens should be restricted to client management only
- Keep hosted zone domains private to prevent unauthorized access attempts