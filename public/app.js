// CAP Copilot Client-Side Application Logic

// App State
let walletConnected = false;
let activePublicKey = '0124ba60a2b8e5c3e7f41f021e15ab9c9d4ff843a85b9b6ff8c4fbeea37d825c9b';
let mockBalanceCspr = 1250.00;
let mockStakedCspr = 450.00;
let mockRwaCspr = 200.00;
let chatHistory = [];
let pendingDeploy = null;
let chartInstance = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateBalanceUI();
  initAllocationChart();
  loadValidatorYields();
  
  // Set up initial greeting in chat history
  chatHistory.push({ role: 'agent', content: 'Hello! I am your Casper Agentic Portfolio Copilot (CAP). 🤖' });
});

// Event Listeners Setup
function setupEventListeners() {
  // Chat elements
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send-chat');
  const btnClearChat = document.getElementById('btn-clear-chat');
  
  btnSend.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  
  btnClearChat.addEventListener('click', () => {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = `
      <div class="message system">
        <div class="message-content">
          <p><strong>System Note:</strong> Chat history cleared. CAP Copilot is ready.</p>
        </div>
      </div>
    `;
    chatHistory = [];
  });

  // Quick Prompts
  const quickBtns = document.querySelectorAll('.quick-prompt-btn');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      chatInput.value = e.target.textContent;
      sendChatMessage();
    });
  });

  // Wallet and balance refresh
  const btnCheckBalance = document.getElementById('btn-check-balance');
  const btnGenerateWallet = document.getElementById('btn-generate-wallet');
  const btnFaucet = document.getElementById('btn-faucet');
  const pkInput = document.getElementById('public-key-input');
  
  btnCheckBalance.addEventListener('click', refreshBalance);
  btnGenerateWallet.addEventListener('click', generateTestWallet);
  if (btnFaucet) {
    btnFaucet.addEventListener('click', claimFaucetCSPR);
  }
  
  pkInput.addEventListener('change', (e) => {
    activePublicKey = e.target.value.trim();
    refreshBalance();
  });

  // Deploy sandbox actions
  const btnSignDeploy = document.getElementById('btn-sign-deploy');
  btnSignDeploy.addEventListener('click', signAndBroadcastDeploy);
}

// Faucet funding mock function
function claimFaucetCSPR() {
  mockBalanceCspr += 1000.00;
  updateBalanceUI();
  updateChartData();
  
  const logList = document.getElementById('log-list');
  const emptyLog = logList.querySelector('.log-empty');
  if (emptyLog) emptyLog.remove();
  
  const chars = '0123456789abcdef';
  let claimHash = 'faucet-claim-';
  for (let i = 0; i < 16; i++) {
    claimHash += chars[Math.floor(Math.random() * 16)];
  }
  
  const logItem = document.createElement('div');
  logItem.className = 'log-item';
  logItem.style.borderLeftColor = '#10b981'; // Green for funding
  logItem.innerHTML = `
    <div class="title-row">
      <span>Faucet Fund</span>
      <span style="color: #10b981">+1,000 CSPR</span>
    </div>
    <div class="hash">Tx: ${claimHash}</div>
    <div class="meta" style="font-size: 0.65rem; color: var(--color-text-muted);">
      Source: Casper Testnet Faucet
    </div>
  `;
  logList.insertBefore(logItem, logList.firstChild);
  
  appendMessage('system', `⛲ Faucet funded: Added 1,000 CSPR to account ${activePublicKey.slice(0,8)}...`);
}

// Generate a random Casper key pair mock for local testing
function generateTestWallet() {
  const chars = '0123456789abcdef';
  let randomKey = '01'; // Casper keys start with 01 or 02
  for (let i = 0; i < 64; i++) {
    randomKey += chars[Math.floor(Math.random() * 16)];
  }
  
  const pkInput = document.getElementById('public-key-input');
  pkInput.value = randomKey;
  activePublicKey = randomKey;
  
  // Set random mock balance
  mockBalanceCspr = Math.floor(Math.random() * 5000) + 500;
  mockStakedCspr = 0;
  mockRwaCspr = 0;
  
  walletConnected = true;
  const badge = document.getElementById('wallet-badge');
  badge.classList.add('connected');
  document.getElementById('wallet-status').textContent = 'Connected (Mock)';
  
  updateBalanceUI();
  updateChartData();
  
  // Inform agent
  appendMessage('system', `System: Connected mock wallet public key ${randomKey.slice(0,8)}...`);
}

