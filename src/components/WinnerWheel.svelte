<script lang="ts">
  export let names: string[] = [];
  export let winner: string = '';
  export let spinDuration = 3000; // Default 3 seconds, configurable
  
  let spinning = false;
  let currentIndex = 0;
  let showWinnerEffect = false;
  let terminalLines: string[] = [];
  
  // Create cycling names list
  $: displayNames = names.length > 0 ? names : ['NO_ENTRIES'];

  export async function spin(): Promise<void> {
    return new Promise((resolve) => {
      if (!names.length || spinning) {
        resolve();
        return;
      }

      spinning = true;
      showWinnerEffect = false;
      terminalLines = [];
      
      // Clear terminal and show initializing message
      addTerminalLine('> INITIALIZING WINNER SELECTION...');
      addTerminalLine('> LOADING PARTICIPANTS...');
      
      setTimeout(() => {
        addTerminalLine(`> ${names.length} PARTICIPANTS LOADED`);
        addTerminalLine('> STARTING RANDOM SELECTION...');
        
        // Start fast cycling animation
        const startTime = Date.now();
        let cycleSpeed = 50; // Start fast
        
        const cycle = () => {
          if (!spinning) return;
          
          currentIndex = (currentIndex + 1) % displayNames.length;
          const elapsed = Date.now() - startTime;
          const progress = elapsed / spinDuration;
          
          // Gradually slow down
          cycleSpeed = 50 + (progress * 300); // Slow from 50ms to 350ms
          
          if (elapsed >= spinDuration) {
            // Stop on winner
            const winnerIndex = displayNames.findIndex(name => name === winner);
            if (winnerIndex >= 0) {
              currentIndex = winnerIndex;
            }
            
            spinning = false;
            showWinnerEffect = true;
            
            addTerminalLine('> SELECTION COMPLETE!');
            addTerminalLine(`> WINNER: ${winner.toUpperCase()}`);
            
            setTimeout(() => {
              resolve();
            }, 1000);
          } else {
            setTimeout(cycle, cycleSpeed);
          }
        };
        
        cycle();
      }, 500);
    });
  }

  export function reset() {
    spinning = false;
    currentIndex = 0;
    showWinnerEffect = false;
    terminalLines = [];
  }
  
  function addTerminalLine(line: string) {
    terminalLines = [...terminalLines, line];
    // Keep only last 10 lines
    if (terminalLines.length > 10) {
      terminalLines = terminalLines.slice(-10);
    }
  }
</script>

