import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Edit2,
  Trash2,
  DollarSign,
  RotateCcw,
  RefreshCw,
  Trophy,
  Gamepad2,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { User } from '../../types/bingo';

export type UserWithStats = User & {
  cardsCount?: number;
  registeredCardsCount?: number;
  blockedCardsCount?: number;
};

interface UserManagementTabProps {
  users: UserWithStats[];
  currentUser: User | null;
  onRefresh: () => void;
}

export function UserManagementTab({
  users,
  currentUser,
  onRefresh,
}: UserManagementTabProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'player' | 'host' | 'admin'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'wins' | 'games'>('name');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithStats | null>(null);
  const [balanceUser, setBalanceUser] = useState<UserWithStats | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserWithStats | null>(null);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'player' | 'host' | 'admin'>('player');
  const [newBalance, setNewBalance] = useState('100.00');

  // Edit form states
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'player' | 'host' | 'admin'>('player');
  const [editBalance, setEditBalance] = useState('0');

  // Balance adjust states
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustAmount, setAdjustAmount] = useState('25.00');
  const [adjustReason, setAdjustReason] = useState('');

  // Status & action loading
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Filter and sort users
  const filteredUsers = users
    .filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      if (sortBy === 'balance') return (b.balance || 0) - (a.balance || 0);
      if (sortBy === 'wins') return (b.stats?.bingosWon || 0) - (a.stats?.bingosWon || 0);
      if (sortBy === 'games') return (b.stats?.gamesPlayed || 0) - (a.stats?.gamesPlayed || 0);
      return 0;
    });

  // Calculate summary metrics
  const totalUsersCount = users.length;
  const playersCount = users.filter((u) => u.role === 'player').length;
  const staffCount = users.filter((u) => u.role === 'host' || u.role === 'admin').length;
  const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);

  // Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newDisplayName.trim()) {
      showFeedback('Username and Display Name are required.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'usr-admin-1',
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          displayName: newDisplayName.trim(),
          email: newEmail.trim(),
          role: newRole,
          balance: parseFloat(newBalance) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user.');

      showFeedback(`User account "${data.user.displayName}" created successfully!`, 'success');
      setIsAddModalOpen(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewEmail('');
      setNewBalance('100.00');
      onRefresh();
    } catch (err: any) {
      showFeedback(err.message || 'Error creating user account.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (user: UserWithStats) => {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditBalance(user.balance.toString());
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'usr-admin-1',
        },
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          email: editEmail.trim(),
          role: editRole,
          balance: parseFloat(editBalance) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user.');

      showFeedback(`User "${data.user.displayName}" updated successfully!`, 'success');
      setEditingUser(null);
      onRefresh();
    } catch (err: any) {
      showFeedback(err.message || 'Error updating user.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceUser) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      showFeedback('Please enter a valid amount greater than 0.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${balanceUser.id}/adjust-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'usr-admin-1',
        },
        body: JSON.stringify({
          amount,
          type: adjustType,
          reason: adjustReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust balance.');

      showFeedback(
        `${adjustType === 'add' ? 'Credited' : 'Deducted'} $${amount.toFixed(2)} to ${balanceUser.displayName}! New balance: $${data.newBalance.toFixed(2)}`,
        'success'
      );
      setBalanceUser(null);
      setAdjustReason('');
      onRefresh();
    } catch (err: any) {
      showFeedback(err.message || 'Error adjusting balance.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetStats = async (user: UserWithStats) => {
    if (!window.confirm(`Are you sure you want to reset tournament gameplay stats for "${user.displayName}"?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'usr-admin-1',
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset stats.');

      showFeedback(`Stats reset for ${user.displayName}.`, 'success');
      onRefresh();
    } catch (err: any) {
      showFeedback(err.message || 'Error resetting stats.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'usr-admin-1',
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');

      showFeedback(`User account "${deletingUser.displayName}" permanently deleted.`, 'success');
      setDeletingUser(null);
      onRefresh();
    } catch (err: any) {
      showFeedback(err.message || 'Error deleting user.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400">Total Users</div>
            <div className="text-lg font-black text-slate-800">{totalUsersCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400">Players</div>
            <div className="text-lg font-black text-slate-800">{playersCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400">Hosts & Admins</div>
            <div className="text-lg font-black text-slate-800">{staffCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400">Total Balances</div>
            <div className="text-lg font-black text-emerald-700">${totalBalance.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Action / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, email..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-blue-600 transition"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <option value="all">All Roles ({users.length})</option>
            <option value="player">Players only</option>
            <option value="host">Hosts only</option>
            <option value="admin">Admins only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <option value="name">Sort by Name</option>
            <option value="balance">Sort by Balance</option>
            <option value="wins">Sort by Bingos Won</option>
            <option value="games">Sort by Games</option>
          </select>

          <button
            onClick={onRefresh}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Wallet Balance</th>
                <th className="px-4 py-3">Gameplay Stats</th>
                <th className="px-4 py-3">Active Cards</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentAdmin = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                              u.role === 'admin'
                                ? 'bg-purple-600'
                                : u.role === 'host'
                                ? 'bg-amber-600'
                                : 'bg-blue-600'
                            }`}
                          >
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.displayName}</span>
                              {isCurrentAdmin && (
                                <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded-full border border-slate-200">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              @{u.username} • {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'host'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>${(u.balance || 0).toFixed(2)}</span>
                          <button
                            onClick={() => {
                              setBalanceUser(u);
                              setAdjustAmount('25.00');
                              setAdjustType('add');
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                            title="Adjust Balance"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 text-[11px] text-slate-600">
                          <span className="flex items-center gap-1" title="Games Played">
                            <Gamepad2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{u.stats?.gamesPlayed || 0}</span>
                          </span>
                          <span className="flex items-center gap-1 text-amber-700 font-bold" title="Bingos Won">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span>{u.stats?.bingosWon || 0}</span>
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-600">
                        <span>{u.registeredCardsCount || 0} registered</span>
                        {Boolean(u.blockedCardsCount) && (
                          <span className="ml-1.5 text-rose-600 font-bold">
                            ({u.blockedCardsCount} blocked)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition cursor-pointer"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleResetStats(u)}
                            className="p-1.5 hover:bg-amber-50 text-slate-500 hover:text-amber-600 rounded-lg transition cursor-pointer"
                            title="Reset Gameplay Stats"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {!isCurrentAdmin && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* MODAL 1: ADD USER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm">Add New User Account</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. bingo_star"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Bingo Star"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. star@bingo.app"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-blue-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-600 transition cursor-pointer"
                  >
                    <option value="player">Player</option>
                    <option value="host">Host</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Balance ($)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-blue-600 transition"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'Creating...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm">Edit User: {editingUser.displayName}</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-blue-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-600 transition cursor-pointer"
                  >
                    <option value="player">Player</option>
                    <option value="host">Host</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Balance ($)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-blue-600 transition"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{actionLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADJUST BALANCE MODAL */}
      {balanceUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">Adjust Balance: {balanceUser.displayName}</h3>
              </div>
              <button
                onClick={() => setBalanceUser(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleAdjustBalance} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold">Current Balance:</span>
                <span className="font-mono font-bold text-sm text-slate-800">
                  ${(balanceUser.balance || 0).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      adjustType === 'add'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    + Add / Credit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      adjustType === 'deduct'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    - Deduct / Debit
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount ($) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Tournament bonus, manual payout..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-blue-600 transition"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 ${
                    adjustType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionLoading ? 'Updating...' : adjustType === 'add' ? 'Credit Funds' : 'Deduct Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-300" />
                <h3 className="font-bold text-sm">Delete User Account</h3>
              </div>
              <button
                onClick={() => setDeletingUser(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently delete{' '}
                <span className="font-bold text-slate-900">{deletingUser.displayName}</span> (@{deletingUser.username})?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] leading-relaxed">
                This action cannot be undone. All user data, account credentials, and active sessions will be terminated immediately.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
