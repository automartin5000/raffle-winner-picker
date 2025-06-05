<script lang="ts">
  export let newPrize: string = '';
  export let add: () => void;
</script>

<input type="text" bind:value={newPrize} placeholder="New Prize" />
<button on:click={add}>Add Prize</button>