<script lang="ts">
  import { onMount } from 'svelte';
  import { isAuthenticated, user, loginWithPopup, logout } from '../lib/auth';
  import CSVUpload from '../components/CSVUpload.svelte';
  import WinnerWheel from '../components/WinnerWheel.svelte';
  import WinnersTable from '../components/WinnersTable.svelte';
  import RaffleControls from '../components/RaffleControls.svelte';
  import { saveRaffleRun } from '../lib/api';
  import { extractPrizesFromEntries } from '../utils/csv';
  
  
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
  let prizeWinnerCounts: Record<string, number> = {};
  let currentWinnerInPrize = 0;
  let spinDuration = 3000; // Default 3 seconds
  
  onMount(() => {
    // App is ready
  });

  async function handleEntriesLoaded(event: CustomEvent) {
    console.log('handleEntriesLoaded called with event:', event.detail);
    const { entries: loadedEntries, pool, prizeWinnerCounts: counts } = event.detail;
    entries = loadedEntries;
    entryPool = pool;
    prizeWinnerCounts = counts || {};
    
    // Extract unique prizes from CSV
    csvPrizes = extractPrizesFromEntries(loadedEntries);
    console.log('Entries loaded successfully:', { entriesCount: entries.length, poolSize: entryPool.length, prizeWinnerCounts });
  }

  async function handleRaffleStart(event: CustomEvent) {
    const { prizes: selectedPrizes, spinDuration: duration } = event.detail;
    if (duration) spinDuration = duration;
    
    prizes = selectedPrizes;
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
    
    // Get winner count for current prize
    const winnersNeeded = prizeWinnerCounts[currentPrize] || 1;
    
    // Check if we need more winners for this prize
    if (currentWinnerInPrize < winnersNeeded) {
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

  function handleNewRaffle() {
    // Reset everything and go back to upload screen
    entries = [];
    csvPrizes = [];
    entryPool = [];
    winners = [];
    isRunning = false;
    isPaused = false;
    currentWinner = '';
    currentPrize = '';
    prizes = [];
    currentPrizeIndex = 0;
    prizeWinnerCounts = {};
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
  <!-- Sign In Screen -->
  <div class="sign-in-container">
    <div class="sign-in-panel">
      <div class="sign-in-header">
        <div class="app-logo">🎲</div>
        <h1 class="app-name">Raffle Winner Picker</h1>
        <p class="app-description">
          Create fair, transparent raffles with spinning wheel animations and automatic result tracking.
        </p>
      </div>
      
      <div class="sign-in-content">
        <button class="sign-in-button" on:click={loginWithPopup}>
          <span class="sign-in-icon">🔐</span>
          <span>Sign In to Continue</span>
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- SMUI Main Application -->
  <div class="min-h-screen bg-gray-50">
    <!-- Modern Header -->
    <header class="header-modern">
      <div class="header-content">
        <div class="header-brand">
          <div class="brand-icon">
            <div class="dice-icon">🎲</div>
          </div>
          <div class="brand-text">
            <h1 class="brand-title">Raffle Winner Picker</h1>
            <div class="brand-subtitle">Fair & Transparent Drawings</div>
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

    <main class="main-content" class:drawing-phase={entries.length > 0}>
      {#if entries.length === 0}
        <!-- Upload Phase -->
        <div class="upload-container-wrapper">
          <CSVUpload on:entriesLoaded={handleEntriesLoaded} />
        </div>
      {:else}
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
                  names={entryPool}
                  winner={currentWinner}
                  {spinDuration}
                />
                
                <!-- Status Boxes -->
                <div class="status-boxes">
                  <!-- Left: Status Display -->
                  <div class="status-box">
                    {#if isRunning}
                      <div class="status-content running">
                        <div class="status-spinner">⚡</div>
                        <span class="status-label">Raffle in Progress</span>
                      </div>
                    {:else if winners.length > 0}
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
                      <div class="count-number">{winners.length}</div>
                      <span class="count-label">Winners Selected</span>
                    </div>
                  </div>
                </div>
                
                {#if !isRunning && winners.length > 0}
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
                    hasEntries={entries.length > 0}
                    {isRunning}
                    {isPaused}
                    winnersCount={winners.length}
                    {csvPrizes}
                    isComplete={!isRunning && winners.length > 0}
                    on:start={handleRaffleStart}
                    on:pause={handlePause}
                    on:resume={handleResume}
                    on:reset={handleReset}
                  />
                  
                  <!-- Quick Stats -->
                  <div class="stats-row">
                    <div class="stat-item">
                      <span class="stat-value">{entries.length}</span>
                      <span class="stat-label">Participants</span>
                    </div>
                    <div class="stat-item">  
                      <span class="stat-value">{entryPool.length}</span>
                      <span class="stat-label">Pool</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-value">{winners.length}</span>
                      <span class="stat-label">Winners</span>
                    </div>
                  </div>
                </div>
                
                <!-- Winners List -->
                <div class="winners-container">
                  <WinnersTable 
                    {winners}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </main>
  </div>
{/if}

<style>
  /* Sign In Screen Styles */
  .sign-in-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .sign-in-panel {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e1e5e9;
    border-radius: 1.5rem;
    box-shadow: 
      0 20px 60px rgba(0, 0, 0, 0.15),
      0 8px 20px rgba(0, 0, 0, 0.1);
    padding: 3rem 2rem;
    max-width: 28rem;
    width: 100%;
    text-align: center;
  }

  .sign-in-header {
    margin-bottom: 2rem;
  }

  .app-logo {
    width: 4rem;
    height: 4rem;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin: 0 auto 1.5rem;
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
  }

  .app-name {
    font-size: 2rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 1rem 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .app-description {
    color: #64748b;
    font-size: 1rem;
    line-height: 1.6;
    margin: 0;
  }

  .sign-in-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .sign-in-button {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .sign-in-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
  }

  .sign-in-icon {
    font-size: 1.25rem;
  }

  @media (max-width: 768px) {
    .sign-in-panel {
      padding: 2rem 1.5rem;
      margin: 0 1rem;
    }
    
    .app-name {
      font-size: 1.75rem;
    }
    
    .app-description {
      font-size: 0.9375rem;
    }
  }

  /* Modern Header Styles */
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

  /* When in drawing phase, use fixed height and no overflow */
  .main-content.drawing-phase {
    height: calc(100vh - 50px);
    overflow: hidden;
  }

  .upload-container-wrapper {
    max-width: 500px;
    width: 100%;
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
  }
</style>