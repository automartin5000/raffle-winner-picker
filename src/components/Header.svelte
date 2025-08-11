<script lang="ts">
  import { user, logout } from '../lib/auth';
</script>

<header class="header-modern">
  <div class="header-content">
    <div class="header-brand">
      <a href="/" class="brand-link">
        <div class="brand-icon">
          <div class="dice-icon">🎲</div>
        </div>
        <div class="brand-text">
          <h1 class="brand-title">Raffle Winner Picker</h1>
          <div class="brand-subtitle">Fair & Transparent Drawings</div>
        </div>
      </a>
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

<style>
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

  .brand-link {
    display: flex;
    align-items: center;
    gap: 1rem;
    text-decoration: none;
    color: inherit;
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
  }
</style>