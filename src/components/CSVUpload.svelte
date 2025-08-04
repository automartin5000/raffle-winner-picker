<script lang="ts">
  import { parseCSV, mapCSVData, createEntryPool, extractPrizesFromEntries } from '../utils/csv';
  import { createEventDispatcher } from 'svelte';
  
  // SMUI Components
  import Card from '@smui/card';
  import Select from '@smui/select';
  import Paper from '@smui/paper';

  const dispatch = createEventDispatcher();

  let fileInput: HTMLInputElement;
  let csvData: any = null;
  let showMapping = false;
  let showPrizeConfig = false;
  let columnMapping = {
    name: '',
    email: '',
    tickets: '',
    prize: ''
  };
  let previewData: any[] = [];
  let mappedEntries: any[] = [];
  let extractedPrizes: string[] = [];
  let prizeWinnerCounts: Record<string, number> = {};

  function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      csvData = parseCSV(content);
      
      if (csvData.headers.length > 0) {
        // Auto-detect common column names
        const headers = csvData.headers.map((h: string) => h.toLowerCase());
        
        columnMapping.name = csvData.headers.find((h: string) => 
          ['name', 'participant', 'entry', 'person'].some(term => h.toLowerCase().includes(term))
        ) || csvData.headers[0];
        
        columnMapping.email = csvData.headers.find((h: string) => 
          h.toLowerCase().includes('email') || h.toLowerCase().includes('mail')
        ) || '';
        
        columnMapping.tickets = csvData.headers.find((h: string) => 
          ['ticket', 'count', 'quantity', 'number'].some(term => h.toLowerCase().includes(term))
        ) || '';
        
        columnMapping.prize = csvData.headers.find((h: string) => 
          ['prize', 'award', 'reward', 'category'].some(term => h.toLowerCase().includes(term))
        ) || '';
        
        updatePreview();
        showMapping = true;
      }
    };
    reader.readAsText(file);
  }

  function updatePreview() {
    if (!csvData) return;
    
    const mapped = mapCSVData(csvData.data, columnMapping);
    previewData = mapped.slice(0, 5);
  }

  function confirmMapping() {
    console.log('confirmMapping called', { csvData, columnMapping });
    if (!csvData) return;
    
    mappedEntries = mapCSVData(csvData.data, columnMapping);
    extractedPrizes = extractPrizesFromEntries(mappedEntries);
    console.log('Extracted prizes:', extractedPrizes);
    
    // Initialize winner counts to 1 for each prize
    prizeWinnerCounts = {};
    extractedPrizes.forEach(prize => {
      prizeWinnerCounts[prize] = 1;
    });
    
    // If there are prizes, show prize configuration, otherwise go directly to raffle
    if (extractedPrizes.length > 0) {
      showMapping = false;
      showPrizeConfig = true;
    } else {
      finalizePrizeConfig();
    }
  }
  
  function finalizePrizeConfig() {
    console.log('finalizePrizeConfig called', { mappedEntries, prizeWinnerCounts });
    const entryPool = createEntryPool(mappedEntries);
    
    console.log('About to dispatch entriesLoaded with:', {
      entries: mappedEntries,
      pool: entryPool,
      originalData: csvData,
      prizeWinnerCounts: prizeWinnerCounts
    });
    
    dispatch('entriesLoaded', {
      entries: mappedEntries,
      pool: entryPool,
      originalData: csvData,
      prizeWinnerCounts: prizeWinnerCounts
    });
    console.log('entriesLoaded event dispatched successfully');
    
    // Don't reset state here - let the parent component hide this component
    // when entries.length > 0
  }

  function resetUpload() {
    showMapping = false;
    showPrizeConfig = false;
    csvData = null;
    previewData = [];
    mappedEntries = [];
    extractedPrizes = [];
    prizeWinnerCounts = {};
    if (fileInput) {
      fileInput.value = '';
    }
  }

  $: if (columnMapping && csvData) {
    updatePreview();
  }
</script>

