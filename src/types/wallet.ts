export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL_REQUEST'
  | 'WITHDRAWAL_APPROVED'
  | 'WITHDRAWAL_PAID'
  | 'WITHDRAWAL_REJECTED'
  | 'WITHDRAWAL_FAILED'
  | 'GAME_ENTRY_DEBIT'
  | 'GAME_WIN_CREDIT'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'MIGRATION_INITIAL_BALANCE';

export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';

export type DepositStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'NOT_FOUND'
  | 'AMOUNT_MISMATCH'
  | 'REQUIRES_ADMIN_REVIEW'
  | 'FAILED'
  | 'DUPLICATE_REJECTED';

export type WithdrawalStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PROCESSING'
  | 'PAID'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

export interface Wallet {
  id: string;
  userId: string;
  availableBalance: number;
  reservedBalance: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  referenceId?: string;
  referenceType?: 'deposit' | 'withdrawal' | 'game' | 'card' | 'admin' | 'migration';
  status: TransactionStatus;
  description: string;
  metadata?: Record<string, any>;
  createdAt: number;
}

export interface Deposit {
  id: string;
  walletId: string;
  userId: string;
  provider: 'verify_et' | string;
  providerTransactionId: string;
  providerRequestId?: string;
  idempotencyKey?: string;
  requestedAmount: number;
  verifiedAmount?: number;
  amount: number;
  currency: string;
  paymentMethod: 'telebirr' | string;
  status: DepositStatus;
  statusMessage?: string;
  recipientAccount?: string;
  recipientName?: string;
  rawResponse?: Record<string, any>;
  verifiedAt?: number;
  creditedAt?: number;
  manualDecision?: 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectionReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TelebirrReceivingConfig {
  telebirrPhoneNumber: string;
  telebirrAccountName: string;
  depositInstructions: string;
  minDepositAmount: number;
  maxDepositAmount: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
  updatedAt: number;
  updatedBy?: string;
}

export interface Withdrawal {
  id: string;
  walletId: string;
  userId: string;
  amount: number;
  currency: string;
  payoutMethod: 'telebirr' | string;
  accountIdentifier: string; // Telebirr phone number
  accountName: string; // Telebirr account holder name
  idempotencyKey?: string;
  status: WithdrawalStatus;
  statusMessage?: string;
  requestedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNote?: string;
  approvedBy?: string;
  approvedAt?: number;
  paidBy?: string;
  paidAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
  rejectionReason?: string;
  failedBy?: string;
  failedAt?: number;
  failureReason?: string;
  paymentReference?: string;
  settledAt?: number;
  updatedAt: number;
}

export interface AdminWithdrawalRecord extends Withdrawal {
  playerDisplayName?: string;
  playerUsername?: string;
  playerAvailableBalance: number;
  playerReservedBalance: number;
}

export interface PaymentProviderConfig {
  providerId: string;
  name: string;
  isEnabled: boolean;
  isDefault?: boolean;
  isConfigured: boolean;
  supportedMethods: string[];
  environment: 'live' | 'sandbox';
  updatedAt: number;
}

export interface WalletMigrationRecord {
  id: string;
  version: number;
  description: string;
  appliedAt: number;
  migratedCount: number;
}

export interface FinancialAuditLog {
  id: string;
  timestamp: number;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: 'wallet' | 'transaction' | 'deposit' | 'withdrawal' | 'config';
  entityId: string;
  amount?: number;
  details: string;
  ipAddress?: string;
}

export interface FinancialOverviewSummary {
  totalWallets: number;
  totalAvailableBalance: number;
  totalReservedBalance: number;
  totalSystemBalance: number;
  totalDepositedAmount: number;
  totalWithdrawnAmount: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmount: number;
  activeWithdrawalsCount: number;
  activeWithdrawalsAmount: number;
  pendingDepositReviewsCount: number;
  totalTransactionsCount: number;
}

export interface WalletDiscrepancy {
  userId: string;
  walletId: string;
  actualAvailable: number;
  expectedAvailable: number;
  actualReserved: number;
  expectedReserved: number;
  expectedReservedFromWithdrawals: number;
  reason: string;
}

export interface WalletReconciliationResult {
  checkedAt: number;
  totalWalletsChecked: number;
  matchedCount: number;
  discrepancyCount: number;
  isBalanced: boolean;
  discrepancies: WalletDiscrepancy[];
}

export interface FinancialReportSummary {
  generatedAt: number;
  fromDate?: number;
  toDate?: number;
  deposits: {
    totalCount: number;
    verifiedCount: number;
    verifiedAmount: number;
    pendingCount: number;
    manualReviewCount: number;
    failedCount: number;
  };
  withdrawals: {
    totalCount: number;
    paidCount: number;
    paidAmount: number;
    inProgressCount: number;
    inProgressAmount: number;
    rejectedCount: number;
    failedCount: number;
  };
  gaming: {
    entryDebitsCount: number;
    entryDebitsAmount: number;
    winCreditsCount: number;
    winCreditsAmount: number;
    netGamingRevenue: number;
  };
  adjustments: {
    adminCreditsAmount: number;
    adminDebitsAmount: number;
  };
  netPaymentFlow: number;
  reconciliation: WalletReconciliationResult;
}
