<script lang="ts">
  import { onMount } from 'svelte';
  import { getAccessToken } from '$lib/auth';
  import { getApiUrl, CORE_SERVICES } from '$lib/domain-constants';
  import { getHostedZone } from '$lib/constants';

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
  }

  interface UserRaffleEntry {
    raffleId: string;
    raffleDate: string;
    myEntries: RaffleEntry[];
    prizes: string[];
    totalEntries: number;
    isWinner: boolean;
    wonPrizes: string[];
  }

  let myRaffleEntries: UserRaffleEntry[] = [];
  let loading = true;
  let error = '';

  // Get user's email/identifier for lookup
  async function getUserIdentifier(): Promise<string | null> {
    try {
      const token = await getAccessToken();
      if (!token) return null;
      
      // Decode JWT to get claims (this is a simple decode, not verification)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email || payload.sub;
    } catch (err) {
      console.error('Error getting user identifier:', err);
      return null;
    }
  }

  async function loadMyRaffleEntries() {
    try {
      loading = true;
      error = '';

      const userIdentifier = await getUserIdentifier();
      if (!userIdentifier) {
        throw new Error('Unable to identify user');
      }

      // Get all raffle runs
      const apiHostedZone = getHostedZone();
      const envName = import.meta.env.deploy_env;
      const winnersBaseApiUrl = getApiUrl({
        envName,
        service: CORE_SERVICES.WINNERS,
        hostedZone: apiHostedZone,
      });

      const token = await getAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }

      const response = await fetch(`${winnersBaseApiUrl}/runs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const allRaffles: RaffleRun[] = result.runs || [];

      // Filter raffles where user was entered and extract user's entries
      myRaffleEntries = allRaffles.reduce((acc: UserRaffleEntry[], raffle) => {
        // Find user's entries in this raffle (by email or name matching)
        const userEntries = raffle.entries.filter(entry => 
          entry.email === userIdentifier || 
          entry.name.toLowerCase().includes(userIdentifier.toLowerCase())
        );

        if (userEntries.length > 0) {
          // Check if user won any prizes
          const userWins = raffle.winners.filter(winner => 
            userEntries.some(entry => entry.name === winner.name)
          );

          const uniquePrizes = [...new Set(raffle.winners.map(w => w.prize))];

          acc.push({
            raffleId: raffle.runId,
            raffleDate: new Date(raffle.timestamp).toLocaleString(),
            myEntries: userEntries,
            prizes: uniquePrizes,
            totalEntries: raffle.totalEntries,
            isWinner: userWins.length > 0,
            wonPrizes: userWins.map(w => w.prize)
          });
        }

        return acc;
      }, []);

    } catch (err) {
      console.error('Error loading raffle entries:', err);
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadMyRaffleEntries();
  });
</script>

<svelte:head>
  <title>My Raffle Entries - Raffle Winner Picker</title>
</svelte:head>

<main class="container">
  <h1>My Raffle Entries</h1>
  <p class="subtitle">View all the raffles you've participated in and your results</p>

  {#if loading}
    <div class="loading">Loading your raffle history...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={loadMyRaffleEntries}>Retry</button>
    </div>
  {:else if myRaffleEntries.length === 0}
    <div class="no-entries">
      <p>You haven't been entered in any raffles yet.</p>
      <p>When you participate in raffles, they'll appear here.</p>
    </div>
  {:else}
    <div class="entries-grid">
      {#each myRaffleEntries as entry}
        <div class="entry-card {entry.isWinner ? 'winner' : ''}">
          <div class="card-header">
            <h3>Raffle {entry.raffleId.slice(-8)}</h3>
            <div class="date">{entry.raffleDate}</div>
            {#if entry.isWinner}
              <div class="winner-badge">🏆 Winner!</div>
            {/if}
          </div>

          <div class="card-body">
            <div class="section">
              <h4>Your Entries ({entry.myEntries.length})</h4>
              {#each entry.myEntries as myEntry}
                <div class="entry-item">
                  <span class="name">{myEntry.name}</span>
                  {#if myEntry.tickets && myEntry.tickets > 1}
                    <span class="tickets">({myEntry.tickets} tickets)</span>
                  {/if}
                </div>
              {/each}
            </div>

            <div class="section">
              <h4>Prizes Available</h4>
              <div class="prizes">
                {#each entry.prizes as prize}
                  <span class="prize {entry.wonPrizes.includes(prize) ? 'won' : ''}">{prize}</span>
                {/each}
              </div>
            </div>

            {#if entry.isWinner}
              <div class="section won-section">
                <h4>🎉 You Won!</h4>
                {#each entry.wonPrizes as wonPrize}
                  <div class="won-prize">{wonPrize}</div>
                {/each}
              </div>
            {/if}

            <div class="stats">
              <span>Total entries: {entry.totalEntries}</span>
              <span>Your entries: {entry.myEntries.length}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>

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

  .loading, .error, .no-entries {
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

  .entries-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .entry-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .entry-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  .entry-card.winner {
    border-color: #22c55e;
    background: linear-gradient(135deg, white, rgba(34, 197, 94, 0.05));
  }

  .card-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    position: relative;
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

  .winner-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: #22c55e;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .card-body {
    padding: 1rem;
  }

  .section {
    margin-bottom: 1rem;
  }

  .section h4 {
    margin: 0 0 0.5rem 0;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .entry-item {
    padding: 0.25rem 0;
  }

  .name {
    font-weight: 500;
    color: #111827;
  }

  .tickets {
    color: #6b7280;
    font-size: 0.875rem;
    margin-left: 0.5rem;
  }

  .prizes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .prize {
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    color: #374151;
  }

  .prize.won {
    background: #22c55e;
    color: white;
    font-weight: 600;
  }

  .won-section {
    background: rgba(34, 197, 94, 0.1);
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid #22c55e;
  }

  .won-prize {
    background: #22c55e;
    color: white;
    padding: 0.5rem;
    border-radius: 0.25rem;
    margin: 0.25rem 0;
    font-weight: 600;
    text-align: center;
  }

  .stats {
    display: flex;
    justify-content: space-between;
    color: #6b7280;
    font-size: 0.875rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }
</style>