import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Search,
  Lock,
  Settings,
  FileBarChart,
  Download,
  Scale,
  AlertTriangle,
  Sliders,
} from 'lucide-react';
import {
  FinancialOverviewSummary,
  AdminWithdrawalRecord,
  Deposit,
  WalletTransaction,
  FinancialAuditLog,
  PaymentProviderConfig,
  TelebirrReceivingConfig,
  FinancialReportSummary,
  WalletReconciliationResult,
} from '../../types/wallet';

interface FinancialTabProps {
  currentAdminId: string;
}

type AdminDepositRecord = Deposit & {
  playerDisplayName?: string;
  playerUsername?: string;
};

type FinancialSubsection =
  | 'overview'
  | 'deposits'
  | 'withdrawals'
  | 'transactions'
  | 'settings'
  | 'reports'
  | 'audit';

function getWithdrawalBadge(status: AdminWithdrawalRecord['status']) {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', cls: 'bg-amber-100 text-amber-800' };
    case 'UNDER_REVIEW':
      return { label: 'Under Review', cls: 'bg-indigo-100 text-indigo-800' };
    case 'APPROVED':
      return { label: 'Approved', cls: 'bg-sky-100 text-sky-800' };
    case 'PROCESSING':
      return { label: 'Processing Payment', cls: 'bg-purple-100 text-purple-800' };
    case 'PAID':
    case 'COMPLETED':
      return { label: 'Paid', cls: 'bg-emerald-100 text-emerald-800' };
    case 'REJECTED':
      return { label: 'Rejected', cls: 'bg-rose-100 text-rose-800' };
    case 'FAILED':
      return { label: 'Failed', cls: 'bg-orange-100 text-orange-800' };
    default:
      return { label: status, cls: 'bg-slate-100 text-slate-700' };
  }
}

