import {
  Wallet,
  WalletTransaction,
  Deposit,
  Withdrawal,
  AdminWithdrawalRecord,
  FinancialAuditLog,
  FinancialOverviewSummary,
  TelebirrReceivingConfig,
  WalletDiscrepancy,
  WalletReconciliationResult,
  FinancialReportSummary,
} from '../../types/wallet';
import {
  wallets,
  transactions,
  deposits,
  providerTxIndex,
  providerRequestIndex,
  processedWebhookEvents,
  withdrawalIdempotencyIndex,
  withdrawalPayoutRefIndex,
  telebirrConfig,
  setTelebirrConfig,
  gameEntryDebitIndex,
  gameWinCreditIndex,
  withdrawals,
  financialAuditLogs,
  initWalletForUser,
} from './store';
import { paymentProviderRegistry } from './providers/registry';
import { VerificationResult } from './providers/types';

export type DepositStatusCode =
  | 'DEPOSIT_SUCCESSFUL'
  | 'PENDING_VERIFICATION'
  | 'TRANSACTION_NOT_FOUND'
  | 'AMOUNT_MISMATCH'
  | 'ALREADY_PROCESSED'
  | 'VERIFICATION_FAILED'
  | 'REQUIRES_ADMIN_REVIEW'
  | 'PROVIDER_UNAVAILABLE';

export interface DepositOperationResult {
  success: boolean;
  httpStatus: number;
  statusCode: DepositStatusCode;
  message: string;
  deposit?: Deposit;
  wallet?: Wallet;
  transaction?: WalletTransaction;
}

// Mutex locks (per wallet/key) to guarantee atomic balance mutations and prevent race conditions
const locks = new Map<string, Promise<void>>();

async function acquireLock(lockKey: string): Promise<() => void> {
  while (locks.has(lockKey)) {
    try {
      await locks.get(lockKey);
    } catch {
      // ignore
    }
  }

  let releaseLock: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  locks.set(lockKey, lockPromise);

  return () => {
    locks.delete(lockKey);
    releaseLock();
  };
}

/**
 * Normalize Ethiopian phone / Telebirr account strings for strict comparison.
 * Detects masked accounts (containing '*' or 'x'/'X') so unconfirmable recipients are routed to admin review.
 */
function normalizeEtPhone(raw?: string): { digits: string; canonical9: string; masked: boolean } {
  const str = (raw || '').trim();
  if (!str) return { digits: '', canonical9: '', masked: false };
  const masked = /[*xX]/.test(str);
  const digits = str.replace(/\D/g, '');
  let canonical9 = digits;
  if (digits.startsWith('251') && digits.length >= 12) {
    canonical9 = digits.slice(-9);
  } else if (digits.startsWith('0') && digits.length === 10) {
    canonical9 = digits.slice(1);
  } else if (digits.length > 9) {
    canonical9 = digits.slice(-9);
  }
  return { digits, canonical9, masked };
}

function compareRecipientWallet(
  providerPhone: string | undefined,
  configured: TelebirrReceivingConfig
): 'MATCH' | 'MISMATCH' | 'UNCONFIRMABLE' {
  const rawPhone = (providerPhone || '').trim();
  if (!rawPhone) return 'UNCONFIRMABLE';

  const prov = normalizeEtPhone(rawPhone);
  const cfg = normalizeEtPhone(configured.telebirrPhoneNumber);

  // If the provider masked digits (e.g. 2519****2233), it cannot unambiguously confirm the full receiving wallet
  if (prov.masked) {
    return 'UNCONFIRMABLE';
  }

  if (prov.canonical9 && cfg.canonical9) {
    return prov.canonical9 === cfg.canonical9 ? 'MATCH' : 'MISMATCH';
  }

  // Exact fallback for merchant shortcodes or non-standard identifiers
  if (rawPhone.toUpperCase() === configured.telebirrPhoneNumber.trim().toUpperCase()) {
    return 'MATCH';
  }

  return 'MISMATCH';
}

// Helper to log financial audit
export function logFinancialAudit(
  actorId: string,
  actorRole: string,
  action: string,
  entityType: FinancialAuditLog['entityType'],
  entityId: string,
  amount: number | undefined,
  details: string
) {
  const auditEntry: FinancialAuditLog = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: Date.now(),
    actorId,
    actorRole,
    action,
    entityType,
    entityId,
    amount,
    details,
  };
  financialAuditLogs.unshift(auditEntry);
  if (financialAuditLogs.length > 1000) {
    financialAuditLogs.pop();
  }
}

