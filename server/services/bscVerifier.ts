/**
 * BNB Smart Chain (BEP-20) Blockchain Transaction Verifier
 * 
 * Verifies on-chain transactions directly against BNB Smart Chain nodes:
 * 1. Checks transaction existence and valid hash format.
 * 2. Confirms execution on BNB Smart Chain and successful receipt status (0x1).
 * 3. Validates receiving address strictly matches platform receiving address:
 *    0x311136bd4daac7083a552407703b6892f2aa0c48
 * 4. For BEP-20 tokens (e.g., USDT, USDC), verifies exact contract address and
 *    decodes the ERC-20 Transfer(address,address,uint256) event logs.
 * 5. For Native BNB, validates direct value transfer.
 * 6. Calculates real-time block confirmations against latest chain tip.
 */

export const PLATFORM_RECEIVING_ADDRESS = '0x311136bd4daac7083a552407703b6892f2aa0c48'.toLowerCase();

export const BSC_RPC_ENDPOINTS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed2.defibit.io/',
  'https://bsc-dataseed1.ninicoin.io/',
  'https://rpc.ankr.com/bsc',
  'https://binance.nodereal.io',
];

// ERC-20 / BEP-20 standard Transfer event topic: Transfer(address,address,uint256)
export const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface BscVerificationResult {
  valid: boolean;
  status: 'pending' | 'detecting' | 'confirming' | 'completed' | 'failed' | 'rejected';
  reason?: string;
  txHash: string;
  blockNumber?: number;
  latestBlock?: number;
  confirmations?: number;
  requiredConfirmations?: number;
  fromAddress?: string;
  toAddress?: string;
  receivingAddress: string;
  asset: string;
  network: string;
  contractAddress?: string;
  amount: number;
  amountUsd: number;
  decimals: number;
  rawAmount?: string;
}

