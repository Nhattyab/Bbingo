import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Trophy,
  Clock,
  Shield,
  ShieldAlert,
  AlertCircle,
  FileCheck,
  X,
} from 'lucide-react';
import { BingoClaim, GameSession } from '../../types/bingo';
import { WINNING_RULE_LABELS } from '../../utils/bingoRules';

interface ClaimsMonitoringTabProps {
  claims: (BingoClaim & { cardMatrix?: any; cardMarked?: any; isCardBlocked?: boolean })[];
  game: GameSession | null;
  onApproveClaim?: (claimId: string) => Promise<void>;
  onRejectClaim?: (claimId: string, reason: string, blockCard?: boolean) => Promise<void>;
  onConfirmWinner?: (claimId: string) => Promise<void>;
  onFinalizeGame?: () => Promise<void>;
  onResolveClaim: (claimId: string, action: 'confirm' | 'reject' | 'approve', reason?: string, blockCard?: boolean) => Promise<void>;
  onInspectCard: (cardId: string) => void;
  claimWindowSeconds?: number;
}

export function ClaimsMonitoringTab({
  claims,
  game,
  onApproveClaim,
  onRejectClaim,
  onConfirmWinner,
  onFinalizeGame,
  onResolveClaim,
  claimWindowSeconds,
}: ClaimsMonitoringTabProps) {
  // Modal states
  const [selectedClaimForReview, setSelectedClaimForReview] = useState<BingoClaim | null>(null);
  const [rejectingClaim, setRejectingClaim] = useState<BingoClaim | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('Pattern incomplete or contains uncalled numbers');
  const [alsoBlockCard, setAlsoBlockCard] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'confirmed' | 'rejected'>('all');

  const filteredClaims = claims.filter((cl) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') {
      return cl.status === 'pending' || cl.status === 'submitted' || cl.status === 'under_verification';
    }
    return cl.status === statusFilter;
  });

  const pendingCount = claims.filter(
    (c) => c.status === 'pending' || c.status === 'submitted' || c.status === 'under_verification'
  ).length;
  const approvedCount = claims.filter((c) => c.status === 'approved').length;
  const confirmedCount = claims.filter((c) => c.status === 'confirmed').length;

  const handleApprove = async (claimId: string) => {
    setActionLoading(true);
    try {
      if (onApproveClaim) {
        await onApproveClaim(claimId);
      } else {
        await onResolveClaim(claimId, 'approve');
      }
      if (selectedClaimForReview?.id === claimId) {
        setSelectedClaimForReview((prev) => (prev ? { ...prev, status: 'approved' } : null));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmWinnerAction = async (claimId: string) => {
    setActionLoading(true);
    try {
      if (onConfirmWinner) {
        await onConfirmWinner(claimId);
      } else {
        await onResolveClaim(claimId, 'confirm');
      }
      if (selectedClaimForReview?.id === claimId) {
        setSelectedClaimForReview((prev) => (prev ? { ...prev, status: 'confirmed' } : null));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteReject = async () => {
    if (!rejectingClaim) return;
    setActionLoading(true);
    try {
      if (onRejectClaim) {
        await onRejectClaim(rejectingClaim.id, rejectionReason, alsoBlockCard);
      } else {
        await onResolveClaim(rejectingClaim.id, 'reject', rejectionReason, alsoBlockCard);
      }
      if (selectedClaimForReview?.id === rejectingClaim.id) {
        setSelectedClaimForReview((prev) =>
          prev ? { ...prev, status: 'rejected', rejectionReason } : null
        );
      }
      setRejectingClaim(null);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to format called numbers
  const calledNumbersSet = new Set((game?.calledNumbers || []).map((b) => b.number));

  return (
    <div className="space-y-6">
      {/* Stage Banner: Checking Winning Cards & 15-second claim window */}
      {(game?.status === 'checking_winners' || game?.status === 'claim_review' || (claimWindowSeconds !== undefined && claimWindowSeconds > 0)) && (
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 text-white p-4 rounded-2xl shadow-md border border-purple-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shrink-0 border border-white/20">
              <Clock className="w-6 h-6 animate-spin text-purple-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="font-extrabold text-sm tracking-tight text-white">
                  Checking Winning Cards (Claim Window Active)
                </h3>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                Number calling is paused. Review player claims below, verify pattern eligibility, approve valid claims, and confirm official winners.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {claimWindowSeconds !== undefined && claimWindowSeconds > 0 && (
              <div className="flex items-center gap-2 bg-black/30 px-3.5 py-2 rounded-xl border border-white/20">
                <span className="text-[10px] uppercase font-bold text-purple-200">Window:</span>
                <span className="font-mono font-black text-lg text-amber-300 tabular-nums">
                  {claimWindowSeconds}s
                </span>
              </div>
            )}
            {confirmedCount > 0 && onFinalizeGame && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={onFinalizeGame}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>Finalize Game (30s)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Stats & Workflow Overview Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Claims</div>
          <div className="text-xl font-black text-slate-900 mt-1">{claims.length}</div>
        </div>

        <div
          onClick={() => setStatusFilter('pending')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Review</span>
            {pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
          </div>
          <div className="text-xl font-black text-amber-700 mt-1">{pendingCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('approved')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'approved'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Approved</div>
          <div className="text-xl font-black text-blue-700 mt-1">{approvedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('confirmed')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'confirmed'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Confirmed Winners</div>
          <div className="text-xl font-black text-emerald-700 mt-1">{confirmedCount}</div>
        </div>
      </div>

      {/* Main Claims Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Bingo Claims Activity</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Player submissions during this game. A claim requires automatic validation + administrator confirmation to win.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Claims ({claims.length})</option>
              <option value="pending">Pending Verification ({pendingCount})</option>
              <option value="approved">Approved Claims ({approvedCount})</option>
              <option value="confirmed">Confirmed Winners ({confirmedCount})</option>
              <option value="rejected">Rejected Claims</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Player & Game</th>
                <th className="px-4 py-3">Card ID</th>
                <th className="px-4 py-3">Claimed Pattern</th>
                <th className="px-4 py-3">Auto-Check</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3 text-right">Verification Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No claims match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredClaims.map((cl) => {
                  const isPending = cl.status === 'pending' || cl.status === 'submitted' || cl.status === 'under_verification';
                  const isApproved = cl.status === 'approved';
                  const isConfirmed = cl.status === 'confirmed';
                  const isRejected = cl.status === 'rejected';

                  const autoCheckValid = cl.autoVerification?.valid;

                  return (
                    <tr key={cl.id} className="hover:bg-slate-50/80 transition">
                      {/* Player & Game */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{cl.userName}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-mono">{cl.userId}</span>
                          <span>·</span>
                          <span>{new Date(cl.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </td>

                      {/* Card ID */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          {cl.cardId}
                        </span>
                      </td>

                      {/* Pattern */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800 block">
                          {WINNING_RULE_LABELS[cl.pattern] || cl.pattern}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Prize: ${(cl.prizeAmount || game?.totalPrizePool || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Auto-Verification Badge */}
                      <td className="px-4 py-3">
                        {autoCheckValid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Passed
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                            title={cl.autoVerification?.reason || 'Verification incomplete'}
                          >
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Incomplete
                          </span>
                        )}
                      </td>

                      {/* Review Status Badge */}
                      <td className="px-4 py-3">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Verification
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <FileCheck className="w-3 h-3 text-blue-600" />
                            Approved
                          </span>
                        )}
                        {isConfirmed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Confirmed Winner
                          </span>
                        )}
                        {isRejected && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                            title={cl.rejectionReason}
                          >
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedClaimForReview(cl)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer flex items-center gap-1"
                            title="Inspect complete 5x5 card and validation details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>

                          {isPending && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleApprove(cl.id)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition cursor-pointer"
                                title="Approve claim after review"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => setRejectingClaim(cl)}
                                className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-lg transition cursor-pointer"
                                title="Reject claim with recorded reason"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleConfirmWinnerAction(cl.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1"
                                title="Confirm official winner and award prize"
                              >
                                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                                <span>Confirm Winner</span>
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => setRejectingClaim(cl)}
                                className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-bold rounded-lg transition cursor-pointer"
                                title="Reject claim"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Inspect Complete Card & Review Claim Modal */}
      {selectedClaimForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">Review Claim & Inspect Card</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span>Card #{selectedClaimForReview.cardId}</span>
                    <span>·</span>
                    <span>Player: {selectedClaimForReview.userName}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaimForReview(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Claim Overview Info Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Claimed Pattern:</span>
                  <span className="font-bold text-slate-900">
                    {WINNING_RULE_LABELS[selectedClaimForReview.pattern] || selectedClaimForReview.pattern}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Claim Time:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(selectedClaimForReview.submittedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Review Status:</span>
                  <span className="font-bold capitalize">
                    {selectedClaimForReview.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Automatic Verification Result Box */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                  selectedClaimForReview.autoVerification?.valid
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                }`}
              >
                {selectedClaimForReview.autoVerification?.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold">
                    Automatic Verification:{' '}
                    {selectedClaimForReview.autoVerification?.valid ? 'PASSED' : 'FLAGGED / INCOMPLETE'}
                  </div>
                  <div className="text-[11px] mt-0.5 text-slate-700">
                    {selectedClaimForReview.autoVerification?.reason ||
                      'Automated pattern verification completed.'}
                  </div>
                  {selectedClaimForReview.autoVerification?.diagnostics && (
                    <div className="mt-1 text-[10px] text-slate-500 font-mono bg-white/70 p-1.5 rounded border border-slate-200">
                      {selectedClaimForReview.autoVerification.diagnostics}
                    </div>
                  )}
                </div>
              </div>

              {/* 5x5 Card Grid Display */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                    Full 5x5 Card Matrix
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Blue = Marked · Green Ring = Winning Pattern
                  </span>
                </div>

                {/* B-I-N-G-O Headers */}
                <div className="grid grid-cols-5 gap-1.5 mb-1.5 text-center font-black text-xs text-slate-700">
                  {['B', 'I', 'N', 'G', 'O'].map((h) => (
                    <div key={h} className="py-1 bg-slate-100 rounded-lg">
                      {h}
                    </div>
                  ))}
                </div>

                {/* Grid Cells */}
                {selectedClaimForReview.cardMatrix && (
                  <div className="grid grid-cols-5 gap-1.5">
                    {selectedClaimForReview.cardMatrix.map((row, r) =>
                      row.map((val, c) => {
                        const isFree = val === 'FREE';
                        const isMarked =
                          isFree || Boolean(selectedClaimForReview.cardMarked?.[r]?.[c]);
                        const isCalled = isFree || (typeof val === 'number' && calledNumbersSet.has(val));

                        // Check if this coordinate is part of winning coordinates
                        const isWinningCoord = selectedClaimForReview.autoVerification?.winningCoordinates?.some(
                          ([wr, wc]) => wr === r && wc === c
                        );

                        return (
                          <div
                            key={`${r}-${c}`}
                            className={`aspect-square flex flex-col items-center justify-center rounded-xl font-bold text-xs border relative transition ${
                              isWinningCoord
                                ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 shadow-md'
                                : isFree
                                ? 'bg-amber-100 border-amber-300 text-amber-900'
                                : isMarked
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                : isCalled
                                ? 'bg-blue-50 border-blue-200 text-blue-900'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <span>{isFree ? '★' : val}</span>
                            {isWinningCoord && (
                              <span className="text-[7px] uppercase font-bold text-emerald-200 mt-0.5">
                                WIN
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Called Numbers History Snapshot */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span>Called Balls at Claim Time:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {selectedClaimForReview.calledNumbersAtClaim?.length || game?.calledNumbers?.length || 0} Balls
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Last called:{' '}
                  {game?.calledNumbers && game.calledNumbers.length > 0 ? (
                    <span className="font-bold text-indigo-700">
                      {game.calledNumbers.slice(-5).map((b) => `${b.letter}-${b.number}`).join(', ')}
                    </span>
                  ) : (
                    'None'
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {(selectedClaimForReview.status === 'pending' ||
                  selectedClaimForReview.status === 'submitted') && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApprove(selectedClaimForReview.id)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Approve Claim
                  </button>
                )}

                {(selectedClaimForReview.status === 'approved' ||
                  selectedClaimForReview.status === 'pending') && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleConfirmWinnerAction(selectedClaimForReview.id)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    <span>Confirm Winner</span>
                  </button>
                )}

                {selectedClaimForReview.status !== 'rejected' &&
                  selectedClaimForReview.status !== 'confirmed' && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        setRejectingClaim(selectedClaimForReview);
                      }}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition cursor-pointer"
                    >
                      Reject...
                    </button>
                  )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedClaimForReview(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject Claim Modal with Reason Input & Optional Block Checkbox */}
      {rejectingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-4 bg-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-sm">Reject Bingo Claim</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingClaim(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                You are rejecting the claim submitted by{' '}
                <strong className="text-slate-900">{rejectingClaim.userName}</strong> for card{' '}
                <strong className="font-mono text-indigo-700">#{rejectingClaim.cardId}</strong>.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Recorded Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., Missing called numbers for horizontal line"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {[
                    'Uncalled numbers on card',
                    'Pattern incomplete',
                    'Card not eligible',
                    'Technical marking discrepancy',
                  ].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setRejectionReason(quick)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-[10px] cursor-pointer"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>

              {/* Requirement 5: Technical errors must not automatically result in card blocking */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="alsoBlockCardCheckbox"
                  checked={alsoBlockCard}
                  onChange={(e) => setAlsoBlockCard(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 cursor-pointer"
                />
                <label htmlFor="alsoBlockCardCheckbox" className="cursor-pointer">
                  <span className="font-bold text-slate-900 block">Also Block Card</span>
                  <span className="text-[11px] text-slate-500">
                    By default, false or technical claims do not block the card. Check this only for intentional abuse or invalid cards.
                  </span>
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingClaim(null)}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !rejectionReason.trim()}
                onClick={handleExecuteReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
