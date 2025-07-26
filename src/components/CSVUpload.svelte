<script lang="ts">
  import { parseCSV, mapCSVData, createEntryPool } from '../utils/csv';
  import { createEventDispatcher } from 'svelte';
  
  // SMUI Components
  import Card from '@smui/card';
  import Select from '@smui/select';
  import Paper from '@smui/paper';

  const dispatch = createEventDispatcher();

  let fileInput: HTMLInputElement;
  let csvData: any = null;
  let showMapping = false;
  let columnMapping = {
    name: '',
    email: '',
    tickets: '',
    prize: ''
  };
  let previewData: any[] = [];

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
    if (!csvData) return;
    
    const mappedEntries = mapCSVData(csvData.data, columnMapping);
    const entryPool = createEntryPool(mappedEntries);
    
    dispatch('entriesLoaded', {
      entries: mappedEntries,
      pool: entryPool,
      originalData: csvData
    });
    
    showMapping = false;
    csvData = null;
  }

  function resetUpload() {
    showMapping = false;
    csvData = null;
    previewData = [];
    if (fileInput) {
      fileInput.value = '';
    }
  }

  $: if (columnMapping && csvData) {
    updatePreview();
  }
</script>

<div class="w-full max-w-2xl mx-auto">
  {#if !showMapping}
    <!-- Upload Interface -->
    <Card style="padding: 1.5rem;">
      <h2 class="text-xl font-bold text-gray-800 mb-4">📊 Upload Raffle Entries</h2>
      
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
        <div class="mb-4">
          <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
        </div>
        
        <p class="text-gray-600 mb-4">
          Select a CSV file with your raffle entries<br>
          <span class="text-sm text-gray-500">Supports name, email, and ticket count columns</span>
        </p>
        
        <input
          bind:this={fileInput}
          type="file"
          accept=".csv"
          on:change={handleFileUpload}
          class="hidden"
        />
        
        <button
          class="bg-primary-500 hover:bg-primary-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
          on:click={() => fileInput?.click()}
        >
          Choose CSV File
        </button>
      </div>
      
      <div class="mt-4 text-sm text-gray-500">
        <p class="font-medium mb-2">Expected format:</p>
        <div class="bg-gray-50 p-3 rounded font-mono text-xs">
          Name,Email,Tickets,Prize<br>
          John Doe,john@example.com,3,Grand Prize<br>
          Jane Smith,jane@example.com,1,Second Place<br>
          Bob Wilson,bob@example.com,2,Grand Prize
        </div>
        <p class="text-xs mt-2">
          📝 Prize column is optional - if provided, it will auto-populate the prizes list
        </p>
      </div>
    </Card>
  
  {:else}
    <!-- Column Mapping Interface -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-800">🔗 Map CSV Columns</h2>
        <button on:click={resetUpload} class="text-gray-500 hover:text-gray-700" aria-label="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="font-medium text-gray-700 mb-4">Column Mapping</h3>
          
          <div class="space-y-4">
            <div>
              <label for="name-select" class="block text-sm font-medium text-gray-600 mb-2">
                Participant Name (Required)
              </label>
              <select id="name-select" bind:value={columnMapping.name} class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                {#each csvData.headers as header}
                  <option value={header}>{header}</option>
                {/each}
              </select>
            </div>
            
            <div>
              <label for="email-select" class="block text-sm font-medium text-gray-600 mb-2">
                Email (Optional)
              </label>
              <select id="email-select" bind:value={columnMapping.email} class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="">-- Not mapped --</option>
                {#each csvData.headers as header}
                  <option value={header}>{header}</option>
                {/each}
              </select>
            </div>
            
            <div>
              <label for="tickets-select" class="block text-sm font-medium text-gray-600 mb-2">
                Ticket Count (Optional, defaults to 1)
              </label>
              <select id="tickets-select" bind:value={columnMapping.tickets} class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="">-- Not mapped --</option>
                {#each csvData.headers as header}
                  <option value={header}>{header}</option>
                {/each}
              </select>
            </div>
            
            <div>
              <label for="prize-select" class="block text-sm font-medium text-gray-600 mb-2">
                Prize Category (Optional)
              </label>
              <select id="prize-select" bind:value={columnMapping.prize} class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="">-- Not mapped --</option>
                {#each csvData.headers as header}
                  <option value={header}>{header}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
        
        <div>
          <h3 class="font-medium text-gray-700 mb-4">Preview ({csvData.data.length} total entries)</h3>
          
          <div class="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            {#each previewData as entry}
              <div class="bg-white rounded p-3 mb-2 shadow-sm">
                <div class="font-medium text-gray-800">{entry.name}</div>
                {#if entry.email}
                  <div class="text-sm text-gray-600">{entry.email}</div>
                {/if}
                {#if entry.tickets && entry.tickets > 1}
                  <div class="text-sm text-primary-600">{entry.tickets} tickets</div>
                {/if}
                {#if entry.prize}
                  <div class="text-sm text-purple-600">Prize: {entry.prize}</div>
                {/if}
              </div>
            {/each}
            {#if csvData.data.length > 5}
              <div class="text-sm text-gray-500 text-center mt-2">
                ... and {csvData.data.length - 5} more entries
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <button
          on:click={resetUpload}
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          on:click={confirmMapping}
          class="bg-success-500 hover:bg-success-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
        >
          Load Entries ({csvData.data.length})
        </button>
      </div>
    </div>
  {/if}
</div>