// Generate unique transaction ID
function generateTxId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export class WalletLedgerService {
  /**
   * Get configured Telebirr receiving account
   */
  static getTelebirrConfig(): TelebirrReceivingConfig {
    return { ...telebirrConfig };
  }

  /**
   * Admin updates Telebirr receiving account settings
   */
  static updateTelebirrConfig(
    updates: Partial<TelebirrReceivingConfig>,
    adminId: string
  ): { success: boolean; message: string; config?: TelebirrReceivingConfig } {
    const phone = (updates.telebirrPhoneNumber ?? telebirrConfig.telebirrPhoneNumber).trim();
    const accountName = (updates.telebirrAccountName ?? telebirrConfig.telebirrAccountName).trim();
    const depositInstructions = (
      updates.depositInstructions ?? telebirrConfig.depositInstructions ?? ''
    ).trim();
    const minAmount =
      updates.minDepositAmount !== undefined
        ? parseFloat(Number(updates.minDepositAmount).toFixed(2))
        : telebirrConfig.minDepositAmount;
    const maxAmount =
      updates.maxDepositAmount !== undefined
        ? parseFloat(Number(updates.maxDepositAmount).toFixed(2))
        : telebirrConfig.maxDepositAmount;
    const minWithdrawal =
      updates.minWithdrawalAmount !== undefined
        ? parseFloat(Number(updates.minWithdrawalAmount).toFixed(2))
        : telebirrConfig.minWithdrawalAmount;
    const maxWithdrawal =
      updates.maxWithdrawalAmount !== undefined
        ? parseFloat(Number(updates.maxWithdrawalAmount).toFixed(2))
        : telebirrConfig.maxWithdrawalAmount;
    const depositsEnabled =
      updates.depositsEnabled !== undefined ? Boolean(updates.depositsEnabled) : telebirrConfig.depositsEnabled;
    const withdrawalsEnabled =
      updates.withdrawalsEnabled !== undefined
        ? Boolean(updates.withdrawalsEnabled)
        : telebirrConfig.withdrawalsEnabled;

    if (!phone || phone.replace(/\D/g, '').length < 4) {
      return { success: false, message: 'Please enter a valid Telebirr receiving phone number or merchant ID.' };
    }
    if (!accountName) {
      return { success: false, message: 'Telebirr receiving account name is required.' };
    }
    if (isNaN(minAmount) || minAmount < 1) {
      return { success: false, message: 'Minimum deposit amount must be at least 1.00 ETB.' };
    }
    if (isNaN(maxAmount) || maxAmount < minAmount) {
      return { success: false, message: 'Maximum deposit amount must be greater than minimum deposit amount.' };
    }
    if (isNaN(minWithdrawal) || minWithdrawal < 1) {
      return { success: false, message: 'Minimum withdrawal amount must be at least 1.00 ETB.' };
    }
    if (isNaN(maxWithdrawal) || maxWithdrawal < minWithdrawal) {
      return { success: false, message: 'Maximum withdrawal amount must be greater than minimum withdrawal amount.' };
    }

    const updated: TelebirrReceivingConfig = {
      telebirrPhoneNumber: phone,
      telebirrAccountName: accountName,
      depositInstructions:
        depositInstructions ||
        'Transfer the exact deposit amount via Telebirr to our official receiving wallet, copy the Transaction Number from your confirmation SMS, paste it below, and click Verify & Deposit.',
      minDepositAmount: minAmount,
      maxDepositAmount: maxAmount,
      minWithdrawalAmount: minWithdrawal,
      maxWithdrawalAmount: maxWithdrawal,
      depositsEnabled,
      withdrawalsEnabled,
      updatedAt: Date.now(),
      updatedBy: adminId,
    };

    setTelebirrConfig(updated);

    logFinancialAudit(
      adminId,
      'ADMIN',
      'TELEBIRR_CONFIG_UPDATED',
      'config',
      'telebirr-receiving',
      undefined,
      `Updated Telebirr wallet to ${accountName} (${phone}); Deposit limits ${minAmount}-${maxAmount} ETB (${
        depositsEnabled ? 'ON' : 'OFF'
      }); Withdrawal limits ${minWithdrawal}-${maxWithdrawal} ETB (${withdrawalsEnabled ? 'ON' : 'OFF'})`
    );

    return {
      success: true,
      message: 'Telebirr payment settings updated.',
      config: updated,
    };
  }

  /**
   * Get or initialize a user's wallet
   */
  static getWallet(userId: string): Wallet {
    let wallet = wallets.get(userId);
    if (!wallet) {
      wallet = initWalletForUser(userId, 0, 'ETB');
    }
    return wallet;
  }

  /**
   * Get user transactions (newest first)
   */
  static getTransactions(userId: string, limit: number = 50): WalletTransaction[] {
    const userTxs: WalletTransaction[] = [];
    for (const tx of transactions.values()) {
      if (tx.userId === userId) {
        userTxs.push(tx);
      }
    }
    return userTxs.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  /**
   * Get all system transactions (newest first)
   */
  static getAllTransactions(limit: number = 100): WalletTransaction[] {
    return Array.from(transactions.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get deposits (filtered by userId if provided, newest first)
   */
  static getDeposits(userId?: string, limit: number = 100): Deposit[] {
    const list: Deposit[] = [];
    for (const d of deposits.values()) {
      if (!userId || d.userId === userId) {
        list.push(d);
      }
    }
    return list.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  /**
   * Get single deposit by ID
   */
  static getDepositById(depositId: string): Deposit | undefined {
    return deposits.get(depositId);
  }

  /**
   * Get withdrawal requests (filtered by userId if provided, newest first)
   */
  static getWithdrawals(userId?: string): Withdrawal[] {
    const list: Withdrawal[] = [];
    for (const w of withdrawals.values()) {
      if (!userId || w.userId === userId) {
        list.push(w);
      }
    }
    return list.sort((a, b) => b.requestedAt - a.requestedAt);
  }

  /**
   * Get withdrawal requests enriched with player wallet balances & display names for Admin Panel
   */
  static getAdminWithdrawals(
    usersMap?: Map<string, { displayName?: string; username?: string }>
  ): AdminWithdrawalRecord[] {
    return this.getWithdrawals().map((w) => {
      const wallet = this.getWallet(w.userId);
      const user = usersMap?.get(w.userId);
      return {
        ...w,
        playerDisplayName: user?.displayName,
        playerUsername: user?.username,
        playerAvailableBalance: wallet.availableBalance,
        playerReservedBalance: wallet.reservedBalance,
      };
    });
  }

  /**
   * Evaluate all 7 strict verification rules and atomically credit wallet ONLY if ALL pass.
   * Caller MUST already hold `provider-tx:${tx}` and `wallet:${deposit.userId}` locks.
   */
  private static evaluateAndApplyVerificationLocked(
    deposit: Deposit,
    verifyResult: VerificationResult,
    expectedUserId?: string
  ): DepositOperationResult {
    const now = Date.now();
    deposit.rawResponse = verifyResult.rawResponse;
    deposit.updatedAt = now;
    if (verifyResult.providerRequestId && !deposit.providerRequestId) {
      deposit.providerRequestId = verifyResult.providerRequestId;
      providerRequestIndex.set(verifyResult.providerRequestId, deposit.id);
    }

    // Rule 7: Deposit belongs to the authenticated player
    if (expectedUserId && deposit.userId !== expectedUserId) {
      return {
        success: false,
        httpStatus: 403,
        statusCode: 'VERIFICATION_FAILED',
        message: 'Deposit record does not belong to the authenticated player.',
      };
    }

    // Rule 6: Transaction has not previously been credited
    if (deposit.status === 'VERIFIED' || deposit.creditedAt) {
      return {
        success: false,
        httpStatus: 409,
        statusCode: 'ALREADY_PROCESSED',
        message: `Transaction ${deposit.providerTransactionId} has already been credited.`,
        deposit,
      };
    }

    // Handle provider outages gracefully
    if (verifyResult.status === 'PROVIDER_UNAVAILABLE') {
      // If queued async request already had a providerRequestId, stay PENDING so webhook/poll can still complete it
      if (deposit.providerRequestId && deposit.status === 'PENDING') {
        deposit.statusMessage = verifyResult.errorMessage || 'Pending Verification (provider temporarily busy)';
        return {
          success: true,
          httpStatus: 202,
          statusCode: 'PENDING_VERIFICATION',
          message: 'Verification service is busy. Deposit remains pending confirmation.',
          deposit,
        };
      }
      deposit.status = 'FAILED';
      deposit.statusMessage = verifyResult.errorMessage || 'Payment verification service is temporarily unavailable.';
      logFinancialAudit(
        deposit.userId,
        'SYSTEM',
        'DEPOSIT_PROVIDER_UNAVAILABLE',
        'deposit',
        deposit.id,
        deposit.requestedAmount,
        `Provider unavailable for tx ${deposit.providerTransactionId}: ${deposit.statusMessage}`
      );
      return {
        success: false,
        httpStatus: 503,
        statusCode: 'PROVIDER_UNAVAILABLE',
        message: deposit.statusMessage,
        deposit,
      };
    }

    // Handle async pending state
    if (verifyResult.status === 'PENDING') {
      deposit.status = 'PENDING';
      deposit.statusMessage = 'Pending Verification — Waiting for asynchronous confirmation from Verify.et.';
      return {
        success: true,
        httpStatus: 202,
        statusCode: 'PENDING_VERIFICATION',
        message: deposit.statusMessage,
        deposit,
      };
    }

    // Rule 1: Transaction exists
    if (verifyResult.status === 'NOT_FOUND') {
      deposit.status = 'NOT_FOUND';
      deposit.statusMessage = verifyResult.errorMessage || 'Transaction not found in Telebirr records.';
      logFinancialAudit(
        deposit.userId,
        'PLAYER',
        'DEPOSIT_TX_NOT_FOUND',
        'deposit',
        deposit.id,
        deposit.requestedAmount,
        `Tx ${deposit.providerTransactionId} not found.`
      );
      return {
        success: false,
        httpStatus: 404,
        statusCode: 'TRANSACTION_NOT_FOUND',
        message: deposit.statusMessage,
        deposit,
      };
    }

    // Rule 2: Payment was successfully completed
    if (!verifyResult.success || verifyResult.status !== 'VERIFIED' || verifyResult.verifiedFlag === false) {
      deposit.status = 'FAILED';
      deposit.statusMessage = verifyResult.errorMessage || 'Telebirr payment verification failed.';
      logFinancialAudit(
        deposit.userId,
        'PLAYER',
        'DEPOSIT_VERIFICATION_FAILED',
        'deposit',
        deposit.id,
        deposit.requestedAmount,
        `Verification failed for tx ${deposit.providerTransactionId}: ${deposit.statusMessage}`
      );
      return {
        success: false,
        httpStatus: 400,
        statusCode: 'VERIFICATION_FAILED',
        message: deposit.statusMessage,
        deposit,
      };
    }

    // Rule 4: Currency must be ETB
    const currency = (verifyResult.currency || '').trim().toUpperCase();
    if (currency !== 'ETB') {
      deposit.status = 'FAILED';
      deposit.statusMessage = `Invalid currency '${currency || 'UNKNOWN'}'. Only ETB deposits are accepted.`;
      logFinancialAudit(
        deposit.userId,
        'SYSTEM',
        'DEPOSIT_CURRENCY_MISMATCH',
        'deposit',
        deposit.id,
        deposit.requestedAmount,
        deposit.statusMessage
      );
      return {
        success: false,
        httpStatus: 400,
        statusCode: 'VERIFICATION_FAILED',
        message: deposit.statusMessage,
        deposit,
      };
    }

    // Rule 3: Received amount MUST exactly match requested deposit amount
    const verifiedAmount = parseFloat((verifyResult.amount || 0).toFixed(2));
    deposit.verifiedAmount = verifiedAmount;
    if (verifiedAmount <= 0 || Math.abs(verifiedAmount - deposit.requestedAmount) >= 0.01) {
      deposit.status = 'AMOUNT_MISMATCH';
      deposit.statusMessage = `Amount mismatch: you requested ${deposit.requestedAmount.toFixed(
        2
      )} ETB, but Telebirr receipt shows ${verifiedAmount.toFixed(2)} ETB.`;
      logFinancialAudit(
        deposit.userId,
        'SYSTEM',
        'DEPOSIT_AMOUNT_MISMATCH',
        'deposit',
        deposit.id,
        verifiedAmount,
        deposit.statusMessage
      );
      return {
        success: false,
        httpStatus: 400,
        statusCode: 'AMOUNT_MISMATCH',
        message: deposit.statusMessage,
        deposit,
      };
    }

    // Rule 5: Recipient must be configured business Telebirr wallet
    deposit.recipientAccount = verifyResult.recipientPhone;
    deposit.recipientName = verifyResult.recipientName;
    const recipientMatch = compareRecipientWallet(verifyResult.recipientPhone, telebirrConfig);

    if (recipientMatch === 'MISMATCH') {
      deposit.status = 'FAILED';
      deposit.statusMessage = `Verification failed: Telebirr receipt recipient (${verifyResult.recipientPhone}) does not match configured receiving wallet (${telebirrConfig.telebirrPhoneNumber}).`;
      logFinancialAudit(
        deposit.userId,
        'SYSTEM',
        'DEPOSIT_RECIPIENT_MISMATCH',
        'deposit',
        deposit.id,
        verifiedAmount,
        deposit.statusMessage
      );
      return {
        success: false,
        httpStatus: 400,
        statusCode: 'VERIFICATION_FAILED',
        message: deposit.statusMessage,
        deposit,
      };
    }

    if (recipientMatch === 'UNCONFIRMABLE') {
      deposit.status = 'REQUIRES_ADMIN_REVIEW';
      deposit.statusMessage =
        'Payment amount matched, but the provider did not unmasked-confirm the receiving Telebirr wallet. Sent to admin review.';
      logFinancialAudit(
        deposit.userId,
        'SYSTEM',
        'DEPOSIT_REQUIRES_ADMIN_REVIEW',
        'deposit',
        deposit.id,
        verifiedAmount,
        `Tx ${deposit.providerTransactionId} (${verifiedAmount.toFixed(
          2
        )} ETB) routed to admin review because recipient wallet could not be confirmed (${
          verifyResult.recipientPhone || 'omitted'
        }).`
      );
      return {
        success: false,
        httpStatus: 202,
        statusCode: 'REQUIRES_ADMIN_REVIEW',
        message: deposit.statusMessage,
        deposit,
      };
    }

    // ALL 7 CHECKS PASSED -> Atomically credit player's wallet and append immutable ledger entry
    const wallet = this.getWallet(deposit.userId);
    const creditAmount = deposit.requestedAmount;
    const balanceBefore = wallet.availableBalance;
    const balanceAfter = parseFloat((balanceBefore + creditAmount).toFixed(2));

    const txId = generateTxId();
    const ledgerTx: WalletTransaction = {
      id: txId,
      walletId: wallet.id,
      userId: deposit.userId,
      type: 'DEPOSIT',
      amount: creditAmount,
      currency: 'ETB',
      balanceBefore,
      balanceAfter,
      reservedBefore: wallet.reservedBalance,
      reservedAfter: wallet.reservedBalance,
      referenceId: deposit.id,
      referenceType: 'deposit',
      status: 'COMPLETED',
      description: `Telebirr Deposit verified (${deposit.providerTransactionId})`,
      metadata: {
        provider: deposit.provider,
        providerTransactionId: deposit.providerTransactionId,
        providerRequestId: deposit.providerRequestId,
        senderName: verifyResult.senderName,
        senderPhone: verifyResult.senderPhone,
        recipientAccount: verifyResult.recipientPhone,
      },
      createdAt: now,
    };

    wallet.availableBalance = balanceAfter;
    wallet.updatedAt = now;
    wallet.version += 1;

    deposit.amount = creditAmount;
    deposit.status = 'VERIFIED';
    deposit.statusMessage = `Deposit Successful! ${creditAmount.toFixed(2)} ETB credited to your wallet.`;
    deposit.verifiedAt = verifyResult.verifiedAt || now;
    deposit.creditedAt = now;
    deposit.updatedAt = now;

    transactions.set(txId, ledgerTx);

    logFinancialAudit(
      deposit.userId,
      'PLAYER',
      'DEPOSIT_VERIFIED_CREDIT',
      'deposit',
      deposit.id,
      creditAmount,
      `Telebirr receipt ${deposit.providerTransactionId} passed all 7 verification checks via ${deposit.provider} and credited +${creditAmount.toFixed(
        2
      )} ETB to user ${deposit.userId}`
    );

    return {
      success: true,
      httpStatus: 200,
      statusCode: 'DEPOSIT_SUCCESSFUL',
      message: deposit.statusMessage,
      deposit,
      wallet,
      transaction: ledgerTx,
    };
  }

  /**
   * Initiate a Telebirr deposit with Verify.et:
   * - Validates requested amount and transaction number
   * - Creates a unique PENDING deposit record before calling provider
   * - Uses Idempotency-Key and handles HTTP 200 immediate and HTTP 202 queued async results
   */
  static async initiateDeposit(
    userId: string,
    requestedAmount: number,
    transactionNumber: string,
    senderPhone?: string,
    paymentMethod: string = 'telebirr'
  ): Promise<DepositOperationResult> {
    if (!telebirrConfig.depositsEnabled) {
      return {
        success: false,
        httpStatus: 503,
        statusCode: 'VERIFICATION_FAILED',
        message: 'Telebirr deposits are temporarily disabled by administration.',
      };
    }

    const cleanTxNumber = (transactionNumber || '').trim().toUpperCase();
    if (!cleanTxNumber || !/^[A-Z0-9_-]{5,64}$/.test(cleanTxNumber)) {
      return {
        success: false,
        httpStatus: 400,
        statusCode: 'VERIFICATION_FAILED',
        message: 'Please enter a valid Telebirr transaction number (5-64 alphanumeric characters).',
      };
    }

    const cleanAmount = parseFloat(Number(requestedAmount).toFixed(2));
    if (isNaN(cleanAmount) || cleanAmount < telebirrConfig.minDepositAmount) {
      return {
        success: false,
        httpStatus: 400,
        statusCode: 'VERIFICATION_FAILED',
        message: `Minimum deposit amount is ${telebirrConfig.minDepositAmount.toFixed(2)} ETB.`,
      };
    }
    if (cleanAmount > telebirrConfig.maxDepositAmount) {
      return {
        success: false,
        httpStatus: 400,
        statusCode: 'VERIFICATION_FAILED',
        message: `Maximum single deposit amount is ${telebirrConfig.maxDepositAmount.toFixed(2)} ETB.`,
      };
    }

    // Lock globally on transactionNumber first, then user wallet, preventing concurrent race double-credits
    const releaseTxLock = await acquireLock(`provider-tx:${cleanTxNumber}`);
    const releaseUserLock = await acquireLock(`wallet:${userId}`);

    try {
      // 1. Resolve provider before mutating index
      const { provider } = paymentProviderRegistry.getActiveProviderForMethod(paymentMethod);
      if (!provider) {
        return {
          success: false,
          httpStatus: 503,
          statusCode: 'PROVIDER_UNAVAILABLE',
          message: `No enabled payment verification provider is configured for ${paymentMethod}.`,
        };
      }

      const now = Date.now();
      let deposit: Deposit | undefined;

      // 2. Enforce unique constraint on providerTransactionId
      const existingDepId = providerTxIndex.get(cleanTxNumber);
      if (existingDepId) {
        const existing = deposits.get(existingDepId);
        if (existing) {
          const nonRetryableStatuses = ['VERIFIED', 'PENDING', 'REQUIRES_ADMIN_REVIEW', 'AMOUNT_MISMATCH'];
          if (existing.userId !== userId || nonRetryableStatuses.includes(existing.status)) {
            logFinancialAudit(
              userId,
              'PLAYER',
              'DUPLICATE_DEPOSIT_ATTEMPT',
              'deposit',
              cleanTxNumber,
              cleanAmount,
              `Rejected duplicate submission of receipt ${cleanTxNumber} (existing status: ${existing.status})`
            );
            return {
              success: false,
              httpStatus: 409,
              statusCode: 'ALREADY_PROCESSED',
              message: `Transaction number ${cleanTxNumber} has already been processed or is currently pending.`,
              deposit: existing.userId === userId ? existing : undefined,
            };
          }

          // Allow same user to retry an earlier transient FAILED / NOT_FOUND record using the same unique record
          existing.requestedAmount = cleanAmount;
          existing.amount = cleanAmount;
          existing.status = 'PENDING';
          existing.statusMessage = 'Verifying Payment';
          existing.idempotencyKey = `dep-${provider.id}-${cleanTxNumber}-${now}`;
          existing.updatedAt = now;
          deposit = existing;
        }
      }

      // 3. Create new unique PENDING deposit record
      if (!deposit) {
        const wallet = this.getWallet(userId);
        const depositId = `dep-${now}-${Math.floor(Math.random() * 10000)}`;
        deposit = {
          id: depositId,
          walletId: wallet.id,
          userId,
          provider: provider.id,
          providerTransactionId: cleanTxNumber,
          idempotencyKey: `dep-${provider.id}-${cleanTxNumber}`,
          requestedAmount: cleanAmount,
          amount: cleanAmount,
          currency: 'ETB',
          paymentMethod,
          status: 'PENDING',
          statusMessage: 'Pending Verification',
          createdAt: now,
          updatedAt: now,
        };
        deposits.set(deposit.id, deposit);
        providerTxIndex.set(cleanTxNumber, deposit.id);
      }

      // 4. Call Verify.et / provider verification API
      const verifyResult = await provider.verifyTransaction({
        transactionNumber: cleanTxNumber,
        expectedAmount: cleanAmount,
        expectedCurrency: 'ETB',
        senderPhone,
        paymentMethod,
        idempotencyKey: deposit.idempotencyKey,
        waitMs: 8000,
      });

      if (verifyResult.providerRequestId) {
        deposit.providerRequestId = verifyResult.providerRequestId;
        providerRequestIndex.set(verifyResult.providerRequestId, deposit.id);
      }

      // 5. Evaluate 7 strict rules (or leave PENDING on HTTP 202 queued)
      return this.evaluateAndApplyVerificationLocked(deposit, verifyResult, userId);
    } finally {
      releaseUserLock();
      releaseTxLock();
    }
  }

  /**
   * Backward-compatible alias that delegates to initiateDeposit
   */
  static async processDeposit(
    userId: string,
    transactionNumber: string,
    expectedAmount?: number,
    senderPhone?: string,
    paymentMethod: string = 'telebirr'
  ): Promise<DepositOperationResult> {
    return this.initiateDeposit(
      userId,
      expectedAmount && expectedAmount > 0 ? expectedAmount : 0,
      transactionNumber,
      senderPhone,
      paymentMethod
    );
  }

  /**
   * Poll an asynchronous HTTP 202 PENDING deposit from Verify.et
   */
  static async pollDepositStatus(
    depositId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<DepositOperationResult> {
    const initial = deposits.get(depositId);
    if (!initial) {
      return {
        success: false,
        httpStatus: 404,
        statusCode: 'TRANSACTION_NOT_FOUND',
        message: 'Deposit record not found.',
      };
    }

    if (!isAdmin && initial.userId !== userId) {
      return {
        success: false,
        httpStatus: 403,
        statusCode: 'VERIFICATION_FAILED',
        message: 'You do not have permission to view this deposit.',
      };
    }

    // If not pending or no providerRequestId to poll, return current status immediately
    if (initial.status !== 'PENDING' || !initial.providerRequestId) {
      const codeMap: Record<Deposit['status'], DepositStatusCode> = {
        VERIFIED: 'DEPOSIT_SUCCESSFUL',
        PENDING: 'PENDING_VERIFICATION',
        NOT_FOUND: 'TRANSACTION_NOT_FOUND',
        AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
        REQUIRES_ADMIN_REVIEW: 'REQUIRES_ADMIN_REVIEW',
        FAILED: 'VERIFICATION_FAILED',
        DUPLICATE_REJECTED: 'ALREADY_PROCESSED',
      };
      return {
        success: initial.status === 'VERIFIED' || initial.status === 'PENDING',
        httpStatus: initial.status === 'PENDING' ? 202 : initial.status === 'VERIFIED' ? 200 : 400,
        statusCode: codeMap[initial.status],
        message: initial.statusMessage || initial.status,
        deposit: initial,
        wallet: initial.status === 'VERIFIED' ? this.getWallet(initial.userId) : undefined,
      };
    }

    const releaseTxLock = await acquireLock(`provider-tx:${initial.providerTransactionId}`);
    const releaseUserLock = await acquireLock(`wallet:${initial.userId}`);

    try {
      const deposit = deposits.get(depositId);
      if (!deposit) {
        return {
          success: false,
          httpStatus: 404,
          statusCode: 'TRANSACTION_NOT_FOUND',
          message: 'Deposit record not found.',
        };
      }

      if (deposit.status !== 'PENDING') {
        return {
          success: deposit.status === 'VERIFIED',
          httpStatus: deposit.status === 'VERIFIED' ? 200 : 400,
          statusCode: deposit.status === 'VERIFIED' ? 'DEPOSIT_SUCCESSFUL' : 'VERIFICATION_FAILED',
          message: deposit.statusMessage || deposit.status,
          deposit,
          wallet: deposit.status === 'VERIFIED' ? this.getWallet(deposit.userId) : undefined,
        };
      }

      const provider = paymentProviderRegistry.getProvider(deposit.provider);
      if (!provider || !provider.checkVerificationStatus || !deposit.providerRequestId) {
        return {
          success: true,
          httpStatus: 202,
          statusCode: 'PENDING_VERIFICATION',
          message: deposit.statusMessage || 'Pending Verification',
          deposit,
        };
      }

      const pollResult = await provider.checkVerificationStatus(deposit.providerRequestId);
      return this.evaluateAndApplyVerificationLocked(deposit, pollResult);
    } finally {
      releaseUserLock();
      releaseTxLock();
    }
  }

  /**
   * Handle asynchronous webhook callback from Verify.et:
   * - Verifies HMAC-SHA256 signature & replay timestamp
   * - Deduplicates repeated deliveries safely via X-Webhook-Event-Id
   * - Applies the 7 mandatory verification rules atomically under lock
   */
  static async handleWebhookDelivery(
    providerId: string,
    rawBody: string,
    headers: Record<string, string | string[] | undefined>
  ): Promise<{
    ok: boolean;
    httpStatus: number;
    duplicate?: boolean;
    message?: string;
    error?: string;
    deposit?: Deposit;
    wallet?: Wallet;
    transaction?: WalletTransaction;
  }> {
    const provider = paymentProviderRegistry.getProvider(providerId);
    if (!provider || !provider.verifyWebhookSignature || !provider.parseWebhookEvent) {
      return { ok: false, httpStatus: 404, error: `Webhook handler not supported for provider '${providerId}'.` };
    }

    // 1. Verify HMAC-SHA256 webhook signature & timestamp window
    const sigCheck = provider.verifyWebhookSignature(headers, rawBody);
    if (!sigCheck.valid) {
      logFinancialAudit(
        'WEBHOOK',
        'SYSTEM',
        'WEBHOOK_SIGNATURE_REJECTED',
        'deposit',
        sigCheck.eventId || 'unknown',
        undefined,
        `Rejected Verify.et webhook: ${sigCheck.reason}`
      );
      return { ok: false, httpStatus: 401, error: sigCheck.reason || 'Invalid webhook signature.' };
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody || '{}');
    } catch {
      return { ok: false, httpStatus: 400, error: 'Invalid JSON webhook payload.' };
    }

    const parsed = provider.parseWebhookEvent(payload);
    const eventId = sigCheck.eventId || parsed.eventId;

    // 2. Deduplicate repeated webhook deliveries
    if (eventId && processedWebhookEvents.has(eventId)) {
      return {
        ok: true,
        httpStatus: 204,
        duplicate: true,
        message: 'Duplicate webhook event safely ignored.',
      };
    }

    // 3. Locate corresponding pending deposit
    let depositId = parsed.requestId ? providerRequestIndex.get(parsed.requestId.trim()) : undefined;
    const txNum = (parsed.verification.providerTransactionId || '').trim().toUpperCase();
    if (!depositId && txNum) {
      depositId = providerTxIndex.get(txNum);
    }

    if (!depositId) {
      if (eventId) processedWebhookEvents.add(eventId);
      logFinancialAudit(
        'WEBHOOK',
        'SYSTEM',
        'WEBHOOK_UNMATCHED_DEPOSIT',
        'deposit',
        parsed.requestId || txNum || 'unknown',
        undefined,
        `Received verified Verify.et webhook (${sigCheck.eventType || parsed.eventType}) for untracked request.`
      );
      return { ok: true, httpStatus: 204, message: 'Webhook acknowledged.' };
    }

    const initialDeposit = deposits.get(depositId);
    if (!initialDeposit) {
      if (eventId) processedWebhookEvents.add(eventId);
      return { ok: true, httpStatus: 204, message: 'Deposit not found; webhook acknowledged.' };
    }

    const releaseTxLock = await acquireLock(`provider-tx:${initialDeposit.providerTransactionId}`);
    const releaseUserLock = await acquireLock(`wallet:${initialDeposit.userId}`);

    try {
      if (eventId && processedWebhookEvents.has(eventId)) {
        return {
          ok: true,
          httpStatus: 204,
          duplicate: true,
          message: 'Duplicate webhook event safely ignored.',
          deposit: initialDeposit,
        };
      }

      const deposit = deposits.get(depositId);
      if (!deposit) {
        if (eventId) processedWebhookEvents.add(eventId);
        return { ok: true, httpStatus: 204, message: 'Webhook acknowledged.' };
      }

      // Already credited -> idempotent ignore
      if (deposit.status === 'VERIFIED' || deposit.creditedAt) {
        if (eventId) processedWebhookEvents.add(eventId);
        return {
          ok: true,
          httpStatus: 204,
          duplicate: true,
          message: 'Deposit already credited; webhook ignored.',
          deposit,
        };
      }

      const outcome = this.evaluateAndApplyVerificationLocked(deposit, parsed.verification);
      if (eventId) processedWebhookEvents.add(eventId);

      logFinancialAudit(
        'WEBHOOK',
        'SYSTEM',
        'WEBHOOK_DEPOSIT_PROCESSED',
        'deposit',
        deposit.id,
        deposit.verifiedAmount ?? deposit.requestedAmount,
        `Webhook (${sigCheck.eventType || parsed.eventType}) updated deposit ${deposit.id} -> ${deposit.status}`
      );

      return {
        ok: true,
        httpStatus: 204,
        deposit: outcome.deposit,
        wallet: outcome.wallet,
        transaction: outcome.transaction,
        message: outcome.message,
      };
    } finally {
      releaseUserLock();
      releaseTxLock();
    }
  }

  /**
   * Admin approves a deposit flagged REQUIRES_ADMIN_REVIEW (or verifies recipient manually)
   */
  static async adminApproveDeposit(
    depositId: string,
    adminId: string,
    note?: string
  ): Promise<DepositOperationResult> {
    const initial = deposits.get(depositId);
    if (!initial) {
      return {
        success: false,
        httpStatus: 404,
        statusCode: 'TRANSACTION_NOT_FOUND',
        message: 'Deposit record not found.',
      };
    }

    const releaseTxLock = await acquireLock(`provider-tx:${initial.providerTransactionId}`);
    const releaseUserLock = await acquireLock(`wallet:${initial.userId}`);

    try {
      const deposit = deposits.get(depositId);
      if (!deposit) {
        return {
          success: false,
          httpStatus: 404,
          statusCode: 'TRANSACTION_NOT_FOUND',
          message: 'Deposit record not found.',
        };
      }

      if (deposit.status === 'VERIFIED' || deposit.creditedAt) {
        return {
          success: false,
          httpStatus: 409,
          statusCode: 'ALREADY_PROCESSED',
          message: 'Deposit has already been verified and credited.',
          deposit,
        };
      }

      if (deposit.status !== 'REQUIRES_ADMIN_REVIEW') {
        return {
          success: false,
          httpStatus: 400,
          statusCode: 'VERIFICATION_FAILED',
          message: `Only REQUIRES_ADMIN_REVIEW deposits can be manually approved (current: ${deposit.status}).`,
          deposit,
        };
      }

      const creditAmount = parseFloat((deposit.verifiedAmount || deposit.requestedAmount).toFixed(2));
      const wallet = this.getWallet(deposit.userId);
      const now = Date.now();
      const balanceBefore = wallet.availableBalance;
      const balanceAfter = parseFloat((balanceBefore + creditAmount).toFixed(2));

      const cleanNote = note?.trim() || undefined;
      const txId = generateTxId();
      const ledgerTx: WalletTransaction = {
        id: txId,
        walletId: wallet.id,
        userId: deposit.userId,
        type: 'DEPOSIT',
        amount: creditAmount,
        currency: 'ETB',
        balanceBefore,
        balanceAfter,
        reservedBefore: wallet.reservedBalance,
        reservedAfter: wallet.reservedBalance,
        referenceId: deposit.id,
        referenceType: 'deposit',
        status: 'COMPLETED',
        description: `Telebirr Deposit manually approved by admin ${adminId} (${deposit.providerTransactionId})`,
        metadata: {
          provider: deposit.provider,
          providerTransactionId: deposit.providerTransactionId,
          manualDecision: 'APPROVED',
          reviewedBy: adminId,
          reviewNote: cleanNote,
        },
        createdAt: now,
      };

      wallet.availableBalance = balanceAfter;
      wallet.updatedAt = now;
      wallet.version += 1;

      deposit.amount = creditAmount;
      deposit.status = 'VERIFIED';
      deposit.manualDecision = 'APPROVED';
      deposit.reviewNote = cleanNote;
      deposit.statusMessage = `Manually approved by admin ${adminId}. ${creditAmount.toFixed(2)} ETB credited.`;
      deposit.reviewedBy = adminId;
      deposit.reviewedAt = now;
      deposit.verifiedAt = deposit.verifiedAt || now;
      deposit.creditedAt = now;
      deposit.updatedAt = now;

      transactions.set(txId, ledgerTx);

      logFinancialAudit(
        adminId,
        'ADMIN',
        'ADMIN_DEPOSIT_MANUAL_APPROVED',
        'deposit',
        deposit.id,
        creditAmount,
        `Admin ${adminId} manually approved deposit ${deposit.id} (${deposit.providerTransactionId}) for +${creditAmount.toFixed(
          2
        )} ETB${cleanNote ? `. Note: ${cleanNote}` : ''}`
      );

      return {
        success: true,
        httpStatus: 200,
        statusCode: 'DEPOSIT_SUCCESSFUL',
        message: deposit.statusMessage,
        deposit,
        wallet,
        transaction: ledgerTx,
      };
    } finally {
      releaseUserLock();
      releaseTxLock();
    }
  }

  /**
   * Admin rejects a flagged/pending deposit without crediting
   */
  static async adminRejectDeposit(
    depositId: string,
    adminId: string,
    reason: string
  ): Promise<DepositOperationResult> {
    const initial = deposits.get(depositId);
    if (!initial) {
      return {
        success: false,
        httpStatus: 404,
        statusCode: 'TRANSACTION_NOT_FOUND',
        message: 'Deposit record not found.',
      };
    }

    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      return {
        success: false,
        httpStatus: 400,
        statusCode: 'VERIFICATION_FAILED',
        message: 'Rejection reason is required.',
      };
    }

    const releaseTxLock = await acquireLock(`provider-tx:${initial.providerTransactionId}`);
    const releaseUserLock = await acquireLock(`wallet:${initial.userId}`);

    try {
      const deposit = deposits.get(depositId);
      if (!deposit) {
        return {
          success: false,
          httpStatus: 404,
          statusCode: 'TRANSACTION_NOT_FOUND',
          message: 'Deposit record not found.',
        };
      }

      if (deposit.status === 'VERIFIED' || deposit.creditedAt) {
        return {
          success: false,
          httpStatus: 409,
          statusCode: 'ALREADY_PROCESSED',
          message: 'Cannot reject a deposit that has already been credited.',
          deposit,
        };
      }

      const now = Date.now();
      deposit.status = 'FAILED';
      deposit.manualDecision = 'REJECTED';
      deposit.reviewNote = cleanReason;
      deposit.reviewedBy = adminId;
      deposit.reviewedAt = now;
      deposit.rejectionReason = cleanReason;
      deposit.statusMessage = `Manually rejected by admin ${adminId}: ${cleanReason}`;
      deposit.updatedAt = now;

      logFinancialAudit(
        adminId,
        'ADMIN',
        'ADMIN_DEPOSIT_MANUAL_REJECTED',
        'deposit',
        deposit.id,
        deposit.requestedAmount,
        `Admin ${adminId} manually rejected deposit ${deposit.id} (${deposit.providerTransactionId}): ${cleanReason}`
      );

      return {
        success: true,
        httpStatus: 200,
        statusCode: 'VERIFICATION_FAILED',
        message: `Deposit ${deposit.id} rejected.`,
        deposit,
      };
    } finally {
      releaseUserLock();
      releaseTxLock();
    }
  }

  /**
   * Request a withdrawal (atomically validates limits/eligibility, deduplicates idempotency key, and reserves balance)
   */
  static async requestWithdrawal(
    userId: string,
    amount: number,
    accountIdentifier: string,
    accountName: string,
    payoutMethod: string = 'telebirr',
    idempotencyKey?: string,
    accountEligible: boolean = true
  ): Promise<{ success: boolean; duplicate?: boolean; message: string; withdrawal?: Withdrawal; wallet?: Wallet }> {
    if (!telebirrConfig.withdrawalsEnabled) {
      return { success: false, message: 'Withdrawals are temporarily paused by administration.' };
    }
    if (!accountEligible) {
      return { success: false, message: 'Your account is not currently eligible for withdrawals.' };
    }

    const numAmount = parseFloat(Number(amount).toFixed(2));
    if (isNaN(numAmount) || numAmount < telebirrConfig.minWithdrawalAmount) {
      return {
        success: false,
        message: `Minimum withdrawal amount is ${telebirrConfig.minWithdrawalAmount.toFixed(2)} ETB.`,
      };
    }
    if (numAmount > telebirrConfig.maxWithdrawalAmount) {
      return {
        success: false,
        message: `Maximum single withdrawal amount is ${telebirrConfig.maxWithdrawalAmount.toFixed(2)} ETB.`,
      };
    }

    const cleanAccount = (accountIdentifier || '').trim();
    const digitsOnly = cleanAccount.replace(/\D/g, '');
    if (!cleanAccount || digitsOnly.length < 9) {
      return { success: false, message: 'Please provide a valid Telebirr phone number (at least 9 digits).' };
    }

    const cleanName = (accountName || '').trim();
    if (!cleanName || cleanName.length < 2) {
      return { success: false, message: 'Telebirr account holder name is required.' };
    }

    const cleanIdemp = (idempotencyKey || '').trim() || undefined;

    const release = await acquireLock(`wallet:${userId}`);
    try {
      // Idempotency check to prevent duplicate submissions
      if (cleanIdemp) {
        const existingId = withdrawalIdempotencyIndex.get(`${userId}:${cleanIdemp}`);
        if (existingId) {
          const existing = withdrawals.get(existingId);
          if (existing) {
            return {
              success: true,
              duplicate: true,
              message: `Duplicate request safely ignored. Existing withdrawal ${existing.id} (${existing.status}) returned.`,
              withdrawal: existing,
              wallet: this.getWallet(userId),
            };
          }
        }
      }

      const wallet = this.getWallet(userId);

      if (wallet.availableBalance < numAmount) {
        return {
          success: false,
          message: `Insufficient available balance (${wallet.availableBalance.toFixed(2)} ETB) for requested withdrawal (${numAmount.toFixed(2)} ETB).`,
        };
      }

      const now = Date.now();
      const balanceBefore = wallet.availableBalance;
      const balanceAfter = parseFloat((balanceBefore - numAmount).toFixed(2));
      const reservedBefore = wallet.reservedBalance;
      const reservedAfter = parseFloat((reservedBefore + numAmount).toFixed(2));

      const withdrawalId = `wdr-${now}-${Math.floor(Math.random() * 10000)}`;
      const withdrawal: Withdrawal = {
        id: withdrawalId,
        walletId: wallet.id,
        userId,
        amount: numAmount,
        currency: 'ETB',
        payoutMethod,
        accountIdentifier: cleanAccount,
        accountName: cleanName,
        idempotencyKey: cleanIdemp,
        status: 'PENDING',
        statusMessage: 'Pending Review — Funds reserved in your wallet.',
        requestedAt: now,
        updatedAt: now,
      };

      const txId = generateTxId();
      const ledgerTx: WalletTransaction = {
        id: txId,
        walletId: wallet.id,
        userId,
        type: 'WITHDRAWAL_REQUEST',
        amount: numAmount,
        currency: 'ETB',
        balanceBefore,
        balanceAfter,
        reservedBefore,
        reservedAfter,
        referenceId: withdrawalId,
        referenceType: 'withdrawal',
        status: 'PENDING',
        description: `Withdrawal request to ${payoutMethod.toUpperCase()} (${cleanAccount} - ${cleanName})`,
        metadata: {
          accountIdentifier: cleanAccount,
          accountName: cleanName,
          idempotencyKey: cleanIdemp,
        },
        createdAt: now,
      };

      // Atomic mutation
      wallet.availableBalance = balanceAfter;
      wallet.reservedBalance = reservedAfter;
      wallet.updatedAt = now;
      wallet.version += 1;

      withdrawals.set(withdrawalId, withdrawal);
      transactions.set(txId, ledgerTx);
      if (cleanIdemp) {
        withdrawalIdempotencyIndex.set(`${userId}:${cleanIdemp}`, withdrawalId);
      }

      logFinancialAudit(
        userId,
        'PLAYER',
        'WITHDRAWAL_REQUEST_RESERVED',
        'withdrawal',
        withdrawalId,
        numAmount,
        `Withdrawal of ${numAmount.toFixed(2)} ETB requested to ${cleanAccount} (${cleanName}). Funds reserved.`
      );

      return {
        success: true,
        message: `Withdrawal request for ${numAmount.toFixed(2)} ETB submitted. Funds are reserved pending admin review.`,
        withdrawal,
        wallet,
      };
    } finally {
      release();
    }
  }

  /**
   * Stage 2: Admin moves PENDING withdrawal -> UNDER_REVIEW (funds remain reserved)
   */
  static async moveWithdrawalToUnderReview(
    withdrawalId: string,
    adminId: string,
    note?: string
  ): Promise<{ success: boolean; message: string; withdrawal?: Withdrawal; wallet?: Wallet }> {
    const initial = withdrawals.get(withdrawalId);
    if (!initial) {
      return { success: false, message: 'Withdrawal record not found.' };
    }

    const release = await acquireLock(`wallet:${initial.userId}`);
    try {
      const withdrawal = withdrawals.get(withdrawalId);
      if (!withdrawal) return { success: false, message: 'Withdrawal record not found.' };
      if (withdrawal.settledAt) {
        return { success: false, message: `Withdrawal is already finalized (${withdrawal.status}).` };
      }
      if (withdrawal.status !== 'PENDING') {
        return { success: false, message: `Only PENDING withdrawals can move to UNDER_REVIEW (current: ${withdrawal.status}).` };
      }

      const now = Date.now();
      withdrawal.status = 'UNDER_REVIEW';
      withdrawal.reviewedBy = adminId;
      withdrawal.reviewedAt = now;
      if (note?.trim()) withdrawal.reviewNote = note.trim();
      withdrawal.statusMessage = 'Under Review by financial administrator.';
      withdrawal.updatedAt = now;

      logFinancialAudit(
        adminId,
        'ADMIN',
        'WITHDRAWAL_UNDER_REVIEW',
        'withdrawal',
        withdrawal.id,
        withdrawal.amount,
        `Moved withdrawal ${withdrawal.id} (${withdrawal.amount.toFixed(2)} ETB) to UNDER_REVIEW.${
          withdrawal.reviewNote ? ` Note: ${withdrawal.reviewNote}` : ''
        }`
      );

      return {
        success: true,
        message: `Withdrawal ${withdrawal.id} marked as Under Review.`,
        withdrawal,
        wallet: this.getWallet(withdrawal.userId),
      };
    } finally {
      release();
    }
  }

  /**
   * Stage 3: Admin approves withdrawal (PENDING | UNDER_REVIEW -> APPROVED; funds remain reserved until Paid)
   */
  static async approveWithdrawal(
    withdrawalId: string,
    adminId: string,
    note?: string
  ): Promise<{ success: boolean; message: string; withdrawal?: Withdrawal; wallet?: Wallet }> {
    const initialWithdrawal = withdrawals.get(withdrawalId);
    if (!initialWithdrawal) {
      return { success: false, message: 'Withdrawal record not found.' };
    }

    const release = await acquireLock(`wallet:${initialWithdrawal.userId}`);
    try {
      const withdrawal = withdrawals.get(withdrawalId);
      if (!withdrawal) {
        return { success: false, message: 'Withdrawal record not found.' };
      }
      if (withdrawal.settledAt) {
        return { success: false, message: `Withdrawal is already finalized (${withdrawal.status}).` };
      }
      if (withdrawal.status !== 'PENDING' && withdrawal.status !== 'UNDER_REVIEW') {
        return { success: false, message: `Withdrawal cannot be approved from '${withdrawal.status}' status.` };
      }

      const wallet = this.getWallet(withdrawal.userId);
      if (wallet.reservedBalance + 0.001 < withdrawal.amount) {
        return { success: false, message: 'Reserved balance is insufficient for this withdrawal.' };
      }

      const now = Date.now();
      withdrawal.status = 'APPROVED';
      withdrawal.approvedBy = adminId;
      withdrawal.approvedAt = now;
      withdrawal.reviewedBy = withdrawal.reviewedBy || adminId;
      withdrawal.reviewedAt = withdrawal.reviewedAt || now;
      if (note?.trim()) withdrawal.reviewNote = note.trim();
      withdrawal.statusMessage = 'Approved for payout. Send Telebirr transfer and record outgoing transaction reference to mark Paid.';
      withdrawal.updatedAt = now;

      logFinancialAudit(
        adminId,
        'ADMIN',
        'WITHDRAWAL_APPROVED',
        'withdrawal',
        withdrawal.id,
        withdrawal.amount,
        `Approved withdrawal ${withdrawal.id} (${withdrawal.amount.toFixed(2)} ETB to ${withdrawal.accountIdentifier} - ${withdrawal.accountName}). Awaiting payout execution.`
      );

      return {
        success: true,
        message: `Withdrawal ${withdrawal.id} approved for payout. Funds remain reserved until Paid.`,
        withdrawal,
        wallet,
      };
    } finally {
      release();
    }
  }

  /**
   * Stage 4: Admin marks APPROVED withdrawal -> PROCESSING (Payment in progress, funds remain reserved)
   */
  static async markWithdrawalProcessing(
    withdrawalId: string,
    adminId: string,
    note?: string
  ): Promise<{ success: boolean; message: string; withdrawal?: Withdrawal; wallet?: Wallet }> {
    const initial = withdrawals.get(withdrawalId);
    if (!initial) {
      return { success: false, message: 'Withdrawal record not found.' };
    }

    const release = await acquireLock(`wallet:${initial.userId}`);
    try {
      const withdrawal = withdrawals.get(withdrawalId);
      if (!withdrawal) return { success: false, message: 'Withdrawal record not found.' };
      if (withdrawal.settledAt) {
        return { success: false, message: `Withdrawal is already finalized (${withdrawal.status}).` };
      }
      if (withdrawal.status !== 'APPROVED') {
        return { success: false, message: `Only APPROVED withdrawals can move to PROCESSING (current: ${withdrawal.status}).` };
      }

      const now = Date.now();
      withdrawal.status = 'PROCESSING';
      if (note?.trim()) withdrawal.reviewNote = note.trim();
      withdrawal.statusMessage = 'Processing Payment — Telebirr payout transfer initiated.';
      withdrawal.updatedAt = now;

      logFinancialAudit(
        adminId,
        'ADMIN',
        'WITHDRAWAL_PROCESSING',
        'withdrawal',
        withdrawal.id,
        withdrawal.amount,
        `Marked withdrawal ${withdrawal.id} as Processing Payment.${withdrawal.reviewNote ? ` Note: ${withdrawal.reviewNote}` : ''}`
      );

      return {
        success: true,
        message: `Withdrawal ${withdrawal.id} is now Processing Payment.`,
        withdrawal,
        wallet: this.getWallet(withdrawal.userId),
      };
    } finally {
      release();
    }
  }

  /**
   * Stage 5: Admin records outgoing Telebirr transaction reference and marks APPROVED | PROCESSING -> PAID.
   * Atomically deducts reservedBalance and writes immutable WITHDRAWAL_PAID ledger entry.
   */
  static async markWithdrawalPaid(
    withdrawalId: string,
    adminId: string,
    paymentReference: string,
    note?: string
  ): Promise<{ success: boolean; message: string; withdrawal?: Withdrawal; wallet?: Wallet; transaction?: WalletTransaction }> {
    const initial = withdrawals.get(withdrawalId);
    if (!initial) {
      return { success: false, message: 'Withdrawal record not found.' };
    }

    const cleanRef = (paymentReference || '').trim();
    if (!cleanRef || cleanRef.length < 4) {
      return {
        success: false,
        message: 'Outgoing Telebirr transaction reference (min 4 characters) is required before marking a withdrawal Paid.',
      };
    }

    const release = await acquireLock(`wallet:${initial.userId}`);
    try {
      const withdrawal = withdrawals.get(withdrawalId);
      if (!withdrawal) {
        return { success: false, message: 'Withdrawal record not found.' };
      }
      if (withdrawal.settledAt || withdrawal.status === 'PAID' || withdrawal.status === 'COMPLETED') {
        return { success: false, message: `Withdrawal has already been finalized (${withdrawal.status}).` };
      }
      if (withdrawal.status !== 'APPROVED' && withdrawal.status !== 'PROCESSING') {
        return {
          success: false,
          message: `Withdrawal must be APPROVED or PROCESSING before marking as Paid (current: ${withdrawal.status}).`,
        };
      }

      const refKey = cleanRef.toUpperCase();
      const existingRefWdr = withdrawalPayoutRefIndex.get(refKey);
      if (existingRefWdr && existingRefWdr !== withdrawal.id) {
        return {
          success: false,
          message: `Telebirr transaction reference '${cleanRef}' is already attached to withdrawal ${existingRefWdr}.`,
        };
      }

      const wallet = this.getWallet(withdrawal.userId);
      if (wallet.reservedBalance + 0.001 < withdrawal.amount) {
        return { success: false, message: 'Reserved balance is insufficient to settle this withdrawal.' };
      }

      const now = Date.now();
      const reservedBefore = wallet.reservedBalance;
      const reservedAfter = parseFloat(Math.max(0, reservedBefore - withdrawal.amount).toFixed(2));
      const cleanNote = note?.trim() || withdrawal.reviewNote;

      withdrawal.status = 'PAID';
      withdrawal.paymentReference = cleanRef;
      withdrawal.paidBy = adminId;
      withdrawal.paidAt = now;
      withdrawal.settledAt = now;
      if (cleanNote) withdrawal.reviewNote = cleanNote;
      withdrawal.statusMessage = `Paid via Telebirr (Ref: ${cleanRef}).`;
      withdrawal.updatedAt = now;

      const txId = generateTxId();
      const ledgerTx: WalletTransaction = {
        id: txId,
        walletId: wallet.id,
        userId: withdrawal.userId,
        type: 'WITHDRAWAL_PAID',
        amount: withdrawal.amount,
        currency: 'ETB',
        balanceBefore: wallet.availableBalance,
        balanceAfter: wallet.availableBalance,
        reservedBefore,
        reservedAfter,
        referenceId: withdrawal.id,
        referenceType: 'withdrawal',
        status: 'COMPLETED',
        description: `Withdrawal paid via ${withdrawal.payoutMethod.toUpperCase()} to ${withdrawal.accountIdentifier} (Ref: ${cleanRef})`,
        metadata: {
          adminId,
          paymentReference: cleanRef,
          accountIdentifier: withdrawal.accountIdentifier,
          accountName: withdrawal.accountName,
          note: cleanNote,
        },
        createdAt: now,
      };

      wallet.reservedBalance = reservedAfter;
      wallet.updatedAt = now;
      wallet.version += 1;

      transactions.set(txId, ledgerTx);
      withdrawalPayoutRefIndex.set(refKey, withdrawal.id);

      logFinancialAudit(
        adminId,
        'ADMIN',
        'WITHDRAWAL_PAID',
        'withdrawal',
        withdrawal.id,
        withdrawal.amount,
        `Marked withdrawal ${withdrawal.id} Paid (${withdrawal.amount.toFixed(2)} ETB to ${withdrawal.accountIdentifier} - ${withdrawal.accountName}). Outgoing Ref: ${cleanRef}`
      );

      return {
        success: true,
        message: `Withdrawal ${withdrawal.id} marked Paid (Ref: ${cleanRef}).`,
        withdrawal,
        wallet,
        transaction: ledgerTx,
      };
    } finally {
      release();
    }
  }

  /**
   * Reject an unsettled withdrawal (releases reserved balance back into availableBalance exactly once)
   */
  static async rejectWithdrawal(
    withdrawalId: string,
    adminId: string,
    rejectionReason: string
  ): Promise<{ success: boolean; message: string; withdrawal?: Withdrawal; wallet?: Wallet; transaction?: WalletTransaction }> {
    const initialWithdrawal = withdrawals.get(withdrawalId);
    if (!initialWithdrawal) {
      return { success: false, message: 'Withdrawal record not found.' };
    }

    const cleanReason = (rejectionReason || '').trim();
    if (!cleanReason) {
      return { success: false, message: 'A rejection reason is required.' };
    }

    const release = await acquireLock(`wallet:${initialWithdrawal.userId}`);
    try {
      const withdrawal = withdrawals.get(withdrawalId);
      if (!withdrawal) {
        return { success: false, message: 'Withdrawal record not found.' };
      }
      if (withdrawal.settledAt || ['PAID', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED'].includes(withdrawal.status)) {
        return { success: false, message: `Withdrawal is already finalized (${withdrawal.status}).` };
      }

      const wallet = this.getWallet(withdrawal.userId);
      const now = Date.now();
      const balanceBefore = wallet.availableBalance;
      const balanceAfter = parseFloat((balanceBefore + withdrawal.amount).toFixed(2));
      const reservedBefore = wallet.reservedBalance;
      const reservedAfter = parseFloat(Math.max(0, reservedBefore - withdrawal.amount).toFixed(2));

      withdrawal.status = 'REJECTED';
      withdrawal.rejectedBy = adminId;
      withdrawal.rejectedAt = now;
      withdrawal.reviewedBy = withdrawal.reviewedBy || adminId;
      withdrawal.reviewedAt = withdrawal.reviewedAt || now;
      withdrawal.rejectionReason = cleanReason;
      withdrawal.settledAt = now;
      withdrawal.statusMessage = `Rejected: ${cleanReason}. Reserved funds released.`;
      withdrawal.updatedAt = now;

      const txId = generateTxId();
      const ledgerTx: WalletTransaction = {
        id: txId,
        walletId: wallet.id,
        userId: withdrawal.userId,
        type: 'WITHDRAWAL_REJECTED',
        amount: withdrawal.amount,
        currency: 'ETB',
        balanceBefore,
        balanceAfter,
        reservedBefore,
        reservedAfter,
        referenceId: withdrawal.id,
        referenceType: 'withdrawal',
        status: 'COMPLETED',
        description: `Withdrawal rejected: ${cleanReason}. Funds returned to available balance.`,
        metadata: {
          adminId,
          rejectionReason: cleanReason,
        },
        createdAt: now,
      };

      wallet.availableBalance = balanceAfter;
      wallet.reservedBalance = reservedAfter;
      wallet.updatedAt = now;
      wallet.version += 1;

      transactions.set(txId, ledgerTx);

      logFinancialAudit(
        adminId,
        'ADMIN',
        'WITHDRAWAL_REJECTED',
        'withdrawal',
        withdrawal.id,
        withdrawal.amount,
        `Rejected withdrawal ${withdrawal.id}. Reason: ${cleanReason}. Released ${withdrawal.amount.toFixed(2)} ETB back to available balance.`
      );

      return {
        success: true,
        message: `Withdrawal ${withdrawal.id} rejected and reserved funds returned to available balance.`,
        withdrawal,
        wallet,
        transaction: ledgerTx,
      };
    } finally {
      release();
    }
  }

  /**
   * Mark an unsettled withdrawal as FAILED (releases reserved balance back into availableBalance exactly once)
   */
  static async failWithdrawal(
    withdrawalId: string,
    adminId: string,
    failureReason: string
  ): Promise<{ success: boolean; message: string; withdrawal?: Withdrawal; wallet?: Wallet; transaction?: WalletTransaction }> {
    const initialWithdrawal = withdrawals.get(withdrawalId);
    if (!initialWithdrawal) {
      return { success: false, message: 'Withdrawal record not found.' };
    }

    const cleanReason = (failureReason || '').trim();
    if (!cleanReason) {
      return { success: false, message: 'A failure reason is required.' };
    }

    const release = await acquireLock(`wallet:${initialWithdrawal.userId}`);
    try {
      const withdrawal = withdrawals.get(withdrawalId);
      if (!withdrawal) {
        return { success: false, message: 'Withdrawal record not found.' };
      }
      if (withdrawal.settledAt || ['PAID', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED'].includes(withdrawal.status)) {
        return { success: false, message: `Withdrawal is already finalized (${withdrawal.status}).` };
      }

      const wallet = this.getWallet(withdrawal.userId);
      const now = Date.now();
      const balanceBefore = wallet.availableBalance;
      const balanceAfter = parseFloat((balanceBefore + withdrawal.amount).toFixed(2));
      const reservedBefore = wallet.reservedBalance;
      const reservedAfter = parseFloat(Math.max(0, reservedBefore - withdrawal.amount).toFixed(2));

      withdrawal.status = 'FAILED';
      withdrawal.failedBy = adminId;
      withdrawal.failedAt = now;
      withdrawal.failureReason = cleanReason;
      withdrawal.settledAt = now;
      withdrawal.statusMessage = `Payout Failed: ${cleanReason}. Reserved funds released.`;
      withdrawal.updatedAt = now;

      const txId = generateTxId();
      const ledgerTx: WalletTransaction = {
        id: txId,
        walletId: wallet.id,
        userId: withdrawal.userId,
        type: 'WITHDRAWAL_FAILED',
        amount: withdrawal.amount,
        currency: 'ETB',
        balanceBefore,
        balanceAfter,
        reservedBefore,
        reservedAfter,
        referenceId: withdrawal.id,
        referenceType: 'withdrawal',
        status: 'COMPLETED',
        description: `Withdrawal payout failed: ${cleanReason}. Funds released back to available balance.`,
        metadata: {
          adminId,
          failureReason: cleanReason,
        },
        createdAt: now,
      };

      wallet.availableBalance = balanceAfter;
      wallet.reservedBalance = reservedAfter;
      wallet.updatedAt = now;
      wallet.version += 1;

      transactions.set(txId, ledgerTx);

      logFinancialAudit(
        adminId,
        'ADMIN',
        'WITHDRAWAL_FAILED',
        'withdrawal',
        withdrawal.id,
        withdrawal.amount,
        `Marked withdrawal ${withdrawal.id} Failed. Reason: ${cleanReason}. Released ${withdrawal.amount.toFixed(2)} ETB back to available balance.`
      );

      return {
        success: true,
        message: `Withdrawal ${withdrawal.id} marked Failed and reserved funds released to available balance.`,
        withdrawal,
        wallet,
        transaction: ledgerTx,
      };
    } finally {
      release();
    }
  }

  /**
   * Debit wallet for bingo game card registration (prevents duplicate debit for same game+card)
   */
  static async debitGameEntry(
    userId: string,
    amount: number,
    gameId: string,
    cardId: string
  ): Promise<{ success: boolean; message: string; wallet?: Wallet; transaction?: WalletTransaction }> {
    const cleanAmount = parseFloat(amount.toFixed(2));
    if (cleanAmount <= 0) {
      return { success: true, message: 'Free entry.' };
    }

    const refKey = `${gameId}:${cardId}`;
    const release = await acquireLock(`wallet:${userId}`);
    try {
      // Unique constraint check to prevent duplicate debits
      if (gameEntryDebitIndex.has(refKey)) {
        return {
          success: false,
          message: `Card #${cardId} has already been debited for game ${gameId}.`,
        };
      }

      const wallet = this.getWallet(userId);
      if (wallet.availableBalance < cleanAmount) {
        return {
          success: false,
          message: `Insufficient balance (${wallet.availableBalance.toFixed(2)} ETB). Card fee is ${cleanAmount.toFixed(2)} ETB.`,
        };
      }

      const now = Date.now();
      const balanceBefore = wallet.availableBalance;
      const balanceAfter = parseFloat((balanceBefore - cleanAmount).toFixed(2));

      const txId = generateTxId();
      const ledgerTx: WalletTransaction = {
        id: txId,
        walletId: wallet.id,
        userId,
        type: 'GAME_ENTRY_DEBIT',
        amount: cleanAmount,
        currency: 'ETB',
        balanceBefore,
        balanceAfter,
        reservedBefore: wallet.reservedBalance,
        reservedAfter: wallet.reservedBalance,
        referenceId: refKey,
        referenceType: 'card',
        status: 'COMPLETED',
        description: `Card #${cardId} entry for game ${gameId}`,
        metadata: { gameId, cardId },
        createdAt: now,
      };

      wallet.availableBalance = balanceAfter;
      wallet.updatedAt = now;
      wallet.version += 1;

      transactions.set(txId, ledgerTx);
      gameEntryDebitIndex.set(refKey, txId);

      logFinancialAudit(
        userId,
        'PLAYER',
        'GAME_ENTRY_DEBIT',
        'transaction',
        txId,
        cleanAmount,
        `Debited ${cleanAmount.toFixed(2)} ETB for Card #${cardId} in game ${gameId}`
      );

      return {
        success: true,
        message: `Debited ${cleanAmount.toFixed(2)} ETB for Card #${cardId}`,
        wallet,
        transaction: ledgerTx,
      };
    } finally {
      release();
    }
  }

  /**
   * Credit wallet for bingo win (idempotent per game+card+user to prevent duplicate win credits)
   */
  static async creditGameWin(
    userId: string,
    amount: number,
    gameId: string,
    cardId: string
  ): Promise<{ success: boolean; message: string; wallet?: Wallet; transaction?: WalletTransaction }> {
    const cleanAmount = parseFloat(amount.toFixed(2));
    if (cleanAmount <= 0) return { success: true, message: 'No win amount.' };

    const refKey = `${gameId}:${cardId}`;
    const winKey = `${refKey}:${userId}`;
    const release = await acquireLock(`wallet:${userId}`);
    try {
      // Prevent duplicate win payouts for the same winning card in the same game
      if (gameWinCreditIndex.has(winKey)) {
        return {
          success: true,
          message: `Win prize for game ${gameId} Card #${cardId} was already credited.`,
          wallet: this.getWallet(userId),
        };
      }

      const wallet = this.getWallet(userId);
      const now = Date.now();
      const balanceBefore = wallet.availableBalance;
      const balanceAfter = parseFloat((balanceBefore + cleanAmount).toFixed(2));

      const txId = generateTxId();
      const ledgerTx: WalletTransaction = {
        id: txId,
        walletId: wallet.id,
        userId,
        type: 'GAME_WIN_CREDIT',
        amount: cleanAmount,
        currency: 'ETB',
        balanceBefore,
        balanceAfter,
        reservedBefore: wallet.reservedBalance,
        reservedAfter: wallet.reservedBalance,
        referenceId: refKey,
        referenceType: 'game',
        status: 'COMPLETED',
        description: `Bingo Prize won in game ${gameId} with Card #${cardId}!`,
        metadata: { gameId, cardId },
        createdAt: now,
      };

      wallet.availableBalance = balanceAfter;
      wallet.updatedAt = now;
      wallet.version += 1;

      transactions.set(txId, ledgerTx);
      gameWinCreditIndex.set(winKey, txId);

      logFinancialAudit(
        'SYSTEM',
        'SYSTEM',
        'GAME_WIN_CREDIT',
        'wallet',
        wallet.id,
        cleanAmount,
        `Bingo prize credited +${cleanAmount.toFixed(2)} ETB to user ${userId} for game ${gameId}`
      );

      return {
        success: true,
        message: `Credited ${cleanAmount.toFixed(2)} ETB prize for game ${gameId}`,
        wallet,
        transaction: ledgerTx,
      };
    } finally {
      release();
    }
  }

  /**
   * Admin manual balance adjustment
   */
  static async adminAdjustBalance(
    userId: string,
    amount: number,
    type: 'ADMIN_CREDIT' | 'ADMIN_DEBIT',
    adminId: string,
    reason: string
  ): Promise<{ success: boolean; message: string; wallet?: Wallet }> {
    const numAmount = parseFloat(Math.abs(amount).toFixed(2));
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, message: 'Adjustment amount must be positive.' };
    }

    const release = await acquireLock(`wallet:${userId}`);
    try {
      const wallet = this.getWallet(userId);
      const now = Date.now();
      const balanceBefore = wallet.availableBalance;
      let balanceAfter = balanceBefore;

      if (type === 'ADMIN_DEBIT') {
        if (wallet.availableBalance < numAmount) {
          return { success: false, message: `User only has ${wallet.availableBalance.toFixed(2)} ETB available.` };
        }
        balanceAfter = parseFloat((balanceBefore - numAmount).toFixed(2));
      } else {
        balanceAfter = parseFloat((balanceBefore + numAmount).toFixed(2));
      }

      const txId = generateTxId();
      const ledgerTx: WalletTransaction = {
        id: txId,
        walletId: wallet.id,
        userId,
        type,
        amount: numAmount,
        currency: 'ETB',
        balanceBefore,
        balanceAfter,
        reservedBefore: wallet.reservedBalance,
        reservedAfter: wallet.reservedBalance,
        referenceId: adminId,
        referenceType: 'admin',
        status: 'COMPLETED',
        description: `Manual adjustment by admin (${adminId}): ${reason}`,
        metadata: { adminId, reason },
        createdAt: now,
      };

      wallet.availableBalance = balanceAfter;
      wallet.updatedAt = now;
      wallet.version += 1;

      transactions.set(txId, ledgerTx);

      logFinancialAudit(
        adminId,
        'ADMIN',
        type,
        'wallet',
        wallet.id,
        numAmount,
        `${type === 'ADMIN_CREDIT' ? 'Credited' : 'Debited'} ${numAmount.toFixed(2)} ETB to user ${userId}. Reason: ${reason}`
      );

      return {
        success: true,
        message: `Successfully adjusted balance by ${type === 'ADMIN_CREDIT' ? '+' : '-'}${numAmount.toFixed(2)} ETB.`,
        wallet,
      };
    } finally {
      release();
    }
  }

  /**
   * Reconcile every wallet balance against its immutable transaction ledger & unsettled withdrawals.
   */
  static reconcileWallets(): WalletReconciliationResult {
    const txsByUser = new Map<string, WalletTransaction[]>();
    for (const tx of transactions.values()) {
      const arr = txsByUser.get(tx.userId) || [];
      arr.push(tx);
      txsByUser.set(tx.userId, arr);
    }

    const unsettledReservedByUser = new Map<string, number>();
    const unsettledStatuses = new Set(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING']);
    for (const w of withdrawals.values()) {
      if (unsettledStatuses.has(w.status)) {
        unsettledReservedByUser.set(
          w.userId,
          parseFloat(((unsettledReservedByUser.get(w.userId) || 0) + w.amount).toFixed(2))
        );
      }
    }

    const discrepancies: WalletDiscrepancy[] = [];
    let matchedCount = 0;

    for (const wallet of wallets.values()) {
      const userTxs = (txsByUser.get(wallet.userId) || []).sort((a, b) => a.createdAt - b.createdAt);
      let expectedAvailable = 0;
      let expectedReserved = 0;

      for (const tx of userTxs) {
        switch (tx.type) {
          case 'MIGRATION_INITIAL_BALANCE':
          case 'DEPOSIT':
          case 'GAME_WIN_CREDIT':
          case 'ADMIN_CREDIT':
            expectedAvailable = parseFloat((expectedAvailable + tx.amount).toFixed(2));
            break;
          case 'GAME_ENTRY_DEBIT':
          case 'ADMIN_DEBIT':
            expectedAvailable = parseFloat((expectedAvailable - tx.amount).toFixed(2));
            break;
          case 'WITHDRAWAL_REQUEST':
            expectedAvailable = parseFloat((expectedAvailable - tx.amount).toFixed(2));
            expectedReserved = parseFloat((expectedReserved + tx.amount).toFixed(2));
            break;
          case 'WITHDRAWAL_PAID':
          case 'WITHDRAWAL_APPROVED':
            expectedReserved = parseFloat((expectedReserved - tx.amount).toFixed(2));
            break;
          case 'WITHDRAWAL_REJECTED':
          case 'WITHDRAWAL_FAILED':
            expectedReserved = parseFloat((expectedReserved - tx.amount).toFixed(2));
            expectedAvailable = parseFloat((expectedAvailable + tx.amount).toFixed(2));
            break;
        }
      }

      const expectedReservedFromWithdrawals = parseFloat((unsettledReservedByUser.get(wallet.userId) || 0).toFixed(2));
      const availDiff = Math.abs(wallet.availableBalance - expectedAvailable);
      const resDiff = Math.abs(wallet.reservedBalance - expectedReserved);
      const wdrDiff = Math.abs(wallet.reservedBalance - expectedReservedFromWithdrawals);

      if (availDiff >= 0.01 || resDiff >= 0.01 || wdrDiff >= 0.01) {
        const reasons: string[] = [];
        if (availDiff >= 0.01) reasons.push(`available (${wallet.availableBalance.toFixed(2)} != ledger ${expectedAvailable.toFixed(2)})`);
        if (resDiff >= 0.01) reasons.push(`reserved (${wallet.reservedBalance.toFixed(2)} != ledger ${expectedReserved.toFixed(2)})`);
        if (wdrDiff >= 0.01) reasons.push(`reserved (${wallet.reservedBalance.toFixed(2)} != active withdrawals ${expectedReservedFromWithdrawals.toFixed(2)})`);

        discrepancies.push({
          userId: wallet.userId,
          walletId: wallet.id,
          actualAvailable: wallet.availableBalance,
          expectedAvailable,
          actualReserved: wallet.reservedBalance,
          expectedReserved,
          expectedReservedFromWithdrawals,
          reason: reasons.join('; '),
        });
      } else {
        matchedCount += 1;
      }
    }

    return {
      checkedAt: Date.now(),
      totalWalletsChecked: wallets.size,
      matchedCount,
      discrepancyCount: discrepancies.length,
      isBalanced: discrepancies.length === 0,
      discrepancies,
    };
  }

  /**
   * Financial report summary over an optional [fromDate, toDate] millisecond timestamp range
   */
  static getFinancialReport(fromDate?: number, toDate?: number): FinancialReportSummary {
    const start = fromDate ?? 0;
    const end = toDate ?? Number.MAX_SAFE_INTEGER;
    const inRange = (ts: number) => ts >= start && ts <= end;

    const depSummary = {
      totalCount: 0,
      verifiedCount: 0,
      verifiedAmount: 0,
      pendingCount: 0,
      manualReviewCount: 0,
      failedCount: 0,
    };

    for (const d of deposits.values()) {
      if (!inRange(d.createdAt)) continue;
      depSummary.totalCount += 1;
      if (d.status === 'VERIFIED') {
        depSummary.verifiedCount += 1;
        depSummary.verifiedAmount += d.amount;
      } else if (d.status === 'PENDING') {
        depSummary.pendingCount += 1;
      } else if (d.status === 'REQUIRES_ADMIN_REVIEW') {
        depSummary.manualReviewCount += 1;
      } else {
        depSummary.failedCount += 1;
      }
    }

    const wdrSummary = {
      totalCount: 0,
      paidCount: 0,
      paidAmount: 0,
      inProgressCount: 0,
      inProgressAmount: 0,
      rejectedCount: 0,
      failedCount: 0,
    };

    for (const w of withdrawals.values()) {
      if (!inRange(w.requestedAt)) continue;
      wdrSummary.totalCount += 1;
      if (w.status === 'PAID' || w.status === 'COMPLETED') {
        wdrSummary.paidCount += 1;
        wdrSummary.paidAmount += w.amount;
      } else if (['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'].includes(w.status)) {
        wdrSummary.inProgressCount += 1;
        wdrSummary.inProgressAmount += w.amount;
      } else if (w.status === 'REJECTED') {
        wdrSummary.rejectedCount += 1;
      } else if (w.status === 'FAILED') {
        wdrSummary.failedCount += 1;
      }
    }

    const gaming = {
      entryDebitsCount: 0,
      entryDebitsAmount: 0,
      winCreditsCount: 0,
      winCreditsAmount: 0,
      netGamingRevenue: 0,
    };
    const adjustments = {
      adminCreditsAmount: 0,
      adminDebitsAmount: 0,
    };

    for (const tx of transactions.values()) {
      if (!inRange(tx.createdAt)) continue;
      if (tx.type === 'GAME_ENTRY_DEBIT') {
        gaming.entryDebitsCount += 1;
        gaming.entryDebitsAmount += tx.amount;
      } else if (tx.type === 'GAME_WIN_CREDIT') {
        gaming.winCreditsCount += 1;
        gaming.winCreditsAmount += tx.amount;
      } else if (tx.type === 'ADMIN_CREDIT') {
        adjustments.adminCreditsAmount += tx.amount;
      } else if (tx.type === 'ADMIN_DEBIT') {
        adjustments.adminDebitsAmount += tx.amount;
      }
    }

    depSummary.verifiedAmount = parseFloat(depSummary.verifiedAmount.toFixed(2));
    wdrSummary.paidAmount = parseFloat(wdrSummary.paidAmount.toFixed(2));
    wdrSummary.inProgressAmount = parseFloat(wdrSummary.inProgressAmount.toFixed(2));
    gaming.entryDebitsAmount = parseFloat(gaming.entryDebitsAmount.toFixed(2));
    gaming.winCreditsAmount = parseFloat(gaming.winCreditsAmount.toFixed(2));
    gaming.netGamingRevenue = parseFloat((gaming.entryDebitsAmount - gaming.winCreditsAmount).toFixed(2));
    adjustments.adminCreditsAmount = parseFloat(adjustments.adminCreditsAmount.toFixed(2));
    adjustments.adminDebitsAmount = parseFloat(adjustments.adminDebitsAmount.toFixed(2));

    return {
      generatedAt: Date.now(),
      fromDate,
      toDate,
      deposits: depSummary,
      withdrawals: wdrSummary,
      gaming,
      adjustments,
      netPaymentFlow: parseFloat((depSummary.verifiedAmount - wdrSummary.paidAmount).toFixed(2)),
      reconciliation: this.reconcileWallets(),
    };
  }

  /**
   * System financial overview for admin dashboard
   */
  static getFinancialOverview(): FinancialOverviewSummary {
    let totalAvailable = 0;
    let totalReserved = 0;
    for (const w of wallets.values()) {
      totalAvailable += w.availableBalance;
      totalReserved += w.reservedBalance;
    }

    let totalDeposited = 0;
    let pendingDepositReviewsCount = 0;
    for (const d of deposits.values()) {
      if (d.status === 'VERIFIED') {
        totalDeposited += d.amount;
      } else if (d.status === 'REQUIRES_ADMIN_REVIEW') {
        pendingDepositReviewsCount += 1;
      }
    }

    let totalWithdrawn = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let activeCount = 0;
    let activeAmount = 0;
    for (const w of withdrawals.values()) {
      if (w.status === 'PAID' || w.status === 'COMPLETED') {
        totalWithdrawn += w.amount;
      } else if (w.status === 'PENDING' || w.status === 'UNDER_REVIEW') {
        pendingCount += 1;
        pendingAmount += w.amount;
        activeCount += 1;
        activeAmount += w.amount;
      } else if (w.status === 'APPROVED' || w.status === 'PROCESSING') {
        activeCount += 1;
        activeAmount += w.amount;
      }
    }

    return {
      totalWallets: wallets.size,
      totalAvailableBalance: parseFloat(totalAvailable.toFixed(2)),
      totalReservedBalance: parseFloat(totalReserved.toFixed(2)),
      totalSystemBalance: parseFloat((totalAvailable + totalReserved).toFixed(2)),
      totalDepositedAmount: parseFloat(totalDeposited.toFixed(2)),
      totalWithdrawnAmount: parseFloat(totalWithdrawn.toFixed(2)),
      pendingWithdrawalsCount: pendingCount,
      pendingWithdrawalsAmount: parseFloat(pendingAmount.toFixed(2)),
      activeWithdrawalsCount: activeCount,
      activeWithdrawalsAmount: parseFloat(activeAmount.toFixed(2)),
      pendingDepositReviewsCount,
      totalTransactionsCount: transactions.size,
    };
  }

  /**
   * Get audit logs
   */
  static getAuditLogs(limit: number = 100): FinancialAuditLog[] {
    return financialAuditLogs.slice(0, limit);
  }
}