// Query balance from local backend (which queries Casper Testnet or uses fallback)
async function refreshBalance() {
  const pkInput = document.getElementById('public-key-input').value.trim();
  if (!pkInput) return;
  
  activePublicKey = pkInput;
  document.getElementById('balance-amount').textContent = '...';
  
  try {
    const response = await fetch('/api/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'get_account_balance',
        arguments: { publicKey: activePublicKey }
      })
    });
    
    const result = await response.json();
    if (result.data) {
      const realBalance = parseFloat(result.data.balanceCspr);
      if (isNaN(realBalance) || (realBalance === 0 && mockBalanceCspr > 0)) {
        console.log("Account is not active on Testnet; keeping simulated mock balance.");
        appendMessage('system', `Note: Account ${activePublicKey.slice(0,8)}... has 0 CSPR on Testnet. Using mock balance for simulation.`);
      } else {
        mockBalanceCspr = realBalance;
      }
      updateBalanceUI();
      updateChartData();
      
      walletConnected = true;
      const badge = document.getElementById('wallet-badge');
      badge.classList.add('connected');
      document.getElementById('wallet-status').textContent = 'Connected';
    }
  } catch (error) {
    console.error('Balance fetch failed:', error);
    // Fallback if backend is down
    document.getElementById('balance-amount').textContent = mockBalanceCspr.toFixed(2);
  }
}

function updateBalanceUI() {
  document.getElementById('balance-amount').textContent = mockBalanceCspr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const motes = Math.floor(mockBalanceCspr * 1_000_000_000);
  document.getElementById('balance-motes').textContent = `${motes.toLocaleString()} motes`;
}

// Initialize Doughnut Allocation Chart
function initAllocationChart() {
  const ctx = document.getElementById('allocation-chart').getContext('2d');
  
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Available CSPR', 'Staked/Delegated', 'RWA Vaults'],
      datasets: [{
        data: [mockBalanceCspr, mockStakedCspr, mockRwaCspr],
        backgroundColor: [
          '#ff761c', // Casper Orange
          '#8b5cf6', // Agent Purple
          '#10b981'  // Emerald Green
        ],
        borderWidth: 2,
        borderColor: '#0f1225',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      cutout: '70%'
    }
  });
}

function updateChartData() {
  if (chartInstance) {
    chartInstance.data.datasets[0].data = [mockBalanceCspr, mockStakedCspr, mockRwaCspr];
    chartInstance.update();
  }
}

// Load Validator APY list from backend
async function loadValidatorYields() {
  const yieldList = document.getElementById('yield-list');
  
  try {
    const response = await fetch('/api/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'get_staking_yields',
        arguments: {}
      })
    });
    
    const result = await response.json();
    if (result.data) {
      yieldList.innerHTML = '';
      result.data.forEach(v => {
        const item = document.createElement('div');
        item.className = 'yield-item';
        item.innerHTML = `
          <div class="validator-info">
            <span class="addr" title="${v.validatorPublicKey}">${v.validatorPublicKey.slice(0, 10)}...${v.validatorPublicKey.slice(-8)}</span>
            <span class="meta">${v.totalStakedCspr} Staked • ${v.delegatorCount} Delegators</span>
          </div>
          <div class="yield-value">
            <span class="apy">${v.estimatedApy}</span>
            <div class="fee">Fee: ${v.commissionRate}</div>
          </div>
        `;
        
        // Let user click a validator to autofill delegation staking action
        item.addEventListener('click', () => {
          const chatInput = document.getElementById('chat-input');
          chatInput.value = `Prepare delegation of 100 CSPR to validator ${v.validatorPublicKey}`;
          chatInput.focus();
        });
        
        yieldList.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Failed to load yields:', error);
    yieldList.innerHTML = '<div class="log-empty"><p>Failed to connect to Casper Testnet RPC node. Staking list offline.</p></div>';
  }
}

// Send user chat message to agent backend
async function sendChatMessage() {
  const chatInput = document.getElementById('chat-input');
  const messageText = chatInput.value.trim();
  if (!messageText) return;

  // Append user message to feed
  appendMessage('user', messageText);
  chatInput.value = '';
  
  // Show thinking indicator
  const thinkingId = showThinkingBubble();
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageText,
        history: chatHistory,
        senderPublicKey: activePublicKey
      })
    });

    const result = await response.json();
    
    // Remove thinking indicator
    removeThinkingBubble(thinkingId);
    
    // Append agent message to feed
    appendMessage('agent', result.response);
    
    // Save to history
    chatHistory.push({ role: 'user', content: messageText });
    chatHistory.push({ role: 'agent', content: result.response });

    // Handle tool callbacks
    if (result.toolCalled) {
      handleToolOutput(result.toolCalled, result.toolData);
    }
    
  } catch (error) {
    console.error('Chat error:', error);
    removeThinkingBubble(thinkingId);
    appendMessage('agent', `Sorry, I had trouble reaching the AI coordinator. Please check that the server is running on port 3000.`);
  }
}

