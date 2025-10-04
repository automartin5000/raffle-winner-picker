<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { raffleStore, resetRaffle, updateRaffleState } from '../../lib/stores/raffle';
  import { isAuthenticated, user, logout } from '../../lib/auth';
  import WinnerWheel from '../../components/WinnerWheel.svelte';
  import WinnersTable from '../../components/WinnersTable.svelte';
  import RaffleControls from '../../components/RaffleControls.svelte';
  import { saveRaffleRun } from '../../lib/api';
  import { extractPrizesFromEntries } from '../../utils/csv';

  let winnerWheelComponent: WinnerWheel;
  let prizes: string[] = [];

  // Compute the eligible pool for the current prize
  $: eligiblePoolForDisplay = (() => {
    if (!$raffleStore.currentPrize) return $raffleStore.entryPool;
    
    // Filter entries that are eligible for the current prize
    // All entries MUST have a prize field (validated at upload)
    const eligibleEntries = $raffleStore.entries.filter(entry => {
      return entry.prize === $raffleStore.currentPrize;
    });
    
    // Create pool from eligible entries (respecting ticket counts)
    const pool: string[] = [];
    eligibleEntries.forEach(entry => {
      const tickets = entry.tickets ?? 1;
      for (let i = 0; i < tickets; i++) {
        pool.push(entry.name);
      }
    });
    
    return pool;
  })();

  onMount(() => {
    // Redirect if no entries
    if ($raffleStore.entries.length === 0) {
      goto('/');
      return;
    }
    
    console.log('Raffle page loaded with prize winner counts:', $raffleStore.prizeWinnerCounts);
  });

  async function handleRaffleStart(event: CustomEvent) {
    const { prizes: selectedPrizes, spinDuration: duration } = event.detail;
    
    prizes = selectedPrizes;
    
    updateRaffleState({
      isRunning: true,
      isPaused: false,
      currentPrizeIndex: 0,
      currentWinnerInPrize: 0,
      winners: [],
      spinDuration: duration || $raffleStore.spinDuration
    });
    
    await drawNextWinner();
  }

  async function drawNextWinner() {
    if ($raffleStore.isPaused || !$raffleStore.isRunning) return;
    
    // Check if we've completed all winners
    if ($raffleStore.currentPrizeIndex >= prizes.length) {
      updateRaffleState({ isRunning: false });
      await saveResults();
      return;
    }
    
    const currentPrize = prizes[$raffleStore.currentPrizeIndex];
    
    // Filter entries that are eligible for this prize
    // All entries MUST have a prize field (validated at upload)
    const eligibleEntries = $raffleStore.entries.filter(entry => {
      return entry.prize === currentPrize;
    });
    
    // Create pool from eligible entries (respecting ticket counts)
    const eligiblePool: string[] = [];
    eligibleEntries.forEach(entry => {
      const tickets = entry.tickets || 1;
      for (let i = 0; i < tickets; i++) {
        eligiblePool.push(entry.name);
      }
    });
    
    // Filter out previous winners for this prize
    const availableEntries = eligiblePool.filter(name => 
      !$raffleStore.winners.some(w => w.name === name && w.prize === currentPrize)
    );
    
    if (availableEntries.length === 0) {
      // Move to next prize if no more entries available
      updateRaffleState({
        currentPrizeIndex: $raffleStore.currentPrizeIndex + 1,
        currentWinnerInPrize: 0
      });
      await drawNextWinner();
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableEntries.length);
    const currentWinner = availableEntries[randomIndex];
    
    updateRaffleState({
      currentWinner,
      currentPrize
    });
    
    // Start wheel animation
    if (winnerWheelComponent) {
      await winnerWheelComponent.spin();
    }
    
    // Add winner to list
    const entry = $raffleStore.entries.find(e => e.name === currentWinner);
    const newWinner = {
      name: currentWinner,
      prize: currentPrize,
      timestamp: new Date().toISOString(),
      email: entry?.email
    };
    
    updateRaffleState({
      winners: [...$raffleStore.winners, newWinner],
      currentWinnerInPrize: $raffleStore.currentWinnerInPrize + 1
    });
    
    // Get winner count for current prize
    const winnersNeeded = $raffleStore.prizeWinnerCounts[currentPrize] || 1;
    
    // Check if we need more winners for this prize
    if ($raffleStore.currentWinnerInPrize < winnersNeeded) {
      // 2-second pause before next winner for same prize
      await new Promise(resolve => setTimeout(resolve, 2000));
      await drawNextWinner();
    } else {
      // Move to next prize
      const nextPrizeIndex = $raffleStore.currentPrizeIndex + 1;
      updateRaffleState({
        currentPrizeIndex: nextPrizeIndex,
        currentWinnerInPrize: 0
      });
      
      if (nextPrizeIndex < prizes.length) {
        // 3-second pause before next prize
        await new Promise(resolve => setTimeout(resolve, 3000));
        await drawNextWinner();
      } else {
        // All done
        updateRaffleState({ isRunning: false });
        await saveResults();
      }
    }
  }

  function handlePause() {
    updateRaffleState({ isPaused: true });
  }

  function handleResume() {
    updateRaffleState({ isPaused: false });
    drawNextWinner();
  }

  function handleReset() {
    updateRaffleState({
      isRunning: false,
      isPaused: false,
      winners: [],
      currentWinner: '',
      currentPrize: '',
      currentPrizeIndex: 0,
      currentWinnerInPrize: 0
    });
    if (winnerWheelComponent) {
      winnerWheelComponent.reset();
    }
  }

  function handleNewRaffle() {
    // Reset everything and go back to upload screen
    resetRaffle();
    goto('/');
  }

  function goBack() {
    // If we have prizes with winner counts, go to prize config
    // Otherwise go to column mapping
    if ($raffleStore.csvPrizes.length > 0 && Object.keys($raffleStore.prizeWinnerCounts).length > 0) {
      // Set the flag to show prize config directly
      raffleStore.update(state => ({
        ...state,
        step: 'configure'
      }));
      goto('/configure?step=prizes');
    } else {
      goto('/configure');
    }
  }

  async function saveResults() {
    if ($raffleStore.winners.length === 0) return;
    
    try {
      const result = await saveRaffleRun({
        entries: $raffleStore.entries,
        winners: $raffleStore.winners.map(w => ({
          name: w.name,
          email: w.email,
          prize: w.prize || 'Prize',
          timestamp: w.timestamp
        }))
      });
      
      if (result.success) {
        console.log('Raffle results saved successfully');
      } else {
        console.error('Failed to save raffle results:', result.error);
      }
    } catch (error) {
      console.error('Failed to save raffle results:', error);
    }
  }
