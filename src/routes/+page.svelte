<script lang="ts">
  import { parseCSV } from '../utils/csv';
  import { downloadCSV } from '../utils/download';
  import PrizeForm from '../components/PrizeForm.svelte';
  import PrizeList from '../components/PrizeList.svelte';
  import WinnerWheel from '../components/WinnerWheel.svelte';

  let entries: string[] = [];
  let prizes: string[] = [];
  let newPrize: string = $state('');
  let prizeWinners: Record<string, string[]> = $state({});
  let winnerPool: string[] = $state([]);
  let numWinners: number = $state(1);
  let displayedName: string = $state('');
  let spinning: boolean = $state(false);
  let interval: ReturnType<typeof setInterval>;

  function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      entries = parseCSV(e.target?.result as string);
      winnerPool = [...entries];
    };
    reader.readAsText(file);
  }

  function addPrize() {
    if (newPrize && !prizes.includes(newPrize)) {
      prizes.push(newPrize);
      prizeWinners[newPrize] = [];
      newPrize = '';
    }
  }

  function pickWinners(prize: string) {
    if (!winnerPool.length || spinning) return;
    spinning = true;
    let selected: string[] = [];
    interval = setInterval(() => {
      displayedName = winnerPool[Math.floor(Math.random() * winnerPool.length)];
    }, 50);
    setTimeout(() => {
      clearInterval(interval);
      for (let i = 0; i < numWinners && winnerPool.length; i++) {
        const index = Math.floor(Math.random() * winnerPool.length);
        selected.push(winnerPool[index]);
        winnerPool.splice(index, 1);
      }
      prizeWinners[prize].push(...selected);
      displayedName = selected[selected.length - 1] || '';
      spinning = false;
    }, 3000);
  }

  function exportWinners() {
    const rows: string[][] = [["Prize", "Winner"]];
    for (const prize in prizeWinners) {
      prizeWinners[prize].forEach(w => rows.push([prize, w]));
    }
    downloadCSV(rows);
  }
</script>

<style>
  h1 {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-top: 1rem;
  }

  button {
    margin-top: 1rem;
  }
</style>

<h1>CSV Raffle Picker</h1>

<input type="file" accept=".csv" onchange={handleFileUpload} />
<br /><br />

<PrizeForm bind:newPrize add={addPrize} />

<label for="numWinners">Number of Winners per Prize:</label>
<input id="numWinners" type="number" min="1" bind:value={numWinners} />
<br /><br />

<PrizeList
  {prizes}
  {prizeWinners}
  {winnerPool}
  {spinning}
  {pickWinners}
/>

<WinnerWheel name={displayedName} />

<br />
<button onclick={exportWinners} disabled={Object.keys(prizeWinners).length === 0}>
  Export Winners CSV
</button>