<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isAuthenticated, user, loginWithRedirect, logout } from '../lib/auth';
  import { parseCSV } from '../utils/csv';
  import { setCSVData } from '../lib/stores/raffle';

  let fileInput: HTMLInputElement;
  let csvData: any = null;
  let columnMapping = {
    name: '',
    email: '',
    tickets: '',
    prize: ''
  };

  onMount(() => {
    // App is ready
  });

  function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      csvData = parseCSV(content);
      
      if (csvData.headers.length > 0) {
        // Auto-detect common column names
        columnMapping.name = csvData.headers.find((h: string) => 
          ['name', 'participant', 'entry', 'person'].some(term => h.toLowerCase().includes(term))
        ) || csvData.headers[0];
        
        columnMapping.email = csvData.headers.find((h: string) => 
          h.toLowerCase().includes('email') || h.toLowerCase().includes('mail')
        ) || '';
        
        columnMapping.tickets = csvData.headers.find((h: string) => 
          ['ticket', 'count', 'quantity', 'number'].some(term => h.toLowerCase().includes(term))
        ) || '';
        
        columnMapping.prize = csvData.headers.find((h: string) => 
          ['prize', 'award', 'reward', 'category'].some(term => h.toLowerCase().includes(term))
        ) || '';
        
        // Save to store and navigate to configure page
        setCSVData(csvData, columnMapping);
        goto('/configure');
      }
    };
    reader.readAsText(file);
  }

  function resetUpload() {
    csvData = null;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  function useSampleData() {
    // Sample data from sample_raffle_tickets.csv
    const sampleCsvContent = `Donor Name,Email,Prize,Quantity
Minney Mouse,minney_mouse@email.com,5 nights in Aspen,1
Mickey Mouse,mickey_mouse@email.com,(2) Coldplay tickets (take a coworker!),1
Jane Doe,jane_doe@email.com,(2) Coldplay tickets (take a coworker!),1
Jane Doe,jane_doe@email.com,(2) Coldplay tickets (take a coworker!),1
Jane Doe,jane_doe@email.com,(2) VIP seats for the school concert,1
John Doe,john_doe@email.com,(4) Savannah Bananas Tickets,1
John Doe,john_doe@email.com,(1) 5 nights at a 5-star resort,3
Iron Man,iron_man@email.com,"Family fun gift pack (Questing, mini golf, and bowling)",3
George Washington,george_washington@email.com,Private wine class for 20 people from Total Wine & More,1
Bluey Heeler,bluey_heeler@email.com,"Family fun gift pack (Questing, mini golf, and bowling)",1
Iron Man,iron_man@email.com,Valentine's Day Scratch Ticket Board,5
George Washington,george_washington@email.com,(1) 5 nights at a 5-star resort,1
Minney Mouse,minney_mouse@email.com,7-10 night stay in Antigua with Elite Island Resorts,1
George Washington,george_washington@email.com,Principal for the Day,5
George Washington,george_washington@email.com,Principal for the Day,5`;

    csvData = parseCSV(sampleCsvContent);
    
    if (csvData.headers.length > 0) {
      // Set up column mapping for the sample data
      columnMapping.name = 'Donor Name';
      columnMapping.email = 'Email';
      columnMapping.tickets = 'Quantity';
      columnMapping.prize = 'Prize';
      
      // Save to store and navigate to configure page
      setCSVData(csvData, columnMapping);
      goto('/configure');
    }
  }
</script>

{#if !$isAuthenticated}
  <!-- Marketing Home Page -->
  <div class="marketing-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-icon">🎰</div>
        <h1 class="hero-title">Raffle Winner Picker</h1>
        <p class="hero-subtitle">
          Make conducting fair drawings simple and fun. Upload your participant list, 
          watch the animated selection process, and share your results with confidence.
        </p>
        <button class="cta-button" on:click={loginWithRedirect}>
          <span class="cta-icon">🔐</span>
          <span>Get Started - Sign In</span>
        </button>
        <p class="cta-subtext">Free to use • Secure • Transparent</p>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <h2 class="section-title">Why Choose Raffle Winner Picker?</h2>
      <p class="section-subtitle">
        Everything you need to run fair, transparent raffles that everyone can trust
      </p>
      
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">📤</div>
          <h3 class="feature-title">Easy Upload</h3>
          <p class="feature-description">
            Drop your CSV file with participant names, emails, and ticket quantities. 
            We'll automatically detect your columns and get you started in seconds.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🎪</div>
          <h3 class="feature-title">Live Animation</h3>
          <p class="feature-description">
            Animated terminal-style visualization displays each participant during selection. 
            Every participant is shown to ensure complete transparency.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3 class="feature-title">Smart Prizes</h3>
          <p class="feature-description">
            Support multiple prizes with different winner counts per prize. 
            Perfect for complex raffles with various prize tiers.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3 class="feature-title">Secure & Private</h3>
          <p class="feature-description">
            Your data is protected with enterprise-grade authentication. 
            Results are private by default, public only when you choose.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📋</div>
          <h3 class="feature-title">Instant Results</h3>
          <p class="feature-description">
            Download winner lists and share public links to your raffle results. 
            Export to CSV for record keeping and notifications.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3 class="feature-title">Complete History</h3>
          <p class="feature-description">
            Access all your past raffles anytime. Full audit trail ensures 
            accountability and transparency for every drawing.
          </p>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section class="how-it-works-section">
      <h2 class="section-title">How It Works</h2>
      <p class="section-subtitle">Get started in minutes with our simple 5-step process</p>
      
      <div class="steps-container">
        <div class="step">
          <div class="step-number">1</div>
          <h3 class="step-title">Sign In</h3>
          <p class="step-description">
            Sign in with Google, GitHub, or email. Your account keeps all your raffles organized and secure.
          </p>
        </div>

        <div class="step">
          <div class="step-number">2</div>
          <h3 class="step-title">Upload CSV</h3>
          <p class="step-description">
            Upload your participant list with names, emails, tickets, and prizes. We'll detect your columns automatically.
          </p>
        </div>

        <div class="step">
          <div class="step-number">3</div>
          <h3 class="step-title">Configure</h3>
          <p class="step-description">
            Set up your prizes and specify how many winners you want for each. Customize timing for the selection animation.
          </p>
        </div>

        <div class="step">
          <div class="step-number">4</div>
          <h3 class="step-title">Run Raffle</h3>
          <p class="step-description">
            Hit start and watch the exciting animated selection. Every participant is displayed to ensure complete transparency.
          </p>
        </div>

        <div class="step">
          <div class="step-number">5</div>
          <h3 class="step-title">Share Results</h3>
          <p class="step-description">
            Download results, make them public, and share the link. Perfect for stakeholders and participants to verify fairness.
          </p>
        </div>
      </div>
    </section>

    <!-- Trust Section -->
    <section class="trust-section">
      <h2 class="section-title">Fair & Transparent Selection</h2>
      <div class="trust-grid">
        <div class="trust-item">
          <div class="trust-icon">🎲</div>
          <h3 class="trust-title">True Randomization</h3>
          <p class="trust-description">
            Using proven random number generation to ensure every participant has an equal chance based on their ticket count.
          </p>
        </div>

        <div class="trust-item">
          <div class="trust-icon">👁️</div>
          <h3 class="trust-title">Transparent Process</h3>
          <p class="trust-description">
            Watch the selection happen in real-time with every participant displayed on screen during the drawing.
          </p>
        </div>

        <div class="trust-item">
          <div class="trust-icon">✅</div>
          <h3 class="trust-title">Verifiable Results</h3>
          <p class="trust-description">
            Complete audit trail and permanent records of all selections. Results cannot be edited after drawing.
          </p>
        </div>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section class="use-cases-section">
      <h2 class="section-title">Perfect For</h2>
      <div class="use-cases-grid">
        <div class="use-case">
          <div class="use-case-icon">❤️</div>
          <h3 class="use-case-title">Charity Fundraisers</h3>
          <p class="use-case-description">Transparent drawings build donor trust</p>
        </div>

        <div class="use-case">
          <div class="use-case-icon">🏢</div>
          <h3 class="use-case-title">Company Events</h3>
          <p class="use-case-description">Fair employee giveaways and contests</p>
        </div>

        <div class="use-case">
          <div class="use-case-icon">🎓</div>
          <h3 class="use-case-title">Schools & Nonprofits</h3>
          <p class="use-case-description">Fundraising events and activities</p>
        </div>

        <div class="use-case">
          <div class="use-case-icon">🌐</div>
          <h3 class="use-case-title">Online Events</h3>
          <p class="use-case-description">Virtual conferences and webinar prizes</p>
        </div>

        <div class="use-case">
          <div class="use-case-icon">🏘️</div>
          <h3 class="use-case-title">Community Organizations</h3>
          <p class="use-case-description">Local raffles and door prizes</p>
        </div>

        <div class="use-case">
          <div class="use-case-icon">🏆</div>
          <h3 class="use-case-title">Social Media Contests</h3>
          <p class="use-case-description">Fair selection from engagement</p>
        </div>
      </div>
    </section>

    <!-- Final CTA Section -->
    <section class="final-cta-section">
      <div class="final-cta-content">
        <h2 class="final-cta-title">Ready to Run Your Raffle?</h2>
        <p class="final-cta-subtitle">
          Join thousands of organizers running fair, transparent raffles
        </p>
        <button class="cta-button cta-button-large" on:click={loginWithRedirect}>
          <span class="cta-icon">🚀</span>
          <span>Get Started Now - Sign In</span>
        </button>
        <p class="cta-subtext">No credit card required • Free to use</p>
      </div>
    </section>

    <!-- Footer -->
    <footer class="marketing-footer">
      <p class="footer-text">
        Made with ❤️ for fair and transparent raffles
      </p>
    </footer>
  </div>
{:else}
  <!-- Main Application -->
  <div class="min-h-screen bg-gray-50">
    <!-- Modern Header -->
    <header class="header-modern">
      <div class="header-content">
        <div class="header-brand">
          <div class="brand-icon">
            <div class="dice-icon">🎲</div>
          </div>
          <div class="brand-text">
            <h1 class="brand-title">Raffle Winner Picker</h1>
            <div class="brand-subtitle">Fair & Transparent Drawings</div>
          </div>
        </div>
        
        <div class="header-actions">
          <nav class="header-nav">
            <a href="/my-entries" class="nav-link">
              <span class="nav-icon">🎫</span>
              My Entries
            </a>
            <a href="/my-raffles" class="nav-link">
              <span class="nav-icon">🏆</span>
              My Raffles
            </a>
          </nav>
          <div class="user-info">
            <div class="user-avatar">
              {($user?.name || 'User').charAt(0).toUpperCase()}
            </div>
            <div class="user-details">
              <div class="user-name">{$user?.name || 'User'}</div>
              <div class="user-email">{$user?.email || ''}</div>
            </div>
          </div>
          <button class="sign-out-btn" on:click={logout}>
            <span class="sign-out-icon">↗</span>
            Sign Out
          </button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <!-- Upload Interface -->
      <div class="upload-container-wrapper">
        <div class="upload-container">
          <div class="upload-header">
            <div class="upload-icon">📊</div>
            <h2 class="upload-title">Upload Raffle Entries</h2>
            <p class="upload-subtitle">Select a CSV file with your participant data</p>
          </div>
          
          <div class="upload-dropzone" class:hover={false}>
            <div class="upload-visual">
              <div class="upload-symbol">📄</div>
            </div>
            
            <div class="upload-text">
              <p class="upload-main-text">Drop your CSV file here</p>
              <p class="upload-sub-text">or click to browse</p>
            </div>
            
            <input
              bind:this={fileInput}
              type="file"
              accept=".csv"
              on:change={handleFileUpload}
              class="upload-input"
            />
            
            <button
              class="upload-button"
              on:click={() => fileInput?.click()}
            >
              <span class="upload-button-icon">📁</span>
              Choose CSV File
            </button>
          </div>
          
          <div class="format-info">
            <div class="format-header">
              <span class="format-icon">📋</span>
              <span class="format-title">Expected Format</span>
            </div>
            <div class="format-example">
              <div class="format-code">
                Name,Email,Tickets,Prize<br>
                John Doe,john@example.com,3,Grand Prize<br>
                Jane Smith,jane@example.com,1,Second Place<br>
                Bob Wilson,bob@example.com,2,Grand Prize
              </div>
            </div>
          </div>
          
          <div class="sample-data-section">
            <div class="sample-divider">
              <div class="sample-divider-line"></div>
              <span class="sample-divider-text">or</span>
              <div class="sample-divider-line"></div>
            </div>
            
            <button class="sample-data-button" on:click={useSampleData}>
              <span class="sample-data-icon">🎲</span>
              Use Sample Data for Demo
            </button>
            <p class="sample-data-note">
              ✨ Try the app with realistic sample raffle data
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
{/if}

<style>
  /* Marketing Page Styles */
  .marketing-page {
    min-height: 100vh;
    background: #f8fafc;
  }

  /* Hero Section */
  .hero-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 6rem 2rem;
    text-align: center;
    color: white;
  }

  .hero-content {
    max-width: 56rem;
    margin: 0 auto;
  }

  .hero-icon {
    font-size: 5rem;
    margin-bottom: 1.5rem;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  }

  .hero-title {
    font-size: 3.5rem;
    font-weight: 700;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .hero-subtitle {
    font-size: 1.25rem;
    line-height: 1.8;
    margin: 0 0 2.5rem 0;
    opacity: 0.95;
    max-width: 48rem;
    margin-left: auto;
    margin-right: auto;
  }

  .cta-button {
    background: white;
    color: #667eea;
    border: none;
    padding: 1.25rem 3rem;
    border-radius: 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
  }

  .cta-button:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.3);
  }

  .cta-button-large {
    padding: 1.5rem 3.5rem;
    font-size: 1.25rem;
  }

  .cta-icon {
    font-size: 1.5rem;
  }

  .cta-subtext {
    margin-top: 1rem;
    font-size: 0.875rem;
    opacity: 0.9;
  }

  /* Features Section */
  .features-section {
    padding: 5rem 2rem;
    max-width: 80rem;
    margin: 0 auto;
  }

  .section-title {
    font-size: 2.5rem;
    font-weight: 700;
    text-align: center;
    color: #1e293b;
    margin: 0 0 1rem 0;
  }

  .section-subtitle {
    font-size: 1.125rem;
    text-align: center;
    color: #64748b;
    margin: 0 0 3rem 0;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .feature-card {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
    border: 1px solid #e2e8f0;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  }

  .feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .feature-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.75rem 0;
  }

  .feature-description {
    color: #64748b;
    line-height: 1.6;
    margin: 0;
  }

  /* How It Works Section */
  .how-it-works-section {
    padding: 5rem 2rem;
    background: white;
  }

  .steps-container {
    max-width: 60rem;
    margin: 0 auto;
    display: grid;
    gap: 2.5rem;
  }

  .step {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  .step-number {
    width: 3.5rem;
    height: 3.5rem;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .step-description {
    color: #64748b;
    line-height: 1.6;
    margin: 0;
  }

  /* Trust Section */
  .trust-section {
    padding: 5rem 2rem;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  }

  .trust-grid {
    max-width: 80rem;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
  }

  .trust-item {
    text-align: center;
    padding: 2rem;
  }

  .trust-icon {
    font-size: 3.5rem;
    margin-bottom: 1rem;
  }

  .trust-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.75rem 0;
  }

  .trust-description {
    color: #64748b;
    line-height: 1.6;
    margin: 0;
  }

  /* Use Cases Section */
  .use-cases-section {
    padding: 5rem 2rem;
    max-width: 80rem;
    margin: 0 auto;
  }

  .use-cases-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .use-case {
    background: white;
    padding: 1.5rem;
    border-radius: 0.75rem;
    text-align: center;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;
  }

  .use-case:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }

  .use-case-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
  }

  .use-case-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .use-case-description {
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
  }

  /* Final CTA Section */
  .final-cta-section {
    padding: 6rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    text-align: center;
    color: white;
  }

  .final-cta-content {
    max-width: 48rem;
    margin: 0 auto;
  }

  .final-cta-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
  }

  .final-cta-subtitle {
    font-size: 1.25rem;
    margin: 0 0 2.5rem 0;
    opacity: 0.95;
  }

  /* Footer */
  .marketing-footer {
    background: #1e293b;
    color: white;
    text-align: center;
    padding: 2rem;
  }

  .footer-text {
    margin: 0;
    opacity: 0.8;
  }

  /* Marketing Responsive Design */
  @media (max-width: 768px) {
    .hero-section {
      padding: 4rem 1.5rem;
    }

    .hero-icon {
      font-size: 3.5rem;
    }

    .hero-title {
      font-size: 2.5rem;
    }

    .hero-subtitle {
      font-size: 1rem;
    }

    .cta-button {
      padding: 1rem 2rem;
      font-size: 1rem;
    }

    .cta-button-large {
      padding: 1.25rem 2.5rem;
      font-size: 1.125rem;
    }

    .section-title {
      font-size: 2rem;
    }

    .section-subtitle {
      font-size: 1rem;
    }

    .features-section,
    .how-it-works-section,
    .trust-section,
    .use-cases-section {
      padding: 3rem 1.5rem;
    }

    .step {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .step-number {
      margin: 0 auto;
    }

    .final-cta-section {
      padding: 4rem 1.5rem;
    }

    .final-cta-title {
      font-size: 2rem;
    }

    .final-cta-subtitle {
      font-size: 1rem;
    }
  }

  /* Modern Header Styles */
  .header-modern {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 
      0 4px 20px rgba(0, 0, 0, 0.1),
      0 1px 3px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 1000;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-content {
    max-width: 80rem;
    margin: 0 auto;
    padding: 0.5rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .brand-icon {
    width: 2.5rem;
    height: 2.5rem;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dice-icon {
    font-size: 1.5rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .brand-text {
    color: white;
  }

  .brand-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .brand-subtitle {
    font-size: 0.875rem;
    opacity: 0.9;
    font-weight: 300;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .header-nav {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    color: white;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }

  .nav-link:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .nav-icon {
    font-size: 1rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 2.5rem;
    height: 2.5rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .user-details {
    color: white;
    text-align: right;
  }

  .user-name {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .user-email {
    font-size: 0.75rem;
    opacity: 0.8;
    margin-top: 0.125rem;
  }

  .sign-out-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sign-out-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .sign-out-icon {
    font-size: 1rem;
    transform: rotate(45deg);
  }

  /* Main Content Styles */
  .main-content {
    min-height: calc(100vh - 80px);
    padding: 1rem 0.25rem;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow-y: auto;
    padding-top: 2rem;
  }

  .upload-container-wrapper {
    max-width: 450px;
    width: 100%;
  }

  /* Upload Container Styles */
  .upload-container {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e1e5e9;
    border-radius: 1.25rem;
    padding: 1.25rem;
    box-shadow: 
      0 10px 25px rgba(0, 0, 0, 0.1),
      0 4px 10px rgba(0, 0, 0, 0.05);
  }

  .upload-header {
    text-align: center;
    margin-bottom: 1rem;
  }

  .upload-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
  }

  .upload-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.375rem 0;
  }

  .upload-subtitle {
    color: #64748b;
    font-size: 0.9375rem;
    margin: 0;
  }

  .upload-dropzone {
    border: 2px dashed #cbd5e1;
    border-radius: 0.875rem;
    padding: 1.5rem 1.25rem;
    text-align: center;
    background: linear-gradient(145deg, #f8fafc, #ffffff);
    transition: all 0.3s ease;
    position: relative;
    cursor: pointer;
    margin-bottom: 1.25rem;
  }

  .upload-dropzone:hover {
    border-color: #3b82f6;
    background: linear-gradient(145deg, #eff6ff, #f8fafc);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
  }

  .upload-visual {
    margin-bottom: 0.75rem;
  }

  .upload-symbol {
    font-size: 2rem;
    color: #94a3b8;
    font-weight: 300;
    display: inline-block;
  }

  .upload-text {
    margin-bottom: 1.25rem;
  }

  .upload-main-text {
    font-size: 1rem;
    font-weight: 500;
    color: #374151;
    margin: 0 0 0.375rem 0;
  }

  .upload-sub-text {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
  }

  .upload-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .upload-button {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 0.75rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
  }

  .upload-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
  }

  .upload-button-icon {
    font-size: 1.125rem;
  }

  .format-info {
    background: linear-gradient(145deg, #f1f5f9, #e2e8f0);
    border-radius: 0.875rem;
    padding: 0.875rem;
    border: 1px solid #e2e8f0;
  }

  .format-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .format-icon {
    font-size: 1.25rem;
  }

  .format-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .format-example {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.875rem;
    margin-bottom: 0.75rem;
  }

  .format-code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.8125rem;
    color: #374151;
    line-height: 1.5;
  }


  /* Sample Data Styles */
  .sample-data-section {
    margin-top: 1rem;
    text-align: center;
  }

  .sample-divider {
    display: flex;
    align-items: center;
    margin: 1rem 0;
    gap: 1rem;
  }

  .sample-divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
  }

  .sample-divider-text {
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sample-data-button {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    margin-bottom: 0.5rem;
  }

  .sample-data-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
    background: linear-gradient(135deg, #059669, #047857);
  }

  .sample-data-icon {
    font-size: 1rem;
  }

  .sample-data-note {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-style: italic;
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .header-content {
      padding: 0.375rem 0.75rem;
    }
    
    .brand-title {
      font-size: 1.125rem;
    }
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 0.5rem 0.75rem;
    }
    
    .brand-title {
      font-size: 1rem;
    }
    
    .user-info {
      display: none;
    }
    
    .header-nav {
      gap: 0.5rem;
    }
    
    .nav-link {
      padding: 0.5rem;
      font-size: 0.8rem;
    }
    
    .main-content {
      padding: 0.5rem 0.125rem;
      padding-top: 1rem;
    }
  }
</style>