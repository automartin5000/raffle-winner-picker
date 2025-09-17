# Contributing to Raffle Winner Picker

Thank you for your interest in contributing to Raffle Winner Picker! This guide will help you get started with development, testing, and deployment.

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- AWS CLI configured
- Auth0 account for authentication

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/automartin5000/raffle-winner-picker.git
   cd raffle-winner-picker
   ```

2. **Copy environment file**
   ```bash
   cp .env.example .env.local
   ```

3. **Configure environment variables**
   - See `.env.example` for all required variables
   - Update TODOs with your actual values
   - See `GITHUB-SECRETS.md` for CI/CD setup

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Start development server**
   ```bash
   pj dev
   ```

6. **Deploy infrastructure** (optional)
   ```bash
   pj deploy
   ```

## 🏗️ Architecture

### Tech Stack

- **Frontend**: SvelteKit with TypeScript
- **Backend**: AWS Lambda + API Gateway
- **Database**: DynamoDB with user isolation
- **Authentication**: Auth0 SPA SDK
- **Infrastructure**: AWS CDK
- **CI/CD**: GitHub Actions

### Project Structure

```
├── src/                     # Frontend SvelteKit application
│   ├── routes/             # Page routes
│   ├── components/         # Reusable Svelte components
│   ├── lib/               # Utilities and stores
│   └── utils/             # Helper functions
├── infra/                  # AWS CDK infrastructure
│   ├── bin/               # CDK app entry points
│   ├── lib/               # CDK stack definitions
│   └── lambda/            # Lambda function code
├── scripts/               # Build and deployment scripts
├── tests/                 # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # API integration tests
│   └── e2e/               # End-to-end tests
└── shared/                # Shared utilities and types
```

## ⚙️ Configuration

### Required Setup

#### 1. Auth0 Configuration

- Create Auth0 tenant and applications
- Configure Management API permissions
- Update domain and callback URLs
- Set up environment-specific clients

#### 2. AWS Setup

- Configure AWS accounts (dev/prod) and IAM roles
- Set up Route 53 hosted zones
- Configure GitHub OIDC integration for CI/CD
- Set up AWS CLI profiles

#### 3. GitHub Secrets

See `GITHUB-SECRETS.md` for the complete list of required repository secrets for CI/CD pipelines.

### Environment Variables

All configuration is done via environment variables:

- `.env.example` - Complete list with examples
- `GITHUB-SECRETS.md` - GitHub repository secrets
- TODO comments in code for hardcoded values that need updating

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Test with coverage
npm run test:coverage
```

### Test Types

- **Unit Tests**: Test individual components and utilities
- **Integration Tests**: Test API endpoints and database operations
- **E2E Tests**: Test complete user workflows with Playwright

### Writing Tests

- Unit tests go in `test/unit/`
- Integration tests go in `tests/integration/`
- E2E tests go in `tests/e2e/`
- Follow existing naming conventions: `*.test.ts` or `*.spec.ts`

## 📦 Build and Deployment

### Development Commands

```bash
pj dev        # Start dev server
pj build      # Build for production  
pj test       # Run all tests
pj lint       # Run linting
pj format     # Format code
```

### CDK Commands

```bash
pj synth      # Generate CDK templates
pj deploy     # Deploy to AWS
pj destroy    # Destroy infrastructure
pj diff       # Show deployment diff
```

### Deployment Environments

- **Local**: `local.dev.rafflewinnerpicker.com`
- **Development**: `dev.rafflewinnerpicker.com`
- **Production**: `rafflewinnerpicker.com`
- **PR Environments**: `pr{number}.dev.rafflewinnerpicker.com`

## 🔧 Development Workflow

### Branching Strategy

- `main` - Production branch
- `develop` - Development branch
- Feature branches: `feature/your-feature-name`
- Bug fixes: `fix/issue-description`

### Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes with tests
3. Run the full test suite
4. Update documentation if needed
5. Submit a pull request to `develop`
6. Address review feedback
7. Merge after approval

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Follow the configured rules
- **Prettier**: Auto-format on save
- **Svelte**: Follow Svelte best practices
- **Tests**: Aim for >80% coverage

## 🐛 Debugging

### Common Issues

**Auth0 Authentication Problems**
- Check client IDs and domain configuration
- Verify callback URLs match your environment
- Ensure Management API permissions are set

**AWS Deployment Issues**
- Verify AWS CLI configuration
- Check IAM permissions
- Review CloudFormation stack events

**Database Connection Issues**
- Verify DynamoDB table exists
- Check Lambda function environment variables
- Review CloudWatch logs

### Logging

- **Frontend**: Browser dev tools console
- **Backend**: CloudWatch logs for Lambda functions
- **Infrastructure**: CloudFormation events

## 📚 Key Files and Directories

### Frontend

- `src/routes/+page.svelte` - Home page with CSV upload
- `src/routes/raffle/+page.svelte` - Main raffle interface with winner selection
- `src/lib/auth.ts` - Auth0 authentication logic
- `src/lib/api.ts` - API client for backend communication
- `src/components/WinnerWheel.svelte` - Animated winner selection component

### Backend

- `infra/lambda/raffle-api/index.js` - Main API Lambda function
- `infra/lib/api-stack.ts` - API Gateway and Lambda CDK stack
- `infra/lib/frontend-stack.ts` - CloudFront and S3 CDK stack

### Infrastructure

- `infra/bin/app.ts` - CDK app entry point
- `cdk.json` - CDK configuration
- `.github/workflows/` - CI/CD pipeline definitions

## 🤝 Contributing Guidelines

### Before You Start

1. Check existing issues and discussions
2. Create an issue for new features or significant changes
3. Ask questions in GitHub Discussions

### Code Contributions

1. **Small fixes**: Feel free to submit directly
2. **New features**: Please create an issue first
3. **Breaking changes**: Discuss in issues before implementing

### Documentation

- Update README for user-facing changes
- Update this CONTRIBUTING guide for developer changes
- Include JSDoc comments for complex functions
- Update API documentation for backend changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Getting Help

- **Bug reports**: [GitHub Issues](https://github.com/automartin5000/raffle-winner-picker/issues)
- **Feature requests**: [GitHub Discussions](https://github.com/automartin5000/raffle-winner-picker/discussions)
- **Questions**: [GitHub Discussions](https://github.com/automartin5000/raffle-winner-picker/discussions)
- **Security issues**: Email directly to maintainers

## 🎯 Development Roadmap

### Near Term
- [ ] Enhanced CSV validation and error handling
- [ ] Email notifications for winners
- [ ] Better mobile responsive design
- [ ] Audit logging and compliance features

### Long Term
- [ ] Multi-language support
- [ ] Advanced randomization algorithms
- [ ] Integration with external notification services
- [ ] White-label customization options

---

Thank you for contributing to Raffle Winner Picker! 🎉