// Render message in chat feed
function appendMessage(sender, text) {
  const feed = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  if (sender === 'system') {
    messageDiv.innerHTML = `
      <div class="message-content">
        <p>${text}</p>
      </div>
    `;
  } else {
    const avatarIcon = sender === 'agent' ? 'ri-robot-2-line' : 'ri-user-line';
    const senderName = sender === 'agent' ? 'CAP Agent' : 'You';
    
    // Convert markdown bold/code backticks to simple HTML for presentation
    const formattedText = text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');

    messageDiv.innerHTML = `
      <div class="avatar"><i class="${avatarIcon}"></i></div>
      <div class="message-body">
        <div class="message-content">
          <p>${formattedText}</p>
        </div>
        <div class="message-meta">${senderName} • Just now</div>
      </div>
    `;
  }
  
  feed.appendChild(messageDiv);
  feed.scrollTop = feed.scrollHeight;
}

// Show animated dot thinking indicator
function showThinkingBubble() {
  const feed = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  const id = 'thinking-' + Date.now();
  bubble.id = id;
  bubble.className = 'message agent thinking';
  bubble.innerHTML = `
    <div class="avatar"><i class="ri-robot-2-line"></i></div>
    <div class="message-body">
      <div class="message-content">
        <div class="loading-spinner" style="padding: 0; font-size: 0.8rem;">
          <i class="ri-loader-4-line spin"></i> Agent is thinking...
        </div>
      </div>
    </div>
  `;
  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;
  return id;
}

function removeThinkingBubble(id) {
  const bubble = document.getElementById(id);
  if (bubble) bubble.remove();
}

// Route tools data to specific widget updates
function handleToolOutput(toolName, data) {
  console.log(`[Frontend] Processing tool output for "${toolName}":`, data);
  
  if (toolName === 'get_account_balance') {
    if (data) {
      mockBalanceCspr = data.balanceCspr || 0;
      updateBalanceUI();
      updateChartData();
    }
  } 
  else if (toolName === 'prepare_transfer' || toolName === 'prepare_delegation') {
    // Load generated deploy JSON into sandbox viewer
    pendingDeploy = data;
    const viewer = document.getElementById('deploy-json-viewer');
    viewer.textContent = JSON.stringify(data.deployJson, null, 2);
    
    // Set status badge and enable buttons
    const badge = document.getElementById('deploy-badge');
    badge.className = 'badge active';
    badge.textContent = 'Pending Sign';
    
    const btn = document.getElementById('btn-sign-deploy');
    btn.removeAttribute('disabled');
  }
  else if (toolName === 'analyze_rwa_risk') {
    // Deduct x402 micropayment fee (0.05 CSPR)
    const x402Fee = 0.05;
    mockBalanceCspr -= x402Fee;
    updateBalanceUI();

    // Log the x402 payment event
    const logList = document.getElementById('log-list');
    const emptyLog = logList.querySelector('.log-empty');
    if (emptyLog) emptyLog.remove();

    const chars = '0123456789abcdef';
    let x402Hash = 'x402-proof-';
    for (let i = 0; i < 16; i++) {
      x402Hash += chars[Math.floor(Math.random() * 16)];
    }

    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    logItem.style.borderLeftColor = '#3b82f6'; // Blue border for x402
    logItem.innerHTML = `
      <div class="title-row">
        <span>x402 Micropayment</span>
        <span style="color: #3b82f6">-0.05 CSPR</span>
      </div>
      <div class="hash">Proof: ${x402Hash}</div>
      <div class="meta" style="font-size: 0.65rem; color: var(--color-text-muted);">
        Target: RWA Risk Evaluator API
      </div>
    `;
    logList.insertBefore(logItem, logList.firstChild);

    // Load collateral status widget
    const rwaArea = document.getElementById('rwa-status-area');
    const isSafe = data.riskRating === 'Low' || data.riskRating === 'Moderate';
    const riskColor = data.color;
    
    // Update active vault mock asset values
    if (isSafe) {
      mockRwaCspr += data.requestedLoanUsd / 2; // Simulated CSPR valuation
    }
    updateChartData();
    
    rwaArea.innerHTML = `
      <div class="rwa-loaded-card">
        <div class="rwa-header-row">
          <h4>${data.assetName}</h4>
          <span class="rwa-risk-badge" style="background: ${riskColor}22; color: ${riskColor}; border: 1px solid ${riskColor}44;">
            ${data.riskRating} Risk
          </span>
        </div>
        <div class="rwa-stat-grid">
          <div class="rwa-stat-item">
            <span class="label">Collateral Value</span>
            <span class="val">$${data.collateralValueUsd.toLocaleString()}</span>
          </div>
          <div class="rwa-stat-item">
            <span class="label">Requested Loan</span>
            <span class="val">$${data.requestedLoanUsd.toLocaleString()}</span>
          </div>
        </div>
        <span class="label">Health Index (${data.healthScore}/100)</span>
        <div class="rwa-health-bar">
          <div class="rwa-health-fill" style="width: ${data.healthScore}%; background-color: ${riskColor};"></div>
        </div>
        <div class="rwa-summary-box">
          LTV ratio stands at <strong>${data.ltv.toFixed(1)}%</strong>. Positions exceeding 80% LTV are automatically flagged for liquidation reviews on Casper.
        </div>
      </div>
    `;
  }
}