export const FinancialTab: React.FC<FinancialTabProps> = ({ currentAdminId }) => {
  const [activeSection, setActiveSection] = useState<FinancialSubsection>('overview');
  const [overview, setOverview] = useState<FinancialOverviewSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRecord[]>([]);
  const [deposits, setDeposits] = useState<AdminDepositRecord[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);
  const [providers, setProviders] = useState<PaymentProviderConfig[]>([]);
  const [telebirrConfig, setTelebirrConfig] = useState<TelebirrReceivingConfig | null>(null);
  const [report, setReport] = useState<FinancialReportSummary | null>(null);
  const [reconciliation, setReconciliation] = useState<WalletReconciliationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter & Search States
  const [withdrawalFilter, setWithdrawalFilter] = useState<
    'ALL' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'REJECTED' | 'FAILED'
  >('ALL');
  const [depositFilter, setDepositFilter] = useState<
    'ALL' | 'REQUIRES_ADMIN_REVIEW' | 'VERIFIED' | 'PENDING' | 'FAILED'
  >('ALL');
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('ALL');
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);

  // Withdrawal Action Modal State
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawalRecord | null>(null);
  const [wdNote, setWdNote] = useState('');
  const [wdPaymentRef, setWdPaymentRef] = useState('');
  const [wdReason, setWdReason] = useState('');

  // Deposit Review Modal State
  const [selectedDeposit, setSelectedDeposit] = useState<AdminDepositRecord | null>(null);
  const [depositReviewNote, setDepositReviewNote] = useState('');
  const [depositRejectReason, setDepositRejectReason] = useState('');

  // Telebirr Settings Form
  const [cfgPhone, setCfgPhone] = useState('');
  const [cfgAccountName, setCfgAccountName] = useState('');
  const [cfgInstructions, setCfgInstructions] = useState('');
  const [cfgMinDeposit, setCfgMinDeposit] = useState('10');
  const [cfgMaxDeposit, setCfgMaxDeposit] = useState('50000');
  const [cfgMinWithdrawal, setCfgMinWithdrawal] = useState('10');
  const [cfgMaxWithdrawal, setCfgMaxWithdrawal] = useState('50000');
  const [cfgDepositsEnabled, setCfgDepositsEnabled] = useState(true);
  const [cfgWithdrawalsEnabled, setCfgWithdrawalsEnabled] = useState(true);

  // Reports Filter State
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');

  // Manual Balance Adjustment Form
  const [adjUserId, setAdjUserId] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState<'ADMIN_CREDIT' | 'ADMIN_DEBIT'>('ADMIN_CREDIT');
  const [adjReason, setAdjReason] = useState('');

  const buildReportUrl = () => {
    const params = new URLSearchParams();
    if (reportFrom) {
      const ts = new Date(`${reportFrom}T00:00:00`).getTime();
      if (!isNaN(ts)) params.set('from', String(ts));
    }
    if (reportTo) {
      const ts = new Date(`${reportTo}T23:59:59.999`).getTime();
      if (!isNaN(ts)) params.set('to', String(ts));
    }
    const qs = params.toString();
    return `/api/admin/financial/reports${qs ? `?${qs}` : ''}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = { 'x-user-id': currentAdminId };
      const [ovRes, wdRes, depRes, txRes, audRes, prvRes, tbCfgRes, repRes, recRes] = await Promise.all([
        fetch('/api/admin/financial/overview', { headers }),
        fetch('/api/admin/financial/withdrawals', { headers }),
        fetch('/api/admin/financial/deposits?limit=150', { headers }),
        fetch('/api/admin/financial/transactions?limit=150', { headers }),
        fetch('/api/admin/financial/audit-logs', { headers }),
        fetch('/api/admin/financial/provider-config', { headers }),
        fetch('/api/admin/financial/telebirr-config', { headers }),
        fetch(buildReportUrl(), { headers }),
        fetch('/api/admin/financial/reconciliation', { headers }),
      ]);

      if (ovRes.ok) {
        const d = await ovRes.json();
        setOverview(d.overview);
      }
      if (wdRes.ok) {
        const d = await wdRes.json();
        setWithdrawals(d.withdrawals || []);
      }
      if (depRes.ok) {
        const d = await depRes.json();
        setDeposits(d.deposits || []);
      }
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions || []);
      }
      if (audRes.ok) {
        const d = await audRes.json();
        setAuditLogs(d.logs || []);
      }
      if (prvRes.ok) {
        const d = await prvRes.json();
        setProviders(d.providers || []);
      }
      if (tbCfgRes.ok) {
        const d = await tbCfgRes.json();
        if (d.config) {
          setTelebirrConfig(d.config);
          setCfgPhone(d.config.telebirrPhoneNumber || '');
          setCfgAccountName(d.config.telebirrAccountName || '');
          setCfgInstructions(d.config.depositInstructions || '');
          setCfgMinDeposit(String(d.config.minDepositAmount ?? 10));
          setCfgMaxDeposit(String(d.config.maxDepositAmount ?? 50000));
          setCfgMinWithdrawal(String(d.config.minWithdrawalAmount ?? 10));
          setCfgMaxWithdrawal(String(d.config.maxWithdrawalAmount ?? 50000));
          setCfgDepositsEnabled(d.config.depositsEnabled !== false);
          setCfgWithdrawalsEnabled(d.config.withdrawalsEnabled !== false);
        }
      }
      if (repRes.ok) {
        const d = await repRes.json();
        setReport(d.report || null);
      }
      if (recRes.ok) {
        const d = await recRes.json();
        setReconciliation(d.reconciliation || null);
      }
    } catch (err: any) {
      console.warn('Failed to load financial records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentAdminId]);

  const handleRunReport = async () => {
    setProcessingAction(true);
    setActionFeedback(null);
    try {
      const headers = { 'x-user-id': currentAdminId };
      const [repRes, recRes] = await Promise.all([
        fetch(buildReportUrl(), { headers }),
        fetch('/api/admin/financial/reconciliation', { headers }),
      ]);
      if (repRes.ok) {
        const d = await repRes.json();
        setReport(d.report);
      }
      if (recRes.ok) {
        const d = await recRes.json();
        setReconciliation(d.reconciliation);
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleExportReportCsv = () => {
    if (!report) return;
    const rows = [
      ['Metric', 'Count', 'Amount (ETB)'],
      ['Verified Deposits', report.deposits.verifiedCount, report.deposits.verifiedAmount.toFixed(2)],
      ['Pending Deposits', report.deposits.pendingCount, '0.00'],
      ['Deposits Pending Admin Review', report.deposits.manualReviewCount, '0.00'],
      ['Failed Deposits', report.deposits.failedCount, '0.00'],
      ['Paid Withdrawals', report.withdrawals.paidCount, report.withdrawals.paidAmount.toFixed(2)],
      ['In-Progress Withdrawals', report.withdrawals.inProgressCount, report.withdrawals.inProgressAmount.toFixed(2)],
      ['Rejected Withdrawals', report.withdrawals.rejectedCount, '0.00'],
      ['Failed Withdrawals', report.withdrawals.failedCount, '0.00'],
      ['Game Entry Debits', report.gaming.entryDebitsCount, report.gaming.entryDebitsAmount.toFixed(2)],
      ['Game Win Credits', report.gaming.winCreditsCount, report.gaming.winCreditsAmount.toFixed(2)],
      ['Net Gaming Revenue', '', report.gaming.netGamingRevenue.toFixed(2)],
      ['Admin Manual Credits', '', report.adjustments.adminCreditsAmount.toFixed(2)],
      ['Admin Manual Debits', '', report.adjustments.adminDebitsAmount.toFixed(2)],
      ['Net Payment Flow (Deposits - Paid Withdrawals)', '', report.netPaymentFlow.toFixed(2)],
      ['Ledger Reconciliation Status', report.reconciliation.isBalanced ? 'BALANCED' : 'DISCREPANCY', `${report.reconciliation.matchedCount}/${report.reconciliation.totalWalletsChecked}`],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveTelebirrConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingAction(true);
    setActionFeedback(null);
    try {
      const res = await fetch('/api/admin/financial/telebirr-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentAdminId,
        },
        body: JSON.stringify({
          telebirrPhoneNumber: cfgPhone.trim(),
          telebirrAccountName: cfgAccountName.trim(),
          depositInstructions: cfgInstructions.trim(),
          minDepositAmount: parseFloat(cfgMinDeposit),
          maxDepositAmount: parseFloat(cfgMaxDeposit),
          minWithdrawalAmount: parseFloat(cfgMinWithdrawal),
          maxWithdrawalAmount: parseFloat(cfgMaxWithdrawal),
          depositsEnabled: cfgDepositsEnabled,
          withdrawalsEnabled: cfgWithdrawalsEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelebirrConfig(data.config);
        setActionFeedback({ type: 'success', message: data.message || 'Telebirr payment settings saved.' });
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: data.message || data.error || 'Failed to update settings.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleToggleProvider = async (providerId: string, updates: { isEnabled?: boolean; isDefault?: boolean }) => {
    setProcessingAction(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/financial/provider-config/${providerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentAdminId,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProviders(data.providers || []);
        setActionFeedback({ type: 'success', message: `Updated configuration for ${providerId}.` });
      } else {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to update provider config.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleApproveDeposit = async () => {
    if (!selectedDeposit) return;
    setProcessingAction(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/financial/deposits/${selectedDeposit.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentAdminId,
        },
        body: JSON.stringify({ note: depositReviewNote.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback({
          type: 'success',
          message: `Deposit ${selectedDeposit.id} manually approved and credited to ${selectedDeposit.userId}.`,
        });
        setSelectedDeposit(null);
        setDepositReviewNote('');
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: data.message || data.error || 'Failed to approve deposit.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleRejectDeposit = async () => {
    if (!selectedDeposit) return;
    if (!depositRejectReason.trim()) {
      setActionFeedback({ type: 'error', message: 'Please provide a rejection reason.' });
      return;
    }
    setProcessingAction(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/financial/deposits/${selectedDeposit.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentAdminId,
        },
        body: JSON.stringify({ reason: depositRejectReason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback({ type: 'success', message: `Deposit ${selectedDeposit.id} manually rejected.` });
        setSelectedDeposit(null);
        setDepositRejectReason('');
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: data.message || data.error || 'Failed to reject deposit.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setProcessingAction(false);
    }
  };

  // Unified Withdrawal Workflow Transition Handler
  const executeWithdrawalTransition = async (
    action: 'review' | 'approve' | 'processing' | 'mark-paid' | 'reject' | 'fail'
  ) => {
    if (!selectedWithdrawal) return;

    if (action === 'mark-paid' && (!wdPaymentRef.trim() || wdPaymentRef.trim().length < 4)) {
      setActionFeedback({
        type: 'error',
        message: 'Outgoing Telebirr transaction reference (min 4 characters) is required before marking as Paid.',
      });
      return;
    }

    if ((action === 'reject' || action === 'fail') && !wdReason.trim()) {
      setActionFeedback({
        type: 'error',
        message: `Please provide a written reason before marking withdrawal as ${
          action === 'reject' ? 'Rejected' : 'Failed'
        }.`,
      });
      return;
    }

    setProcessingAction(true);
    setActionFeedback(null);
    try {
      const bodyPayload: Record<string, any> = {};
      if (wdNote.trim()) bodyPayload.note = wdNote.trim();
      if (action === 'mark-paid') bodyPayload.paymentReference = wdPaymentRef.trim();
      if (action === 'reject' || action === 'fail') bodyPayload.reason = wdReason.trim();

      const res = await fetch(`/api/admin/financial/withdrawals/${selectedWithdrawal.id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentAdminId,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback({ type: 'success', message: data.message || `Withdrawal updated (${action}).` });
        setSelectedWithdrawal(null);
        setWdNote('');
        setWdPaymentRef('');
        setWdReason('');
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: data.message || data.error || `Failed to ${action} withdrawal.` });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(adjAmount);
    if (!adjUserId.trim() || isNaN(num) || num <= 0 || !adjReason.trim()) {
      setActionFeedback({ type: 'error', message: 'Target user, positive amount, and reason are required.' });
      return;
    }

    setProcessingAction(true);
    setActionFeedback(null);
    try {
      const res = await fetch('/api/admin/financial/adjust-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentAdminId,
        },
        body: JSON.stringify({
          targetUserId: adjUserId.trim(),
          amount: num,
          type: adjType,
          reason: adjReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback({
          type: 'success',
          message: `Adjusted ${adjUserId} by ${adjType === 'ADMIN_CREDIT' ? '+' : '-'}${num.toFixed(2)} ETB.`,
        });
        setAdjUserId('');
        setAdjAmount('');
        setAdjReason('');
        setShowAdjustPanel(false);
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: data.message || data.error || 'Failed to adjust balance.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const activeWithdrawalQueueCount = withdrawals.filter((w) =>
    ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'].includes(w.status)
  ).length;
  const reviewQueueCount = deposits.filter((d) => d.status === 'REQUIRES_ADMIN_REVIEW').length;

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (withdrawalFilter === 'ALL') return true;
    if (withdrawalFilter === 'PAID') return w.status === 'PAID' || w.status === 'COMPLETED';
    return w.status === withdrawalFilter;
  });

  const filteredDeposits = deposits.filter((d) => {
    if (depositFilter === 'ALL') return true;
    if (depositFilter === 'FAILED') {
      return d.status === 'FAILED' || d.status === 'NOT_FOUND' || d.status === 'AMOUNT_MISMATCH';
    }
    return d.status === depositFilter;
  });

  const filteredTransactions = transactions.filter((t) => {
    if (txTypeFilter !== 'ALL' && t.type !== txTypeFilter) return false;
    if (!txSearch.trim()) return true;
    const q = txSearch.toLowerCase();
    return (
      t.id.toLowerCase().includes(q) ||
      t.userId.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      (t.referenceId && t.referenceId.toLowerCase().includes(q))
    );
  });

  const navSubsections: { id: FinancialSubsection; label: string; badge?: number }[] = [
    { id: 'overview', label: '1. Financial Overview' },
    { id: 'deposits', label: '2. Deposit Management', badge: reviewQueueCount || undefined },
    { id: 'withdrawals', label: '3. Withdrawal Management', badge: activeWithdrawalQueueCount || undefined },
    { id: 'transactions', label: '4. Transaction History' },
    { id: 'settings', label: '5. Telebirr Settings' },
    { id: 'reports', label: '6. Financial Reports' },
    { id: 'audit', label: '7. Financial Audit Logs' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>Wallet &amp; Payments Administration</span>
          </h2>
          <p className="text-xs text-slate-500">
            Telebirr deposits, multi-stage withdrawal payouts, immutable wallet ledger, reconciliation &amp; financial
            audit controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reconciliation && (
            <span
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                reconciliation.isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-100 text-rose-800'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>
                {reconciliation.isBalanced
                  ? `Ledger Balanced (${reconciliation.matchedCount}/${reconciliation.totalWalletsChecked})`
                  : `${reconciliation.discrepancyCount} Discrepancy`}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-semibold">{actionFeedback.message}</div>
        </div>
      )}

      {/* 7 Required Subsections Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2.5">
        {navSubsections.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSection === tab.id
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                  activeSection === tab.id ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 1. FINANCIAL OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500 mb-1">Total System Balance</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {overview ? overview.totalSystemBalance.toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-slate-400">ETB</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Available: {overview ? overview.totalAvailableBalance.toFixed(2) : '0.00'} • Reserved:{' '}
                {overview ? overview.totalReservedBalance.toFixed(2) : '0.00'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
              <div className="text-xs font-bold text-emerald-700 mb-1">Verified Telebirr Deposits</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">
                {overview ? overview.totalDepositedAmount.toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-emerald-500">ETB</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {overview?.pendingDepositReviewsCount || 0} deposit(s) awaiting manual review
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-amber-700 mb-1">
                <span>Active Withdrawal Queue</span>
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-800">
                {overview ? (overview.activeWithdrawalsAmount ?? overview.pendingWithdrawalsAmount).toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-amber-600">ETB</span>
              </div>
              <div className="text-[10px] text-amber-700 font-bold mt-1">
                {overview?.activeWithdrawalsCount ?? overview?.pendingWithdrawalsCount ?? 0} unsettled request(s)
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-2xs">
              <div className="text-xs font-bold text-indigo-700 mb-1">Total Disbursed Payouts</div>
              <div className="text-xl sm:text-2xl font-black text-indigo-900">
                {overview ? overview.totalWithdrawnAmount.toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-indigo-500">ETB</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {overview ? overview.totalWallets : 0} wallets • {overview ? overview.totalTransactionsCount : 0}{' '}
                ledger entries
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">Operational Queues</h3>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <div className="font-bold text-slate-800">Withdrawal Payout Pipeline</div>
                    <div className="text-[11px] text-slate-500">
                      Pending, Under Review, Approved &amp; Processing payouts
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('withdrawals')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Manage ({activeWithdrawalQueueCount})
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <div className="font-bold text-slate-800">Deposit Verification Queue</div>
                    <div className="text-[11px] text-slate-500">
                      Verify.et receipts &amp; flagged manual review queue
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('deposits')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Review ({reviewQueueCount})
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <div className="font-bold text-slate-800">Telebirr Channel Status</div>
                    <div className="text-[11px] text-slate-500">
                      Receiving: {telebirrConfig?.telebirrPhoneNumber || '—'} • Deposits:{' '}
                      <strong>{telebirrConfig?.depositsEnabled ? 'Enabled' : 'Paused'}</strong> • Withdrawals:{' '}
                      <strong>{telebirrConfig?.withdrawalsEnabled ? 'Enabled' : 'Paused'}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('settings')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Settings
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">Ledger Integrity &amp; Reconciliation</h3>
                <Scale className="w-4 h-4 text-emerald-600" />
              </div>
              {reconciliation ? (
                <div className="space-y-3 text-xs">
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                      reconciliation.isBalanced
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {reconciliation.isBalanced ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-extrabold">
                        {reconciliation.isBalanced
                          ? 'All Wallets Reconciled With Immutable Ledger'
                          : `${reconciliation.discrepancyCount} Wallet Discrepancy Detected`}
                      </div>
                      <div className="text-[11px]">
                        Checked {reconciliation.totalWalletsChecked} wallet(s) • Matched: {reconciliation.matchedCount}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('reports')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Open Financial Reports
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection('transactions');
                        setShowAdjustPanel(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                    >
                      Manual Balance Adjustment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">Loading reconciliation summary...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. DEPOSIT MANAGEMENT */}
      {activeSection === 'deposits' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-extrabold text-sm text-slate-800">Deposit Management</h3>
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              {(['ALL', 'REQUIRES_ADMIN_REVIEW', 'PENDING', 'VERIFIED', 'FAILED'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDepositFilter(f)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                    depositFilter === f ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f === 'REQUIRES_ADMIN_REVIEW' ? `Review (${reviewQueueCount})` : f}
                </button>
              ))}
            </div>
          </div>

          {filteredDeposits.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              No deposits match the selected filter.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3.5 py-2.5">Player</th>
                    <th className="px-3.5 py-2.5">Deposit ID</th>
                    <th className="px-3.5 py-2.5">Requested Amount</th>
                    <th className="px-3.5 py-2.5">Transaction Reference</th>
                    <th className="px-3.5 py-2.5">Verification Status</th>
                    <th className="px-3.5 py-2.5">Received Amount</th>
                    <th className="px-3.5 py-2.5">Receiving Account</th>
                    <th className="px-3.5 py-2.5">Submission Time</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeposits.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{d.playerDisplayName || d.userId}</div>
                        <div className="text-[10px] font-mono text-slate-400">{d.userId}</div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{d.id}</td>
                      <td className="px-3.5 py-2.5 font-black text-slate-900 whitespace-nowrap">
                        {(d.requestedAmount || d.amount).toFixed(2)} {d.currency}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] whitespace-nowrap">
                        <div className="font-bold text-slate-800">{d.providerTransactionId}</div>
                        {d.providerRequestId && (
                          <div className="text-[10px] text-slate-400">Req: {d.providerRequestId}</div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            d.status === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : d.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : d.status === 'REQUIRES_ADMIN_REVIEW'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {d.status}
                        </span>
                        {d.manualDecision && (
                          <div className="text-[10px] font-bold text-indigo-700 mt-0.5">
                            MANUAL {d.manualDecision}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-emerald-700">
                        {typeof d.verifiedAmount === 'number'
                          ? `${d.verifiedAmount.toFixed(2)} ${d.currency}`
                          : d.status === 'VERIFIED'
                          ? `${d.amount.toFixed(2)} ${d.currency}`
                          : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] font-mono text-slate-600 whitespace-nowrap">
                        {d.recipientAccount || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        {d.status === 'REQUIRES_ADMIN_REVIEW' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDeposit(d);
                              setDepositReviewNote('');
                              setDepositRejectReason('');
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg cursor-pointer"
                          >
                            Review
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            {d.reviewedBy ? `Manual: ${d.reviewedBy}` : 'Automated'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. WITHDRAWAL MANAGEMENT */}
      {activeSection === 'withdrawals' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            <h3 className="font-extrabold text-sm text-slate-800">Withdrawal Management</h3>
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'FAILED'] as const).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setWithdrawalFilter(f)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                      withdrawalFilter === f
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.replace(/_/g, ' ')}
                  </button>
                )
              )}
            </div>
          </div>

          {filteredWithdrawals.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              No withdrawal requests matching the selected status filter.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3.5 py-2.5">Player</th>
                    <th className="px-3.5 py-2.5">Available Bal</th>
                    <th className="px-3.5 py-2.5">Reserved Amt</th>
                    <th className="px-3.5 py-2.5">Withdrawal</th>
                    <th className="px-3.5 py-2.5">Telebirr Number</th>
                    <th className="px-3.5 py-2.5">Account Name</th>
                    <th className="px-3.5 py-2.5">Request Date</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Payment Ref</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWithdrawals.map((w) => {
                    const badge = getWithdrawalBadge(w.status);
                    const isFinalized = ['PAID', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED'].includes(w.status);
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{w.playerDisplayName || w.userId}</div>
                          <div className="text-[10px] font-mono text-slate-400">{w.userId}</div>
                        </td>
                        <td className="px-3.5 py-2.5 font-bold text-emerald-700 whitespace-nowrap">
                          {w.playerAvailableBalance.toFixed(2)} ETB
                        </td>
                        <td className="px-3.5 py-2.5 font-bold text-amber-700 whitespace-nowrap">
                          {w.playerReservedBalance.toFixed(2)} ETB
                        </td>
                        <td className="px-3.5 py-2.5 font-black text-slate-900 whitespace-nowrap">
                          <div>{w.amount.toFixed(2)} ETB</div>
                          <div className="text-[10px] font-mono text-slate-400">{w.id}</div>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {w.accountIdentifier}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                          {w.accountName || '—'}
                        </td>
                        <td className="px-3.5 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(w.requestedAt).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${badge.cls}`}>{badge.label}</span>
                          {(w.rejectionReason || w.failureReason) && (
                            <div className="text-[10px] text-rose-600 mt-0.5 max-w-[160px] truncate">
                              {w.rejectionReason || w.failureReason}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {w.paymentReference || '—'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          {!isFinalized ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedWithdrawal(w);
                                setWdNote(w.reviewNote || '');
                                setWdPaymentRef('');
                                setWdReason('');
                              }}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg cursor-pointer"
                            >
                              Process
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              {w.paidBy || w.rejectedBy || w.failedBy || w.reviewedBy || 'Finalized'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. TRANSACTION HISTORY */}
      {activeSection === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-extrabold text-sm text-slate-800">Transaction History (Immutable Wallet Ledger)</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user, tx ID, ref..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
              >
                <option value="ALL">All Types</option>
                <option value="DEPOSIT">Deposit</option>
                <option value="WITHDRAWAL_REQUEST">Withdrawal Request</option>
                <option value="WITHDRAWAL_PAID">Withdrawal Paid</option>
                <option value="WITHDRAWAL_REJECTED">Withdrawal Rejected</option>
                <option value="WITHDRAWAL_FAILED">Withdrawal Failed</option>
                <option value="GAME_ENTRY_DEBIT">Game Entry Debit</option>
                <option value="GAME_WIN_CREDIT">Game Win Credit</option>
                <option value="ADMIN_CREDIT">Admin Credit</option>
                <option value="ADMIN_DEBIT">Admin Debit</option>
              </select>
              <button
                type="button"
                onClick={() => setShowAdjustPanel((v) => !v)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdjustPanel ? 'Hide Adjustment' : 'Manual Adjustment'}</span>
              </button>
            </div>
          </div>

          {showAdjustPanel && (
            <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-2xs">
              <h4 className="font-black text-xs text-slate-900 mb-2">
                Manual Account Balance Adjustment (Recorded in Immutable Ledger)
              </h4>
              <form onSubmit={handleManualAdjustment} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  value={adjUserId}
                  onChange={(e) => setAdjUserId(e.target.value)}
                  placeholder="User ID (e.g. usr-player-1)"
                  required
                  className="px-3 py-2 rounded-lg border border-slate-300 font-mono"
                />
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as 'ADMIN_CREDIT' | 'ADMIN_DEBIT')}
                  className="px-3 py-2 rounded-lg border border-slate-300 font-bold"
                >
                  <option value="ADMIN_CREDIT">Credit (+)</option>
                  <option value="ADMIN_DEBIT">Debit (-)</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="Amount ETB"
                  required
                  className="px-3 py-2 rounded-lg border border-slate-300 font-bold"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    placeholder="Reason (required)"
                    required
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300"
                  />
                  <button
                    type="submit"
                    disabled={processingAction}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">Date / Time</th>
                  <th className="px-3.5 py-2.5">Tx ID</th>
                  <th className="px-3.5 py-2.5">User</th>
                  <th className="px-3.5 py-2.5">Type</th>
                  <th className="px-3.5 py-2.5">Amount</th>
                  <th className="px-3.5 py-2.5">Available Change</th>
                  <th className="px-3.5 py-2.5">Reserved Change</th>
                  <th className="px-3.5 py-2.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const isCredit =
                    tx.type === 'DEPOSIT' ||
                    tx.type === 'GAME_WIN_CREDIT' ||
                    tx.type === 'ADMIN_CREDIT' ||
                    tx.type === 'WITHDRAWAL_REJECTED' ||
                    tx.type === 'WITHDRAWAL_FAILED';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3.5 py-2.5 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap">
                        {tx.id}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 whitespace-nowrap">{tx.userId}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-black whitespace-nowrap">
                        <span className={isCredit ? 'text-emerald-600' : 'text-slate-900'}>
                          {isCredit ? `+${tx.amount.toFixed(2)}` : `-${tx.amount.toFixed(2)}`} ETB
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {tx.balanceBefore.toFixed(2)} &rarr;{' '}
                        <strong className="text-slate-700">{tx.balanceAfter.toFixed(2)}</strong>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {tx.reservedBefore.toFixed(2)} &rarr;{' '}
                        <strong className="text-slate-700">{tx.reservedAfter.toFixed(2)}</strong>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 max-w-xs truncate">{tx.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TELEBIRR SETTINGS */}
      {activeSection === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900">Telebirr Payment &amp; Wallet Settings</h3>
                <p className="text-xs text-slate-500">
                  Configure Telebirr receiving account, deposit instructions, deposit/withdrawal limits, and channel
                  availability toggles.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveTelebirrConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Telebirr Receiving Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={cfgPhone}
                  onChange={(e) => setCfgPhone(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Telebirr Account Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={cfgAccountName}
                  onChange={(e) => setCfgAccountName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Deposit Instructions</label>
                <textarea
                  rows={2}
                  value={cfgInstructions}
                  onChange={(e) => setCfgInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Minimum Deposit (ETB)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cfgMinDeposit}
                  onChange={(e) => setCfgMinDeposit(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Maximum Deposit (ETB)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cfgMaxDeposit}
                  onChange={(e) => setCfgMaxDeposit(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Minimum Withdrawal (ETB)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cfgMinWithdrawal}
                  onChange={(e) => setCfgMinWithdrawal(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Maximum Withdrawal (ETB)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cfgMaxWithdrawal}
                  onChange={(e) => setCfgMaxWithdrawal(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300"
                />
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Deposit Availability</div>
                  <div className="text-[11px] text-slate-500">Allow players to submit Telebirr deposits</div>
                </div>
                <input
                  type="checkbox"
                  checked={cfgDepositsEnabled}
                  onChange={(e) => setCfgDepositsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Withdrawal Availability</div>
                  <div className="text-[11px] text-slate-500">Allow players to submit Telebirr withdrawals</div>
                </div>
                <input
                  type="checkbox"
                  checked={cfgWithdrawalsEnabled}
                  onChange={(e) => setCfgWithdrawalsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
              </label>

              <div className="sm:col-span-2 flex items-center justify-between pt-1">
                <div className="text-[11px] text-slate-400">
                  {telebirrConfig?.updatedAt &&
                    `Last updated ${new Date(telebirrConfig.updatedAt).toLocaleString()}${
                      telebirrConfig.updatedBy ? ` by ${telebirrConfig.updatedBy}` : ''
                    }`}
                </div>
                <button
                  type="submit"
                  disabled={processingAction}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Save Telebirr Settings
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">Payment Verification Provider Adapters</h3>
                <p className="text-xs text-slate-500">
                  Pluggable verification adapters (credentials remain strictly in server environment variables).
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{providers.filter((p) => p.isEnabled).length} Active</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map((p) => (
                <div key={p.providerId} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">ID: {p.providerId}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        p.isConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.isConfigured ? 'LIVE CREDENTIALS' : 'API KEY REQUIRED'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={processingAction}
                      onClick={() => handleToggleProvider(p.providerId, { isEnabled: !p.isEnabled })}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        p.isEnabled
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                      }`}
                    >
                      {p.isEnabled ? 'Disable Provider' : 'Enable Provider'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. FINANCIAL REPORTS */}
      {activeSection === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
              <button
                type="button"
                onClick={handleRunReport}
                disabled={processingAction}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <FileBarChart className="w-3.5 h-3.5" />
                <span>Generate Report &amp; Reconcile</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleExportReportCsv}
              disabled={!report}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {report && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5 shadow-2xs">
                <div className="font-extrabold text-emerald-700 uppercase text-[10px]">Deposits Summary</div>
                <div className="text-lg font-black text-slate-900">{report.deposits.verifiedAmount.toFixed(2)} ETB</div>
                <div className="text-slate-600">Verified: {report.deposits.verifiedCount}</div>
                <div className="text-slate-500">Pending: {report.deposits.pendingCount} • Manual Review: {report.deposits.manualReviewCount}</div>
                <div className="text-rose-600">Failed / Rejected: {report.deposits.failedCount}</div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5 shadow-2xs">
                <div className="font-extrabold text-indigo-700 uppercase text-[10px]">Withdrawals Summary</div>
                <div className="text-lg font-black text-slate-900">{report.withdrawals.paidAmount.toFixed(2)} ETB</div>
                <div className="text-slate-600">Paid: {report.withdrawals.paidCount}</div>
                <div className="text-amber-700">
                  In Progress: {report.withdrawals.inProgressCount} ({report.withdrawals.inProgressAmount.toFixed(2)} ETB)
                </div>
                <div className="text-rose-600">
                  Rejected: {report.withdrawals.rejectedCount} • Failed: {report.withdrawals.failedCount}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5 shadow-2xs">
                <div className="font-extrabold text-purple-700 uppercase text-[10px]">Gaming Flow</div>
                <div className="text-lg font-black text-slate-900">{report.gaming.netGamingRevenue.toFixed(2)} ETB</div>
                <div className="text-slate-600">
                  Card Entries ({report.gaming.entryDebitsCount}): {report.gaming.entryDebitsAmount.toFixed(2)} ETB
                </div>
                <div className="text-slate-600">
                  Prize Payouts ({report.gaming.winCreditsCount}): {report.gaming.winCreditsAmount.toFixed(2)} ETB
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5 shadow-2xs">
                <div className="font-extrabold text-slate-700 uppercase text-[10px]">Net Payment &amp; Adjustments</div>
                <div className="text-lg font-black text-slate-900">{report.netPaymentFlow.toFixed(2)} ETB</div>
                <div className="text-slate-500">Deposits minus Paid Withdrawals</div>
                <div className="text-emerald-700">Admin Credits: +{report.adjustments.adminCreditsAmount.toFixed(2)} ETB</div>
                <div className="text-rose-700">Admin Debits: -{report.adjustments.adminDebitsAmount.toFixed(2)} ETB</div>
              </div>
            </div>
          )}

          {/* Wallet vs Ledger Reconciliation Table */}
          {reconciliation && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>Wallet vs Ledger Reconciliation</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                    reconciliation.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {reconciliation.isBalanced ? '100% BALANCED' : `${reconciliation.discrepancyCount} DISCREPANCIES`}
                </span>
              </div>
              <div className="text-slate-600">
                Verified {reconciliation.totalWalletsChecked} wallet(s) against immutable transaction history and active
                withdrawal reservations at {new Date(reconciliation.checkedAt).toLocaleString()}.
              </div>
              {reconciliation.discrepancies.length > 0 && (
                <div className="overflow-x-auto border border-rose-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-rose-50 text-rose-800 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">User ID</th>
                        <th className="px-3 py-2">Actual Avail / Res</th>
                        <th className="px-3 py-2">Expected Avail / Res</th>
                        <th className="px-3 py-2">Mismatch Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {reconciliation.discrepancies.map((disc) => (
                        <tr key={disc.walletId}>
                          <td className="px-3 py-2 font-mono font-bold">{disc.userId}</td>
                          <td className="px-3 py-2 font-mono">
                            {disc.actualAvailable.toFixed(2)} / {disc.actualReserved.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {disc.expectedAvailable.toFixed(2)} / {disc.expectedReserved.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-rose-700">{disc.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. FINANCIAL AUDIT LOGS */}
      {activeSection === 'audit' && (
        <div className="space-y-4">
          <h3 className="font-extrabold text-sm text-slate-800">Financial Audit Logs</h3>
          {auditLogs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              No financial audit logs recorded yet.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3.5 py-2.5">Timestamp</th>
                    <th className="px-3.5 py-2.5">Actor</th>
                    <th className="px-3.5 py-2.5">Action</th>
                    <th className="px-3.5 py-2.5">Entity</th>
                    <th className="px-3.5 py-2.5">Amount</th>
                    <th className="px-3.5 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3.5 py-2.5 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{log.actorId}</span>{' '}
                        <span className="text-[10px] text-slate-400">({log.actorRole})</span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {log.entityType}:{log.entityId}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                        {log.amount !== undefined ? `${log.amount.toFixed(2)} ETB` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 max-w-md">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: MULTI-STAGE WITHDRAWAL PROCESSING */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <span>Process Withdrawal</span>
                <span className="font-mono text-xs text-slate-400">({selectedWithdrawal.id})</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedWithdrawal(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Player:</span>
                  <strong className="text-slate-900">
                    {selectedWithdrawal.playerDisplayName || selectedWithdrawal.userId} ({selectedWithdrawal.userId})
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Withdrawal:</span>
                  <strong className="text-emerald-700 text-sm">{selectedWithdrawal.amount.toFixed(2)} ETB</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Wallet Available / Reserved:</span>
                  <strong className="font-mono text-slate-800">
                    {selectedWithdrawal.playerAvailableBalance.toFixed(2)} /{' '}
                    {selectedWithdrawal.playerReservedBalance.toFixed(2)} ETB
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telebirr Number:</span>
                  <strong className="font-mono text-slate-900">{selectedWithdrawal.accountIdentifier}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telebirr Account Name:</span>
                  <strong className="text-slate-900">{selectedWithdrawal.accountName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getWithdrawalBadge(selectedWithdrawal.status).cls}`}>
                    {getWithdrawalBadge(selectedWithdrawal.status).label}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Admin Note (Optional)</label>
                <input
                  type="text"
                  value={wdNote}
                  onChange={(e) => setWdNote(e.target.value)}
                  placeholder="Internal finance review note..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>

              {/* Stage Progress Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedWithdrawal.status === 'PENDING' && (
                  <button
                    type="button"
                    disabled={processingAction}
                    onClick={() => executeWithdrawalTransition('review')}
                    className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Move to Under Review
                  </button>
                )}
                {(selectedWithdrawal.status === 'PENDING' || selectedWithdrawal.status === 'UNDER_REVIEW') && (
                  <button
                    type="button"
                    disabled={processingAction}
                    onClick={() => executeWithdrawalTransition('approve')}
                    className="py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Approve Payout
                  </button>
                )}
                {selectedWithdrawal.status === 'APPROVED' && (
                  <button
                    type="button"
                    disabled={processingAction}
                    onClick={() => executeWithdrawalTransition('processing')}
                    className="py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Processing Payment
                  </button>
                )}
              </div>

              {/* Mark Paid (Available when APPROVED or PROCESSING; requires outgoing Telebirr Tx Ref) */}
              {(selectedWithdrawal.status === 'APPROVED' || selectedWithdrawal.status === 'PROCESSING') && (
                <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/50 space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Complete Transfer &amp; Mark Paid</span>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Outgoing Telebirr Transaction Reference <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={wdPaymentRef}
                      onChange={(e) => setWdPaymentRef(e.target.value)}
                      placeholder="Paste outgoing Telebirr Tx Ref (e.g. TB-OUT-948210)"
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={processingAction || !wdPaymentRef.trim()}
                    onClick={() => executeWithdrawalTransition('mark-paid')}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Record Reference &amp; Mark Paid
                  </button>
                </div>
              )}

              {/* Reject or Mark Failed (Releases reserved balance back to availableBalance exactly once) */}
              <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/50 space-y-2">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Reject or Mark Payout Failed (Refunds Reserved Funds)</span>
                </div>
                <input
                  type="text"
                  value={wdReason}
                  onChange={(e) => setWdReason(e.target.value)}
                  placeholder="Required reason (e.g. Name mismatch or Telebirr transfer error)"
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={processingAction || !wdReason.trim()}
                    onClick={() => executeWithdrawalTransition('reject')}
                    className="py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Reject &amp; Refund
                  </button>
                  <button
                    type="button"
                    disabled={processingAction || !wdReason.trim()}
                    onClick={() => executeWithdrawalTransition('fail')}
                    className="py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Mark Failed &amp; Refund
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedWithdrawal(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN REVIEW FLAGGED DEPOSIT */}
      {selectedDeposit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-indigo-950 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <span>Manual Deposit Review</span>
                <span className="font-mono text-xs text-indigo-300">({selectedDeposit.providerTransactionId})</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDeposit(null)}
                className="text-indigo-200 hover:text-white transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Player:</span>
                  <strong className="text-slate-900">
                    {selectedDeposit.playerDisplayName || selectedDeposit.userId} ({selectedDeposit.userId})
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Amount:</span>
                  <strong className="text-slate-900">{selectedDeposit.requestedAmount.toFixed(2)} ETB</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Received Amount:</span>
                  <strong className="text-emerald-700">
                    {(selectedDeposit.verifiedAmount ?? selectedDeposit.requestedAmount).toFixed(2)} ETB
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Provider Recipient Field:</span>
                  <strong className="font-mono text-slate-900">
                    {selectedDeposit.recipientAccount || 'Not provided / Masked'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Configured Receiving Account:</span>
                  <strong className="font-mono text-indigo-700">{telebirrConfig?.telebirrPhoneNumber || '—'}</strong>
                </div>
              </div>

              <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/50 space-y-2">
                <div className="font-bold text-emerald-900">Manual Approval (Audited)</div>
                <input
                  type="text"
                  value={depositReviewNote}
                  onChange={(e) => setDepositReviewNote(e.target.value)}
                  placeholder="Optional admin verification note"
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
                />
                <button
                  type="button"
                  onClick={handleApproveDeposit}
                  disabled={processingAction}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  Manually Approve &amp; Credit{' '}
                  {(selectedDeposit.verifiedAmount ?? selectedDeposit.requestedAmount).toFixed(2)} ETB
                </button>
              </div>

              <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/50 space-y-2">
                <div className="font-bold text-rose-900">Manual Rejection</div>
                <input
                  type="text"
                  value={depositRejectReason}
                  onChange={(e) => setDepositRejectReason(e.target.value)}
                  placeholder="Reason (required, e.g. Sent to wrong Telebirr account)"
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
                />
                <button
                  type="button"
                  onClick={handleRejectDeposit}
                  disabled={processingAction}
                  className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  Reject Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