<!-- Authentic Retro Computer Terminal -->
<div class="w-full max-w-lg mx-auto">
  <!-- Computer Monitor Housing -->
  <div class="computer-terminal">
    <!-- Monitor Bezel -->
    <div class="monitor-bezel">
      <!-- Brand Label -->
      <div class="brand-label">
        <span class="font-mono text-xs tracking-wider">RAFFLE-TRON 3000</span>
      </div>
      
      <!-- CRT Screen -->
      <div class="crt-screen">
        <!-- Scanlines Effect -->
        <div class="scanlines"></div>
        
        <!-- Terminal Content -->
        <div class="terminal-display">
          <!-- Boot Sequence / Header -->
          <div class="terminal-header">
            <div class="text-green-400 font-mono text-xs mb-2">
              <div class="typing-effect">[SYSTEM ONLINE]</div>
              <div class="typing-effect">WINNER SELECTION PROTOCOL v2.1</div>
              <div class="typing-effect">PARTICIPANTS LOADED: {names.length}</div>
              <div class="border-b border-green-700 my-2"></div>
            </div>
          </div>
          
          <!-- Terminal Output Window -->
          <div class="terminal-output">
            {#each terminalLines as line}
              <div class="terminal-line text-green-400 font-mono text-sm">
                <span class="line-prefix">></span> {line}
              </div>
            {/each}
          </div>
          
          <!-- Main Display Area -->
          <div class="main-display">
            <div class="selection-box">
              <div class="text-green-700 font-mono text-xs mb-1">CURRENT SELECTION:</div>
              <div class="selection-text">
                {#if spinning}
                  <span class="text-green-400 font-mono text-2xl animate-pulse glow">
                    {displayNames[currentIndex] || 'PROCESSING...'}
                  </span>
                {:else if showWinnerEffect}
                  <span class="text-green-400 font-mono text-2xl animate-bounce winner-glow">
                    *** {winner.toUpperCase()} ***
                  </span>
                {:else if names.length > 0}
                  <span class="text-green-700 font-mono text-lg">READY FOR SELECTION</span>
                {:else}
                  <span class="text-red-400 font-mono text-lg">NO DATA LOADED</span>
                {/if}
              </div>
            </div>
          </div>
          
          <!-- Status Line -->
          <div class="status-line">
            <div class="flex justify-between items-center text-green-700 font-mono text-xs">
              <div class="flex items-center space-x-3">
                <span class="{spinning ? 'text-green-400 animate-pulse' : 'text-green-700'}">●</span>
                <span>STATUS: {spinning ? 'PROCESSING' : 'READY'}</span>
                {#if spinning}
                  <span class="animate-spin">█</span>
                {/if}
              </div>
              <div class="flex space-x-3">
                <span>ENTRIES: {names.length}</span>
                <span>DURATION: {Math.floor(spinDuration/1000)}s</span>
              </div>
            </div>
          </div>
          
          <!-- Command Prompt -->
          {#if !spinning && !showWinnerEffect}
            <div class="command-prompt">
              <span class="text-green-400 font-mono">RAFFLE-TRON></span>
              <span class="text-green-400 font-mono animate-pulse ml-1">█</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Monitor Stand -->
    <div class="monitor-stand"></div>
  </div>
</div>

<style>
  /* Computer Terminal Housing */
  .computer-terminal {
    perspective: 1000px;
    margin: 2rem auto;
  }
  
  /* Monitor Bezel - Cream colored like old terminals */
  .monitor-bezel {
    background: linear-gradient(145deg, #f5f5dc, #e6e6d0);
    border: 3px solid #d4d4aa;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      inset 0 2px 4px rgba(255, 255, 255, 0.3),
      inset 0 -2px 4px rgba(0, 0, 0, 0.1);
    position: relative;
  }
  
  /* Brand Label */
  .brand-label {
    position: absolute;
    top: 0.5rem;
    right: 1rem;
    background: #333;
    color: #ccc;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 10px;
  }
  
  /* CRT Screen - Deep black with slight curve - Square aspect ratio */
  .crt-screen {
    background: #000;
    border: 4px solid #1a1a1a;
    border-radius: 8px;
    position: relative;
    overflow: hidden;
    height: 480px;
    width: 100%;
    aspect-ratio: 1;
    box-shadow: 
      inset 0 0 50px rgba(0, 0, 0, 0.5),
      inset 0 0 20px rgba(0, 255, 0, 0.1);
    transform: perspective(800px) rotateX(2deg);
  }
  
  /* Scanlines Effect */
  .scanlines {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      transparent 0%,
      rgba(0, 255, 0, 0.05) 50%,
      transparent 100%
    );
    background-size: 100% 3px;
    animation: scanlineMove 0.1s linear infinite;
    pointer-events: none;
    z-index: 10;
  }
  
  @keyframes scanlineMove {
    0% { background-position: 0 0; }
    100% { background-position: 0 3px; }
  }
  
  /* Terminal Display */
  .terminal-display {
    padding: 1.5rem;
    height: 100%;
    background: 
      radial-gradient(ellipse at center, rgba(0, 255, 0, 0.02) 0%, rgba(0, 0, 0, 0.9) 100%),
      linear-gradient(90deg, transparent 98%, rgba(0, 255, 0, 0.03) 100%);
    background-size: 100% 100%, 2px 2px;
    color: #00ff00;
    font-family: 'Courier New', 'Monaco', monospace;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  
  /* Terminal Header */
  .terminal-header {
    border-bottom: 1px solid #003300;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
  
  /* Terminal Output */
  .terminal-output {
    flex: 0 0 auto;
    max-height: 120px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }
  
  .terminal-output::-webkit-scrollbar {
    width: 2px;
  }
  
  .terminal-output::-webkit-scrollbar-track {
    background: rgba(0, 255, 0, 0.1);
  }
  
  .terminal-output::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 0, 0.5);
  }
  
  /* Terminal Lines */
  .terminal-line {
    opacity: 0;
    animation: typeIn 0.5s ease-out forwards;
    margin: 0.2rem 0;
  }
  
  .line-prefix {
    color: #006600;
  }
  
  /* Main Display */
  .main-display {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Selection Box */
  .selection-box {
    border: 2px solid #00ff00;
    border-radius: 4px;
    padding: 1.5rem;
    text-align: center;
    background: rgba(0, 255, 0, 0.05);
    box-shadow: 
      0 0 20px rgba(0, 255, 0, 0.3),
      inset 0 0 10px rgba(0, 255, 0, 0.1);
    min-height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
  }
  
  .selection-text {
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Status Line */
  .status-line {
    border-top: 1px solid #003300;
    padding-top: 0.5rem;
    margin-top: auto;
  }
  
  /* Command Prompt */
  .command-prompt {
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
  }
  
  /* Monitor Stand */
  .monitor-stand {
    width: 120px;
    height: 60px;
    background: linear-gradient(145deg, #d4d4aa, #c4c49a);
    margin: 0 auto;
    border-radius: 0 0 8px 8px;
    border: 2px solid #b4b48a;
    border-top: none;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  /* Glow Effects */
  .glow {
    text-shadow: 
      0 0 5px #00ff00,
      0 0 10px #00ff00,
      0 0 15px #00ff00;
  }
  
  .winner-glow {
    text-shadow: 
      0 0 5px #00ff00,
      0 0 10px #00ff00,
      0 0 20px #00ff00,
      0 0 30px #00ff00;
  }
  
  /* Typing Animation */
  .typing-effect {
    opacity: 0;
    animation: typeIn 0.8s ease-out forwards;
  }
  
  .typing-effect:nth-child(1) { animation-delay: 0.2s; }
  .typing-effect:nth-child(2) { animation-delay: 0.5s; }
  .typing-effect:nth-child(3) { animation-delay: 0.8s; }
  
  @keyframes typeIn {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .monitor-bezel {
      padding: 1rem;
    }
    
    .crt-screen {
      height: 350px;
      aspect-ratio: 1;
    }
    
    .terminal-display {
      padding: 1rem;
    }
    
    .selection-text span {
      font-size: 1.25rem !important;
    }
    
    .terminal-output {
      max-height: 80px;
    }
  }
  
  @media (max-width: 1280px) {
    .crt-screen {
      height: 420px;
      aspect-ratio: 1;
    }
  }
</style>