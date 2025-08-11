# 🎰 Raffle Winner Picker

A modern, full-stack raffle application built with SvelteKit and AWS CDK.

## Features

- **🔐 Auth0 Authentication** - Secure user login and session management
- **📊 CSV Upload & Mapping** - Smart column detection and manual mapping
- **🎰 Animated Winner Selection** - Slot machine-style animation with 5-second pauses
- **🏆 Live Results** - Real-time winner tracking and display
- **☁️ Cloud Storage** - User-scoped data in DynamoDB
- **📅 Run History** - Complete audit trail of past raffles
- **🎨 Modern UI** - Responsive design with professional styling

## Quick Start

1. **Copy environment file**
   ```bash
   cp .env.example .env.local
   ```

2. **Configure environment variables**
   - See `.env.example` for all required variables
   - Update TODOs with your actual values
   - See `GITHUB-SECRETS.md` for CI/CD setup

3. **Start development server**
   ```bash
   pj dev
   ```

4. **Deploy infrastructure** (optional)
   ```bash
   pj deploy
   ```

## Configuration

### Required Setup

1. **Auth0 Configuration**
   - Create Auth0 tenant and applications
   - Configure Management API permissions
   - Update domain and callback URLs

2. **AWS Setup**
   - Configure AWS accounts and IAM roles
   - Set up Route 53 hosted zones
   - Configure GitHub OIDC integration

3. **GitHub Secrets**
   - See `GITHUB-SECRETS.md` for complete list
   - Required for CI/CD pipelines

### Environment Variables

All configuration is done via environment variables. See:
- `.env.example` - Complete list with examples
- `GITHUB-SECRETS.md` - GitHub repository secrets
- TODO comments in code for hardcoded values that need updating

## Development

```bash
pj dev        # Start dev server
pj build      # Build for production  
pj synth      # Generate CDK templates
pj deploy     # Deploy to AWS
```

## Architecture

- **Frontend**: SvelteKit with TypeScript
- **Backend**: AWS Lambda + API Gateway
- **Database**: DynamoDB with user isolation
- **Auth**: Auth0 SPA SDK
- **Infrastructure**: AWS CDK

## Sample Data

See `src/sample_raffle_tickets.csv` for expected CSV format.