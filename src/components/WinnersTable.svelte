<script lang="ts">
  export let winners: Array<{
    name: string;
    prize?: string;
    timestamp: string;
    email?: string;
  }> = [];
  

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

<div class="winners-table">
  <!-- Compact Header -->
  <div class="winners-header">
    <div class="winners-title">
      <span class="winners-icon">🏆</span>
      <span class="winners-text">Winners ({winners.length})</span>
    </div>
    
    {#if winners.length > 0}
      <button class="export-btn" on:click={downloadWinners}>
        📥
      </button>
    {/if}
  </div>

  {#if winners.length === 0}
    <!-- Compact Empty State -->
    <div class="empty-state">
      <div class="empty-icon">🎯</div>
      <div class="empty-text">Winners will appear here</div>
    </div>
  {:else}
    <!-- Compact Winners List -->
    <div class="winners-list">
      {#each winners as winner, index}
        <div class="winner-item">
          <div class="winner-number">{index + 1}</div>
          <div class="winner-details">
            <div class="winner-name">{winner.name}</div>
            {#if winner.prize}
              <div class="winner-prize">{winner.prize}</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

</div>

<style>
  .winners-table {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e1e5e9;
    border-radius: 0.75rem;
    padding: 0.75rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    min-height: 0;
  }

  .winners-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .winners-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .winners-icon {
    font-size: 1rem;
  }

  .winners-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
  }

  .export-btn {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border: none;
    padding: 0.375rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(59, 130, 246, 0.2);
  }

  .export-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem 0;
  }

  .empty-icon {
    font-size: 2rem;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 0.875rem;
    color: #64748b;
    text-align: center;
  }

  .winners-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
  }

  .winners-list::-webkit-scrollbar {
    width: 3px;
  }

  .winners-list::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 2px;
  }

  .winners-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }

  .winner-item {
    background: linear-gradient(145deg, #f8fafc, #ffffff);
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s ease;
  }

  .winner-item:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
  }

  .winner-number {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: white;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .winner-details {
    flex: 1;
    min-width: 0;
  }

  .winner-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .winner-prize {
    font-size: 0.75rem;
    color: #7c3aed;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

</style>

