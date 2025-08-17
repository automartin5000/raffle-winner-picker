// Quick debug script to check environment variables
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load .env files
config(); // Load .env
config({ path: '.env.local' }); // Load .env.local

console.log('Environment Variables Check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VITE_AUTH0_DOMAIN from process.env:', process.env.VITE_AUTH0_DOMAIN);
console.log('VITE_SPA_AUTH0_CLIENT_ID from process.env:', process.env.VITE_SPA_AUTH0_CLIENT_ID);
console.log('VITE_AUTH0_AUDIENCE from process.env:', process.env.VITE_AUTH0_AUDIENCE);

// Check .env files

try {
  const envContent = readFileSync('.env', 'utf8');
  console.log('\n.env file content (VITE_ vars only):');
  envContent.split('\n').filter(line => line.startsWith('VITE_')).forEach(line => {
    console.log(line);
  });
} catch (e) {
  console.log('.env file not found');
}

try {
  const envLocalContent = readFileSync('.env.local', 'utf8');
  console.log('\n.env.local file content (VITE_ vars only):');
  envLocalContent.split('\n').filter(line => line.startsWith('VITE_')).forEach(line => {
    console.log(line);
  });
} catch (e) {
  console.log('.env.local file not found');
}