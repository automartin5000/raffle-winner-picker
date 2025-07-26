<script lang="ts">
  import { onMount } from 'svelte';
  import { initAuth0, isAuthenticated, isLoading, user } from '../lib/auth';
  import '../app.css';
  import '../smui-theme.css';

  onMount(() => {
    initAuth0();
  });
</script>

<div class="min-h-screen bg-gray-50">
  {#if $isLoading}
    <!-- Loading Screen -->
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600">Loading application...</p>
      </div>
    </div>
  {:else}
    <slot />
  {/if}
</div>