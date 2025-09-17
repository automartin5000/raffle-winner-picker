<script lang="ts">
  import { onMount } from 'svelte';
  import { getRaffleRuns, updateRafflePublicStatus, getPublicRaffleUrl } from '$lib/api';
  import Header from '../../components/Header.svelte';

  interface RaffleEntry {
    name: string;
    email?: string;
    tickets?: number;
    [key: string]: any;
  }

  interface Winner {
    name: string;
    prize: string;
    timestamp: string;
  }

  interface RaffleRun {
    userId: string;
    runId: string;
    timestamp: string;
    entries: RaffleEntry[];
    winners: Winner[];
    totalEntries: number;
    isPublic?: boolean;
  }

  let myRaffles: RaffleRun[] = [];
  let loading = true;
  let error = '';
  let selectedRaffle: RaffleRun | null = null;

  async function loadMyRaffles() {
    try {
      loading = true;
      error = '';

      const result = await getRaffleRuns();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load raffles');
      }

      myRaffles = result.runs || [];
    } catch (err) {
      console.error('Error loading raffles:', err);
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      loading = false;
    }
  }

  function showRaffleDetails(raffle: RaffleRun) {
    selectedRaffle = raffle;
  }

  function closeDetails() {
    selectedRaffle = null;
  }

  function getUniqueParticipants(entries: RaffleEntry[]): number {
    const uniqueNames = new Set(entries.map(entry => entry.name.toLowerCase()));
    return uniqueNames.size;
  }

  function getUniquePrizes(winners: Winner[]): string[] {
    return [...new Set(winners.map(w => w.prize))];
  }

  async function togglePublicStatus(raffle: RaffleRun) {
    try {
      const newStatus = !raffle.isPublic;
      const result = await updateRafflePublicStatus(raffle.runId, newStatus);
      
      if (result.success) {
        // Update the local raffle object
        raffle.isPublic = newStatus;
        // Trigger reactivity
        myRaffles = [...myRaffles];
        if (selectedRaffle && selectedRaffle.runId === raffle.runId) {
          selectedRaffle = { ...selectedRaffle, isPublic: newStatus };
        }
      } else {
        console.error('Failed to update public status:', result.error);
        alert('Failed to update raffle visibility. Please try again.');
      }
    } catch (error) {
      console.error('Error toggling public status:', error);
      alert('Failed to update raffle visibility. Please try again.');
    }
  }

  function copyPublicLink(runId: string) {
    const url = getPublicRaffleUrl(runId);
    navigator.clipboard.writeText(url).then(() => {
      alert('Public link copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Public link copied to clipboard!');
    });
  }

  onMount(() => {
    loadMyRaffles();
  });
</script>

