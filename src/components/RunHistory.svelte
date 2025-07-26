<script lang="ts">
  import { onMount } from 'svelte';
  import { getRaffleRuns, getRaffleRun } from '../lib/api';
  
  let runs: any[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedRun: any = null;
  let viewingRun = false;

  onMount(async () => {
    await loadRuns();
  });

  async function loadRuns() {
    loading = true;
    error = null;
    
    const result = await getRaffleRuns();
    
    if (result.success && result.runs) {
      runs = result.runs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } else {
      error = result.error || 'Failed to load runs';
    }
    
    loading = false;
  }

  async function viewRun(runId: string) {
    const result = await getRaffleRun(runId);
    
    if (result.success && result.run) {
      selectedRun = result.run;
      viewingRun = true;
    }
  }

  function closeRunView() {
    viewingRun = false;
    selectedRun = null;
  }

  function formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function downloadRunData(run: any) {
    const csvContent = [
      ['Winner', 'Prize', 'Time', 'Email'].join(','),
      ...run.winners.map((w: any) => [
        w.name,
        w.prize || 'Prize',
        new Date(w.timestamp).toLocaleString(),
        w.email || ''
      ].map((field: string) => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raffle-run-${run.runId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

{#if !viewingRun}
  <!-- Runs List -->
  <div class="bg-white rounded-lg shadow-lg p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-gray-800">📅 Raffle History</h2>
      <button
        on:click={loadRuns}
        class="text-primary-600 hover:text-primary-800 transition-colors"
        disabled={loading}
      >
        🔄 Refresh
      </button>
    </div>

    {#if loading}
      <div class="text-center py-8">
        <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p class="text-gray-600">Loading history...</p>
      </div>
    {:else if error}
      <div class="text-center py-8">
        <div class="text-red-500 text-4xl mb-2">⚠️</div>
        <p class="text-red-600">{error}</p>
        <button
          on:click={loadRuns}
          class="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    {:else if runs.length === 0}
      <div class="text-center py-8">
        <div class="text-4xl mb-4">📋</div>
        <p class="text-gray-500">No raffle runs found</p>
        <p class="text-sm text-gray-400">Complete a raffle to see it here</p>
      </div>
    {:else}
      <div class="space-y-3 max-h-96 overflow-y-auto">
        {#each runs as run}
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between">
              <div class="flex-grow">
                <div class="font-medium text-gray-800">
                  Raffle Run #{run.runId.slice(-8)}
                </div>
                <div class="text-sm text-gray-600">
                  {formatDate(run.timestamp)}
                </div>
                <div class="text-sm text-gray-500 mt-1">
                  {run.totalEntries} entries • {run.winners.length} winners
                </div>
              </div>
              
              <div class="flex space-x-2">
                <button
                  on:click={() => viewRun(run.runId)}
                  class="bg-primary-100 hover:bg-primary-200 text-primary-700 px-3 py-1 rounded text-sm transition-colors"
                >
                  👁️ View
                </button>
                <button
                  on:click={() => downloadRunData(run)}
                  class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
                >
                  📥 CSV
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <!-- Run Detail View -->
  <div class="bg-white rounded-lg shadow-lg p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-gray-800">
        📊 Run #{selectedRun.runId.slice(-8)} Details
      </h2>
      <button
        on:click={closeRunView}
        class="text-gray-500 hover:text-gray-700"
      >
        ✕
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Run Info -->
      <div>
        <h3 class="font-medium text-gray-700 mb-3">Run Information</h3>
        <div class="bg-gray-50 rounded-lg p-4 space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-600">Date:</span>
            <span class="font-medium">{formatDate(selectedRun.timestamp)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Total Entries:</span>
            <span class="font-medium">{selectedRun.totalEntries}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Winners Selected:</span>
            <span class="font-medium">{selectedRun.winners.length}</span>
          </div>
        </div>

        <button
          on:click={() => downloadRunData(selectedRun)}
          class="w-full mt-4 bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg transition-colors"
        >
          📥 Download Full Data
        </button>
      </div>

      <!-- Winners List -->
      <div>
        <h3 class="font-medium text-gray-700 mb-3">Winners</h3>
        <div class="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
          {#each selectedRun.winners as winner, index}
            <div class="bg-white rounded p-3 mb-2 shadow-sm">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-success-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                  {index + 1}
                </div>
                <div class="flex-grow">
                  <div class="font-medium text-gray-800">{winner.name}</div>
                  {#if winner.email}
                    <div class="text-sm text-gray-600">{winner.email}</div>
                  {/if}
                  {#if winner.prize}
                    <div class="text-sm text-success-700">Prize: {winner.prize}</div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}