import path from 'path';
import {
  Wallet,
  WalletTransaction,
  Deposit,
  Withdrawal,
  FinancialAuditLog,
  PaymentProviderConfig,
  WalletMigrationRecord,
  TelebirrReceivingConfig,
} from '../../types/wallet';

export const DB_FILE = path.join('/tmp', 'bingo_db.json');

// Memory Maps (Persistent collections matching DB schema)
export const wallets = new Map<string, Wallet>(); // Keyed by userId (unique per user)
export const transactions = new Map<string, WalletTransaction>();
export const deposits = new Map<string, Deposit>();
export const withdrawals = new Map<string, Withdrawal>();
export const paymentProviderConfigs = new Map<string, PaymentProviderConfig>();
export const financialAuditLogs: FinancialAuditLog[] = [];
export const walletMigrations: WalletMigrationRecord[] = [];

// Unique Constraints & Idempotency Indexes
export const providerTxIndex = new Map<string, string>(); // providerTransactionId (UPPER) -> depositId
export const providerRequestIndex = new Map<string, string>(); // providerRequestId -> depositId
export const processedWebhookEvents = new Set<string>(); // webhook eventId deduplication set
export const withdrawalIdempotencyIndex = new Map<string, string>(); // `${userId}:${idempotencyKey}` -> withdrawalId
export const withdrawalPayoutRefIndex = new Map<string, string>(); // outgoing paymentReference (UPPER) -> withdrawalId
export const gameEntryDebitIndex = new Map<string, string>(); // `${gameId}:${cardId}` -> txId
export const gameWinCreditIndex = new Map<string, string>(); // `${gameId}:${cardId}:${userId}` -> txId

const DEFAULT_DEPOSIT_INSTRUCTIONS =
  'Transfer the exact deposit amount via Telebirr to our official receiving wallet, copy the Transaction Number from your confirmation SMS, paste it below, and click Verify & Deposit.';

// Admin-configurable Telebirr deposit & withdrawal settings
export let telebirrConfig: TelebirrReceivingConfig = {
  telebirrPhoneNumber: process.env.TELEBIRR_RECEIVING_NUMBER || '0911002233',
  telebirrAccountName: process.env.TELEBIRR_RECEIVING_NAME || 'MY Bingo Official',
  depositInstructions: DEFAULT_DEPOSIT_INSTRUCTIONS,
  minDepositAmount: 10,
  maxDepositAmount: 50000,
  minWithdrawalAmount: 10,
  maxWithdrawalAmount: 50000,
  depositsEnabled: true,
  withdrawalsEnabled: true,
  updatedAt: Date.now(),
};

export function setTelebirrConfig(next: TelebirrReceivingConfig) {
  telebirrConfig = next;
}

