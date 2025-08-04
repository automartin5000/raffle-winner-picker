import { writable } from 'svelte/store';

export interface RaffleEntry {
  name: string;
  email?: string;
  tickets?: number;
  prize?: string;
  originalData?: Record<string, any>;
}

export interface RaffleWinner {
  name: string;
  prize?: string;
  timestamp: string;
  email?: string;
}

export interface RaffleState {
  // CSV Data
  csvData: any;
  columnMapping: {
    name: string;
    email: string;
    tickets: string;
    prize: string;
  };
  
  // Processed Data
  entries: RaffleEntry[];
  entryPool: string[];
  csvPrizes: string[];
  prizeWinnerCounts: Record<string, number>;
  
  // Raffle State
  winners: RaffleWinner[];
  isRunning: boolean;
  isPaused: boolean;
  currentWinner: string;
  currentPrize: string;
  currentPrizeIndex: number;
  currentWinnerInPrize: number;
  spinDuration: number;
  
  // Navigation
  step: 'upload' | 'configure' | 'raffle';
}

const initialState: RaffleState = {
  csvData: null,
  columnMapping: {
    name: '',
    email: '',
    tickets: '',
    prize: ''
  },
  entries: [],
  entryPool: [],
  csvPrizes: [],
  prizeWinnerCounts: {},
  winners: [],
  isRunning: false,
  isPaused: false,
  currentWinner: '',
  currentPrize: '',
  currentPrizeIndex: 0,
  currentWinnerInPrize: 0,
  spinDuration: 3000,
  step: 'upload'
};

export const raffleStore = writable<RaffleState>(initialState);

// Helper functions
export const resetRaffle = () => {
  raffleStore.set(initialState);
};

export const setCSVData = (csvData: any, columnMapping: any) => {
  raffleStore.update(state => ({
    ...state,
    csvData,
    columnMapping,
    step: 'configure'
  }));
};

export const setEntries = (entries: RaffleEntry[], entryPool: string[], csvPrizes: string[], prizeWinnerCounts: Record<string, number>) => {
  raffleStore.update(state => ({
    ...state,
    entries,
    entryPool,
    csvPrizes,
    prizeWinnerCounts,
    step: 'raffle'
  }));
};

export const updateRaffleState = (updates: Partial<RaffleState>) => {
  raffleStore.update(state => ({
    ...state,
    ...updates
  }));
};