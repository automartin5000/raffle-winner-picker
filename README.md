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
   cp .env.example .env
   ```

2. **Update `.env` with your credentials**
   - Auth0 domain, client ID, and audience
   - API Gateway URL (provided after CDK deployment)

3. **Start development server**
   ```bash
   pj dev
   ```

4. **Deploy infrastructure** (optional)
   ```bash
   pj deploy
   ```

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