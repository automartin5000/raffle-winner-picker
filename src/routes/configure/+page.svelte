<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { raffleStore, setEntries } from '../../lib/stores/raffle';
  import { mapCSVData, createEntryPool, extractPrizesFromEntries, validatePrizeData } from '../../utils/csv';
  import { isAuthenticated, user, logout } from '../../lib/auth';

  let previewData: any[] = [];
  let mappedEntries: any[] = [];
  let extractedPrizes: string[] = [];
  let prizeWinnerCounts: Record<string, number> = {};
  let showPrizeConfig = false;
  let validationError: string = '';

  $: if ($raffleStore.csvData && $raffleStore.columnMapping) {
    updatePreview();
  }

  onMount(() => {
    // Redirect if no CSV data
    if (!$raffleStore.csvData) {
      goto('/');
      return;
    }
    
    // Check if we should go directly to prize config
    if ($page.url.searchParams.get('step') === 'prizes' && $raffleStore.csvPrizes.length > 0) {
      // Recreate the state for prize configuration
      mappedEntries = mapCSVData($raffleStore.csvData.data, $raffleStore.columnMapping);
      extractedPrizes = extractPrizesFromEntries(mappedEntries);
      prizeWinnerCounts = { ...$raffleStore.prizeWinnerCounts };
      showPrizeConfig = true;
    } else {
      updatePreview();
    }
  });

  function updatePreview() {
    if (!$raffleStore.csvData) return;
    
    const mapped = mapCSVData($raffleStore.csvData.data, $raffleStore.columnMapping);
    previewData = mapped.slice(0, 5);
  }

  function confirmMapping() {
    if (!$raffleStore.csvData) return;
    
    // Validate prize data before proceeding
    const validation = validatePrizeData($raffleStore.csvData.data, $raffleStore.columnMapping);
    if (!validation.valid) {
      validationError = validation.error || 'Validation failed';
      return;
    }
    
    // Clear any previous validation errors
    validationError = '';
    
    mappedEntries = mapCSVData($raffleStore.csvData.data, $raffleStore.columnMapping);
    extractedPrizes = extractPrizesFromEntries(mappedEntries);
    
    // Initialize winner counts to 1 for each prize
    prizeWinnerCounts = {};
    extractedPrizes.forEach(prize => {
      prizeWinnerCounts[prize] = 1;
    });
    
    // If there are prizes, show prize configuration, otherwise go directly to raffle
    if (extractedPrizes.length > 0) {
      showPrizeConfig = true;
    } else {
      finalizePrizeConfig();
    }
  }
  
  function finalizePrizeConfig() {
    const entryPool = createEntryPool(mappedEntries);
    
    console.log('Finalizing prize config with counts:', prizeWinnerCounts);
    
    // Save to store with proper prize winner counts
    raffleStore.update(state => ({
      ...state,
      entries: mappedEntries,
      entryPool,
      csvPrizes: extractedPrizes,
      prizeWinnerCounts: { ...prizeWinnerCounts }, // Make sure to spread to create new object
      step: 'raffle'
    }));
    
    goto('/raffle');
  }

  function goBack() {
    if (showPrizeConfig) {
      showPrizeConfig = false;
    } else {
      goto('/');
    }
  }

  function updateColumnMapping(field: string, value: string) {
    raffleStore.update(state => ({
      ...state,
      columnMapping: {
        ...state.columnMapping,
        [field]: value
      }
    }));
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
            <h1 class="brand-title">Configure Raffle</h1>
            <div class="brand-subtitle">Map columns & set prizes</div>
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

    <main class="main-content">
      <div class="configure-container-wrapper">
        {#if !showPrizeConfig}
          <!-- Column Mapping Interface -->
          <div class="mapping-container">
            <div class="mapping-header">
              <div class="mapping-title">
                <span class="mapping-icon">🔗</span>
                <h2>Map CSV Columns</h2>
              </div>
            </div>
            
            <div class="mapping-grid">
              <div class="mapping-section">
                <h3 class="section-title">Column Mapping</h3>
                
                <div class="mapping-fields">
                  <div class="field-group">
                    <label class="field-label" for="name-select">
                      Participant Name (Required)
                    </label>
                    <select 
                      id="name-select" 
                      bind:value={$raffleStore.columnMapping.name} 
                      on:change={(e) => updateColumnMapping('name', e.target.value)}
                      class="field-select"
                    >
                      {#each $raffleStore.csvData.headers as header}
                        <option value={header}>{header}</option>
                      {/each}
                    </select>
                  </div>
                  
                  <div class="field-group">
                    <label class="field-label" for="email-select">
                      Email (Optional)
                    </label>
                    <select 
                      id="email-select" 
                      bind:value={$raffleStore.columnMapping.email}
                      on:change={(e) => updateColumnMapping('email', e.target.value)}
                      class="field-select"
                    >
                      <option value="">-- Not mapped --</option>
                      {#each $raffleStore.csvData.headers as header}
                        <option value={header}>{header}</option>
                      {/each}
                    </select>
                  </div>
                  
                  <div class="field-group">
                    <label class="field-label" for="tickets-select">
                      Ticket Count (Optional, defaults to 1)
                    </label>
                    <select 
                      id="tickets-select" 
                      bind:value={$raffleStore.columnMapping.tickets}
                      on:change={(e) => updateColumnMapping('tickets', e.target.value)}
                      class="field-select"
                    >
                      <option value="">-- Not mapped --</option>
                      {#each $raffleStore.csvData.headers as header}
                        <option value={header}>{header}</option>
                      {/each}
                    </select>
                  </div>
                  
                  <div class="field-group">
                    <label class="field-label" for="prize-select">
                      Prize Category (Optional)
                    </label>
                    <select 
                      id="prize-select" 
                      bind:value={$raffleStore.columnMapping.prize}
                      on:change={(e) => updateColumnMapping('prize', e.target.value)}
                      class="field-select"
                    >
                      <option value="">-- Not mapped --</option>
                      {#each $raffleStore.csvData.headers as header}
                        <option value={header}>{header}</option>
                      {/each}
                    </select>
                  </div>
                </div>
              </div>
              
              <div class="preview-section">
                <h3 class="section-title">Preview ({$raffleStore.csvData.data.length} total entries)</h3>
                
                <div class="preview-container">
                  {#each previewData as entry}
                    <div class="preview-entry">
                      <div class="entry-name">{entry.name}</div>
                      {#if entry.email}
                        <div class="entry-email">{entry.email}</div>
                      {/if}
                      {#if entry.tickets && entry.tickets > 1}
                        <div class="entry-tickets">{entry.tickets} tickets</div>
                      {/if}
                      {#if entry.prize}
                        <div class="entry-prize">Prize: {entry.prize}</div>
                      {/if}
                    </div>
                  {/each}
                  {#if $raffleStore.csvData.data.length > 5}
                    <div class="more-entries">
                      ... and {$raffleStore.csvData.data.length - 5} more entries
                    </div>
                  {/if}
                </div>
              </div>
            </div>
            
            {#if validationError}
              <div class="validation-error">
                <div class="error-icon">⚠️</div>
                <div class="error-content">
                  <div class="error-title">Validation Error</div>
                  <div class="error-message">{validationError}</div>
                </div>
              </div>
            {/if}
            
            <div class="mapping-actions">
              <button class="btn-cancel" on:click={goBack}>
                Cancel
              </button>
              <button class="btn-confirm" on:click={confirmMapping}>
                Load Entries ({$raffleStore.csvData.data.length})
              </button>
            </div>
          </div>

        {:else}
          <!-- Prize Configuration Interface -->
          <div class="prize-config-container">
            <div class="mapping-header">
              <div class="mapping-title">
                <span class="mapping-icon">🎯</span>
                <h2>Configure Winners per Prize</h2>
              </div>
            </div>
            
            <div class="prize-config-content">
              <p class="prize-config-description">
                Set how many winners should be selected for each prize category found in your CSV.
              </p>
              
              <div class="prizes-config-list">
                {#each extractedPrizes as prize}
                  <div class="prize-config-item">
                    <div class="prize-name-display">
                      <span class="prize-icon">🏆</span>
                      <span class="prize-name">{prize}</span>
                    </div>
                    <div class="winner-count-controls">
                      <label class="winner-count-label" for="winners-{prize}">Winners:</label>
                      <div class="winner-count-input">
                        <button 
                          class="count-btn decrease" 
                          on:click={() => prizeWinnerCounts[prize] = Math.max(1, prizeWinnerCounts[prize] - 1)}
                          disabled={prizeWinnerCounts[prize] <= 1}
                        >
                          −
                        </button>
                        <span class="count-display" id="winners-{prize}">{prizeWinnerCounts[prize]}</span>
                        <button 
                          class="count-btn increase" 
                          on:click={() => prizeWinnerCounts[prize] = Math.min(10, prizeWinnerCounts[prize] + 1)}
                          disabled={prizeWinnerCounts[prize] >= 10}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
            
            <div class="mapping-actions">
              <button class="btn-cancel" on:click={goBack}>
                Back
              </button>
              <button class="btn-confirm" on:click={finalizePrizeConfig}>
                Continue to Raffle
              </button>
            </div>
          </div>
        {/if}
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

  /* Main Content */
  .main-content {
    min-height: calc(100vh - 50px);
    padding: 2rem 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
  }

  .configure-container-wrapper {
    max-width: 800px;
    width: 100%;
  }

  /* Mapping Interface Styles */
  .mapping-container {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e1e5e9;
    border-radius: 1.5rem;
    padding: 2rem;
    box-shadow: 
      0 10px 25px rgba(0, 0, 0, 0.1),
      0 4px 10px rgba(0, 0, 0, 0.05);
  }

  .mapping-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .mapping-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .mapping-title h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .mapping-icon {
    font-size: 1.5rem;
  }

  .mapping-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .mapping-section, .preview-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .mapping-fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .field-select {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    padding: 0.75rem;
    font-size: 0.875rem;
    color: #374151;
    transition: all 0.2s ease;
  }

  .field-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .preview-container {
    background: linear-gradient(145deg, #f1f5f9, #e2e8f0);
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 1rem;
    max-height: 16rem;
    overflow-y: auto;
  }

  .preview-entry {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .preview-entry:last-child {
    margin-bottom: 0;
  }

  .entry-name {
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.25rem;
  }

  .entry-email {
    font-size: 0.875rem;
    color: #64748b;
  }

  .entry-tickets {
    font-size: 0.875rem;
    color: #3b82f6;
    font-weight: 500;
  }

  .entry-prize {
    font-size: 0.875rem;
    color: #7c3aed;
    font-weight: 500;
  }

  .more-entries {
    text-align: center;
    font-size: 0.875rem;
    color: #64748b;
    font-style: italic;
    margin-top: 0.5rem;
  }

  .mapping-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  .btn-cancel {
    background: none;
    border: 1px solid #d1d5db;
    color: #64748b;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .btn-cancel:hover {
    background: #f8fafc;
    border-color: #9ca3af;
    color: #374151;
  }

  .btn-confirm {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
  }

  .btn-confirm:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
  }

  /* Prize Configuration Interface Styles */
  .prize-config-container {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e1e5e9;
    border-radius: 1.5rem;
    padding: 2rem;
    box-shadow: 
      0 10px 25px rgba(0, 0, 0, 0.1),
      0 4px 10px rgba(0, 0, 0, 0.05);
  }

  .prize-config-content {
    margin-bottom: 2rem;
  }

  .prize-config-description {
    color: #64748b;
    font-size: 1rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .prizes-config-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 60vh;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  /* Custom scrollbar for prizes list */
  .prizes-config-list::-webkit-scrollbar {
    width: 8px;
  }

  .prizes-config-list::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .prizes-config-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .prizes-config-list::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .prize-config-item {
    background: linear-gradient(145deg, #f8fafc, #ffffff);
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .prize-name-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .prize-icon {
    font-size: 1.25rem;
  }

  .prize-name {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .winner-count-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .winner-count-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
  }

  .winner-count-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(145deg, #ffffff, #f1f5f9);
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    padding: 0.25rem;
  }

  .count-btn {
    background: linear-gradient(145deg, #f3f4f6, #e5e7eb);
    border: 1px solid #d1d5db;
    color: #374151;
    width: 2rem;
    height: 2rem;
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .count-btn:hover:not(:disabled) {
    background: linear-gradient(145deg, #e5e7eb, #d1d5db);
    transform: translateY(-1px);
  }

  .count-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .count-display {
    min-width: 2rem;
    text-align: center;
    font-weight: 600;
    color: #1e293b;
  }

  /* Validation Error Styles */
  .validation-error {
    background: linear-gradient(145deg, #fef2f2, #fee2e2);
    border: 2px solid #ef4444;
    border-radius: 0.75rem;
    padding: 1rem;
    margin-top: 1.5rem;
    display: flex;
    gap: 1rem;
    box-shadow: 0 4px 6px rgba(239, 68, 68, 0.1);
  }

  .error-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .error-content {
    flex: 1;
  }

  .error-title {
    font-size: 1rem;
    font-weight: 600;
    color: #991b1b;
    margin-bottom: 0.25rem;
  }

  .error-message {
    font-size: 0.875rem;
    color: #7f1d1d;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .mapping-container, .prize-config-container {
      padding: 1.5rem;
    }
    
    .mapping-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    
    .mapping-actions {
      flex-direction: column;
    }

    .back-text {
      display: none;
    }

    .user-info {
      display: none;
    }
  }
</style>