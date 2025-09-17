/// <reference types="vite/client" />
import { getAccessToken } from './auth';
import { getHostedZone } from './constants';
import { getApiUrl, CORE_SERVICES } from './domain-constants';

// Dynamically determine environment from current hostname (like auth.ts does)
function getApiEnvironment(): string {
  const currentHostname = window.location.hostname;

  if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
    return 'local';
  } else if (currentHostname.endsWith(import.meta.env.nonprod_hosted_zone)) {
    // Non-production domains - extract the environment prefix
    const nonprodHostedZone = import.meta.env.nonprod_hosted_zone;
    const prefix = currentHostname.replace(`.${nonprodHostedZone}`, '');
    return prefix || 'dev'; // fallback to 'dev' if no prefix
  } else if (currentHostname.endsWith(import.meta.env.prod_hosted_zone)) {
    return 'prod';
  } else {
    return 'dev'; // fallback
  }
}

const apiHostedZone = getHostedZone();
const envName = getApiEnvironment(); // Use dynamic detection instead of build-time variable
const winnersBaseApiUrl = getApiUrl({
  envName,
  service: CORE_SERVICES.WINNERS,
  hostedZone: apiHostedZone,
});
console.log(`Using Winners API URL: ${winnersBaseApiUrl}`);

interface RaffleRun {
  userId: string;
  runId: string;
  timestamp: string;
  entries: RaffleEntry[];
  winners: Winner[];
  totalEntries: number;
  isPublic?: boolean;
}

interface RaffleEntry {
  name: string;
  email?: string;
  tickets?: number;
  [key: string]: any;
}

interface Winner {
  name: string;
  prize: string;
  timestamp: string;
}

export async function saveRaffleRun(data: {
  entries: RaffleEntry[];
  winners: Winner[];
}): Promise<{ success: boolean; runId?: string; error?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${winnersBaseApiUrl}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entries: data.entries,
        winners: data.winners,
        totalEntries: data.entries.length,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return { success: true, runId: result.runId };
  } catch (error) {
    console.error('Error saving raffle run:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getRaffleRuns(): Promise<{ success: boolean; runs?: RaffleRun[]; error?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${winnersBaseApiUrl}/runs`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return { success: true, runs: result.runs };
  } catch (error) {
    console.error('Error fetching raffle runs:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getRaffleRun(runId: string): Promise<{ success: boolean; run?: RaffleRun; error?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${winnersBaseApiUrl}/runs/${runId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return { success: true, run: result };
  } catch (error) {
    console.error('Error fetching raffle run:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateRafflePublicStatus(runId: string, isPublic: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${winnersBaseApiUrl}/runs/${runId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isPublic }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating raffle public status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export function getPublicRaffleUrl(runId: string): string {
  // Get the current hostname and construct the public URL
  const currentHostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  return `${protocol}//${currentHostname}/public/${runId}`;
}