export interface DepositAssetConfig {
  assetId: string;
  symbol: string;
  name: string;
  network: string;
  contractAddress: string;
  decimals: number;
  minimumDeposit: number;
  confirmationRequirement: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Execute JSON-RPC call against BSC with automatic multi-node fallback
 */
export async function callBscRpc(method: string, params: any[] = []): Promise<any> {
  let lastError: any = null;

  for (const endpoint of BSC_RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status} from ${endpoint}`);
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(`RPC error from ${endpoint}: ${json.error.message || JSON.stringify(json.error)}`);
      }

      return json.result;
    } catch (err: any) {
      lastError = err;
      // Try next endpoint
      continue;
    }
  }

  throw new Error(`All BSC RPC endpoints failed. Last error: ${lastError?.message || lastError}`);
}

/**
 * Get current block height on BNB Smart Chain
 */
export async function getLatestBscBlock(): Promise<number> {
  const blockHex = await callBscRpc('eth_blockNumber');
  if (!blockHex) throw new Error('Failed to retrieve current block number from BSC.');
  return parseInt(blockHex, 16);
}

/**
 * Fetch live BNB to USD price from public ticker
 */
export async function getBnbUsdPrice(): Promise<number> {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
    if (res.ok) {
      const data = await res.json();
      const price = parseFloat(data.price);
      if (!isNaN(price) && price > 0) return price;
    }
  } catch (err) {
    console.warn('[BscVerifier] Failed to fetch live BNB price, using baseline:', err);
  }
  return 620.0; // Reliable baseline fallback for BNB
}

/**
 * Format hex address to 20-byte standard checksum/lowercase address
 */
export function formatAddressFromTopic(topicHex: string): string {
  if (!topicHex || topicHex.length < 40) return '';
  return ('0x' + topicHex.slice(-40)).toLowerCase();
}

/**
 * Core verification logic for a BNB Smart Chain transaction
 */
export async function verifyBscTransaction(
  rawTxHash: string,
  configuredAssets: DepositAssetConfig[],
  hintAssetSymbol?: string
): Promise<BscVerificationResult> {
  const receivingAddress = PLATFORM_RECEIVING_ADDRESS;
  const network = 'BNB Smart Chain (BEP-20)';

  // 1. Validate hash format
  const normalizedTxHash = (rawTxHash || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(normalizedTxHash)) {
    return {
      valid: false,
      status: 'rejected',
      reason: 'Invalid transaction hash format. Must be a 66-character hex string starting with 0x.',
      txHash: rawTxHash,
      receivingAddress,
      asset: hintAssetSymbol || 'UNKNOWN',
      network,
      amount: 0,
      amountUsd: 0,
      decimals: 18,
    };
  }

  // 2. Query transaction and receipt in parallel
  let tx: any = null;
  let receipt: any = null;
  let latestBlock = 0;

  try {
    const [txResult, receiptResult, blockHeight] = await Promise.all([
      callBscRpc('eth_getTransactionByHash', [normalizedTxHash]),
      callBscRpc('eth_getTransactionReceipt', [normalizedTxHash]),
      getLatestBscBlock(),
    ]);

    tx = txResult;
    receipt = receiptResult;
    latestBlock = blockHeight;
  } catch (err: any) {
    return {
      valid: false,
      status: 'detecting',
      reason: `Could not connect to BNB Smart Chain RPC: ${err?.message || 'Network error'}`,
      txHash: normalizedTxHash,
      receivingAddress,
      asset: hintAssetSymbol || 'UNKNOWN',
      network,
      amount: 0,
      amountUsd: 0,
      decimals: 18,
    };
  }

  // 3. Transaction not found or not yet mined
  if (!tx) {
    return {
      valid: false,
      status: 'detecting',
      reason: 'Transaction not found on BNB Smart Chain. It might still be broadcasting in the mempool. Please wait a few seconds and try again.',
      txHash: normalizedTxHash,
      receivingAddress,
      asset: hintAssetSymbol || 'UNKNOWN',
      network,
      amount: 0,
      amountUsd: 0,
      decimals: 18,
    };
  }

  if (!receipt || !tx.blockNumber) {
    return {
      valid: false,
      status: 'detecting',
      reason: 'Transaction is pending confirmation in a BNB Smart Chain block.',
      txHash: normalizedTxHash,
      receivingAddress,
      asset: hintAssetSymbol || 'UNKNOWN',
      network,
      amount: 0,
      amountUsd: 0,
      decimals: 18,
    };
  }

  // 4. Check on-chain execution status (0x1 = success, 0x0 = reverted)
  if (receipt.status !== '0x1') {
    return {
      valid: false,
      status: 'failed',
      reason: 'Transaction failed / reverted on BNB Smart Chain.',
      txHash: normalizedTxHash,
      receivingAddress,
      asset: hintAssetSymbol || 'UNKNOWN',
      network,
      amount: 0,
      amountUsd: 0,
      decimals: 18,
    };
  }

  const txBlockNumber = parseInt(tx.blockNumber, 16);
  const confirmations = Math.max(1, latestBlock - txBlockNumber + 1);
  const fromAddress = (tx.from || '').toLowerCase();

  // 5. Match against supported assets
  // Check if it's Native BNB transfer
  const bnbAsset = configuredAssets.find(
    (a) => a.symbol === 'BNB' || a.contractAddress.toUpperCase() === 'NATIVE'
  );

  const txTo = (tx.to || '').toLowerCase();
  const txValueBigInt = BigInt(tx.value || '0x0');

  // Case A: Direct Native BNB Transfer
  if (txTo === receivingAddress && txValueBigInt > BigInt(0)) {
    const asset = bnbAsset || {
      assetId: 'bnb-native',
      symbol: 'BNB',
      name: 'BNB (Native)',
      network,
      contractAddress: 'NATIVE',
      decimals: 18,
      minimumDeposit: 0.02,
      confirmationRequirement: 3,
      enabled: true,
      createdAt: '',
      updatedAt: '',
    };

    const bnbAmount = Number(txValueBigInt) / 1e18;
    const bnbPrice = await getBnbUsdPrice();
    const amountUsd = bnbAmount * bnbPrice;
    const requiredConfirmations = asset.confirmationRequirement || 3;

    if (bnbAmount < asset.minimumDeposit) {
      return {
        valid: false,
        status: 'rejected',
        reason: `Deposit amount (${bnbAmount.toFixed(4)} BNB) is below the minimum deposit requirement of ${asset.minimumDeposit} BNB.`,
        txHash: normalizedTxHash,
        blockNumber: txBlockNumber,
        latestBlock,
        confirmations,
        requiredConfirmations,
        fromAddress,
        toAddress: receivingAddress,
        receivingAddress,
        asset: 'BNB',
        network,
        contractAddress: 'NATIVE',
        amount: bnbAmount,
        amountUsd,
        decimals: 18,
        rawAmount: txValueBigInt.toString(),
      };
    }

    const isFullyConfirmed = confirmations >= requiredConfirmations;

    return {
      valid: true,
      status: isFullyConfirmed ? 'completed' : 'confirming',
      txHash: normalizedTxHash,
      blockNumber: txBlockNumber,
      latestBlock,
      confirmations,
      requiredConfirmations,
      fromAddress,
      toAddress: receivingAddress,
      receivingAddress,
      asset: 'BNB',
      network,
      contractAddress: 'NATIVE',
      amount: bnbAmount,
      amountUsd,
      decimals: 18,
      rawAmount: txValueBigInt.toString(),
    };
  }

  // Case B: BEP-20 Token Transfer (inspect receipt event logs)
  const logs = receipt.logs || [];
  let matchedTokenAsset: DepositAssetConfig | null = null;
  let matchedTransferLog: any = null;
  let tokenAmount = 0;
  let tokenAmountUsd = 0;
  let tokenSender = fromAddress;

  for (const log of logs) {
    const logContract = (log.address || '').toLowerCase();
    const topics = log.topics || [];

    // Check if event is standard Transfer(address,address,uint256)
    if (topics.length >= 3 && topics[0].toLowerCase() === ERC20_TRANSFER_TOPIC) {
      const recipientAddress = formatAddressFromTopic(topics[2]);

      // Check if recipient is our receiving address
      if (recipientAddress === receivingAddress) {
        // Find matching configured asset by exact contract address
        const assetConfig = configuredAssets.find(
          (a) => a.contractAddress.toLowerCase() === logContract
        );

        if (assetConfig) {
          matchedTokenAsset = assetConfig;
          matchedTransferLog = log;
          tokenSender = formatAddressFromTopic(topics[1]);

          const rawData = log.data || '0x0';
          const rawValue = BigInt(rawData);
          const divisor = Math.pow(10, assetConfig.decimals || 18);
          tokenAmount = Number(rawValue) / divisor;

          // For stablecoins (USDT, USDC), $1 USD = 1 Token
          tokenAmountUsd = tokenAmount;
          break;
        }
      }
    }
  }

  if (!matchedTokenAsset || !matchedTransferLog) {
    // Collect any contracts mentioned in logs for diagnostic help
    const foundRecipients = logs
      .filter((l: any) => (l.topics || []).length >= 3 && l.topics[0].toLowerCase() === ERC20_TRANSFER_TOPIC)
      .map((l: any) => formatAddressFromTopic(l.topics[2]));

    return {
      valid: false,
      status: 'rejected',
      reason: `No valid token transfer to platform receiving address ${receivingAddress} was found in transaction logs. Detected recipients: ${foundRecipients.join(', ') || 'none'}.`,
      txHash: normalizedTxHash,
      blockNumber: txBlockNumber,
      latestBlock,
      confirmations,
      requiredConfirmations: 3,
      fromAddress,
      toAddress: txTo,
      receivingAddress,
      asset: hintAssetSymbol || 'UNKNOWN',
      network,
      amount: 0,
      amountUsd: 0,
      decimals: 18,
    };
  }

  const requiredConfirmations = matchedTokenAsset.confirmationRequirement || 3;

  if (tokenAmount < matchedTokenAsset.minimumDeposit) {
    return {
      valid: false,
      status: 'rejected',
      reason: `Deposit amount (${tokenAmount.toFixed(2)} ${matchedTokenAsset.symbol}) is below the minimum deposit requirement of $${matchedTokenAsset.minimumDeposit.toFixed(2)} USD.`,
      txHash: normalizedTxHash,
      blockNumber: txBlockNumber,
      latestBlock,
      confirmations,
      requiredConfirmations,
      fromAddress: tokenSender,
      toAddress: receivingAddress,
      receivingAddress,
      asset: matchedTokenAsset.symbol,
      network,
      contractAddress: matchedTokenAsset.contractAddress,
      amount: tokenAmount,
      amountUsd: tokenAmountUsd,
      decimals: matchedTokenAsset.decimals,
      rawAmount: matchedTransferLog.data,
    };
  }

  const isFullyConfirmed = confirmations >= requiredConfirmations;

  return {
    valid: true,
    status: isFullyConfirmed ? 'completed' : 'confirming',
    txHash: normalizedTxHash,
    blockNumber: txBlockNumber,
    latestBlock,
    confirmations,
    requiredConfirmations,
    fromAddress: tokenSender,
    toAddress: receivingAddress,
    receivingAddress,
    asset: matchedTokenAsset.symbol,
    network,
    contractAddress: matchedTokenAsset.contractAddress,
    amount: tokenAmount,
    amountUsd: tokenAmountUsd,
    decimals: matchedTokenAsset.decimals,
    rawAmount: matchedTransferLog.data,
  };
}