// Sign and broadcast transaction
async function signAndBroadcastDeploy() {
  if (!pendingDeploy) return;
  
  const btn = document.getElementById('btn-sign-deploy');
  const badge = document.getElementById('deploy-badge');
  const viewer = document.getElementById('deploy-json-viewer');
  
  btn.setAttribute('disabled', 'true');
  btn.innerHTML = `<i class="ri-loader-4-line spin"></i> Broadcasting to Casper Testnet...`;
  
  // Simulate 1.5 seconds network delay for cryptographic signing and node broadcast
  setTimeout(() => {
    btn.innerHTML = `<i class="ri-check-line"></i> Transaction Success`;
    badge.className = 'badge';
    badge.textContent = 'Idle';
    
    // Append to deploy logs panel
    const logList = document.getElementById('log-list');
    const emptyLog = logList.querySelector('.log-empty');
    if (emptyLog) emptyLog.remove();
    
    const isStaking = pendingDeploy.validatorPublicKey !== undefined;
    const amount = pendingDeploy.amountCspr;
    const fee = pendingDeploy.gasFeeCspr;
    const hash = pendingDeploy.deployHash;
    const action = isStaking ? 'Delegate' : 'Transfer';
    
    const logItem = document.createElement('div');
    logItem.className = `log-item ${isStaking ? 'delegate' : 'transfer'}`;
    logItem.innerHTML = `
      <div class="title-row">
        <span>${action} CSPR</span>
        <span style="color: ${isStaking ? '#8b5cf6' : '#ff761c'}">${amount} CSPR</span>
      </div>
      <div class="hash">Hash: ${hash.slice(0,10)}...${hash.slice(-8)}</div>
      <div class="meta" style="font-size: 0.65rem; color: var(--color-text-muted);">
        Fee: ${fee} CSPR • Success
      </div>
    `;
    logList.insertBefore(logItem, logList.firstChild);
    
    // Update local balances based on transaction details
    const totalDeducted = parseFloat(amount) + parseFloat(fee);
    if (isStaking) {
      mockBalanceCspr -= totalDeducted;
      mockStakedCspr += parseFloat(amount);
    } else {
      mockBalanceCspr -= totalDeducted;
    }
    
    updateBalanceUI();
    updateChartData();
    
    // Clear sandbox
    pendingDeploy = null;
    viewer.textContent = `{ "info": "Deploy successful! Hash: ${hash}" }`;
    
    // Notify in chat
    appendMessage('system', `📡 Broadcast complete. Hash: ${hash}. Block confirmed successfully.`);
    
    setTimeout(() => {
      btn.innerHTML = `<i class="ri-quill-pen-line"></i> Sign & Broadcast Deploy`;
    }, 2000);
    
  }, 1500);
}
