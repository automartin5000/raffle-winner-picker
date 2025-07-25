<script lang="ts">
  export let winners: Array<{
    name: string;
    prize?: string;
    timestamp: string;
    email?: string;
  }> = [];
  
  export let isComplete = false;

  function formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  function downloadWinners() {
    const csvContent = [
      ['Winner', 'Prize', 'Time', 'Email'].join(','),
      ...winners.map(w => [
        w.name,
        w.prize || 'Prize',
        formatTime(w.timestamp),
        w.email || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raffle-winners-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-2xl p-6 h-full border border-gray-200">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center space-x-3">
      <div class="text-3xl">🏆</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">WINNERS</h2>
        {#if winners.length > 0}
          <div class="text-sm text-gray-600">{winners.length} selected</div>
        {/if}
      </div>
    </div>
    
    {#if winners.length > 0}
      <button
        on:click={downloadWinners}
        class="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center space-x-2"
      >
        <span>📥</span>
        <span>Export</span>
      </button>
    {/if}
  </div>

  {#if winners.length === 0}
    <!-- Empty State -->
    <div class="text-center py-12">
      <div class="text-6xl mb-4 opacity-50">🎯</div>
      <div class="text-xl font-medium text-gray-400 mb-2">No Winners Yet</div>
      <p class="text-gray-500">Winners will appear here as they are drawn</p>
    </div>
  {:else}
    <!-- Winners List -->
    <div class="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
      {#each winners as winner, index}
        <div class="winner-card group relative overflow-hidden"
             style="animation: slideIn 0.5s ease-out {index * 0.1}s both">
          
          <!-- Background Pattern -->
          <div class="absolute inset-0 bg-gradient-to-r from-yellow-50 via-green-50 to-blue-50 opacity-60"></div>
          
          <!-- Content -->
          <div class="relative flex items-center p-4 rounded-xl border-2 border-gradient shadow-lg bg-white/80 backdrop-blur-sm">
            <!-- Winner Number Badge -->
            <div class="flex-shrink-0 relative mr-4">
              <div class="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                <span class="text-white font-bold text-lg">{index + 1}</span>
              </div>
              <div class="absolute -top-1 -right-1 text-lg animate-bounce">🎉</div>
            </div>
            
            <!-- Winner Details -->
            <div class="flex-grow">
              <div class="font-bold text-lg text-gray-800 mb-1">{winner.name}</div>
              {#if winner.email}
                <div class="text-sm text-gray-600 mb-1">✉️ {winner.email}</div>
              {/if}
              {#if winner.prize}
                <div class="inline-flex items-center bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full border border-purple-200">
                  🏅 {winner.prize}
                </div>
              {/if}
            </div>
            
            <!-- Time and Celebration -->
            <div class="flex-shrink-0 text-right">
              <div class="text-xs text-gray-500 mb-1">{formatTime(winner.timestamp)}</div>
              <div class="text-3xl animate-pulse">🌟</div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Completion Celebration -->
  {#if isComplete && winners.length > 0}
    <div class="mt-6 p-6 bg-gradient-to-r from-green-100 via-blue-100 to-purple-100 border-2 border-green-300 rounded-xl text-center animate-pulse">
      <div class="text-4xl mb-3">🎊✨🎊</div>
      <div class="font-bold text-xl text-green-800 mb-1">RAFFLE COMPLETE!</div>
      <div class="text-green-700">
        Congratulations to all {winners.length} winner{winners.length !== 1 ? 's' : ''}!
      </div>
    </div>
  {/if}
</div>

<style>
  .winner-card {
    position: relative;
  }
  
  .winner-card::before {
    content: '';
    position: absolute;
    inset: 0;
    padding: 2px;
    background: linear-gradient(45deg, #fbbf24, #10b981, #3b82f6, #8b5cf6);
    border-radius: 12px;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: xor;
    -webkit-mask-composite: xor;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #3b82f6, #1d4ed8);
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #1d4ed8, #1e40af);
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>

