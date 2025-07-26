/// <reference types="vite/client" />
import { getAccessToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface RaffleRun {
  userId: string;
  runId: string;
  timestamp: string;
  entries: RaffleEntry[];
  winners: Winner[];
  totalEntries: number;
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

    const response = await fetch(`${API_BASE_URL}/raffle-runs`, {
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

    const response = await fetch(`${API_BASE_URL}/raffle-runs`, {
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

    const response = await fetch(`${API_BASE_URL}/raffle-runs/${runId}`, {
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