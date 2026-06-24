import express from 'express';
import cors from 'cors';
import path from 'path';
import { CasperServiceByJsonRPC, CLPublicKey, DeployUtil, RuntimeArgs, CLValueBuilder, CLAccountHash } from 'casper-js-sdk';
import { handleAgentChat } from './agent';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Agent Chat endpoint
app.post('/api/chat', handleAgentChat);

// Casper Testnet RPC node
const CASPER_TESTNET_RPC = 'https://rpc.testnet.casper.network/rpc';
const client = new CasperServiceByJsonRPC(CASPER_TESTNET_RPC);

// Tool schemas matching Model Context Protocol (MCP) format
const TOOLS = [
  {
    name: 'get_account_balance',
    description: 'Retrieve the CSPR balance of a public key on the Casper Testnet.',
    inputSchema: {
      type: 'object',
      properties: {
        publicKey: {
          type: 'string',
          description: 'The Casper account public key (hex format, e.g. 01c... or 02c...)',
        },
      },
      required: ['publicKey'],
    },
  },
  {
    name: 'get_staking_yields',
    description: 'Retrieve current staking options and estimated annual yields (APY) on Casper Testnet.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'prepare_transfer',
    description: 'Prepare a CSPR transfer deploy. Returns the transaction JSON ready for signing.',
    inputSchema: {
      type: 'object',
      properties: {
        senderPublicKey: {
          type: 'string',
          description: 'The Casper public key of the sender.',
        },
        receiverPublicKey: {
          type: 'string',
          description: 'The Casper public key of the recipient.',
        },
        amountCspr: {
          type: 'string',
          description: 'The amount of CSPR to transfer (e.g. 2.5 or 10).',
        },
      },
      required: ['senderPublicKey', 'receiverPublicKey', 'amountCspr'],
    },
  },
  {
    name: 'prepare_delegation',
    description: 'Prepare a Casper staking delegation deploy. Returns the delegation transaction JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        delegatorPublicKey: {
          type: 'string',
          description: 'The public key of the delegator.',
        },
        validatorPublicKey: {
          type: 'string',
          description: 'The public key of the validator to delegate CSPR to.',
        },
        amountCspr: {
          type: 'string',
          description: 'The amount of CSPR to stake (e.g. 100 or 500).',
        },
      },
      required: ['delegatorPublicKey', 'validatorPublicKey', 'amountCspr'],
    },
  },
  {
    name: 'analyze_rwa_risk',
    description: 'Analyze real-world asset collateral risk and loan-to-value status.',
    inputSchema: {
      type: 'object',
      properties: {
        assetName: {
          type: 'string',
          description: 'Name of the real-world asset (e.g., Gold Certificate, Invoice #1024).',
        },
        collateralValueUsd: {
          type: 'number',
          description: 'USD valuation of the collateral asset.',
        },
        requestedLoanUsd: {
          type: 'number',
          description: 'USD amount of loan requested.',
        },
      },
      required: ['assetName', 'collateralValueUsd', 'requestedLoanUsd'],
    },
  },
];

// Helper to convert CSPR to Motes (1 CSPR = 1,000,000,000 Motes)
function csprToMotes(cspr: string | number): string {
  const parsed = typeof cspr === 'string' ? parseFloat(cspr) : cspr;
  if (isNaN(parsed)) return '0';
  return Math.floor(parsed * 1_000_000_000).toString();
}

// REST endpoints for MCP Tools
app.get('/api/tools', (req, res) => {
  res.json({ tools: TOOLS });
});

