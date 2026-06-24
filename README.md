# Casper Agentic Portfolio Copilot (CAP Copilot)

**CAP Copilot** is a premium, AI-driven portfolio dashboard and Model Context Protocol (MCP) server designed for the **Casper Agentic Buildathon 2026**. It empowers users to interact with an intelligent agent to monitor wallets, analyze validator staking options, track real-world asset (RWA) compliance, and prepare on-chain transactions on the Casper Testnet.

---

## Features
1. **Interactive AI Agent Studio**: Conversational chat interface backed by a custom Casper Model Context Protocol (MCP) tool caller.
2. **Casper MCP Server**: Custom Node.js/TypeScript server exposing Casper-specific blockchain query and transaction generation tools.
3. **Premium Web Dashboard**: Immersive dark-mode glassmorphic user interface featuring responsive token allocation charts and live transaction logging.
4. **On-Chain Deploy Sandbox**: Generates fully structured Casper transaction JSON deploys ready for signing and broadcasting.
5. **RWA Risk & Compliance Engine**: Simulated loan-to-value (LTV) validator for collateralized physical assets.

---

## Tech Stack
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom design system, glassmorphism, responsive grid), JavaScript (ES6+, Chart.js, RemixIcons).
- **Backend/MCP Server**: Node.js, Express, TypeScript, `@modelcontextprotocol/sdk`, `casper-js-sdk`.

---

## Installation & Setup

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)

### Setup Steps
1. **Clone or navigate** to the project directory:
   ```bash
   cd C:\Users\Hipiclab03\.gemini\antigravity\scratch\casper-agentic-suite
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the TypeScript files**:
   ```bash
   npm run build
   ```

4. **Start the server**:
   ```bash
   npm run start
   ```

The application will start, listening on port `3000`. Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## Model Context Protocol (MCP) Tools Exposed
- `get_account_balance`: Retrieve the CSPR balance of a public key.
- `get_staking_yields`: Retrieve current staking options and validator APYs.
- `prepare_transfer`: Generate a transfer transaction JSON ready for signing.
- `prepare_delegation`: Generate a delegation staking transaction JSON.
- `analyze_rwa_risk`: Analyze loan-to-value status for collateralized real-world assets.

---

## Project Structure
```
casper-agentic-suite/
├── src/
│   ├── server.ts      # Main Express API and MCP Server Tools definition
│   └── agent.ts       # Agent reasoning engine and tool orchestration
├── public/
│   ├── index.html     # Dashboard layout
│   ├── index.css      # Premium styling (design tokens, glassmorphism)
│   └── app.js         # Frontend controller and client-side transaction simulator
├── package.json       # Dependencies and build scripts
└── tsconfig.json      # TypeScript compiler settings
```
