<script lang="ts">
  import { onMount } from 'svelte';
  import { isAuthenticated, user, loginWithPopup, logout } from '../lib/auth';
  import CSVUpload from '../components/CSVUpload.svelte';
  import WinnerWheel from '../components/WinnerWheel.svelte';
  import WinnersTable from '../components/WinnersTable.svelte';
  import RaffleControls from '../components/RaffleControls.svelte';
  import { saveRaffleRun } from '../lib/api';
  import { extractPrizesFromEntries } from '../utils/csv';
  
  // SMUI Components
  import Card from '@smui/card';
  import TopAppBar from '@smui/top-app-bar';
  import Paper from '@smui/paper';
  
  let entries: Array<{name: string; email?: string; tickets?: number; prize?: string}> = [];
  let csvPrizes: string[] = [];
  let entryPool: string[] = [];
  let winners: Array<{name: string; prize?: string; timestamp: string; email?: string}> = [];
  let isRunning = false;
  let isPaused = false;
  let currentWinner = '';
  let currentPrize = '';
  let winnerWheelComponent: WinnerWheel;
  let prizes: string[] = [];
  let currentPrizeIndex = 0;
  let winnersPerPrize = 1;
  let currentWinnerInPrize = 0;
  let spinDuration = 3000; // Default 3 seconds
  
  onMount(() => {
    // App is ready
  });

  async function handleEntriesLoaded(event: CustomEvent) {
    const { entries: loadedEntries, pool } = event.detail;
    entries = loadedEntries;
    entryPool = pool;
    
    // Extract unique prizes from CSV
    csvPrizes = extractPrizesFromEntries(loadedEntries);
  }

  async function handleRaffleStart(event: CustomEvent) {
    const { prizes: selectedPrizes, totalWinners, spinDuration: duration } = event.detail;
    if (duration) spinDuration = duration;
    
    prizes = selectedPrizes;
    winnersPerPrize = totalWinners;
    currentPrizeIndex = 0;
    currentWinnerInPrize = 0;
    winners = [];
    
    isRunning = true;
    isPaused = false;
    
    await drawNextWinner();
  }

  async function drawNextWinner() {
    if (isPaused || !isRunning) return;
    
    // Check if we've completed all winners
    if (currentPrizeIndex >= prizes.length) {
      isRunning = false;
      await saveResults();
      return;
    }
    
    currentPrize = prizes[currentPrizeIndex];
    
    // Select winner from pool
    const availableEntries = entryPool.filter(name => 
      !winners.some(w => w.name === name && w.prize === currentPrize)
    );
    
    if (availableEntries.length === 0) {
      // Move to next prize if no more entries available
      currentPrizeIndex++;
      currentWinnerInPrize = 0;
      await drawNextWinner();
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableEntries.length);
    currentWinner = availableEntries[randomIndex];
    
    // Start wheel animation
    if (winnerWheelComponent) {
      await winnerWheelComponent.spin();
    }
    
    // Add winner to list
    const entry = entries.find(e => e.name === currentWinner);
    winners = [...winners, {
      name: currentWinner,
      prize: currentPrize,
      timestamp: new Date().toISOString(),
      email: entry?.email
    }];
    
    currentWinnerInPrize++;
    
    // Check if we need more winners for this prize
    if (currentWinnerInPrize < winnersPerPrize) {
      // 2-second pause before next winner for same prize
      await new Promise(resolve => setTimeout(resolve, 2000));
      await drawNextWinner();
    } else {
      // Move to next prize
      currentPrizeIndex++;
      currentWinnerInPrize = 0;
      
      if (currentPrizeIndex < prizes.length) {
        // 3-second pause before next prize
        await new Promise(resolve => setTimeout(resolve, 3000));
        await drawNextWinner();
      } else {
        // All done
        isRunning = false;
        await saveResults();
      }
    }
  }

  function handlePause() {
    isPaused = true;
  }

  function handleResume() {
    isPaused = false;
    drawNextWinner();
  }

  function handleReset() {
    isRunning = false;
    isPaused = false;
    winners = [];
    currentWinner = '';
    currentPrize = '';
    currentPrizeIndex = 0;
    currentWinnerInPrize = 0;
    if (winnerWheelComponent) {
      winnerWheelComponent.reset();
    }
  }

  async function saveResults() {
    if (winners.length === 0) return;
    
    try {
      await saveRaffleRun({
        entries,
        winners: winners.map(w => ({
          name: w.name,
          email: w.email,
          prize: w.prize || 'Prize',
          timestamp: w.timestamp
        }))
      });
      console.log('Raffle results saved successfully');
    } catch (error) {
      console.error('Failed to save raffle results:', error);
    }
  }
</script>