<svelte:head>
  <title>My Raffles - Raffle Winner Picker</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <Header />
  
  <main class="container">
  <h1>My Raffles</h1>
  <p class="subtitle">View and manage all the raffles you've created</p>

  {#if loading}
    <div class="loading">Loading your raffles...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={loadMyRaffles}>Retry</button>
    </div>
  {:else if myRaffles.length === 0}
    <div class="no-raffles">
      <p>You haven't created any raffles yet.</p>
      <p>
        <a href="/">Create your first raffle</a> to get started!
      </p>
    </div>
  {:else}
    <div class="raffles-grid">
      {#each myRaffles as raffle}
        <div class="raffle-card" role="button" tabindex="0" on:click={() => showRaffleDetails(raffle)} on:keydown={(e) => e.key === 'Enter' && showRaffleDetails(raffle)}>
          <div class="card-header">
            <h3>Raffle {raffle.runId.slice(-8)}</h3>
            <div class="date">{new Date(raffle.timestamp).toLocaleString()}</div>
          </div>

          <div class="card-body">
            <div class="stats-grid">
              <div class="stat">
                <div class="stat-number">{raffle.totalEntries}</div>
                <div class="stat-label">Total Entries</div>
              </div>
              <div class="stat">
                <div class="stat-number">{getUniqueParticipants(raffle.entries)}</div>
                <div class="stat-label">Participants</div>
              </div>
              <div class="stat">
                <div class="stat-number">{raffle.winners.length}</div>
                <div class="stat-label">Winners</div>
              </div>
              <div class="stat">
                <div class="stat-number">{getUniquePrizes(raffle.winners).length}</div>
                <div class="stat-label">Prizes</div>
              </div>
            </div>

            <div class="quick-info">
              <div class="section">
                <h4>Recent Winners</h4>
                <div class="winners-preview">
                  {#each raffle.winners.slice(0, 3) as winner}
                    <div class="winner-item">
                      <span class="winner-name">{winner.name}</span>
                      <span class="winner-prize">{winner.prize}</span>
                    </div>
                  {/each}
                  {#if raffle.winners.length > 3}
                    <div class="more-winners">+{raffle.winners.length - 3} more winners</div>
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <div class="card-footer">
            <button class="view-details-btn">View Full Details</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>

{#if selectedRaffle}
  <div class="modal-backdrop" role="button" tabindex="0" on:click={closeDetails} on:keydown={(e) => e.key === 'Escape' && closeDetails()}>
    <div class="modal" role="dialog" tabindex="-1" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeDetails()}>
      <div class="modal-header">
        <h2>Raffle Details - {selectedRaffle.runId.slice(-8)}</h2>
        <button class="close-btn" on:click={closeDetails}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="detail-section">
          <h3>Summary</h3>
          <div class="summary-stats">
            <div>Date: {new Date(selectedRaffle.timestamp).toLocaleString()}</div>
            <div>Total Entries: {selectedRaffle.totalEntries}</div>
            <div>Unique Participants: {getUniqueParticipants(selectedRaffle.entries)}</div>
            <div>Winners Selected: {selectedRaffle.winners.length}</div>
          </div>
        </div>

        <div class="detail-section">
          <h3>Public Sharing</h3>
          <div class="sharing-controls">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                checked={selectedRaffle.isPublic || false}
                on:change={() => togglePublicStatus(selectedRaffle)}
              />
              <span>Make this raffle public</span>
            </label>
            
            {#if selectedRaffle.isPublic}
              <div class="public-link-section">
                <p class="public-link-info">
                  📋 This raffle is now public! Anyone with this link can view the results:
                </p>
                <div class="link-container">
                  <input 
                    type="text" 
                    value={getPublicRaffleUrl(selectedRaffle.runId)}
                    readonly
                    class="link-input"
                  />
                  <button 
                    class="copy-btn"
                    on:click={() => copyPublicLink(selectedRaffle.runId)}
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            {:else}
              <p class="private-info">
                🔒 This raffle is private. Only you can see the results.
              </p>
            {/if}
          </div>
        </div>

        <div class="detail-section">
          <h3>Winners ({selectedRaffle.winners.length})</h3>
          <div class="winners-list">
            {#each selectedRaffle.winners as winner}
              <div class="winner-detail">
                <div class="winner-name">{winner.name}</div>
                <div class="winner-prize">{winner.prize}</div>
                <div class="winner-time">{new Date(winner.timestamp).toLocaleString()}</div>
              </div>
            {/each}
          </div>
        </div>

        <div class="detail-section">
          <h3>All Entries ({selectedRaffle.entries.length})</h3>
          <div class="entries-list">
            {#each selectedRaffle.entries as entry}
              <div class="entry-detail">
                <div class="entry-name">{entry.name}</div>
                {#if entry.email}
                  <div class="entry-email">{entry.email}</div>
                {/if}
                {#if entry.tickets && entry.tickets > 1}
                  <div class="entry-tickets">{entry.tickets} tickets</div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    color: #1d4ed8;
    margin-bottom: 0.5rem;
    font-size: 1.875rem;
    font-weight: 700;
  }

  .subtitle {
    color: #4b5563;
    margin-bottom: 2rem;
  }

  .loading, .error, .no-raffles {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .error button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 500;
  }

  .error button:hover {
    background: #2563eb;
  }

  .raffles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .raffle-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .raffle-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  .card-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .card-header h3 {
    margin: 0 0 0.5rem 0;
    color: #111827;
    font-weight: 600;
  }

  .date {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .card-body {
    padding: 1rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat {
    text-align: center;
  }

  .stat-number {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1d4ed8;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 500;
  }

  .section h4 {
    margin: 0 0 0.5rem 0;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .winners-preview {
    max-height: 120px;
    overflow-y: auto;
  }

  .winner-item {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .winner-item:last-child {
    border-bottom: none;
  }

  .winner-name {
    font-weight: 500;
    color: #111827;
  }

  .winner-prize {
    color: #22c55e;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .more-winners {
    color: #6b7280;
    font-size: 0.875rem;
    padding: 0.25rem 0;
    text-align: center;
    font-style: italic;
  }

  .card-footer {
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .view-details-btn {
    width: 100%;
    padding: 0.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .view-details-btn:hover {
    background: #2563eb;
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 0.5rem;
    max-width: 800px;
    max-height: 90vh;
    width: 90%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .modal-header h2 {
    margin: 0;
    color: #111827;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .detail-section {
    margin-bottom: 2rem;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .detail-section h3 {
    margin: 0 0 1rem 0;
    color: #1d4ed8;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
    font-weight: 600;
  }

  .summary-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    background: #f9fafb;
    padding: 1rem;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
  }

  .summary-stats div {
    color: #374151;
    font-weight: 500;
  }

  .winners-list, .entries-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    background: white;
  }

  .winner-detail, .entry-detail {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .winner-detail:last-child, .entry-detail:last-child {
    border-bottom: none;
  }

  .winner-detail {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    align-items: center;
  }

  .winner-detail .winner-name {
    color: #111827;
    font-weight: 500;
  }

  .winner-detail .winner-prize {
    color: #22c55e;
    font-weight: 600;
  }

  .winner-time {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .entry-detail {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 1rem;
    align-items: center;
  }

  .entry-detail .entry-name {
    color: #111827;
    font-weight: 500;
  }

  .entry-email {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .entry-tickets {
    color: #1d4ed8;
    font-weight: 500;
    font-size: 0.875rem;
  }

  /* Sharing controls styling */
  .sharing-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: #374151;
  }

  .checkbox-label input[type="checkbox"] {
    width: 1.125rem;
    height: 1.125rem;
    accent-color: #2563eb;
    cursor: pointer;
  }

  .public-link-section {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .public-link-info {
    margin: 0 0 0.75rem 0;
    color: #0369a1;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .link-container {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .link-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
    color: #374151;
  }

  .copy-btn {
    background: #2563eb;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .copy-btn:hover {
    background: #1d4ed8;
  }

  .private-info {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }
    
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .modal {
      width: 95%;
      margin: 1rem;
    }
    
    .winner-detail {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }
    
    .entry-detail {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }
  }
</style>