app.post('/api/tools/call', async (req, res) => {
  const { name, arguments: args } = req.body;

  try {
    switch (name) {
      case 'get_account_balance': {
        const { publicKey } = args;
        try {
          const clPublicKey = CLPublicKey.fromHex(publicKey);
          const accountHash = clPublicKey.toAccountHashStr().replace('account-hash-', '');
          
          // Fetch balance using Casper SDK
          const stateRootHash = await client.getStateRootHash();
          const balanceMotes = (await client.getAccountBalance(stateRootHash, publicKey)).toString();
          const balanceCspr = parseFloat(balanceMotes) / 1_000_000_000;
          
          res.json({
            content: [{
              type: 'text',
              text: `Account hash: account-hash-${accountHash}\nBalance: ${balanceCspr.toLocaleString()} CSPR (${balanceMotes} motes)`,
            }],
            data: {
              publicKey,
              accountHash: `account-hash-${accountHash}`,
              balanceMotes,
              balanceCspr,
            }
          });
        } catch (err: any) {
          // If the account has no deploys yet, it might not be in the global state.
          res.json({
            content: [{
              type: 'text',
              text: `Could not retrieve balance. The account public key "${publicKey}" might not be initialized on Testnet yet (it has 0 CSPR balance).`,
            }],
            data: {
              publicKey,
              balanceMotes: '0',
              balanceCspr: 0,
            }
          });
        }
        break;
      }

      case 'get_staking_yields': {
        const mockValidators = [
          {
            validatorPublicKey: '0124ba60a2b8e5c3e7f41f021e15ab9c9d4ff843a85b9b6ff8c4fbeea37d825c9b',
            commissionRate: '5%',
            delegatorCount: 42,
            totalStakedCspr: '1,240,500 CSPR',
            estimatedApy: '9.8%',
            status: 'Active',
          },
          {
            validatorPublicKey: '01cf906e987c2fb4ba54c12bb16f0d7e2bb7dbfa64a13e2bb7c040003dfa64010b',
            commissionRate: '3%',
            delegatorCount: 89,
            totalStakedCspr: '4,510,000 CSPR',
            estimatedApy: '10.1%',
            status: 'Active',
          },
          {
            validatorPublicKey: '0203f1ea124ba60fbeed82a7f51bbcf83c2718e2bb7a04b12c8c4ff8002bbd74ea',
            commissionRate: '1%',
            delegatorCount: 156,
            totalStakedCspr: '9,820,400 CSPR',
            estimatedApy: '10.4%',
            status: 'Highly Active',
          }
        ];
        
        let text = '### Casper Testnet Validator APY Options:\n\n';
        mockValidators.forEach((v, index) => {
          text += `${index + 1}. **Validator**: \`${v.validatorPublicKey}\`\n`;
          text += `   - APY: **${v.estimatedApy}**\n`;
          text += `   - Fee/Commission: **${v.commissionRate}**\n`;
          text += `   - Total Staked: ${v.totalStakedCspr} (${v.delegatorCount} delegators)\n`;
          text += `   - Status: ${v.status}\n\n`;
        });
        
        res.json({
          content: [{ type: 'text', text }],
          data: mockValidators,
        });
        break;
      }

      case 'prepare_transfer': {
        const { senderPublicKey, receiverPublicKey, amountCspr } = args;
        const amountMotes = csprToMotes(amountCspr);
        
        try {
          const fromKey = CLPublicKey.fromHex(senderPublicKey);
          const toKey = CLPublicKey.fromHex(receiverPublicKey);
          
          // Set transfer fee (standard transfer is 0.1 CSPR = 100,000,000 motes)
          const paymentAmount = 100_000_000;
          
          const deployParams = new DeployUtil.DeployParams(
            fromKey,
            'casper-test', // Chain Name
            1, // Gas Price
            1_800_000 // TTL: 30 minutes
          );
          
          const session = DeployUtil.ExecutableDeployItem.newTransfer(
            amountMotes,
            toKey,
            undefined, // no target account hash override
            12345 // transfer ID (memo)
          );
          
          const payment = DeployUtil.standardPayment(paymentAmount);
          const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
          const deployJson = DeployUtil.deployToJson(deploy);
          
          res.json({
            content: [{
              type: 'text',
              text: `Successfully prepared transfer of ${amountCspr} CSPR to ${receiverPublicKey}.\n\nDeploy Hash: \`${deploy.hash.toString()}\`\nEstimated Gas Fee: 0.1 CSPR.`,
            }],
            data: {
              deployJson,
              deployHash: deploy.hash.toString(),
              amountCspr,
              amountMotes,
              senderPublicKey,
              receiverPublicKey,
              gasFeeCspr: 0.1,
            }
          });
        } catch (err: any) {
          res.status(400).json({ error: `Failed to prepare transfer: ${err.message}` });
        }
        break;
      }

      case 'prepare_delegation': {
        const { delegatorPublicKey, validatorPublicKey, amountCspr } = args;
        const amountMotes = csprToMotes(amountCspr);
        
        try {
          const delegator = CLPublicKey.fromHex(delegatorPublicKey);
          const validator = CLPublicKey.fromHex(validatorPublicKey);
          
          // Delegate command arguments
          const runtimeArgs = RuntimeArgs.fromMap({
            delegator: delegator,
            validator: validator,
            amount: CLValueBuilder.u512(amountMotes)
          });
          
          // Set staking delegation fee (standard delegation is 2.5 CSPR = 2,500,000,000 motes)
          const paymentAmount = 2_500_000_000;
          
          const deployParams = new DeployUtil.DeployParams(
            delegator,
            'casper-test',
            1,
            1_800_000
          );
          
          // Staking operations utilize the Casper System Auction contract
          // We mock standard auction contract hash or call it by name
          const session = DeployUtil.ExecutableDeployItem.newStoredContractByName(
            'auction',
            'delegate',
            runtimeArgs
          );
          
          const payment = DeployUtil.standardPayment(paymentAmount);
          const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
          const deployJson = DeployUtil.deployToJson(deploy);
          
          res.json({
            content: [{
              type: 'text',
              text: `Successfully prepared staking delegation of ${amountCspr} CSPR to validator ${validatorPublicKey}.\n\nDeploy Hash: \`${deploy.hash.toString()}\`\nRequired Gas Fee: 2.5 CSPR.`,
            }],
            data: {
              deployJson,
              deployHash: deploy.hash.toString(),
              amountCspr,
              amountMotes,
              delegatorPublicKey,
              validatorPublicKey,
              gasFeeCspr: 2.5,
            }
          });
        } catch (err: any) {
          res.status(400).json({ error: `Failed to prepare delegation: ${err.message}` });
        }
        break;
      }

      case 'analyze_rwa_risk': {
        const { assetName, collateralValueUsd, requestedLoanUsd } = args;
        
        const ltv = (requestedLoanUsd / collateralValueUsd) * 100;
        let riskRating = 'Low';
        let healthScore = 100;
        let color = '#22c55e'; // Green
        
        if (ltv >= 80) {
          riskRating = 'Critical';
          healthScore = 30;
          color = '#ef4444'; // Red
        } else if (ltv >= 65) {
          riskRating = 'High';
          healthScore = 55;
          color = '#f97316'; // Orange
        } else if (ltv >= 50) {
          riskRating = 'Moderate';
          healthScore = 80;
          color = '#eab308'; // Yellow
        }
        
        const output = `### RWA Collateral Analysis: **${assetName}**\n` +
          `- **Collateral Valuation**: $${collateralValueUsd.toLocaleString()} USD\n` +
          `- **Loan Requested**: $${requestedLoanUsd.toLocaleString()} USD\n` +
          `- **Calculated Loan-to-Value (LTV)**: **${ltv.toFixed(1)}%**\n` +
          `- **Risk Classification**: **${riskRating}**\n` +
          `- **Asset Health Index**: **${healthScore}/100**\n\n` +
          `**Assessment Summary:**\n` +
          (ltv >= 80
            ? `⚠️ **WARNING**: The loan-to-value ratio is dangerously high. Under Casper RWA standards, this protocol position is at high risk of liquidation. We recommend increasing collateral or reducing loan size.`
            : ltv >= 50
              ? `ℹ️ **Note**: This position carries a moderate risk factor. Liquidations could be triggered in case of a 30% valuation drop of the underlying RWA.`
              : `✅ **Safe**: This is a well-collateralized loan with robust protection thresholds. Highly recommended for funding on-chain.`);
              
        res.json({
          content: [{ type: 'text', text: output }],
          data: {
            assetName,
            collateralValueUsd,
            requestedLoanUsd,
            ltv,
            riskRating,
            healthScore,
            color,
            assessmentText: output,
          }
        });
        break;
      }

      default:
        res.status(404).json({ error: `Tool "${name}" not found.` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start the integrated server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CAP Copilot backend listening on port ${PORT}`);
  console.log(`🔌 Casper Testnet RPC node: ${CASPER_TESTNET_RPC}`);
  console.log(`====================================================`);
});
