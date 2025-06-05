<script lang="ts">
  export let prizes: string[] = [];
  export let prizeWinners: Record<string, string[]> = {};
  export let winnerPool: string[] = [];
  export let spinning: boolean = false;
  export let pickWinners: (prize: string) => void;
</script>

{#each prizes as prize}
  <div>
    <h3>{prize}</h3>
    <button on:click={() => pickWinners(prize)} disabled={spinning || !winnerPool.length}>
      Pick Winner(s)
    </button>
    <ul>
      {#each prizeWinners[prize] as w}
        <li class="winner">🎉 {w}</li>
      {/each}
    </ul>
  </div>
{/each}

<style>
  .winner {
    font-weight: bold;
    color: green;
  }
</style>