</script>

{#if !$isAuthenticated}
  <!-- Redirect to login -->
  <script>goto('/');</script>
{:else}
  <!-- Main Application -->
  <div class="min-h-screen bg-gray-50">
    <!-- Modern Header with Back Button -->
    <header class="header-modern">
      <div class="header-content">
        <div class="header-brand">
          <button class="back-button" on:click={goBack}>
            <span class="back-icon">←</span>
            <span class="back-text">Back</span>
          </button>
          <div class="brand-icon">
            <div class="dice-icon">🎲</div>
          </div>
          <div class="brand-text">
            <h1 class="brand-title">Raffle Drawing</h1>
            <div class="brand-subtitle">Select your winners</div>
          </div>
        </div>
        
        <div class="header-actions">
          <div class="user-info">
            <div class="user-avatar">
              {($user?.name || 'User').charAt(0).toUpperCase()}
            </div>
            <div class="user-details">
              <div class="user-name">{$user?.name || 'User'}</div>
              <div class="user-email">{$user?.email || ''}</div>
            </div>
          </div>
          <button class="sign-out-btn" on:click={logout}>
            <span class="sign-out-icon">↗</span>
            Sign Out
          </button>
        </div>
      </div>
    </header>

    <main class="main-content drawing-phase">
      <!-- Drawing Phase -->
      <div class="app-container">
        <!-- Main Content Grid -->
        <div class="main-grid">
          <!-- Left: Terminal App -->
          <div class="app-panel terminal-panel">
            <div class="app-header">
              <span class="app-title">🎲 Winner Selection</span>
            </div>
            <div class="app-content terminal-content">
              <WinnerWheel 
                bind:this={winnerWheelComponent}
                names={eligiblePoolForDisplay}
                winner={$raffleStore.currentWinner}
                prizeName={$raffleStore.currentPrize}
                spinDuration={$raffleStore.spinDuration}
              />
              
              <!-- Status Boxes -->
              <div class="status-boxes">
                <!-- Left: Status Display -->
                <div class="status-box">
                  {#if $raffleStore.isRunning}
                    <div class="status-content running">
                      <div class="status-spinner">⚡</div>
                      <span class="status-label">Raffle in Progress</span>
                    </div>
                  {:else if $raffleStore.winners.length > 0}
                    <div class="status-content complete">
                      <div class="status-icon">🎉</div>
                      <span class="status-label">Raffle Complete!</span>
                    </div>
                  {:else}
                    <div class="status-content ready">
                      <div class="status-icon">🎯</div>
                      <span class="status-label">Ready to Start</span>
                    </div>
                  {/if}
                </div>
                
                <!-- Right: Winner Count -->
                <div class="status-box">
                  <div class="status-content count">
                    <div class="count-number">{$raffleStore.winners.length}</div>
                    <span class="count-label">Winners Selected</span>
                  </div>
                </div>
              </div>
              
              {#if !$raffleStore.isRunning && $raffleStore.winners.length > 0}
                <div class="new-raffle-section">
                  <button class="btn-new-raffle-terminal" on:click={handleNewRaffle}>
                    🎲 Start New Raffle
                  </button>
                </div>
              {/if}
            </div>
          </div>
          
          <!-- Right: Control Panel -->
          <div class="app-panel control-panel-app">
            <div class="app-header">
              <span class="app-title">⚙️ Controls</span>
            </div>
            <div class="app-content controls-content">
              <div class="controls-section">
                <RaffleControls 
                  hasEntries={$raffleStore.entries.length > 0}
                  isRunning={$raffleStore.isRunning}
                  isPaused={$raffleStore.isPaused}
                  winnersCount={$raffleStore.winners.length}
                  csvPrizes={$raffleStore.csvPrizes}
                  isComplete={!$raffleStore.isRunning && $raffleStore.winners.length > 0}
                  on:start={handleRaffleStart}
                  on:pause={handlePause}
                  on:resume={handleResume}
                  on:reset={handleReset}
                />
                
                <!-- Quick Stats -->
                <div class="stats-row">
                  <div class="stat-item">
                    <span class="stat-value">{$raffleStore.entries.length}</span>
                    <span class="stat-label">Participants</span>
                  </div>
                  <div class="stat-item">  
                    <span class="stat-value">{$raffleStore.entryPool.length}</span>
                    <span class="stat-label">Pool</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{$raffleStore.winners.length}</span>
                    <span class="stat-label">Winners</span>
                  </div>
                </div>
              </div>
              
              <!-- Winners List -->
              <div class="winners-container">
                <WinnersTable 
                  winners={$raffleStore.winners}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
{/if}

<style>
  /* Header Styles */
  .header-modern {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 
      0 4px 20px rgba(0, 0, 0, 0.1),
      0 1px 3px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 1000;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-content {
    max-width: 80rem;
    margin: 0 auto;
    padding: 0.5rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .back-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.5rem 0.875rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .back-icon {
    font-size: 1rem;
  }

  .back-text {
    font-size: 0.875rem;
  }

  .brand-icon {
    width: 2.5rem;
    height: 2.5rem;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dice-icon {
    font-size: 1.5rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .brand-text {
    color: white;
  }

  .brand-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .brand-subtitle {
    font-size: 0.875rem;
    opacity: 0.9;
    font-weight: 300;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 2.5rem;
    height: 2.5rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .user-details {
    color: white;
    text-align: right;
  }

  .user-name {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .user-email {
    font-size: 0.75rem;
    opacity: 0.8;
    margin-top: 0.125rem;
  }

  .sign-out-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sign-out-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .sign-out-icon {
    font-size: 1rem;
    transform: rotate(45deg);
  }

  /* Main Content Styles */
  .main-content {
    min-height: calc(100vh - 50px);
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
  }

  /* Drawing phase should maintain fixed height */
  .main-content.drawing-phase {
    height: calc(100vh - 50px);
    overflow: hidden;
  }

  /* App Container Styles */
  .app-container {
    max-width: 1200px;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    flex: 1;
    min-height: 0;
    max-height: calc(100vh - 90px);
  }

  .app-panel {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e1e5e9;
    border-radius: 0.75rem;
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.06),
      0 1px 3px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .app-header {
    background: linear-gradient(135deg, #f8fafc, #e2e8f0);
    border-bottom: 1px solid #e1e5e9;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    flex-shrink: 0;
  }

  .app-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .app-content {
    flex: 1;
    padding: 0.5rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .terminal-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0.5rem 0.5rem 0.75rem 0.5rem;
    gap: 0.75rem;
  }
  
  .new-raffle-section {
    width: 100%;
    display: flex;
    justify-content: center;
  }
  
  .btn-new-raffle-terminal {
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .btn-new-raffle-terminal:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(124, 58, 237, 0.4);
  }

  /* Status Boxes Layout */
  .status-boxes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-top: 0.75rem;
    width: 100%;
  }

  .status-box {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e1e5e9;
    border-radius: 0.75rem;
    padding: 0.75rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .status-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    text-align: center;
  }

  .status-content.running {
    color: #2563eb;
  }

  .status-content.complete {
    color: #059669;
  }

  .status-content.ready {
    color: #64748b;
  }

  .status-content.count {
    color: #7c3aed;
  }

  .status-spinner {
    font-size: 1.5rem;
    animation: spin 1s linear infinite;
  }

  .status-icon {
    font-size: 1.5rem;
  }

  .status-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .count-number {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .count-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .controls-content {
    gap: 0.5rem;
    overflow: hidden;
    min-height: 0;
  }
  
  .controls-section {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stats-row {
    display: flex;
    gap: 0.375rem;
    margin: 0.5rem 0;
    padding: 0.375rem;
    background: linear-gradient(145deg, #f1f5f9, #e2e8f0);
    border-radius: 0.375rem;
    border: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .stat-item {
    flex: 1;
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 0.875rem;
    font-weight: 700;
    color: #1e40af;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.625rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.0625rem;
  }

  .winners-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .main-grid {
      grid-template-columns: 1fr;
      gap: 0.5rem;
      height: auto;
      max-height: none;
    }
    
    .app-panel {
      height: auto;
    }
    
    .header-content {
      padding: 0.375rem 0.75rem;
    }
    
    .brand-title {
      font-size: 1.125rem;
    }
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 0.5rem 0.75rem;
    }
    
    .brand-title {
      font-size: 1rem;
    }
    
    .user-info {
      display: none;
    }
    
    .app-container {
      padding: 0;
    }
    
    .app-content {
      padding: 0.5rem;
    }
    
    .main-content {
      padding: 0.125rem;
    }
    
    .main-grid {
      gap: 0.375rem;
    }

    .back-text {
      display: none;
    }
  }
</style>