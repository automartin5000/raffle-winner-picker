/**
 * @jest-environment node
 */

// Mock svelte/store
jest.mock('svelte/store', () => ({
  writable: jest.fn((initial) => {
    let value = initial;
    const subscribers: Function[] = [];

    return {
      subscribe: jest.fn((callback) => {
        subscribers.push(callback);
        callback(value);
        return {
          unsubscribe: jest.fn(() => {
            const index = subscribers.indexOf(callback);
            if (index !== -1) subscribers.splice(index, 1);
          }),
        };
      }),
      set: jest.fn((newValue) => {
        value = newValue;
        subscribers.forEach(callback => callback(value));
      }),
      update: jest.fn((updater) => {
        value = updater(value);
        subscribers.forEach(callback => callback(value));
      }),
      get: jest.fn(() => value),
    };
  }),
  get: jest.fn((store) => store.get()),
}));

import { get } from 'svelte/store';
import {
  raffleStore,
  resetRaffle,
  setCSVData,
  setEntries,
  updateRaffleState,
  type RaffleEntry,
  type RaffleWinner,
  type RaffleState,
} from '../../src/lib/stores/raffle';

describe('Raffle Store', () => {
  const initialState: RaffleState = {
    csvData: null,
    columnMapping: {
      name: '',
      email: '',
      tickets: '',
      prize: '',
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
    step: 'upload',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const state = get(raffleStore);
      expect(state).toEqual(initialState);
    });

    test('should have correct default values', () => {
      const state = get(raffleStore);
      expect(state.step).toBe('upload');
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.spinDuration).toBe(3000);
      expect(state.winners).toEqual([]);
      expect(state.entries).toEqual([]);
      expect(state.csvPrizes).toEqual([]);
      expect(state.prizeWinnerCounts).toEqual({});
    });
  });

  describe('resetRaffle', () => {
    test('should reset store to initial state', () => {
      // First modify the state
      updateRaffleState({
        isRunning: true,
        currentWinner: 'John Doe',
        winners: [{ name: 'John Doe', timestamp: '2023-01-01', prize: 'Prize 1' }],
        step: 'raffle',
      });

      // Verify it changed
      let state = get(raffleStore);
      expect(state.isRunning).toBe(true);
      expect(state.currentWinner).toBe('John Doe');
      expect(state.step).toBe('raffle');

      // Reset it
      resetRaffle();

      // Verify it's back to initial state
      state = get(raffleStore);
      expect(state).toEqual(initialState);
    });

    test('should call store.set with initial state', () => {
      resetRaffle();
      expect(raffleStore.set).toHaveBeenCalledWith(initialState);
    });
  });

  describe('setCSVData', () => {
    test('should update csvData, columnMapping, and set step to configure', () => {
      const mockCSVData = [
        { name: 'John Doe', email: 'john@example.com', tickets: '3' },
        { name: 'Jane Smith', email: 'jane@example.com', tickets: '1' },
      ];

      const mockColumnMapping = {
        name: 'name',
        email: 'email',
        tickets: 'tickets',
        prize: '',
      };

      setCSVData(mockCSVData, mockColumnMapping);

      expect(raffleStore.update).toHaveBeenCalledWith(expect.any(Function));

      // Test the update function
      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result).toEqual({
        ...initialState,
        csvData: mockCSVData,
        columnMapping: mockColumnMapping,
        step: 'configure',
      });
    });

    test('should preserve other state when updating csvData', () => {
      const existingState = {
        ...initialState,
        isRunning: true,
        currentWinner: 'Existing Winner',
      };

      const mockCSVData = [{ name: 'Test User' }];
      const mockColumnMapping = { name: 'name', email: '', tickets: '', prize: '' };

      setCSVData(mockCSVData, mockColumnMapping);

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(existingState);

      expect(result.isRunning).toBe(true);
      expect(result.currentWinner).toBe('Existing Winner');
      expect(result.csvData).toBe(mockCSVData);
      expect(result.step).toBe('configure');
    });
  });

  describe('setEntries', () => {
    test('should update entries, entryPool, csvPrizes, prizeWinnerCounts, and set step to raffle', () => {
      const mockEntries: RaffleEntry[] = [
        { name: 'John Doe', email: 'john@example.com', tickets: 3 },
        { name: 'Jane Smith', email: 'jane@example.com', tickets: 1 },
      ];

      const mockEntryPool = ['John Doe', 'John Doe', 'John Doe', 'Jane Smith'];
      const mockCSVPrizes = ['Prize 1', 'Prize 2'];
      const mockPrizeWinnerCounts = { 'Prize 1': 2, 'Prize 2': 1 };

      setEntries(mockEntries, mockEntryPool, mockCSVPrizes, mockPrizeWinnerCounts);

      expect(raffleStore.update).toHaveBeenCalledWith(expect.any(Function));

      // Test the update function
      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result).toEqual({
        ...initialState,
        entries: mockEntries,
        entryPool: mockEntryPool,
        csvPrizes: mockCSVPrizes,
        prizeWinnerCounts: mockPrizeWinnerCounts,
        step: 'raffle',
      });
    });

    test('should preserve other state when setting entries', () => {
      const existingState = {
        ...initialState,
        csvData: 'existing data',
        currentWinner: 'Existing Winner',
      };

      const mockEntries: RaffleEntry[] = [{ name: 'Test User' }];
      const mockEntryPool = ['Test User'];
      const mockCSVPrizes: string[] = [];
      const mockPrizeWinnerCounts = {};

      setEntries(mockEntries, mockEntryPool, mockCSVPrizes, mockPrizeWinnerCounts);

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(existingState);

      expect(result.csvData).toBe('existing data');
      expect(result.currentWinner).toBe('Existing Winner');
      expect(result.entries).toBe(mockEntries);
      expect(result.step).toBe('raffle');
    });
  });

  describe('updateRaffleState', () => {
    test('should update specific state properties', () => {
      const updates = {
        isRunning: true,
        currentWinner: 'John Doe',
        currentPrize: 'First Prize',
      };

      updateRaffleState(updates);

      expect(raffleStore.update).toHaveBeenCalledWith(expect.any(Function));

      // Test the update function
      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result).toEqual({
        ...initialState,
        isRunning: true,
        currentWinner: 'John Doe',
        currentPrize: 'First Prize',
      });
    });

    test('should handle partial updates', () => {
      updateRaffleState({ isPaused: true });

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result).toEqual({
        ...initialState,
        isPaused: true,
      });
    });

    test('should handle empty updates', () => {
      updateRaffleState({});

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result).toEqual(initialState);
    });

    test('should handle complex state updates', () => {
      const existingState = {
        ...initialState,
        entries: [{ name: 'Existing User' }],
        winners: [{ name: 'Winner 1', timestamp: '2023-01-01', prize: 'Prize 1' }],
      };

      const updates = {
        winners: [
          { name: 'Winner 1', timestamp: '2023-01-01', prize: 'Prize 1' },
          { name: 'Winner 2', timestamp: '2023-01-02', prize: 'Prize 2' },
        ],
        currentPrizeIndex: 1,
        currentWinnerInPrize: 0,
      };

      updateRaffleState(updates);

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(existingState);

      expect(result.entries).toEqual(existingState.entries); // Preserved
      expect(result.winners).toEqual(updates.winners); // Updated
      expect(result.currentPrizeIndex).toBe(1); // Updated
      expect(result.currentWinnerInPrize).toBe(0); // Updated
    });

    test('should handle array and object updates correctly', () => {
      const newWinners: RaffleWinner[] = [
        { name: 'Winner 1', timestamp: '2023-01-01', prize: 'Prize 1' },
        { name: 'Winner 2', timestamp: '2023-01-02', prize: 'Prize 2' },
      ];

      const newPrizeCounts = { 'Prize 1': 1, 'Prize 2': 1 };

      updateRaffleState({
        winners: newWinners,
        prizeWinnerCounts: newPrizeCounts,
      });

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result.winners).toBe(newWinners);
      expect(result.prizeWinnerCounts).toBe(newPrizeCounts);
    });

    test('should handle step transitions', () => {
      // Test each step transition
      const steps: Array<RaffleState['step']> = ['upload', 'configure', 'raffle'];

      steps.forEach(step => {
        updateRaffleState({ step });

        const updateFunction = (raffleStore.update as jest.Mock).mock.calls.slice(-1)[0][0];
        const result = updateFunction(initialState);

        expect(result.step).toBe(step);
      });
    });
  });

  describe('Data Types and Interfaces', () => {
    test('should handle RaffleEntry with all properties', () => {
      const entry: RaffleEntry = {
        name: 'John Doe',
        email: 'john@example.com',
        tickets: 5,
        prize: 'Special Prize',
        originalData: { id: 123, extra: 'data' },
      };

      updateRaffleState({ entries: [entry] });

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result.entries[0]).toEqual(entry);
    });

    test('should handle RaffleEntry with minimal properties', () => {
      const entry: RaffleEntry = {
        name: 'Jane Smith',
      };

      updateRaffleState({ entries: [entry] });

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result.entries[0]).toEqual(entry);
    });

    test('should handle RaffleWinner with all properties', () => {
      const winner: RaffleWinner = {
        name: 'John Doe',
        prize: 'Grand Prize',
        timestamp: '2023-01-01T12:00:00Z',
        email: 'john@example.com',
      };

      updateRaffleState({ winners: [winner] });

      const updateFunction = (raffleStore.update as jest.Mock).mock.calls[0][0];
      const result = updateFunction(initialState);

      expect(result.winners[0]).toEqual(winner);
    });
  });
});