{#if !$isAuthenticated}
  <!-- SMUI Login Screen -->
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
    <Card style="max-width: 28rem; width: 100%; padding: 2rem;">
        <div class="text-center">
          <div class="w-16 h-16 primary rounded-full flex items-center justify-center text-3xl mb-6 mx-auto">🎲</div>
          <h1 class="text-3xl font-medium text-gray-900 mb-2">Raffle Winner Picker</h1>
          <p class="text-gray-600 mb-8 leading-relaxed">
            Create fair, transparent raffles with spinning wheel animations and automatic result tracking.
          </p>
          
          <button 
            class="w-full primary elevation-2 hover:elevation-4 font-medium py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02]"
            on:click={loginWithPopup}
          >
            <span class="flex items-center justify-center space-x-2">
              <span>🔐</span>
              <span>Sign In to Continue</span>
            </span>
          </button>
          
          <p class="text-sm text-gray-500 mt-6">
            Powered by Auth0 • Secure & Private
          </p>
        </div>
    </Card>
  </div>
{:else}
  <!-- SMUI Main Application -->
  <div class="min-h-screen bg-gray-50">
    <!-- SMUI Top App Bar -->
    <TopAppBar style="background-color: #1976d2; color: white;">
      <div class="flex justify-between items-center h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 primary-light rounded-full flex items-center justify-center text-xl">🎲</div>
          <div>
            <h1 class="text-xl font-medium">Raffle Winner Picker</h1>
            <div class="text-xs opacity-80">Fair & Transparent Drawings</div>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <div class="text-right">
            <div class="text-sm font-medium">{$user?.name || 'User'}</div>
            <div class="text-xs opacity-80">{$user?.email || ''}</div>
          </div>
          <button 
            class="text-white border border-white hover:bg-white hover:text-blue-600 px-3 py-2 rounded-lg transition-all text-sm font-medium"
            on:click={logout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </TopAppBar>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style="margin-top: 64px;">
      {#if entries.length === 0}
        <!-- Upload Phase -->
        <div class="max-w-2xl mx-auto">
          <CSVUpload on:entriesLoaded={handleEntriesLoaded} />
        </div>
      {:else}
        <!-- Drawing Phase -->
        <div class="space-y-8">
          <!-- Controls Section -->
          <div class="max-w-4xl mx-auto">
            <RaffleControls 
              hasEntries={entries.length > 0}
              {isRunning}
              {isPaused}
              winnersCount={winners.length}
              totalWinners={winnersPerPrize * prizes.length}
              {csvPrizes}
              on:start={handleRaffleStart}
              on:pause={handlePause}
              on:resume={handleResume}
              on:reset={handleReset}
            />
            
            {#if currentPrize && isRunning}
              <div class="mt-6 text-center">
                <Card style="padding: 1.5rem; border-left: 4px solid #1976d2; border: 1px solid #e0e0e0;">
                    <div class="w-12 h-12 primary-light rounded-full flex items-center justify-center text-2xl mx-auto mb-3">🎯</div>
                    <div class="text-xl font-medium text-gray-900 mb-2">
                      Drawing for: <span class="primary-dark font-semibold">{currentPrize}</span>
                    </div>
                    <div class="text-sm text-gray-600">
                      Winner {currentWinnerInPrize + 1} of {winnersPerPrize}
                    </div>
                </Card>
              </div>
            {/if}
          </div>

          <!-- Main Game Area: Terminal + Winners Side by Side -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <!-- Left: Terminal and Stats -->
            <div class="space-y-6">
              <!-- Retro Terminal -->
              <WinnerWheel 
                bind:this={winnerWheelComponent}
                names={entryPool}
                winner={currentWinner}
                {spinDuration}
              />
              
              <!-- Entry Stats -->
                <Paper elevation={2} style="padding: 1.5rem; border-radius: 1rem;">
                <div class="flex items-center space-x-2 mb-4 justify-center">
                  <div class="w-6 h-6 primary rounded-full flex items-center justify-center text-white text-sm">📊</div>
                  <h3 class="text-lg font-medium text-gray-900">Statistics</h3>
                </div>
                <div class="grid grid-cols-3 gap-4 text-center">
                    <Paper elevation={1} style="padding: 1rem; border-radius: 0.75rem;">
                      <div class="text-3xl font-bold text-blue-600 mb-1">{entries.length}</div>
                      <div class="text-xs text-gray-600 uppercase tracking-wide">Participants</div>
                    </Paper>
                    <Paper elevation={1} style="padding: 1rem; border-radius: 0.75rem;">
                      <div class="text-3xl font-bold text-green-600 mb-1">{entryPool.length}</div>
                      <div class="text-xs text-gray-600 uppercase tracking-wide">Pool Entries</div>
                    </Paper>
                    <Paper elevation={1} style="padding: 1rem; border-radius: 0.75rem;">
                      <div class="text-3xl font-bold text-purple-600 mb-1">{winners.length}</div>
                      <div class="text-xs text-gray-600 uppercase tracking-wide">Winners</div>
                    </Paper>
                </div>
                </Paper>
            </div>
            
            <!-- Right: Winners Table -->
            <div>
              <WinnersTable 
                {winners}
                isComplete={!isRunning && winners.length > 0}
              />
            </div>
          </div>
        </div>
      {/if}
    </main>
  </div>
{/if}

<style>
  /* Additional custom styles if needed */
</style>