import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Wallet as WalletIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  History,
  Lock,
  DollarSign,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  Wallet,
  WalletTransaction,
  Withdrawal,
  Deposit,
  TelebirrReceivingConfig,
} from '../../types/wallet';
import { User } from '../../types/bingo';
import { useLanguage } from '../../context/LanguageContext';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onBalanceUpdated?: (newBalance: number) => void;
}

type DepositBannerState = {
  code:
    | 'VERIFYING_PAYMENT'
    | 'PENDING_VERIFICATION'
    | 'DEPOSIT_SUCCESSFUL'
    | 'TRANSACTION_NOT_FOUND'
    | 'AMOUNT_MISMATCH'
    | 'ALREADY_PROCESSED'
    | 'VERIFICATION_FAILED'
    | 'REQUIRES_ADMIN_REVIEW'
    | 'PROVIDER_UNAVAILABLE';
  message: string;
};

function getDepositStatusLabel(status: Deposit['status']): { label: string; badgeClass: string } {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Deposit Successful', badgeClass: 'bg-emerald-100 text-emerald-800' };
    case 'PENDING':
      return { label: 'Pending Verification', badgeClass: 'bg-amber-100 text-amber-800' };
    case 'NOT_FOUND':
      return { label: 'Transaction Not Found', badgeClass: 'bg-orange-100 text-orange-800' };
    case 'AMOUNT_MISMATCH':
      return { label: 'Amount Mismatch', badgeClass: 'bg-rose-100 text-rose-800' };
    case 'REQUIRES_ADMIN_REVIEW':
      return { label: 'Requires Admin Review', badgeClass: 'bg-indigo-100 text-indigo-800' };
    case 'DUPLICATE_REJECTED':
      return { label: 'Already Processed', badgeClass: 'bg-slate-200 text-slate-800' };
    case 'FAILED':
    default:
      return { label: 'Verification Failed', badgeClass: 'bg-rose-100 text-rose-800' };
  }
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  user,
  onBalanceUpdated,
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw' | 'history'>('overview');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [telebirrConfig, setTelebirrConfig] = useState<TelebirrReceivingConfig | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Deposit Form
  const [depositAmount, setDepositAmount] = useState('');
  const [depositTxNumber, setDepositTxNumber] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositBanner, setDepositBanner] = useState<DepositBannerState | null>(null);
  const [pollingDepositId, setPollingDepositId] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  // Withdrawal Form
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawName, setWithdrawName] = useState('');
  const [withdrawReviewStep, setWithdrawReviewStep] = useState(false);
  const [withdrawIdempotencyKey, setWithdrawIdempotencyKey] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const userId = user?.id || '';

  // Fetch Wallet Data & Telebirr Receiving Config
  const fetchWalletData = async () => {
    if (!userId) return;
    try {
      setRefreshing(true);
      const [cfgRes, walletRes, txRes, depRes, wdrRes] = await Promise.all([
        fetch('/api/wallet/deposit-config'),
        fetch(`/api/wallet?userId=${encodeURIComponent(userId)}`, {
          headers: { 'x-user-id': userId },
        }),
        fetch(`/api/wallet/transactions?userId=${encodeURIComponent(userId)}&limit=50`, {
          headers: { 'x-user-id': userId },
        }),
        fetch(`/api/wallet/deposits?userId=${encodeURIComponent(userId)}&limit=50`, {
          headers: { 'x-user-id': userId },
        }),
        fetch(`/api/wallet/withdrawals?userId=${encodeURIComponent(userId)}`, {
          headers: { 'x-user-id': userId },
        }),
      ]);

      if (cfgRes.ok) {
        const cData = await cfgRes.json();
        if (cData.config) {
          setTelebirrConfig(cData.config);
        }
      }

      if (walletRes.ok) {
        const wData = await walletRes.json();
        if (wData.wallet) {
          setWallet(wData.wallet);
          if (onBalanceUpdated) {
            onBalanceUpdated(wData.wallet.availableBalance);
          }
        }
      }

      if (txRes.ok) {
        const tData = await txRes.json();
        setTransactions(tData.transactions || []);
      }

      if (depRes.ok) {
        const dData = await depRes.json();
        setDeposits(dData.deposits || []);
      }

      if (wdrRes.ok) {
        const wData = await wdrRes.json();
        setWithdrawals(wData.withdrawals || []);
      }
    } catch (err) {
      console.warn('Failed to fetch wallet info:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchWalletData();
      setDepositBanner(null);
      setWithdrawFeedback(null);
      setWithdrawReviewStep(false);
      setWithdrawIdempotencyKey('');
    }
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const handleDepositUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const dep = detail?.deposit as Deposit | undefined;
      if (dep) {
        if (dep.id === pollingDepositId && dep.status !== 'PENDING') {
          setPollingDepositId(null);
        }
        if (dep.status !== 'PENDING' && dep.statusMessage) {
          const codeMap: Record<Deposit['status'], DepositBannerState['code']> = {
            VERIFIED: 'DEPOSIT_SUCCESSFUL',
            PENDING: 'PENDING_VERIFICATION',
            NOT_FOUND: 'TRANSACTION_NOT_FOUND',
            AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
            REQUIRES_ADMIN_REVIEW: 'REQUIRES_ADMIN_REVIEW',
            DUPLICATE_REJECTED: 'ALREADY_PROCESSED',
            FAILED: 'VERIFICATION_FAILED',
          };
          setDepositBanner({
            code: codeMap[dep.status] || 'VERIFICATION_FAILED',
            message: dep.statusMessage,
          });
        }
      }
      fetchWalletData();
    };

    const handleWalletUpdate = () => {
      fetchWalletData();
    };

    const handleConfigUpdate = (e: Event) => {
      const cfg = (e as CustomEvent).detail as TelebirrReceivingConfig | undefined;
      if (cfg) {
        setTelebirrConfig(cfg);
      }
    };

    window.addEventListener('bingo-deposit-updated', handleDepositUpdate);
    window.addEventListener('bingo-wallet-updated', handleWalletUpdate);
    window.addEventListener('bingo-telebirr-config-updated', handleConfigUpdate);

    return () => {
      window.removeEventListener('bingo-deposit-updated', handleDepositUpdate);
      window.removeEventListener('bingo-wallet-updated', handleWalletUpdate);
      window.removeEventListener('bingo-telebirr-config-updated', handleConfigUpdate);
    };
  }, [isOpen, userId, pollingDepositId]);

  // Poll pending queued deposits automatically while modal is open
  const pollSpecificDeposit = async (depositId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/wallet/deposits/${encodeURIComponent(depositId)}?poll=true`, {
        headers: { 'x-user-id': userId },
      });
      const data = await res.json();
      if (data?.deposit && data.deposit.status !== 'PENDING') {
        setPollingDepositId(null);
        setDepositBanner({
          code: data.statusCode || (data.deposit.status === 'VERIFIED' ? 'DEPOSIT_SUCCESSFUL' : 'VERIFICATION_FAILED'),
          message: data.message || data.deposit.statusMessage || 'Deposit verification updated.',
        });
        fetchWalletData();
      }
    } catch {
      // ignore transient polling error
    }
  };

  useEffect(() => {
    if (!isOpen || !pollingDepositId || !userId) {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    pollTimerRef.current = window.setInterval(() => {
      pollSpecificDeposit(pollingDepositId);
    }, 5000);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, pollingDepositId, userId]);

  if (!isOpen) return null;

  const handleCopyNumber = async () => {
    if (!telebirrConfig?.telebirrPhoneNumber) return;
    try {
      await navigator.clipboard.writeText(telebirrConfig.telebirrPhoneNumber);
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      setCopiedPhone(false);
    }
  };

  // Handle Telebirr Deposit Submission
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setDepositBanner({
        code: 'VERIFICATION_FAILED',
        message: 'Please sign in before submitting a deposit.',
      });
      return;
    }

    const numAmount = parseFloat(depositAmount);
    const minAmt = telebirrConfig?.minDepositAmount ?? 10;
    const maxAmt = telebirrConfig?.maxDepositAmount ?? 50000;

    if (isNaN(numAmount) || numAmount < minAmt || numAmount > maxAmt) {
      setDepositBanner({
        code: 'VERIFICATION_FAILED',
        message: `Please enter a valid deposit amount between ${minAmt.toFixed(2)} and ${maxAmt.toFixed(2)} ETB.`,
      });
      return;
    }

    if (!depositTxNumber.trim()) {
      setDepositBanner({
        code: 'VERIFICATION_FAILED',
        message: 'Please paste the Telebirr Transaction Number from your confirmation SMS.',
      });
      return;
    }

    setDepositSubmitting(true);
    setDepositBanner({
      code: 'VERIFYING_PAYMENT',
      message: 'Verifying Payment — Contacting Verify.et to confirm your Telebirr transfer...',
    });

    try {
      const res = await fetch('/api/wallet/deposit/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          userId,
          amount: numAmount,
          transactionNumber: depositTxNumber.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      const statusCode: DepositBannerState['code'] =
        data.statusCode || (res.ok && data.success ? 'DEPOSIT_SUCCESSFUL' : 'VERIFICATION_FAILED');

      setDepositBanner({
        code: statusCode,
        message: data.message || data.error || 'Verification completed.',
      });

      if (statusCode === 'DEPOSIT_SUCCESSFUL') {
        setDepositTxNumber('');
        setDepositAmount('');
        setPollingDepositId(null);
      } else if (statusCode === 'PENDING_VERIFICATION' && data.deposit?.id) {
        setPollingDepositId(data.deposit.id);
      }

      fetchWalletData();
    } catch (err: any) {
      setDepositBanner({
        code: 'PROVIDER_UNAVAILABLE',
        message: `Network error contacting verification server: ${err.message}`,
      });
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Validate Withdrawal Inputs -> Move to Review Step
  const handleWithdrawReview = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawFeedback(null);

    if (telebirrConfig && !telebirrConfig.withdrawalsEnabled) {
      setWithdrawFeedback({
        type: 'error',
        message: 'Withdrawals are temporarily paused by administration.',
      });
      return;
    }

    const minW = telebirrConfig?.minWithdrawalAmount ?? 10;
    const maxW = telebirrConfig?.maxWithdrawalAmount ?? 50000;
    const num = parseFloat(withdrawAmount);

    if (isNaN(num) || num < minW || num > maxW) {
      setWithdrawFeedback({
        type: 'error',
        message: `Withdrawal amount must be between ${minW.toFixed(2)} and ${maxW.toFixed(2)} ETB.`,
      });
      return;
    }

    const digits = withdrawAccount.replace(/\D/g, '');
    if (!withdrawAccount.trim() || digits.length < 9) {
      setWithdrawFeedback({
        type: 'error',
        message: 'Please provide a valid Telebirr phone number (at least 9 digits).',
      });
      return;
    }

    if (!withdrawName.trim() || withdrawName.trim().length < 2) {
      setWithdrawFeedback({
        type: 'error',
        message: 'Telebirr account holder name is required.',
      });
      return;
    }

    if (wallet && wallet.availableBalance < num) {
      setWithdrawFeedback({
        type: 'error',
        message: `Insufficient available balance (${wallet.availableBalance.toFixed(2)} ETB).`,
      });
      return;
    }

    setWithdrawIdempotencyKey(`wdr-req-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setWithdrawReviewStep(true);
  };

  // Confirm & Submit Withdrawal Request
  const handleWithdrawConfirm = async () => {
    const num = parseFloat(withdrawAmount);
    setWithdrawSubmitting(true);
    setWithdrawFeedback(null);

    try {
      const idempKey = withdrawIdempotencyKey || `wdr-req-${userId}-${Date.now()}`;
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'Idempotency-Key': idempKey,
        },
        body: JSON.stringify({
          userId,
          amount: num,
          accountIdentifier: withdrawAccount.trim(),
          accountName: withdrawName.trim(),
          payoutMethod: 'telebirr',
          idempotencyKey: idempKey,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWithdrawFeedback({
          type: 'success',
          message: data.message || 'Withdrawal request submitted! Funds reserved pending admin review.',
        });
        setWithdrawAmount('');
        setWithdrawAccount('');
        setWithdrawName('');
        setWithdrawReviewStep(false);
        setWithdrawIdempotencyKey('');
        fetchWalletData();
      } else {
        setWithdrawFeedback({
          type: 'error',
          message: data.message || data.error || 'Withdrawal request failed.',
        });
        setWithdrawReviewStep(false);
      }
    } catch (err: any) {
      setWithdrawFeedback({
        type: 'error',
        message: `Network error: ${err.message}`,
      });
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // Format Helper
  const formatTypeBadge = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'DEPOSIT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">DEPOSIT</span>;
      case 'GAME_WIN_CREDIT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800">BINGO WIN</span>;
      case 'WITHDRAWAL_REQUEST':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800">WITHDRAWAL REQ</span>;
      case 'WITHDRAWAL_PAID':
      case 'WITHDRAWAL_APPROVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">PAID OUT</span>;
      case 'WITHDRAWAL_REJECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">REJECTED REFUND</span>;
      case 'WITHDRAWAL_FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-800">FAILED REFUND</span>;
      case 'GAME_ENTRY_DEBIT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-800">CARD FEE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  const getWithdrawalStatusBadge = (status: Withdrawal['status']) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Pending', badgeClass: 'bg-amber-100 text-amber-800' };
      case 'UNDER_REVIEW':
        return { label: 'Under Review', badgeClass: 'bg-indigo-100 text-indigo-800' };
      case 'APPROVED':
        return { label: 'Approved', badgeClass: 'bg-sky-100 text-sky-800' };
      case 'PROCESSING':
        return { label: 'Processing Payment', badgeClass: 'bg-purple-100 text-purple-800' };
      case 'PAID':
      case 'COMPLETED':
        return { label: 'Paid', badgeClass: 'bg-emerald-100 text-emerald-800' };
      case 'REJECTED':
        return { label: 'Rejected (Refunded)', badgeClass: 'bg-rose-100 text-rose-800' };
      case 'FAILED':
        return { label: 'Failed (Refunded)', badgeClass: 'bg-orange-100 text-orange-800' };
      default:
        return { label: status, badgeClass: 'bg-slate-100 text-slate-700' };
    }
  };

  const activeWithdrawalsCount = withdrawals.filter((w) =>
    ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'].includes(w.status)
  ).length;

  const isCreditTx = (type: WalletTransaction['type']) =>
    type === 'DEPOSIT' ||
    type === 'GAME_WIN_CREDIT' ||
    type === 'ADMIN_CREDIT' ||
    type === 'WITHDRAWAL_REJECTED' ||
    type === 'WITHDRAWAL_FAILED';

  const renderDepositBanner = (banner: DepositBannerState) => {
    const configs: Record<
      DepositBannerState['code'],
      { title: string; boxClass: string; icon: React.ReactNode }
    > = {
      VERIFYING_PAYMENT: {
        title: 'Verifying Payment',
        boxClass: 'bg-blue-50 text-blue-900 border-blue-200',
        icon: <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />,
      },
      PENDING_VERIFICATION: {
        title: 'Pending Verification',
        boxClass: 'bg-amber-50 text-amber-900 border-amber-200',
        icon: <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
      },
      DEPOSIT_SUCCESSFUL: {
        title: 'Deposit Successful',
        boxClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
      },
      TRANSACTION_NOT_FOUND: {
        title: 'Transaction Not Found',
        boxClass: 'bg-orange-50 text-orange-900 border-orange-200',
        icon: <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />,
      },
      AMOUNT_MISMATCH: {
        title: 'Amount Mismatch',
        boxClass: 'bg-rose-50 text-rose-900 border-rose-200',
        icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
      },
      ALREADY_PROCESSED: {
        title: 'Already Processed',
        boxClass: 'bg-slate-100 text-slate-900 border-slate-300',
        icon: <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />,
      },
      REQUIRES_ADMIN_REVIEW: {
        title: 'Requires Admin Review',
        boxClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
        icon: <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />,
      },
      PROVIDER_UNAVAILABLE: {
        title: 'Verification Failed',
        boxClass: 'bg-rose-50 text-rose-900 border-rose-200',
        icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
      },
      VERIFICATION_FAILED: {
        title: 'Verification Failed',
        boxClass: 'bg-rose-50 text-rose-900 border-rose-200',
        icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
      },
    };
    const cfg = configs[banner.code] || configs.VERIFICATION_FAILED;
    return (
      <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${cfg.boxClass}`}>
        {cfg.icon}
        <div className="flex-1 space-y-0.5">
          <div className="font-black uppercase tracking-wide text-[11px]">{cfg.title}</div>
          <div className="font-semibold leading-relaxed">{banner.message}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shadow-inner">
              <WalletIcon className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>{language === 'am' ? 'የገንዘብ ቦርሳ (Wallet)' : 'Real-Money Wallet'}</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-emerald-400 text-emerald-950">
                  Telebirr Active
                </span>
              </h2>
              <p className="text-xs text-blue-100">
                {language === 'am' ? 'በቴሌብር ያስቀምጡ እና ያውጡ' : 'Instant Telebirr Deposits & Secure Withdrawals'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchWalletData}
              disabled={refreshing}
              title="Refresh wallet balances"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Balance Cards Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Available Balance */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
                <span>Available Balance</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
                {wallet ? wallet.availableBalance.toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-slate-500">ETB</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Ready for games & withdrawals</div>
            </div>

            {/* Reserved Balance */}
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
                <span>Reserved Balance</span>
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight">
                {wallet ? wallet.reservedBalance.toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-slate-500">ETB</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Pending withdrawal review</div>
            </div>

            {/* Total Balance */}
            <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
                <span>Total Balance</span>
                <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-900 tracking-tight">
                {wallet ? (wallet.availableBalance + wallet.reservedBalance).toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-slate-500">ETB</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Account Net Worth</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <WalletIcon className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'deposit'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>Deposit (Telebirr)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('withdraw')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'withdraw'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
            <span>Withdraw</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Ledger</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('deposit')}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Deposit Funds</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('withdraw')}
                  className="p-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Request Payout</span>
                </button>
              </div>

              {/* Active Withdrawals Banner if any */}
              {activeWithdrawalsCount > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Withdrawal Request in Progress:</span> You have{' '}
                    {activeWithdrawalsCount} active withdrawal request(s) under processing. Funds remain safely
                    reserved until payout completes.
                  </div>
                </div>
              )}

              {/* Recent Activity Mini List */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                    Recent Wallet Ledger Entries
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                  >
                    View All &rarr;
                  </button>
                </div>

                {transactions.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No transactions yet. Deposit with Telebirr to play!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {transactions.slice(0, 5).map((tx) => {
                      const credit = isCreditTx(tx.type);
                      return (
                        <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {credit ? (
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div className="truncate">
                              <div className="font-bold text-slate-800 truncate">{tx.description}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`font-black ${credit ? 'text-emerald-600' : 'text-slate-800'}`}>
                              {credit ? `+${tx.amount.toFixed(2)}` : `-${tx.amount.toFixed(2)}`}{' '}
                              <span className="text-[10px] text-slate-500 font-normal">ETB</span>
                            </div>
                            <div>{formatTypeBadge(tx.type)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DEPOSIT (TELEBIRR AUTOMATION VIA VERIFY.ET) */}
          {activeTab === 'deposit' && (
            <div className="space-y-4">
              {/* Step-by-step Telebirr Transfer Card (Admin-Configured Receiving Account) */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 text-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    <span>Telebirr Deposit Guide</span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700">
                    {telebirrConfig
                      ? `${telebirrConfig.minDepositAmount} – ${telebirrConfig.maxDepositAmount.toLocaleString()} ETB`
                      : 'Loading limits...'}
                  </span>
                </div>

                {/* Configured Receiving Wallet Highlight + Copy Button */}
                <div className="bg-white rounded-xl border border-indigo-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Official Telebirr Receiving Account
                    </div>
                    <div className="text-sm font-black text-slate-900">
                      {telebirrConfig?.telebirrAccountName || 'Loading account...'}
                    </div>
                    <div className="font-mono text-base font-black text-indigo-700 tracking-wide">
                      {telebirrConfig?.telebirrPhoneNumber || '---'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyNumber}
                    disabled={!telebirrConfig?.telebirrPhoneNumber}
                    className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
                      copiedPhone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedPhone ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied Number</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Telebirr Number</span>
                      </>
                    )}
                  </button>
                </div>

                <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium leading-relaxed">
                  <li>Enter the exact deposit amount in <strong>ETB</strong> below.</li>
                  <li>
                    Copy the Telebirr receiving number above and transfer the exact{' '}
                    <strong>{depositAmount ? `${parseFloat(depositAmount || '0').toFixed(2)} ETB` : 'amount'}</strong>{' '}
                    via Telebirr.
                  </li>
                  <li>
                    Copy the <strong>Transaction Number</strong> from your Telebirr confirmation SMS message.
                  </li>
                  <li>
                    Paste the transaction number below and click <strong>Verify &amp; Deposit</strong>.
                  </li>
                </ol>
                {telebirrConfig?.depositInstructions && (
                  <div className="p-2.5 rounded-lg bg-white/80 border border-indigo-100 text-[11px] text-slate-600">
                    {telebirrConfig.depositInstructions}
                  </div>
                )}
              </div>

              {telebirrConfig && !telebirrConfig.depositsEnabled && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="font-semibold">
                    Telebirr deposits are temporarily paused by administration. Please check back shortly.
                  </div>
                </div>
              )}

              {depositBanner && renderDepositBanner(depositBanner)}

              {/* Deposit Form */}
              <form
                onSubmit={handleDepositSubmit}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      1. Amount (ETB) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {[50, 100, 250, 500].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDepositAmount(String(preset))}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                            depositAmount === String(preset)
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min={telebirrConfig?.minDepositAmount ?? 10}
                    max={telebirrConfig?.maxDepositAmount ?? 50000}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="e.g. 100.00"
                    required
                    className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Telebirr Transaction Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={depositTxNumber}
                    onChange={(e) => setDepositTxNumber(e.target.value.toUpperCase())}
                    placeholder="Paste receipt / transaction code (e.g. CJ84K92L1P)"
                    required
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Verified automatically against Telebirr records. Duplicate or mismatched receipts cannot be credited.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    depositSubmitting ||
                    (telebirrConfig !== null && !telebirrConfig.depositsEnabled) ||
                    !depositTxNumber.trim() ||
                    !depositAmount.trim()
                  }
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {depositSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Payment...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify &amp; Deposit</span>
                    </>
                  )}
                </button>
              </form>

              {/* Player Deposit History */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2.5">
                  Deposit History
                </h4>
                {deposits.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs">No deposits recorded yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {deposits.map((d) => {
                      const badge = getDepositStatusLabel(d.status);
                      return (
                        <div key={d.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800">
                              {(d.requestedAmount || d.amount).toFixed(2)} {d.currency} via {d.paymentMethod.toUpperCase()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              Ref: {d.providerTransactionId} •{' '}
                              {new Date(d.createdAt).toLocaleDateString()} {new Date(d.createdAt).toLocaleTimeString()}
                            </div>
                            {d.statusMessage && d.status !== 'VERIFIED' && (
                              <div className="text-[10px] text-slate-600 mt-0.5">{d.statusMessage}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {d.status === 'PENDING' && d.providerRequestId && (
                              <button
                                type="button"
                                onClick={() => pollSpecificDeposit(d.id)}
                                title="Check verification status"
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer"
                              >
                                Check
                              </button>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WITHDRAWAL REQUEST */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-1.5 text-amber-950">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Telebirr Withdrawal Rules &amp; Information</span>
                </div>
                <p>
                  Requested funds are immediately moved into Reserved Balance while your payout is reviewed and
                  disbursed to your Telebirr account.
                </p>
                <div className="text-[11px] font-bold text-amber-900">
                  Minimum withdrawal: {(telebirrConfig?.minWithdrawalAmount ?? 10).toFixed(2)} ETB • Maximum single
                  withdrawal: {(telebirrConfig?.maxWithdrawalAmount ?? 50000).toLocaleString()} ETB
                </div>
              </div>

              {telebirrConfig && !telebirrConfig.withdrawalsEnabled && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="font-semibold">
                    Withdrawals are temporarily paused by administration. Existing pending requests remain reserved.
                  </div>
                </div>
              )}

              {withdrawFeedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                    withdrawFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border border-rose-200'
                  }`}
                >
                  {withdrawFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 font-semibold">{withdrawFeedback.message}</div>
                </div>
              )}

              {!withdrawReviewStep ? (
                <form
                  onSubmit={handleWithdrawReview}
                  className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <label className="font-bold text-slate-700">
                        Withdrawal Amount (ETB) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Available:{' '}
                        <strong className="text-emerald-700">
                          {wallet ? wallet.availableBalance.toFixed(2) : '0.00'} ETB
                        </strong>
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min={telebirrConfig?.minWithdrawalAmount ?? 10}
                      max={Math.min(
                        wallet ? wallet.availableBalance : 50000,
                        telebirrConfig?.maxWithdrawalAmount ?? 50000
                      )}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="e.g. 50.00"
                      required
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telebirr Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={withdrawAccount}
                      onChange={(e) => setWithdrawAccount(e.target.value)}
                      placeholder="e.g. 0911223344"
                      required
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telebirr Account Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={withdrawName}
                      onChange={(e) => setWithdrawName(e.target.value)}
                      placeholder="Full name registered on Telebirr"
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      (telebirrConfig !== null && !telebirrConfig.withdrawalsEnabled) ||
                      !withdrawAmount ||
                      !withdrawAccount.trim() ||
                      !withdrawName.trim()
                    }
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Review Withdrawal Details</span>
                  </button>
                </form>
              ) : (
                <div className="bg-white rounded-xl border-2 border-amber-300 p-4 space-y-3.5 shadow-xs text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm text-slate-900">Confirm Withdrawal Request</h4>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                      REVIEW STEP
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Withdrawal Amount:</span>
                      <strong className="text-slate-900 font-black">
                        {parseFloat(withdrawAmount || '0').toFixed(2)} ETB
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Telebirr Phone Number:</span>
                      <strong className="font-mono text-slate-900">{withdrawAccount.trim()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Telebirr Account Name:</span>
                      <strong className="text-slate-900">{withdrawName.trim()}</strong>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between">
                      <span className="text-slate-500">Available After Reserve:</span>
                      <strong className="text-emerald-700">
                        {Math.max(
                          0,
                          (wallet?.availableBalance ?? 0) - parseFloat(withdrawAmount || '0')
                        ).toFixed(2)}{' '}
                        ETB
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Submitting will move <strong>{parseFloat(withdrawAmount || '0').toFixed(2)} ETB</strong> into your
                    Reserved Balance until an administrator completes or rejects the transfer.
                  </p>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      disabled={withdrawSubmitting}
                      onClick={() => setWithdrawReviewStep(false)}
                      className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                    >
                      Back &amp; Edit
                    </button>
                    <button
                      type="button"
                      disabled={withdrawSubmitting}
                      onClick={handleWithdrawConfirm}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {withdrawSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm Withdrawal</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* User Withdrawal Requests List */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2.5">
                  Your Payout Requests
                </h4>
                {withdrawals.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs">No withdrawal requests found.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {withdrawals.map((w) => {
                      const badge = getWithdrawalStatusBadge(w.status);
                      return (
                        <div key={w.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800">
                              {w.amount.toFixed(2)} ETB to {w.accountIdentifier}
                              {w.accountName ? ` (${w.accountName})` : ''}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(w.requestedAt).toLocaleDateString()} {new Date(w.requestedAt).toLocaleTimeString()}
                              {w.paymentReference && ` • Telebirr Ref: ${w.paymentReference}`}
                            </div>
                            {w.rejectionReason && (
                              <div className="text-[10px] text-rose-600 font-medium">Reason: {w.rejectionReason}</div>
                            )}
                            {w.failureReason && (
                              <div className="text-[10px] text-orange-600 font-medium">Reason: {w.failureReason}</div>
                            )}
                          </div>
                          <div className="shrink-0">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: IMMUTABLE LEDGER */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                  Complete Transaction Ledger
                </h4>
                <span className="text-[11px] text-slate-500 font-semibold">{transactions.length} Records</span>
              </div>

              {transactions.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                  No ledger records recorded yet.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const credit = isCreditTx(tx.type);
                    return (
                      <div key={tx.id} className="p-3.5 hover:bg-slate-50/70 transition space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {formatTypeBadge(tx.type)}
                            <span className="font-mono text-[10px] text-slate-400">{tx.id}</span>
                          </div>
                          <div className={`font-black text-xs sm:text-sm ${credit ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {credit ? `+${tx.amount.toFixed(2)}` : `-${tx.amount.toFixed(2)}`}{' '}
                            <span className="text-[10px] font-normal text-slate-500">ETB</span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-800 font-medium">{tx.description}</div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <div>
                            Balance: {tx.balanceBefore.toFixed(2)} &rarr;{' '}
                            <strong className="text-slate-600">{tx.balanceAfter.toFixed(2)} ETB</strong>
                            {tx.reservedAfter > 0 && ` (Reserved: ${tx.reservedAfter.toFixed(2)} ETB)`}
                          </div>
                          <div>
                            {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verify.et Automated Telebirr Verification Active</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
