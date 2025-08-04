<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  
  const dispatch = createEventDispatcher();
  
  export let hasEntries = false;
  export let isRunning = false;
  export let isPaused = false;
  export let winnersCount = 0;
  export let csvPrizes: string[] = [];
  export let isComplete = false;
  
  let prizes: string[] = [];
  let newPrize = '';
  let useCsvPrizes = false;
  let spinDurationSeconds = 3;
  
  // Auto-populate prizes from CSV when available
  $: if (csvPrizes.length > 0 && prizes.length === 0) {
    useCsvPrizes = true;
    prizes = [...csvPrizes];
  }

  function addPrize() {
    if (newPrize.trim() && !prizes.includes(newPrize.trim())) {
      prizes = [...prizes, newPrize.trim()];
      newPrize = '';
    }
  }

  function removePrize(index: number) {
    prizes = prizes.filter((_, i) => i !== index);
  }

  function startRaffle() {
    if (prizes.length === 0) {
      prizes = ['Grand Prize'];
    }
    dispatch('start', { prizes, spinDuration: spinDurationSeconds * 1000 });
  }

  function pauseRaffle() {
    dispatch('pause');
  }

  function resumeRaffle() {
    dispatch('resume');
  }

  function resetRaffle() {
    dispatch('reset');
  }


  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      addPrize();
    }
  }

  function adjustDuration(value: number) {
    spinDurationSeconds = Math.max(1, Math.min(10, value));
  }
</script>