<div class="w-full max-w-2xl mx-auto">
  {#if !showMapping && !showPrizeConfig}
    <!-- Upload Interface -->
    <div class="upload-container">
      <div class="upload-header">
        <div class="upload-icon">📊</div>
        <h2 class="upload-title">Upload Raffle Entries</h2>
        <p class="upload-subtitle">Select a CSV file with your participant data</p>
      </div>
      
      <div class="upload-dropzone" class:hover={false}>
        <div class="upload-visual">
          <div class="upload-symbol">↑</div>
        </div>
        
        <div class="upload-text">
          <p class="upload-main-text">Drop your CSV file here</p>
          <p class="upload-sub-text">or click to browse</p>
        </div>
        
        <input
          bind:this={fileInput}
          type="file"
          accept=".csv"
          on:change={handleFileUpload}
          class="upload-input"
        />
        
        <button
          class="upload-button"
          on:click={() => fileInput?.click()}
        >
          <span class="upload-button-icon">📁</span>
          Choose CSV File
        </button>
      </div>
      
      <div class="format-info">
        <div class="format-header">
          <span class="format-icon">📋</span>
          <span class="format-title">Expected Format</span>
        </div>
        <div class="format-example">
          <div class="format-code">
            Name,Email,Tickets,Prize<br>
            John Doe,john@example.com,3,Grand Prize<br>
            Jane Smith,jane@example.com,1,Second Place<br>
            Bob Wilson,bob@example.com,2,Grand Prize
          </div>
        </div>
        <p class="format-note">
          💡 Prize column is optional - if provided, it will auto-populate the prizes list
        </p>
      </div>
    </div>
  
  {:else if showMapping}
    <!-- Column Mapping Interface -->
    <div class="mapping-container">
      <div class="mapping-header">
        <div class="mapping-title">
          <span class="mapping-icon">🔗</span>
          <h2>Map CSV Columns</h2>
        </div>
        <button class="close-button" on:click={resetUpload} aria-label="Close">
          <span class="close-icon">×</span>
        </button>
      </div>
      
      <div class="mapping-grid">
        <div class="mapping-section">
          <h3 class="section-title">Column Mapping</h3>
          
          <div class="mapping-fields">
            <div class="field-group">
              <label class="field-label" for="name-select">
                Participant Name (Required)
              </label>
              <select id="name-select" bind:value={columnMapping.name} class="field-select">
                {#each csvData.headers as header}
                  <option value={header}>{header}</option>
                {/each}
              </select>
            </div>
            
            <div class="field-group">
              <label class="field-label" for="email-select">
                Email (Optional)
              </label>
              <select id="email-select" bind:value={columnMapping.email} class="field-select">
                <option value="">-- Not mapped --</option>
                {#each csvData.headers as header}
                  <option value={header}>{header}</option>
                {/each}
              </select>
            </div>
            
            <div class="field-group">
              <label class="field-label" for="tickets-select">
                Ticket Count (Optional, defaults to 1)
              </label>
              <select id="tickets-select" bind:value={columnMapping.tickets} class="field-select">
                <option value="">-- Not mapped --</option>
                {#each csvData.headers as header}
                  <option value={header}>{header}</option>
                {/each}
              </select>
            </div>
            
            <div class="field-group">
              <label class="field-label" for="prize-select">
                Prize Category (Optional)
              </label>
              <select id="prize-select" bind:value={columnMapping.prize} class="field-select">
                <option value="">-- Not mapped --</option>
                {#each csvData.headers as header}
                  <option value={header}>{header}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
        
        <div class="preview-section">
          <h3 class="section-title">Preview ({csvData.data.length} total entries)</h3>
          
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
            {#if csvData.data.length > 5}
              <div class="more-entries">
                ... and {csvData.data.length - 5} more entries
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <div class="mapping-actions">
        <button class="btn-cancel" on:click={resetUpload}>
          Cancel
        </button>
        <button class="btn-confirm" on:click={confirmMapping}>
          Load Entries ({csvData.data.length})
        </button>
      </div>
    </div>
  
  {:else if showPrizeConfig}
    <!-- Prize Configuration Interface -->
    <div class="prize-config-container">
      <div class="mapping-header">
        <div class="mapping-title">
          <span class="mapping-icon">🎯</span>
          <h2>Configure Winners per Prize</h2>
        </div>
        <button class="close-button" on:click={resetUpload} aria-label="Close">
          <span class="close-icon">×</span>
        </button>
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
                <label class="winner-count-label">Winners:</label>
                <div class="winner-count-input">
                  <button 
                    class="count-btn decrease" 
                    on:click={() => prizeWinnerCounts[prize] = Math.max(1, prizeWinnerCounts[prize] - 1)}
                    disabled={prizeWinnerCounts[prize] <= 1}
                  >
                    −
                  </button>
                  <span class="count-display">{prizeWinnerCounts[prize]}</span>
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
        <button class="btn-cancel" on:click={resetUpload}>
          Cancel
        </button>
        <button class="btn-confirm" on:click={finalizePrizeConfig}>
          Continue with Configuration
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Upload Container Styles */
  .upload-container {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e1e5e9;
    border-radius: 1.5rem;
    padding: 2rem;
    box-shadow: 
      0 10px 25px rgba(0, 0, 0, 0.1),
      0 4px 10px rgba(0, 0, 0, 0.05);
  }

  .upload-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .upload-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
  }

  .upload-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .upload-subtitle {
    color: #64748b;
    font-size: 1rem;
    margin: 0;
  }

  .upload-dropzone {
    border: 2px dashed #cbd5e1;
    border-radius: 1rem;
    padding: 3rem 2rem;
    text-align: center;
    background: linear-gradient(145deg, #f8fafc, #ffffff);
    transition: all 0.3s ease;
    position: relative;
    cursor: pointer;
    margin-bottom: 2rem;
  }

  .upload-dropzone:hover {
    border-color: #3b82f6;
    background: linear-gradient(145deg, #eff6ff, #f8fafc);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
  }

  .upload-visual {
    margin-bottom: 1.5rem;
  }

  .upload-symbol {
    font-size: 3rem;
    color: #94a3b8;
    font-weight: 300;
    display: inline-block;
    animation: bounce 2s infinite;
  }

  .upload-text {
    margin-bottom: 2rem;
  }

  .upload-main-text {
    font-size: 1.125rem;
    font-weight: 500;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .upload-sub-text {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }

  .upload-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .upload-button {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 0.75rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
  }

  .upload-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
  }

  .upload-button-icon {
    font-size: 1.125rem;
  }

  .format-info {
    background: linear-gradient(145deg, #f1f5f9, #e2e8f0);
    border-radius: 1rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
  }

  .format-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .format-icon {
    font-size: 1.25rem;
  }

  .format-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .format-example {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .format-code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    color: #374151;
    line-height: 1.6;
  }

  .format-note {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-10px);
    }
    60% {
      transform: translateY(-5px);
    }
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

  .close-button {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #f1f5f9;
    color: #374151;
  }

  .close-icon {
    font-size: 1.5rem;
    font-weight: 300;
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

  @media (max-width: 768px) {
    .mapping-container {
      padding: 1.5rem;
    }
    
    .mapping-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    
    .mapping-actions {
      flex-direction: column;
    }
  }
</style>