// Seed default wallet for a user (non-destructive, creates initial ledger entry if balance > 0)
export function initWalletForUser(userId: string, initialBalance: number = 0, currency: string = 'ETB'): Wallet {
  const existing = wallets.get(userId);
  if (existing) return existing;

  const cleanBalance = parseFloat(Math.max(0, initialBalance).toFixed(2));
  const now = Date.now();
  const newWallet: Wallet = {
    id: `wal-${userId}`,
    userId,
    availableBalance: cleanBalance,
    reservedBalance: 0,
    currency,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  wallets.set(userId, newWallet);

  // Every balance change (including initial migration/creation) has a permanent ledger entry
  if (cleanBalance > 0) {
    const tx: WalletTransaction = {
      id: `tx-init-${now}-${Math.floor(Math.random() * 10000)}`,
      walletId: newWallet.id,
      userId,
      type: 'MIGRATION_INITIAL_BALANCE',
      amount: cleanBalance,
      currency,
      balanceBefore: 0,
      balanceAfter: cleanBalance,
      reservedBefore: 0,
      reservedAfter: 0,
      referenceType: 'migration',
      status: 'COMPLETED',
      description: 'Initial balance migrated from user account',
      createdAt: now,
    };
    transactions.set(tx.id, tx);
  }

  return newWallet;
}

// Rebuild unique indexes from loaded transactions, deposits, and withdrawals
function rebuildUniqueIndexes() {
  providerTxIndex.clear();
  providerRequestIndex.clear();
  for (const d of deposits.values()) {
    if (d.providerTransactionId && d.status !== 'DUPLICATE_REJECTED') {
      providerTxIndex.set(d.providerTransactionId.trim().toUpperCase(), d.id);
    }
    if (d.providerRequestId) {
      providerRequestIndex.set(d.providerRequestId.trim(), d.id);
    }
  }

  withdrawalIdempotencyIndex.clear();
  withdrawalPayoutRefIndex.clear();
  for (const w of withdrawals.values()) {
    if (w.idempotencyKey) {
      withdrawalIdempotencyIndex.set(`${w.userId}:${w.idempotencyKey}`, w.id);
    }
    if (w.paymentReference && (w.status === 'PAID' || w.status === 'COMPLETED')) {
      withdrawalPayoutRefIndex.set(w.paymentReference.trim().toUpperCase(), w.id);
    }
  }

  gameEntryDebitIndex.clear();
  gameWinCreditIndex.clear();
  for (const tx of transactions.values()) {
    if (tx.type === 'GAME_ENTRY_DEBIT' && tx.status === 'COMPLETED' && tx.referenceId) {
      gameEntryDebitIndex.set(tx.referenceId, tx.id);
    }
    if (tx.type === 'GAME_WIN_CREDIT' && tx.status === 'COMPLETED' && tx.referenceId) {
      gameWinCreditIndex.set(`${tx.referenceId}:${tx.userId}`, tx.id);
    }
  }
}

// Non-destructive, idempotent incremental migrations
function runMigrations(existingUsers: any[]) {
  const appliedIds = new Set(walletMigrations.map((m) => m.id));

  // Migration 001: Ensure all legacy user accounts have a Wallet + initial ledger entry
  if (!appliedIds.has('mig-001-initial-wallets') || existingUsers.some((u) => !wallets.has(u.id))) {
    let migratedCount = 0;
    if (Array.isArray(existingUsers)) {
      existingUsers.forEach((u) => {
        if (u && u.id && !wallets.has(u.id)) {
          const userBal = typeof u.balance === 'number' && !isNaN(u.balance) ? u.balance : 0;
          initWalletForUser(u.id, userBal, 'ETB');
          migratedCount++;
        }
      });
    }
    if (!appliedIds.has('mig-001-initial-wallets')) {
      walletMigrations.push({
        id: 'mig-001-initial-wallets',
        version: 1,
        description: 'Initialize real-money wallets and migration ledger entries for existing user accounts',
        appliedAt: Date.now(),
        migratedCount,
      });
    }
  }

  // Migration 002: Ensure default Verify.et payment provider configuration exists (without secrets)
  if (!appliedIds.has('mig-002-provider-configs') || !paymentProviderConfigs.has('verify_et')) {
    if (!paymentProviderConfigs.has('verify_et')) {
      paymentProviderConfigs.set('verify_et', {
        providerId: 'verify_et',
        name: 'Verify.et (Telebirr Automated Verification)',
        isEnabled: true,
        isDefault: true,
        isConfigured: false,
        supportedMethods: ['telebirr'],
        environment: 'sandbox',
        updatedAt: Date.now(),
      });
    }
    if (!appliedIds.has('mig-002-provider-configs')) {
      walletMigrations.push({
        id: 'mig-002-provider-configs',
        version: 2,
        description: 'Seed configurable payment provider registry entry for Verify.et',
        appliedAt: Date.now(),
        migratedCount: 1,
      });
    }
  }

  // Migration 003: Ensure Telebirr receiving account config exists
  if (!appliedIds.has('mig-003-telebirr-config')) {
    if (!telebirrConfig || !telebirrConfig.telebirrPhoneNumber) {
      telebirrConfig = {
        telebirrPhoneNumber: process.env.TELEBIRR_RECEIVING_NUMBER || '0911002233',
        telebirrAccountName: process.env.TELEBIRR_RECEIVING_NAME || 'MY Bingo Official',
        depositInstructions: DEFAULT_DEPOSIT_INSTRUCTIONS,
        minDepositAmount: 10,
        maxDepositAmount: 50000,
        minWithdrawalAmount: 10,
        maxWithdrawalAmount: 50000,
        depositsEnabled: true,
        withdrawalsEnabled: true,
        updatedAt: Date.now(),
      };
    }
    walletMigrations.push({
      id: 'mig-003-telebirr-config',
      version: 3,
      description: 'Initialize admin-configurable Telebirr receiving account & deposit verification thresholds',
      appliedAt: Date.now(),
      migratedCount: 1,
    });
  }

  // Migration 004: Ensure withdrawal limits, deposit instructions, and availability toggles exist
  if (!appliedIds.has('mig-004-withdrawal-payment-settings')) {
    telebirrConfig = {
      telebirrPhoneNumber: telebirrConfig?.telebirrPhoneNumber || '0911002233',
      telebirrAccountName: telebirrConfig?.telebirrAccountName || 'MY Bingo Official',
      depositInstructions: telebirrConfig?.depositInstructions || DEFAULT_DEPOSIT_INSTRUCTIONS,
      minDepositAmount: telebirrConfig?.minDepositAmount || 10,
      maxDepositAmount: telebirrConfig?.maxDepositAmount || 50000,
      minWithdrawalAmount: telebirrConfig?.minWithdrawalAmount || 10,
      maxWithdrawalAmount: telebirrConfig?.maxWithdrawalAmount || 50000,
      depositsEnabled: telebirrConfig?.depositsEnabled !== undefined ? telebirrConfig.depositsEnabled : true,
      withdrawalsEnabled: telebirrConfig?.withdrawalsEnabled !== undefined ? telebirrConfig.withdrawalsEnabled : true,
      updatedAt: telebirrConfig?.updatedAt || Date.now(),
      updatedBy: telebirrConfig?.updatedBy,
    };
    walletMigrations.push({
      id: 'mig-004-withdrawal-payment-settings',
      version: 4,
      description: 'Extend Telebirr settings with withdrawal limits, availability flags, and instructions',
      appliedAt: Date.now(),
      migratedCount: 1,
    });
  }
}

// Load wallet data from disk payload safely without resetting existing records
export function loadWalletState(data: any, existingUsers: any[]) {
  try {
    if (data?.wallets && Array.isArray(data.wallets)) {
      wallets.clear();
      data.wallets.forEach((w: Wallet) => wallets.set(w.userId, w));
    }

    if (data?.walletTransactions && Array.isArray(data.walletTransactions)) {
      transactions.clear();
      data.walletTransactions.forEach((t: WalletTransaction) => transactions.set(t.id, t));
    }

    if (data?.deposits && Array.isArray(data.deposits)) {
      deposits.clear();
      data.deposits.forEach((d: Deposit) => {
        const normalized: Deposit = {
          ...d,
          requestedAmount: typeof d.requestedAmount === 'number' ? d.requestedAmount : d.amount,
          updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : d.createdAt,
        };
        deposits.set(normalized.id, normalized);
      });
    }

    if (data?.withdrawals && Array.isArray(data.withdrawals)) {
      withdrawals.clear();
      data.withdrawals.forEach((w: Withdrawal) => {
        const normalized: Withdrawal = {
          ...w,
          accountName: w.accountName || 'Telebirr Account',
          status: w.status === 'COMPLETED' ? 'PAID' : w.status,
          paidAt: w.paidAt || (w.status === 'COMPLETED' || w.status === 'PAID' ? w.reviewedAt : undefined),
          paidBy: w.paidBy || (w.status === 'COMPLETED' || w.status === 'PAID' ? w.reviewedBy : undefined),
          settledAt:
            w.settledAt ||
            (['PAID', 'COMPLETED', 'REJECTED', 'FAILED'].includes(w.status) ? w.reviewedAt || w.updatedAt : undefined),
        };
        withdrawals.set(normalized.id, normalized);
      });
    }

    if (data?.paymentProviderConfigs && Array.isArray(data.paymentProviderConfigs)) {
      paymentProviderConfigs.clear();
      data.paymentProviderConfigs.forEach((cfg: PaymentProviderConfig) =>
        paymentProviderConfigs.set(cfg.providerId, cfg)
      );
    }

    if (data?.telebirrConfig && typeof data.telebirrConfig === 'object') {
      telebirrConfig = {
        telebirrPhoneNumber: data.telebirrConfig.telebirrPhoneNumber || '0911002233',
        telebirrAccountName: data.telebirrConfig.telebirrAccountName || 'MY Bingo Official',
        depositInstructions: data.telebirrConfig.depositInstructions || DEFAULT_DEPOSIT_INSTRUCTIONS,
        minDepositAmount: Number(data.telebirrConfig.minDepositAmount) || 10,
        maxDepositAmount: Number(data.telebirrConfig.maxDepositAmount) || 50000,
        minWithdrawalAmount: Number(data.telebirrConfig.minWithdrawalAmount) || 10,
        maxWithdrawalAmount: Number(data.telebirrConfig.maxWithdrawalAmount) || 50000,
        depositsEnabled:
          typeof data.telebirrConfig.depositsEnabled === 'boolean' ? data.telebirrConfig.depositsEnabled : true,
        withdrawalsEnabled:
          typeof data.telebirrConfig.withdrawalsEnabled === 'boolean' ? data.telebirrConfig.withdrawalsEnabled : true,
        updatedAt: Number(data.telebirrConfig.updatedAt) || Date.now(),
        updatedBy: data.telebirrConfig.updatedBy,
      };
    }

    if (data?.processedWebhookEvents && Array.isArray(data.processedWebhookEvents)) {
      processedWebhookEvents.clear();
      data.processedWebhookEvents.forEach((id: string) => {
        if (id) processedWebhookEvents.add(id);
      });
    }

    if (data?.financialAuditLogs && Array.isArray(data.financialAuditLogs)) {
      financialAuditLogs.length = 0;
      financialAuditLogs.push(...data.financialAuditLogs);
    }

    if (data?.walletMigrations && Array.isArray(data.walletMigrations)) {
      walletMigrations.length = 0;
      walletMigrations.push(...data.walletMigrations);
    }

    rebuildUniqueIndexes();
    runMigrations(existingUsers);
  } catch (err) {
    console.warn('Error loading wallet persistence state:', err);
  }
}

// Serializer payload helper
export function getWalletStoragePayload() {
  return {
    wallets: Array.from(wallets.values()),
    walletTransactions: Array.from(transactions.values()),
    deposits: Array.from(deposits.values()),
    withdrawals: Array.from(withdrawals.values()),
    paymentProviderConfigs: Array.from(paymentProviderConfigs.values()),
    telebirrConfig,
    processedWebhookEvents: Array.from(processedWebhookEvents).slice(-500),
    financialAuditLogs,
    walletMigrations,
  };
}
