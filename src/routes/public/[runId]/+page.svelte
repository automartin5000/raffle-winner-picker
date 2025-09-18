<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getApiUrl, CORE_SERVICES } from '$lib/domain-constants';
  import { getHostedZone } from '$lib/constants';
  import Header from '../../../components/Header.svelte';

  interface Winner {
    name: string;
    prize: string;
    timestamp: string;
  }

  interface PublicRaffleRun {
    runId: string;
    timestamp: string;
    winners: Winner[];
    totalEntries: number;
  }

  let raffle: PublicRaffleRun | null = null;
  let loading = true;
  let error = '';

  // Get API environment dynamically (same logic as api.ts)
  function getApiEnvironment(): string {
    const currentHostname = window.location.hostname;

    if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
      return 'local';
    } else if (currentHostname.endsWith(import.meta.env.nonprod_hosted_zone)) {
      const nonprodHostedZone = import.meta.env.nonprod_hosted_zone;
      const prefix = currentHostname.replace(`.${nonprodHostedZone}`, '');
      return prefix || 'dev';
    } else if (currentHostname.endsWith(import.meta.env.prod_hosted_zone)) {
      return 'prod';
    } else {
      return 'dev';
    }
  }

  async function loadPublicRaffle(runId: string) {
    try {
      loading = true;
      error = '';

      const apiHostedZone = getHostedZone();
      const envName = getApiEnvironment();
      const winnersBaseApiUrl = getApiUrl({
        envName,
        service: CORE_SERVICES.WINNERS,
        hostedZone: apiHostedZone,
      });

      const response = await fetch(`${winnersBaseApiUrl}/public/runs/${runId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('This raffle is not public or does not exist.');
        }
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      raffle = await response.json();
    } catch (err) {
      console.error('Error loading public raffle:', err);
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      loading = false;
    }
  }

  function formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getUniquePrizes(winners: Winner[]): string[] {
    return [...new Set(winners.map(w => w.prize))];
  }

  onMount(() => {
    const runId = $page.params.runId;
    if (runId) {
      loadPublicRaffle(runId);
    } else {
      error = 'No raffle ID provided';
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Public Raffle Results - Raffle Winner Picker</title>
  <meta name="description" content="View the results of this public raffle drawing" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <Header showAuth={false} />
  
  <main class="container mx-auto px-4 py-8">
    {#if loading}
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading raffle results...</p>
      </div>
    {:else if error}
      <div class="text-center py-12">
        <div class="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <div class="text-red-600 text-5xl mb-4">❌</div>
          <h2 class="text-xl font-semibold text-red-800 mb-2">Unable to Load Raffle</h2>
          <p class="text-red-600">{error}</p>
        </div>
      </div>
    {:else if raffle}
      <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div class="text-center">
            <div class="text-4xl mb-4">🎉</div>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Raffle Results</h1>
            <p class="text-gray-600">Drawn on {formatDate(raffle.timestamp)}</p>
            <div class="mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {raffle.totalEntries} Total Entries
            </div>
          </div>
        </div>

        <!-- Winners Section -->
        {#if raffle.winners.length > 0}
          <div class="bg-white rounded-lg shadow-sm overflow-hidden">
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
              <h2 class="text-xl font-semibold text-white flex items-center">
                <span class="text-2xl mr-3">🏆</span>
                Winners ({raffle.winners.length})
              </h2>
            </div>
            
            <div class="p-6">
              <!-- Group winners by prize -->
              {#each getUniquePrizes(raffle.winners) as prize}
                {@const prizeWinners = raffle.winners.filter(w => w.prize === prize)}
                <div class="mb-6 last:mb-0">
                  <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span class="text-xl mr-2">🎁</span>
                    {prize}
                    {#if prizeWinners.length > 1}
                      <span class="ml-2 text-sm text-gray-500">({prizeWinners.length} winners)</span>
                    {/if}
                  </h3>
                  
                  <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {#each prizeWinners as winner}
                      <div class="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
                        <div class="font-semibold text-gray-900">{winner.name}</div>
                        <div class="text-sm text-gray-600">Won at {formatTime(winner.timestamp)}</div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <div class="text-6xl mb-4">🎲</div>
            <h2 class="text-xl font-semibold text-gray-800 mb-2">No Winners Yet</h2>
            <p class="text-gray-600">This raffle hasn't been drawn yet or had no winners.</p>
          </div>
        {/if}

        <!-- Footer -->
        <div class="mt-8 text-center">
          <p class="text-gray-500 text-sm mb-4">
            This raffle was conducted using Raffle Winner Picker
          </p>
          <a 
            href="/" 
            class="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            Create Your Own Raffle
          </a>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .container {
    max-width: 1200px;
  }
</style>