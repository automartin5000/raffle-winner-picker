<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // SMUI Components
  import Card from '@smui/card';
  import Textfield from '@smui/textfield';
  import Paper from '@smui/paper';
  
  const dispatch = createEventDispatcher();
  
  export let hasEntries = false;
  export let isRunning = false;
  export let isPaused = false;
  export let winnersCount = 0;
  export let totalWinners = 1;
  export let csvPrizes: string[] = [];
  
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
    dispatch('start', { prizes, totalWinners, spinDuration: spinDurationSeconds * 1000 });
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
</script>

<Card style="padding: 1.5rem; border-radius: 1rem;">
  <div class="flex items-center space-x-3 mb-6">
    <div class="w-8 h-8 primary-light rounded-full flex items-center justify-center text-white">⚙️</div>
    <h2 class="text-xl font-medium text-gray-900">Raffle Configuration</h2>
  </div>

  {#if !isRunning}
    <!-- Setup Phase -->
    <div class="space-y-4">
      <!-- Prize Setup -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label for="prize-input" class="block text-sm font-medium text-gray-700">
            Prizes Setup
          </label>
          {#if csvPrizes.length > 0}
            <div class="text-sm">
              <label class="flex items-center space-x-2">
                <input type="checkbox" bind:checked={useCsvPrizes} on:change={() => {
                  if (useCsvPrizes) {
                    prizes = [...csvPrizes];
                  } else {
                    prizes = [];
                  }
                }} class="rounded border-gray-300">
                <span class="text-purple-600">Use prizes from CSV ({csvPrizes.length} found)</span>
              </label>
            </div>
          {/if}
        </div>
        
        {#if csvPrizes.length > 0 && useCsvPrizes}
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
            <div class="text-sm text-purple-800 mb-2">Prizes from CSV:</div>
            <div class="flex flex-wrap gap-2">
              {#each csvPrizes as prize}
                <span class="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                  {prize}
                </span>
              {/each}
            </div>
          </div>
        {:else}
          <div class="text-sm text-gray-600 mb-2">
            Add custom prizes (optional - defaults to "Grand Prize")
          </div>
        {/if}
        
        {#if !useCsvPrizes || csvPrizes.length === 0}
          <div class="flex space-x-2 mb-2">
            <Textfield
              bind:value={newPrize}
              on:keydown={handleKeydown}
              label="Enter prize name"
              variant="outlined"
              style="flex-grow: 1;"
            />
            <button
              class="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition-colors"
              on:click={addPrize}
              disabled={!newPrize.trim()}
            >
              Add
            </button>
          </div>

          {#if prizes.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each prizes as prize, index}
                <div class="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm flex items-center">
                  {prize}
                  <button
                    on:click={() => removePrize(index)}
                    class="ml-2 text-primary-600 hover:text-primary-800"
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Number of Winners -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="winners-input" class="block text-sm font-medium text-gray-700 mb-2">
            Winners per Prize
          </label>
          <Textfield
            type="number"
            label="Winners per Prize"
            variant="outlined"
            input$min="1"
            input$max="50"
            bind:value={totalWinners}
            style="width: 100%;"
          />
        </div>
        
        <div>
          <label for="duration-input" class="block text-sm font-medium text-gray-700 mb-2">
            Spin Duration (seconds)
          </label>
          <Textfield
            type="number"
            label="Spin Duration (seconds)"
            variant="outlined"
            input$min="1"
            input$max="10"
            input$step="0.5"
            bind:value={spinDurationSeconds}
            style="width: 100%;"
          />
        </div>
      </div>

      <!-- Start Button -->
      <button
        class="w-full primary elevation-2 hover:elevation-4 disabled:bg-gray-300 disabled:text-gray-500 font-medium py-4 px-6 rounded-xl transition-all duration-300 transform disabled:transform-none hover:scale-[1.02]"
        on:click={startRaffle}
        disabled={!hasEntries}
      >
        {#if hasEntries}
          <span class="flex items-center justify-center space-x-2">
            <span>🚀</span>
            <span>Start Raffle</span>
          </span>
        {:else}
          <span class="flex items-center justify-center space-x-2">
            <span>📋</span>
            <span>Upload Entries First</span>
          </span>
        {/if}
      </button>
    </div>
  {:else}
    <!-- Running Phase -->
    <div class="space-y-4">
      <Paper elevation={1} style="padding: 1rem; border-radius: 0.75rem;">
        <div class="text-center">
          <div class="w-12 h-12 primary-light rounded-full flex items-center justify-center text-2xl mx-auto mb-3">🎪</div>
          <div class="font-medium text-gray-900 mb-1">Raffle in Progress</div>
          <div class="text-sm text-gray-600">
            {winnersCount} of {totalWinners * prizes.length} winners selected
          </div>
        </div>
      </Paper>

      <div class="grid grid-cols-2 gap-3">
        {#if isPaused}
          <button
            class="primary elevation-2 hover:elevation-4 font-medium py-3 px-4 rounded-xl transition-all duration-300"
            on:click={resumeRaffle}
          >
            ▶️ Resume
          </button>
        {:else}
          <button
            class="bg-orange-500 hover:bg-orange-600 text-white elevation-2 hover:elevation-4 font-medium py-3 px-4 rounded-xl transition-all duration-300"
            on:click={pauseRaffle}
          >
            ⏸️ Pause
          </button>
        {/if}
        
        <button
          class="bg-gray-500 hover:bg-gray-600 text-white elevation-2 hover:elevation-4 font-medium py-3 px-4 rounded-xl transition-all duration-300"
          on:click={resetRaffle}
        >
          🔄 Reset
        </button>
      </div>
    </div>
  {/if}
</Card>