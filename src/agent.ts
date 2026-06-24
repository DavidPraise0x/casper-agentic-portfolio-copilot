import { Request, Response } from 'express';

// Interface for chat request
interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  senderPublicKey?: string; // Optional context: active wallet connected in UI
}

// Local intent-parser behaving like an LLM Agent, explaining its reasoning,
// calling tools, and returning structured data.
export async function handleAgentChat(req: Request, res: Response) {
  const { message, history, senderPublicKey } = req.body as ChatRequest;
  const lowercaseMsg = message.toLowerCase().trim();

  console.log(`[Agent Chat] Received: "${message}" | Connected Wallet: ${senderPublicKey || 'None'}`);

  const PORT = process.env.PORT || 3000;
  const toolCallUrl = `http://localhost:${PORT}/api/tools/call`;

  try {
    // 1. INTENT: Balance query
    if (lowercaseMsg.includes('balance') || lowercaseMsg.includes('how much') || lowercaseMsg.includes('funds')) {
      // Try to extract a public key (starts with 01 or 02 and is 66 chars)
      const pkMatch = message.match(/(01|02)[a-fA-F0-9]{64}/);
      const targetPublicKey = pkMatch ? pkMatch[0] : senderPublicKey;

      if (!targetPublicKey) {
        return res.json({
          response: "I'd be happy to check your balance, but I need a Casper public key. Please connect your wallet in the dashboard or specify a public key (starting with `01` or `02`).",
          toolCalled: null,
          toolData: null
        });
      }

      // Call tool internally using native fetch
      const toolResponse = await fetch(toolCallUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'get_account_balance',
          arguments: { publicKey: targetPublicKey }
        })
      });

      const toolResult = await toolResponse.json() as any;
      const textResponse = `🔍 **Calling MCP Tool**: \`get_account_balance\` with key \`${targetPublicKey.slice(0, 8)}...${targetPublicKey.slice(-6)}\`\n\n` +
        `Here is the current state on Casper Testnet:\n` +
        `${toolResult.content[0].text}\n\n` +
        `Let me know if you would like me to prepare a transfer, stake some CSPR, or run a yield analysis!`;

      return res.json({
        response: textResponse,
        toolCalled: 'get_account_balance',
        toolData: toolResult.data
      });
    }

    // 2. INTENT: Staking / Staking APY / Yield query
    if (lowercaseMsg.includes('stake') || lowercaseMsg.includes('delegate') || lowercaseMsg.includes('yield') || lowercaseMsg.includes('apy') || lowercaseMsg.includes('validator')) {
      
      const hasAmount = lowercaseMsg.match(/\b\d+(\.\d+)?\b/); // Matches number
      const pkMatches = message.match(/(01|02)[a-fA-F0-9]{64}/g) || [];
      
      if ((lowercaseMsg.includes('prepare') || lowercaseMsg.includes('send') || lowercaseMsg.includes('delegate')) && hasAmount && pkMatches.length > 0) {
        // Prepare delegation deploy
        const amountCspr = hasAmount[0];
        const validatorPublicKey = pkMatches[0]; // first public key is the validator
        
        if (!validatorPublicKey) {
          return res.json({
            response: "Please provide a valid validator public key (starting with 01 or 02).",
            toolCalled: null,
            toolData: null
          });
        }
        
        const delegator = senderPublicKey || (pkMatches.length > 1 ? pkMatches[1] : null);

        if (!delegator) {
          return res.json({
            response: "I found a validator address and amount, but I need your delegator public key. Please connect your wallet in the header or provide your public key so I can generate the delegation transaction.",
            toolCalled: null,
            toolData: null
          });
        }

        const toolResponse = await fetch(toolCallUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'prepare_delegation',
            arguments: {
              delegatorPublicKey: delegator,
              validatorPublicKey,
              amountCspr
            }
          })
        });

        const toolResult = await toolResponse.json() as any;
        const textResponse = `✍️ **Calling MCP Tool**: \`prepare_delegation\`\n` +
          `- **Delegator**: \`${delegator.slice(0, 10)}...\`\n` +
          `- **Validator**: \`${validatorPublicKey.slice(0, 10)}...\`\n` +
          `- **Amount**: \`${amountCspr} CSPR\`\n\n` +
          `**Deploy Payload Generated**:\n` +
          `${toolResult.content[0].text}\n\n` +
          `I have populated this transaction payload into your dashboard. Please click **"Sign Deploy"** in the UI to approve and broadcast this delegation to the Casper Testnet.`;

        return res.json({
          response: textResponse,
          toolCalled: 'prepare_delegation',
          toolData: toolResult.data
        });
      }

      // Default: List validator APYs
      const toolResponse = await fetch(toolCallUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'get_staking_yields',
          arguments: {}
        })
      });

      const toolResult = await toolResponse.json() as any;
      const textResponse = `📈 **Calling MCP Tool**: \`get_staking_yields\`\n\n` +
        `Here are the top-yielding validators active on Casper Testnet:\n\n` +
        `${toolResult.content[0].text}\n` +
        `If you would like to stake, you can tell me: *"Delegate [Amount] CSPR to [Validator Key]"*.`;

      return res.json({
        response: textResponse,
        toolCalled: 'get_staking_yields',
        toolData: toolResult.data
      });
    }

    // 3. INTENT: Transfer prepare query
    if (lowercaseMsg.includes('transfer') || lowercaseMsg.includes('send') || lowercaseMsg.includes('pay')) {
      const pkMatches = message.match(/(01|02)[a-fA-F0-9]{64}/g) || [];
      const hasAmount = lowercaseMsg.match(/\b\d+(\.\d+)?\b/);

      if (pkMatches.length === 0 || !hasAmount) {
        return res.json({
          response: "To prepare a transfer, I need the recipient's public key and the amount of CSPR. For example: *\"Send 10 CSPR to 01cf906e98...\"*",
          toolCalled: null,
          toolData: null
        });
      }

      const amountCspr = hasAmount[0];
      const receiverPublicKey = pkMatches[0];
      
      if (!receiverPublicKey) {
        return res.json({
          response: "Please provide a valid recipient public key (starting with 01 or 02).",
          toolCalled: null,
          toolData: null
        });
      }

      const sender = senderPublicKey || (pkMatches.length > 1 ? pkMatches[1] : null);

      if (!sender) {
        return res.json({
          response: `I've prepared the transfer details (sending ${amountCspr} CSPR to \`${receiverPublicKey.slice(0, 8)}...\`). However, to compile the transaction, I need your sender public key. Please connect your wallet in the dashboard.`,
          toolCalled: null,
          toolData: null
        });
      }

      const toolResponse = await fetch(toolCallUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'prepare_transfer',
          arguments: {
            senderPublicKey: sender,
            receiverPublicKey,
            amountCspr
          }
        })
      });

      const toolResult = await toolResponse.json() as any;
      const textResponse = `💸 **Calling MCP Tool**: \`prepare_transfer\`\n` +
        `- **Sender**: \`${sender.slice(0, 10)}...\`\n` +
        `- **Recipient**: \`${receiverPublicKey.slice(0, 10)}...\`\n` +
        `- **Amount**: \`${amountCspr} CSPR\`\n\n` +
        `**Deploy Payload Generated**:\n` +
        `${toolResult.content[0].text}\n\n` +
        `You can find the transaction payload loaded in the "Deploy Sandbox" on the right. Click **"Sign Deploy"** to sign and publish this transfer to Casper Testnet.`;

      return res.json({
        response: textResponse,
        toolCalled: 'prepare_transfer',
        toolData: toolResult.data
      });
    }

    // 4. INTENT: RWA Risk Analysis
    if (lowercaseMsg.includes('risk') || lowercaseMsg.includes('rwa') || lowercaseMsg.includes('collateral') || lowercaseMsg.includes('assess')) {
      // Find numbers for asset valuation and loan request
      const numbers = lowercaseMsg.match(/\b\d+(,\d+)*(\.\d+)?\b/g);
      let valuation = 100000; // default
      let loan = 60000; // default
      let assetName = 'Tokenized Real Estate (Berlin Apts)';

      if (numbers && numbers.length >= 2) {
        valuation = parseFloat(numbers[0].replace(/,/g, ''));
        loan = parseFloat(numbers[1].replace(/,/g, ''));
      }

      if (lowercaseMsg.includes('gold')) {
        assetName = 'Tokenized Gold Bullion';
      } else if (lowercaseMsg.includes('invoice')) {
        assetName = 'Accounts Receivable Invoice #9042';
      }

      const toolResponse = await fetch(toolCallUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'analyze_rwa_risk',
          arguments: {
            assetName,
            collateralValueUsd: valuation,
            requestedLoanUsd: loan
          }
        })
      });

      const toolResult = await toolResponse.json() as any;
      return res.json({
        response: `🛡️ **Calling MCP Tool**: \`analyze_rwa_risk\`\n\n` + toolResult.content[0].text,
        toolCalled: 'analyze_rwa_risk',
        toolData: toolResult.data
      });
    }

    // 5. INTENT: Hello / Greeting / General info
    let genericReply = `Hello! I am your **Casper Agentic Portfolio Copilot (CAP)**. 🤖\n\n` +
      `I operate as an autonomous agent utilizing Casper Model Context Protocol (MCP) servers. I can help you with:\n` +
      `1. 💰 **Checking Balances**: e.g., *"What is the balance of my wallet?"*\n` +
      `2. 📈 **Yield Staking**: e.g., *"What are the current validator APY yields?"*\n` +
      `3. 💸 **Transfers**: e.g., *"Transfer 5 CSPR to [recipient key]"*\n` +
      `4. 🛡️ **RWA Risk Assessment**: e.g., *"Analyze risk for gold collateral 50000 loan 40000"*\n\n` +
      `How can I assist you on the Casper Network today?`;

    if (lowercaseMsg.includes('hello') || lowercaseMsg.includes('hi') || lowercaseMsg.includes('hey')) {
      return res.json({
        response: genericReply,
        toolCalled: null,
        toolData: null
      });
    }

    // Default conversational reply
    res.json({
      response: `I understand your message: "${message}".\n\nI can execute transactions and query data on Casper Testnet using MCP tools. Try asking me:\n- *"Check my account balance"* \n- *"What are the staking validator yields?"* \n- *"Prepare a transfer of 10 CSPR to 01cf906e987c2fb4ba54c12bb16f0d7e2bb7dbfa64a13e2bb7c040003dfa64010b"*`,
      toolCalled: null,
      toolData: null
    });

  } catch (error: any) {
    console.error(`[Agent Chat Error] ${error.message}`);
    res.status(500).json({
      response: `I ran into an issue processing that query: ${error.message}. Please make sure the backend server is running correctly.`,
      toolCalled: null,
      toolData: null
    });
  }
}