<div class="raffle-controls">

  {#if isComplete}
    <!-- Completed Phase -->
    <div class="completed-phase">
      <div class="completion-status">
        <div class="completion-left">
          <div class="completion-icon">🎉</div>
          <span class="completion-label">Raffle Complete!</span>
        </div>
        <div class="completion-right">
          <span class="scoreboard-label">Total Winners:</span>
          <span class="scoreboard-count">{winnersCount}</span>
        </div>
      </div>
    </div>
  {:else if !isRunning}
    <!-- Setup Phase -->
    <div class="setup-phase">
      <!-- Prize Setup -->
      <div>
        <div class="prize-setup-section">
          <div class="prize-header">
            <span class="prize-label">Prizes Setup</span>
            {#if csvPrizes.length > 0}
              <div class="csv-toggle">
                <label class="toggle-label">
                  <input 
                    type="checkbox" 
                    bind:checked={useCsvPrizes} 
                    on:change={() => {
                      if (useCsvPrizes) {
                        prizes = [...csvPrizes];
                      } else {
                        prizes = [];
                      }
                    }} 
                    class="toggle-checkbox"
                  >
                  <span class="toggle-text">Use prizes from CSV ({csvPrizes.length} found)</span>
                </label>
              </div>
            {/if}
          </div>
        
          {#if csvPrizes.length > 0 && useCsvPrizes}
            <div class="csv-prizes-container">
              <div class="csv-prizes-title">Prizes from CSV:</div>
              <div class="prizes-list">
                {#each csvPrizes as prize}
                  <span class="prize-tag">
                    {prize}
                  </span>
                {/each}
              </div>
            </div>
          {:else}
            <div class="prize-help-text">
              Add custom prizes (optional - defaults to "Grand Prize")
            </div>
          {/if}
        </div>
        
        {#if !useCsvPrizes || csvPrizes.length === 0}
          <div class="custom-prize-section">
            <div class="prize-input-row">
              <input
                type="text"
                bind:value={newPrize}
                on:keydown={handleKeydown}
                placeholder="Enter prize name"
                class="prize-input"
              />
              <button
                class="add-prize-btn"
                class:disabled={!newPrize.trim()}
                on:click={addPrize}
                disabled={!newPrize.trim()}
              >
                Add
              </button>
            </div>

            {#if prizes.length > 0}
              <div class="custom-prizes-list">
                {#each prizes as prize, index}
                  <div class="custom-prize-tag">
                    <span class="prize-name">{prize}</span>
                    <button
                      class="remove-prize-btn"
                      on:click={() => removePrize(index)}
                    >
                      ×
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Spin Duration Configuration -->
      <div class="duration-config">
        <label class="config-label" for="duration-config">Spin Duration</label>
        <div class="numeric-input-container">
          <div id="duration-config" class="numeric-display">
            <span class="numeric-value">{spinDurationSeconds}</span>
            <span class="numeric-unit">seconds</span>
          </div>
          <div class="numeric-pad">
            <button class="num-btn" on:click={() => adjustDuration(1)}>1s</button>
            <button class="num-btn" on:click={() => adjustDuration(2)}>2s</button>
            <button class="num-btn" on:click={() => adjustDuration(3)}>3s</button>
            <button class="num-btn" on:click={() => adjustDuration(5)}>5s</button>
            <button class="num-btn" on:click={() => adjustDuration(10)}>10s</button>
            <button class="num-btn clear-btn" on:click={() => spinDurationSeconds = 3}>↺</button>
          </div>
        </div>
      </div>

      <!-- Start Button -->
      <button class="btn-start" class:disabled={!hasEntries} on:click={startRaffle} disabled={!hasEntries}>
        {#if hasEntries}
          🚀 Start Raffle
        {:else}
          📋 Upload Entries First
        {/if}
      </button>
    </div>
  {:else}
    <!-- Running Phase -->
    <div class="running-phase">

      <div class="control-buttons">
        {#if isPaused}
          <button class="btn-primary" on:click={resumeRaffle}>
            ▶️ Resume
          </button>
        {:else}
          <button class="btn-warning" on:click={pauseRaffle}>
            ⏸️ Pause
          </button>
        {/if}
        
        <button class="btn-secondary" on:click={resetRaffle}>
          🔄 Reset
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Component Styles */
  .raffle-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .setup-phase {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .duration-config {
    width: 100%;
  }

  .running-phase {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex-shrink: 0;
  }


  .scoreboard-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .scoreboard-count {
    font-family: 'Courier New', 'Monaco', monospace;
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e40af;
    background: linear-gradient(145deg, #dbeafe, #bfdbfe);
    border: 1px solid #93c5fd;
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    min-width: 2rem;
    text-align: center;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Completed Phase Styles */
  .completed-phase {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .completion-status {
    background: linear-gradient(145deg, #f0fdf4, #dcfce7);
    border: 1px solid #bbf7d0;
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .completion-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .completion-icon {
    font-size: 1rem;
    animation: pulse 2s infinite;
  }

  .completion-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #15803d;
  }

  .completion-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }


  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .control-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  /* Numeric Input Styles */
  .config-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .numeric-input-container {
    background: linear-gradient(145deg, #f8fafc, #ffffff);
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .numeric-display {
    text-align: center;
    margin-bottom: 0.75rem;
    padding: 0.5rem;
    background: linear-gradient(145deg, #ffffff, #f1f5f9);
    border-radius: 0.375rem;
    border: 1px solid #e2e8f0;
  }

  .numeric-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e40af;
    display: block;
    line-height: 1;
  }

  .numeric-unit {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
    display: block;
  }

  .numeric-pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.375rem;
  }

  .num-btn {
    background: linear-gradient(145deg, #ffffff, #f1f5f9);
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    padding: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .num-btn:hover {
    background: linear-gradient(145deg, #f3f4f6, #e5e7eb);
    border-color: #9ca3af;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .num-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .clear-btn {
    background: linear-gradient(145deg, #fef2f2, #fee2e2);
    border-color: #fca5a5;
    color: #dc2626;
  }

  .clear-btn:hover {
    background: linear-gradient(145deg, #fee2e2, #fecaca);
    border-color: #f87171;
  }

  /* Button Styles */
  .btn-start, .btn-primary, .btn-warning, .btn-secondary {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-start:hover, .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
  }

  .btn-warning {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
  }

  .btn-warning:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
  }

  .btn-secondary {
    background: linear-gradient(135deg, #6b7280, #4b5563);
    box-shadow: 0 4px 14px rgba(107, 114, 128, 0.3);
  }

  .btn-secondary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
  }

  .btn-start.disabled {
    background: linear-gradient(135deg, #e5e7eb, #d1d5db);
    color: #9ca3af;
    cursor: not-allowed;
    box-shadow: none;
  }

  .btn-start.disabled:hover {
    transform: none;
    box-shadow: none;
  }

  /* Prize Setup Styles */
  .prize-setup-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .prize-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .prize-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .csv-toggle {
    display: flex;
    align-items: center;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .toggle-checkbox {
    width: 1rem;
    height: 1rem;
    accent-color: #7c3aed;
    cursor: pointer;
  }

  .toggle-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #7c3aed;
  }

  .csv-prizes-container {
    background: linear-gradient(145deg, #f3e8ff, #ede9fe);
    border: 1px solid #d8b4fe;
    border-radius: 0.5rem;
    padding: 0.75rem;
  }

  .csv-prizes-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b21a8;
    margin-bottom: 0.5rem;
  }

  .prizes-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .prize-tag {
    background: linear-gradient(135deg, #a855f7, #9333ea);
    color: white;
    padding: 0.375rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(168, 85, 247, 0.2);
  }

  .prize-help-text {
    font-size: 0.875rem;
    color: #64748b;
    font-style: italic;
  }

  .custom-prize-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .prize-input-row {
    display: flex;
    gap: 0.75rem;
  }

  .prize-input {
    flex: 1;
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    padding: 0.75rem;
    font-size: 0.875rem;
    color: #374151;
    transition: all 0.2s ease;
  }

  .prize-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .add-prize-btn {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
  }

  .add-prize-btn:hover:not(.disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  }

  .add-prize-btn.disabled {
    background: linear-gradient(135deg, #e5e7eb, #d1d5db);
    color: #9ca3af;
    cursor: not-allowed;
    box-shadow: none;
  }

  .custom-prizes-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .custom-prize-tag {
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    border: 1px solid #93c5fd;
    color: #1e40af;
    padding: 0.375rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .prize-name {
    flex: 1;
  }

  .remove-prize-btn {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-weight: 600;
    padding: 0.125rem;
    border-radius: 50%;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .remove-prize-btn:hover {
    background: #3b82f6;
    color: white;
  }

  @media (max-width: 768px) {
    .prize-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
  }
</style>