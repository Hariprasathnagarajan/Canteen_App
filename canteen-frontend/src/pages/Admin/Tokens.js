import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, 
  Users, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Sun, 
  Sunset, 
  Moon, 
  SlidersHorizontal,
  Info,
  Check,
  AlertTriangle,
  X,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  Printer,
  Building2,
  History,
  Eye,
  Clock,
  Wallet,
  TrendingDown,
  Lock,
  Save,
  ChevronDown,
  ChevronUp,
  Filter,
  RotateCcw,
  FileText,
  XCircle
} from 'lucide-react';
import { adminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { useApi } from '../../hooks/useApi';
import SectionHeading from '../../components/canteen/SectionHeading';
import TokenPill from '../../components/canteen/TokenPill';
import EmptyState from '../../components/canteen/EmptyState';

const SHIFT_CONFIGS = {
  day_shift: {
    id: 'day',
    key: 'day_shift',
    name: 'Day Shift',
    icon: Sun,
    badgeColor: 'bg-cobalt-50 text-cobalt-800 border-cobalt-200/80',
    iconBg: 'bg-cobalt-100 text-cobalt-700',
    accentBorder: 'border-cobalt-200/70',
    headerGradient: 'from-cobalt-500/10 via-cobalt-50/20 to-transparent'
  },
  mid_shift: {
    id: 'mid',
    key: 'mid_shift',
    name: 'Mid Shift',
    icon: Sunset,
    badgeColor: 'bg-slate-50 text-slate-800 border-slate-200/80',
    iconBg: 'bg-slate-100 text-slate-700',
    accentBorder: 'border-slate-200/70',
    headerGradient: 'from-slate-500/10 via-slate-50/20 to-transparent'
  },
  night_shift: {
    id: 'night',
    key: 'night_shift',
    name: 'Night Shift',
    icon: Moon,
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300/80',
    iconBg: 'bg-slate-200 text-slate-800',
    accentBorder: 'border-slate-300/70',
    headerGradient: 'from-slate-600/10 via-slate-50/20 to-transparent'
  }
};

const defaultTokenData = {
  day_shift: { users: [], total_tokens: 0, total_distributed: 0, total_spent: 0, total_unused: 0, quota_per_user: 0 },
  mid_shift: { users: [], total_tokens: 0, total_distributed: 0, total_spent: 0, total_unused: 0, quota_per_user: 0 },
  night_shift: { users: [], total_tokens: 0, total_distributed: 0, total_spent: 0, total_unused: 0, quota_per_user: 0 }
};

const AdminTokens = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.is_superuser;

  // Primary active tab: 'allocation' (Current Cycle & Controls) | 'history' (Monthly Allocation History)
  const [activeTab, setActiveTab] = useState('allocation');

  const [tokenData, setTokenData] = useState(defaultTokenData);
  const [assigningShift, setAssigningShift] = useState(null); // 'day' | 'mid' | 'night' | 'all' | null
  const [togglingMode, setTogglingMode] = useState(false);

  // Policy Settings (Super Admin Configurable)
  const [settings, setSettings] = useState({
    monthly_token_allocation_mode: 'automatic',
    day_shift_policy_quota: 100,
    mid_shift_policy_quota: 100,
    night_shift_policy_quota: 100,
    day_shift_daily_limit: 300,
    mid_shift_daily_limit: 250,
    night_shift_daily_limit: 300,
    token_allocation_day: 20,
    reminder_days_before_reset: 3,
    shift_reset_mode: 'shift_based'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Monthly Token Reset Approval Modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvingReset, setApprovingReset] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalQuotas, setApprovalQuotas] = useState({ day: '', mid: '', night: '' });

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingReset, setRejectingReset] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Individual user transaction modal state
  const [selectedUserForHistory, setSelectedUserForHistory] = useState(null);
  const [userHistoryData, setUserHistoryData] = useState(null);
  const [loadingUserHistory, setLoadingUserHistory] = useState(false);
  
  // Custom tokens per shift — for manual allocation mode
  const [customTokens, setCustomTokens] = useState({
    day: '',
    mid: '',
    night: ''
  });

  // Confirmation modal state for manual allocations
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    shift: null, // 'day' | 'mid' | 'night' | 'all'
    tokens: null,
    userCount: 0,
    title: '',
    description: ''
  });

  // Roster search and shift filter
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterShiftFilter, setRosterShiftFilter] = useState('all');

  // Allocation History State
  const [historyData, setHistoryData] = useState({
    cycles: [],
    audit_logs: [],
    available_cycle_starts: []
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    cycle: '',
    shift: '',
    mode: '',
    status: ''
  });
  const [expandedCycles, setExpandedCycles] = useState({});
  const [expandedUserTables, setExpandedUserTables] = useState({});

  const today = new Date();
  const currentMonthName = today.toLocaleString('default', { month: 'long' });

  // API hook for summary
  const { 
    loading, 
    callApi: fetchTokenSummary,
    data: apiData
  } = useApi({
    initialData: defaultTokenData,
    defaultErrorMessage: 'Failed to load token summary',
    logRequests: false,
    skipIfLoading: false
  });

  const { callApi: fetchAssignTokens } = useApi({
    defaultErrorMessage: 'Failed to assign tokens',
    logRequests: false,
    skipIfLoading: true
  });

  // Sync tokenData from apiData
  useEffect(() => {
    if (!apiData) return;
    setTokenData({
      day_shift: {
        users: Array.isArray(apiData.day_shift?.users) ? apiData.day_shift.users : [],
        total_tokens: apiData.day_shift?.total_tokens || 0,
        total_distributed: apiData.day_shift?.total_distributed || 0,
        total_spent: apiData.day_shift?.total_spent || 0,
        total_unused: apiData.day_shift?.total_unused || apiData.day_shift?.total_tokens || 0,
        quota_per_user: apiData.day_shift?.quota_per_user ?? 100
      },
      mid_shift: {
        users: Array.isArray(apiData.mid_shift?.users) ? apiData.mid_shift.users : [],
        total_tokens: apiData.mid_shift?.total_tokens || 0,
        total_distributed: apiData.mid_shift?.total_distributed || 0,
        total_spent: apiData.mid_shift?.total_spent || 0,
        total_unused: apiData.mid_shift?.total_unused || apiData.mid_shift?.total_tokens || 0,
        quota_per_user: apiData.mid_shift?.quota_per_user ?? 100
      },
      night_shift: {
        users: Array.isArray(apiData.night_shift?.users) ? apiData.night_shift.users : [],
        total_tokens: apiData.night_shift?.total_tokens || 0,
        total_distributed: apiData.night_shift?.total_distributed || 0,
        total_spent: apiData.night_shift?.total_spent || 0,
        total_unused: apiData.night_shift?.total_unused || apiData.night_shift?.total_tokens || 0,
        quota_per_user: apiData.night_shift?.quota_per_user ?? 100
      }
    });

    // Initialize custom tokens with active company policy quotas
    // STRICT RULE: Only prefill if customTokens is currently blank.
    // The quota_per_user comes from CanteenSetting policy, NEVER previous month's actuals.
    setCustomTokens(prev => ({
      day: prev.day !== '' ? prev.day : (apiData.day_shift?.quota_per_user ?? 100),
      mid: prev.mid !== '' ? prev.mid : (apiData.mid_shift?.quota_per_user ?? 100),
      night: prev.night !== '' ? prev.night : (apiData.night_shift?.quota_per_user ?? 100)
    }));
  }, [apiData]);

  // Load summary on mount
  const loadSummary = useCallback(async () => {
    const result = await fetchTokenSummary(adminAPI.getTokenSummary);
    if (result?.error) {
      toast.error(result.error || 'Failed to load token summary.');
    }
  }, [fetchTokenSummary]);

  // Load canteen settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await adminAPI.getSettings();
      if (res?.data) {
        setSettings({
          monthly_token_allocation_mode: res.data.monthly_token_allocation_mode || 'automatic',
          day_shift_policy_quota: res.data.day_shift_policy_quota ?? 100,
          mid_shift_policy_quota: res.data.mid_shift_policy_quota ?? 100,
          night_shift_policy_quota: res.data.night_shift_policy_quota ?? 100,
          day_shift_daily_limit: res.data.day_shift_daily_limit ?? 300,
          mid_shift_daily_limit: res.data.mid_shift_daily_limit ?? 250,
          night_shift_daily_limit: res.data.night_shift_daily_limit ?? 300,
          token_allocation_day: res.data.token_allocation_day ?? 20,
          reminder_days_before_reset: res.data.reminder_days_before_reset ?? 3,
          shift_reset_mode: res.data.shift_reset_mode || 'shift_based'
        });
      }
    } catch (err) {
      console.error('Failed to load canteen settings', err);
    }
  }, []);

  // Load history records
  const loadHistory = useCallback(async (customParams = null) => {
    setLoadingHistory(true);
    try {
      const params = customParams || historyFilters;
      // Filter out empty params
      const cleanParams = {};
      Object.keys(params).forEach(k => {
        if (params[k]) cleanParams[k] = params[k];
      });
      const res = await adminAPI.getAllocationHistory(cleanParams);
      if (res?.data) {
        setHistoryData(res.data);
      }
    } catch (err) {
      console.error('Failed to load allocation history', err);
      toast.error('Failed to load allocation history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilters]);

  // Load initial data
  useEffect(() => {
    loadSummary();
    loadSettings();
  }, [loadSummary, loadSettings]);

  // When switching to History tab, load history if empty
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const resetApprovalInfo = apiData?.reset_approval_info;
  const isAutomaticMode = (settings.monthly_token_allocation_mode || resetApprovalInfo?.allocation_mode) === 'automatic';

  // Toggle Automatic Mode (Super Admin Only)
  const handleToggleMode = async () => {
    if (!isSuperAdmin) {
      toast.error('Only Super Admin is authorized to change the allocation mode.');
      return;
    }
    const newMode = isAutomaticMode ? 'manual' : 'automatic';
    setTogglingMode(true);
    try {
      await adminAPI.setAllocationMode(newMode);
      setSettings(prev => ({ ...prev, monthly_token_allocation_mode: newMode }));
      toast.success(
        newMode === 'automatic'
          ? 'Monthly Token Allocation Mode switched to AUTOMATIC.'
          : 'Monthly Token Allocation Mode switched to MANUAL.'
      );
      await loadSummary();
      await loadSettings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update allocation mode.');
    } finally {
      setTogglingMode(false);
    }
  };

  // Save Shift Policy Quotas & Daily Limits (Super Admin Only)
  const handleSaveShiftPolicy = async (e) => {
    if (e) e.preventDefault();
    if (!isSuperAdmin) {
      toast.error('Only Super Admin is authorized to modify token policies.');
      return;
    }
    setSavingSettings(true);
    try {
      await adminAPI.updateSettings({
        day_shift_policy_quota: Number(settings.day_shift_policy_quota) || 100,
        mid_shift_policy_quota: Number(settings.mid_shift_policy_quota) || 100,
        night_shift_policy_quota: Number(settings.night_shift_policy_quota) || 100,
        day_shift_daily_limit: Number(settings.day_shift_daily_limit) || 300,
        mid_shift_daily_limit: Number(settings.mid_shift_daily_limit) || 250,
        night_shift_daily_limit: Number(settings.night_shift_daily_limit) || 300,
        token_allocation_day: Math.min(28, Math.max(1, Number(settings.token_allocation_day) || 20)),
        reminder_days_before_reset: Math.min(14, Math.max(1, Number(settings.reminder_days_before_reset) || 3)),
        shift_reset_mode: settings.shift_reset_mode || 'shift_based',
      });
      toast.success('Token policy quotas and schedule updated successfully!');
      await loadSettings();
      await loadSummary();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update shift policy.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Reset editable inputs to default policy quotas
  const handleResetInputsToPolicy = () => {
    setCustomTokens({
      day: settings.day_shift_policy_quota || 100,
      mid: settings.mid_shift_policy_quota || 100,
      night: settings.night_shift_policy_quota || 100
    });
    toast.info('Shift inputs reset to saved policy quotas.');
  };

  // Open Approval Modal
  const handleOpenApprovalModal = () => {
    if (!isSuperAdmin) {
      toast.error('Only Super Admin is authorized to review and approve token resets.');
      return;
    }
    const prop = resetApprovalInfo?.proposal?.shift_breakdown;
    setApprovalQuotas({
      day: prop?.day?.policy_quota ?? (settings.day_shift_policy_quota || 100),
      mid: prop?.mid?.policy_quota ?? (settings.mid_shift_policy_quota || 100),
      night: prop?.night?.policy_quota ?? (settings.night_shift_policy_quota || 100),
    });
    setApprovalNotes('');
    setShowApprovalModal(true);
  };

  // Execute Approval
  const handleExecuteApproval = async () => {
    if (!isSuperAdmin) {
      toast.error('Only Super Admin is authorized to approve token distribution.');
      return;
    }
    setApprovingReset(true);
    try {
      const payload = {
        quotas: {
          day: Number(approvalQuotas.day) || 0,
          mid: Number(approvalQuotas.mid) || 0,
          night: Number(approvalQuotas.night) || 0,
        },
        notes: approvalNotes
      };
      const res = await adminAPI.approveTokenReset(payload);
      toast.success(res.data?.message || 'Monthly tokens approved and distributed successfully!');
      setShowApprovalModal(false);
      await loadSummary();
      if (activeTab === 'history') await loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to approve token reset');
    } finally {
      setApprovingReset(false);
    }
  };

  // Reject Proposal
  const handleExecuteRejection = async () => {
    if (!isSuperAdmin) {
      toast.error('Only Super Admin is authorized to reject token resets.');
      return;
    }
    setRejectingReset(true);
    try {
      const res = await adminAPI.rejectTokenReset({ notes: rejectionNotes });
      toast.info(res.data?.message || 'Token reset proposal rejected.');
      setShowRejectModal(false);
      setRejectionNotes('');
      await loadSummary();
      if (activeTab === 'history') await loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to reject token reset');
    } finally {
      setRejectingReset(false);
    }
  };

  // Overall metrics accounting
  const overallMetrics = useMemo(() => {
    if (apiData?.overall) {
      return {
        distributed: apiData.overall.total_distributed || 0,
        spent: apiData.overall.total_spent || 0,
        unused: apiData.overall.total_unused || 0,
        users: apiData.overall.total_users || 0,
        month: apiData.overall.month || `${currentMonthName} ${today.getFullYear()}`
      };
    }
    let dist = 0, spent = 0, unused = 0, count = 0;
    ['day_shift', 'mid_shift', 'night_shift'].forEach((key) => {
      const shiftObj = tokenData[key];
      if (shiftObj) {
        dist += shiftObj.total_distributed || 0;
        spent += shiftObj.total_spent || 0;
        unused += shiftObj.total_unused || shiftObj.total_tokens || 0;
        count += (shiftObj.users?.length || 0);
      }
    });
    return {
      distributed: dist,
      spent: spent,
      unused: unused,
      users: count,
      month: `${currentMonthName} ${today.getFullYear()}`
    };
  }, [apiData, tokenData, currentMonthName, today]);

  const totalEmployees = useMemo(() => {
    return overallMetrics.users || (
      (tokenData.day_shift?.users?.length || 0) +
      (tokenData.mid_shift?.users?.length || 0) +
      (tokenData.night_shift?.users?.length || 0)
    );
  }, [overallMetrics.users, tokenData]);

  // Open individual user transaction history
  const handleOpenUserHistory = async (userObj) => {
    setSelectedUserForHistory(userObj);
    setUserHistoryData(null);
    setLoadingUserHistory(true);
    try {
      const res = await adminAPI.getUserTokenTransactions(userObj.id);
      setUserHistoryData(res.data);
    } catch (err) {
      toast.error(`Failed to load transaction history for ${userObj.name || userObj.username}`);
    } finally {
      setLoadingUserHistory(false);
    }
  };

  // Parse a shift's token input — allocation requires an explicit amount
  const parseTokenInput = (shiftId) => {
    const raw = customTokens[shiftId];
    if (raw === '' || raw === null || raw === undefined) return null;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return Math.floor(amount);
  };

  // Handle open confirmation modal (Super Admin Only)
  const openConfirmModal = (shiftKey) => {
    if (!isSuperAdmin) {
      toast.error('Monthly reset token quotas can only be assigned by Super Admin.');
      return;
    }
    if (shiftKey === 'all') {
      const amounts = {
        day: parseTokenInput('day'),
        mid: parseTokenInput('mid'),
        night: parseTokenInput('night')
      };
      const missing = Object.entries(amounts)
        .filter(([, amount]) => amount === null)
        .map(([id]) => SHIFT_CONFIGS[`${id}_shift`].name);
      if (missing.length) {
        toast.error(`Enter a token amount for: ${missing.join(', ')}.`);
        return;
      }
      setConfirmModal({
        isOpen: true,
        shift: 'all',
        tokens: amounts,
        userCount: totalEmployees,
        title: 'Manually Allocate Tokens to All Shifts',
        description: `This will manually allocate monthly tokens for ${totalEmployees} total personnel — Day (${amounts.day} tk), Mid (${amounts.mid} tk), and Night (${amounts.night} tk) — for the current billing cycle.`
      });
      return;
    }

    const cfg = SHIFT_CONFIGS[shiftKey];
    const count = tokenData[shiftKey]?.users?.length || 0;
    const tokensToAssign = parseTokenInput(cfg.id);
    if (tokensToAssign === null) {
      toast.error(`Enter the token amount for ${cfg.name} first.`);
      return;
    }
    setConfirmModal({
      isOpen: true,
      shift: cfg.id,
      tokens: tokensToAssign,
      userCount: count,
      title: `Manually Allocate Tokens for ${cfg.name}`,
      description: `This will manually assign ${tokensToAssign} tokens each to ${count} active diners in ${cfg.name} for the current billing cycle.`
    });
  };

  // Perform actual assignment (Super Admin Only)
  const handleExecuteAssignment = async () => {
    if (!isSuperAdmin) {
      toast.error('Only Super Admin is authorized to execute token allocation.');
      return;
    }
    const { shift, tokens } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    setAssigningShift(shift);

    try {
      let result;
      if (shift === 'all') {
        result = await fetchAssignTokens(() => adminAPI.assignAllTokens(tokens));
      } else {
        result = await fetchAssignTokens(() => adminAPI.assignTokens(shift, tokens));
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success(
        result?.data?.message || 
        (shift === 'all' 
          ? `All shift tokens assigned successfully!` 
          : `Tokens allocated successfully for ${shift} shift!`)
      );

      await loadSummary();
      if (activeTab === 'history') await loadHistory();
    } catch (error) {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to assign tokens';
      toast.error(errorMessage);
    } finally {
      setAssigningShift(null);
    }
  };

  const [showAuditModal, setShowAuditModal] = useState(false);

  // Helper to safely format cell content and prevent CSV/formula injection
  const escapeCSVCell = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return val;
    let str = String(val);
    // Formula injection mitigation (cells starting with =, +, -, @, or tabs)
    if (/^[=+@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  // Export current roster to CSV
  const handleExportCSV = () => {
    try {
      const rows = [];
      rows.push(['VDART CAFE - CORPORATE TOKEN ALLOCATION AUDIT REPORT']);
      rows.push([`Generated On: ${new Date().toLocaleString()}`, `Billing Cycle: ${resetApprovalInfo?.billing_cycle?.cycle_label || overallMetrics.month}`]);
      rows.push([
        `Total Personnel: ${overallMetrics.users}`, 
        `Total Distributed: ${overallMetrics.distributed} tk`,
        `Total Spent: ${overallMetrics.spent} tk`,
        `Total Unused: ${overallMetrics.unused} tk`
      ]);
      rows.push([]);
      rows.push(['User ID', 'Full Name', 'Username', 'Email', 'Role', 'Work Shift', 'Tokens Distributed (tk)', 'Tokens Spent (tk)', 'Unused Balance (tk)', 'Orders This Month', 'Status']);

      const shifts = [
        { key: 'day_shift', name: 'Day Shift' },
        { key: 'mid_shift', name: 'Mid Shift' },
        { key: 'night_shift', name: 'Night Shift' },
      ];

      shifts.forEach(({ key, name }) => {
        const users = tokenData[key]?.users || [];
        users.forEach((u) => {
          rows.push([
            u.user_id || 'N/A',
            u.name || u.username || '',
            u.username || '',
            u.email || '',
            (u.role || 'employee').toUpperCase(),
            name,
            u.tokens_distributed ?? 0,
            u.tokens_spent ?? 0,
            u.tokens_unused ?? u.tokens ?? 0,
            u.month_orders_count ?? 0,
            (u.tokens_unused ?? u.tokens ?? 0) > 0 ? 'Active' : 'Depleted'
          ]);
        });
      });

      const csvContent = rows.map((r) => r.map(escapeCSVCell).join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VDart_Cafe_Token_Audit_${today.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Token roster exported to CSV successfully!');
    } catch (err) {
      toast.error('Failed to export CSV report');
    }
  };

  // Export 13-column History to CSV
  const handleExportHistoryCSV = () => {
    try {
      const rows = [];
      rows.push(['VDART CAFE - MONTHLY ALLOCATION HISTORICAL AUDIT LEDGER']);
      rows.push([`Generated On: ${new Date().toLocaleString()}`]);
      rows.push([]);
      // 13 Columns
      rows.push([
        'Billing Cycle',
        'Allocation Mode',
        'Shift',
        'Eligible Personnel',
        'Policy Quota (tk/diner)',
        'Proposed Allocation (tk)',
        'Actual Allocated Tokens (tk)',
        'Tokens Spent (tk)',
        'Unused / Expired Tokens (tk)',
        'Allocation Status',
        'Approved By',
        'Approved At',
        'Allocated At'
      ]);

      (historyData.cycles || []).forEach((c) => {
        const shifts = c.shift_breakdown || {};
        ['day_shift', 'mid_shift', 'night_shift'].forEach((sk) => {
          const s = shifts[sk] || {};
          rows.push([
            c.cycle_label || `${c.cycle_start} to ${c.cycle_end}`,
            (c.allocation_mode || 'automatic').toUpperCase(),
            s.name || sk,
            s.eligible_count ?? 0,
            s.policy_quota ?? 100,
            s.proposed_tokens ?? 0,
            s.actual_allocated_tokens ?? 0,
            s.tokens_spent ?? 0,
            s.tokens_unused ?? 0,
            (c.status || 'Allocated').toUpperCase(),
            c.approved_by || '—',
            c.approved_at || '—',
            c.allocated_at || '—'
          ]);
        });
      });

      const csvContent = rows.map((r) => r.map(escapeCSVCell).join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VDart_Cafe_Monthly_Allocation_History_${today.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Historical allocation ledger exported to CSV!');
    } catch (err) {
      toast.error('Failed to export historical CSV');
    }
  };

  // Filter roster
  const filteredRoster = useMemo(() => {
    const list = [];
    ['day_shift', 'mid_shift', 'night_shift'].forEach(sk => {
      if (rosterShiftFilter !== 'all' && rosterShiftFilter !== sk) return;
      const users = tokenData[sk]?.users || [];
      users.forEach(u => {
        list.push({ ...u, shiftKey: sk, shiftName: SHIFT_CONFIGS[sk].name });
      });
    });

    if (!rosterSearch.trim()) return list;
    const q = rosterSearch.toLowerCase();
    return list.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.user_id && String(u.user_id).toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [tokenData, rosterSearch, rosterShiftFilter]);

  const toggleCycleExpand = (cycleKey) => {
    setExpandedCycles(prev => ({
      ...prev,
      [cycleKey]: !prev[cycleKey]
    }));
  };

  const toggleUserTableExpand = (cycleKey) => {
    setExpandedUserTables(prev => ({
      ...prev,
      [cycleKey]: !prev[cycleKey]
    }));
  };

  const cycleInfo = resetApprovalInfo?.billing_cycle;
  const proposal = resetApprovalInfo?.proposal;

  return (
    <div className="space-y-6 pb-24">
      {/* Header with Title and Global Actions */}
      <SectionHeading
        kicker="VDart Cafe Administration"
        title="Monthly Token Allocation & Governance"
        hint="Manage corporate monthly canteen allowances, automated reset policies, and historical allocation ledgers."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-export-csv"
              onClick={activeTab === 'history' ? handleExportHistoryCSV : handleExportCSV}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-ink shadow-sm transition hover:bg-slate-50 cursor-pointer"
              title="Download CSV spreadsheet"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              id="btn-audit-report"
              onClick={() => setShowAuditModal(true)}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-ink shadow-sm transition hover:bg-slate-50 cursor-pointer"
              title="Print official corporate token audit report"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              <span className="hidden sm:inline">Audit Report</span>
            </button>
            <button
              id="btn-refresh"
              onClick={() => {
                loadSummary();
                loadSettings();
                if (activeTab === 'history') loadHistory();
              }}
              disabled={loading || loadingHistory}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              title="Refresh token balances"
            >
              <RefreshCw className={`h-4 w-4 text-ink-mute ${(loading || loadingHistory) ? 'animate-spin text-cobalt-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      {/* Tab Navigation: Allocation Controls vs Monthly Allocation History */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          id="tab-allocation-controls"
          onClick={() => setActiveTab('allocation')}
          className={`btn-tactile inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'allocation'
              ? 'bg-cobalt-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Coins className="h-4 w-4" />
          <span>Active Allocation & Controls</span>
        </button>
        <button
          id="tab-allocation-history"
          onClick={() => setActiveTab('history')}
          className={`btn-tactile inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'history'
              ? 'bg-cobalt-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Monthly Allocation History</span>
          {historyData.cycles?.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {historyData.cycles.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'allocation' ? (
        <>
          {/* SECTION 1: PROMINENT MONTHLY TOKEN ALLOCATION MODE CARD */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/50 to-cobalt-50/20 p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Configuration & Governance
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black tracking-wide ${
                    isAutomaticMode 
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${isAutomaticMode ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
                    MODE: {isAutomaticMode ? 'AUTOMATIC (ACTIVE)' : 'MANUAL (ACTIVE)'}
                  </span>
                  {isSuperAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      Super Admin Managed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                      <Lock className="h-3 w-3 text-slate-500" />
                      Read-Only (Super Admin Required)
                    </span>
                  )}
                </div>

                <h3 className="text-lg sm:text-xl font-black text-ink tracking-tight">
                  Monthly Token Allocation Mode
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {isAutomaticMode ? (
                    <>
                      <strong>Automatic Mode is ACTIVE.</strong> The system automatically calculates monthly token quotas for 
                      each shift (Day, Mid, Night) based on active policy, creates an advance proposal for Super Admin review, and 
                      credits diner wallets on the scheduled billing cycle date (20th of the month) once approved.
                    </>
                  ) : (
                    <>
                      <strong>Manual Mode is ACTIVE.</strong> Scheduled automated allocation is disabled. The system will NOT 
                      distribute tokens automatically. Super Admin must manually configure and trigger token distribution for 
                      each shift or diner.
                    </>
                  )}
                </p>

                {/* Billing Cycle Dates & Status Pill Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Cycle</span>
                    <span className="text-xs font-bold text-ink mt-0.5 block truncate" title={cycleInfo?.cycle_label || '20th to 19th'}>
                      {cycleInfo?.cycle_label || '20th to 19th'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Next Run Date</span>
                    <span className="text-xs font-bold text-cobalt-700 mt-0.5 block">
                      {cycleInfo?.next_allocation_run_date || 'Day 20'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Last Successful Run</span>
                    <span className="text-xs font-bold text-slate-700 mt-0.5 block">
                      {cycleInfo?.last_successful_allocation_date || 'None'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Approval Status</span>
                    <span className={`text-xs font-bold mt-0.5 block capitalize ${
                      resetApprovalInfo?.status === 'approved' 
                        ? 'text-emerald-700' 
                        : resetApprovalInfo?.status === 'rejected'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}>
                      {resetApprovalInfo?.status === 'approved' 
                        ? 'Approved & Allocated' 
                        : resetApprovalInfo?.status === 'rejected'
                        ? 'Proposal Rejected'
                        : 'Awaiting Approval'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mode Toggle Switch Control */}
              <div className="flex flex-col items-start lg:items-end gap-3 shrink-0 self-start lg:self-center border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
                <span className="text-xs font-bold text-slate-700">Toggle Allocation Mode:</span>
                
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black ${!isAutomaticMode ? 'text-amber-700' : 'text-slate-400'}`}>
                    Manual
                  </span>
                  
                  <button
                    id="toggle-allocation-mode"
                    type="button"
                    role="switch"
                    aria-checked={isAutomaticMode}
                    onClick={handleToggleMode}
                    disabled={!isSuperAdmin || togglingMode}
                    title={!isSuperAdmin ? 'Only Super Admin can change allocation mode' : `Switch to ${isAutomaticMode ? 'Manual' : 'Automatic'} mode`}
                    className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isAutomaticMode ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className="sr-only">Toggle Monthly Token Allocation Mode</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isAutomaticMode ? 'translate-x-8' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  <span className={`text-xs font-black ${isAutomaticMode ? 'text-emerald-700' : 'text-slate-400'}`}>
                    Automatic
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 text-left lg:text-right max-w-xs">
                  {isSuperAdmin 
                    ? 'Click switch to toggle between Automatic approval-based scheduling and Manual on-demand allocation.'
                    : 'Only Super Admin can toggle between Automatic and Manual allocation modes.'}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: PROPOSAL & APPROVAL STATUS (When in Automatic Mode) */}
          {isAutomaticMode && (
            <div className={`overflow-hidden rounded-3xl border p-5 shadow-sm transition-all ${
              resetApprovalInfo?.is_approved
                ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white text-slate-900'
                : 'border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/40 to-white text-slate-900'
            }`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-2xs border ${
                    resetApprovalInfo?.is_approved
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border-amber-200'
                  }`}>
                    {resetApprovalInfo?.is_approved ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                    ) : (
                      <Clock className="h-6 w-6 text-amber-700" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-base text-slate-900">
                        {resetApprovalInfo?.is_approved
                          ? 'Current Billing Cycle Allocation: Approved & Distributed'
                          : 'Upcoming Billing Cycle Allocation: Awaiting Super Admin Approval'}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        resetApprovalInfo?.is_approved
                          ? 'bg-emerald-200/80 text-emerald-950'
                          : 'bg-amber-200/80 text-amber-950'
                      }`}>
                        {resetApprovalInfo?.is_approved ? 'Status: Approved' : 'Action Required: Review Proposal'}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-700 leading-relaxed max-w-3xl">
                      {resetApprovalInfo?.is_approved ? (
                        <>
                          Tokens for the active cycle have been distributed to diner accounts according to the approved proposal. 
                          {resetApprovalInfo.approval_record?.approved_by && (
                            <span> Approved by <strong>{resetApprovalInfo.approval_record.approved_by}</strong> on {resetApprovalInfo.approval_record.approved_at}.</span>
                          )}
                        </>
                      ) : (
                        <>
                          Under Automatic Mode, monthly token distribution is approval-gated. 
                          The proposal below is calculated based on active company shift policy quotas for <strong>{proposal?.total_eligible_diners ?? totalEmployees} eligible personnel</strong>.
                        </>
                      )}
                    </p>

                    {/* Proposal Preview Grid */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {['day', 'mid', 'night'].map(sh => {
                        const shData = proposal?.shift_breakdown?.[sh];
                        const cfg = SHIFT_CONFIGS[`${sh}_shift`];
                        return (
                          <div key={sh} className="rounded-xl bg-white/90 p-2.5 border border-slate-200 shadow-2xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded-lg ${cfg.iconBg}`}>
                                <cfg.icon className="h-3.5 w-3.5" />
                              </span>
                              <div>
                                <span className="font-bold text-ink block">{cfg.name}</span>
                                <span className="text-[10px] text-slate-500">{shData?.count ?? 0} diners × {shData?.policy_quota ?? 100} tk</span>
                              </div>
                            </div>
                            <span className="font-mono-tokens font-black text-cobalt-700 text-xs">
                              {shData?.proposed_total ?? 0} tk
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-auto shrink-0">
                  {!resetApprovalInfo?.is_approved ? (
                    <>
                      <button
                        id="btn-reject-proposal"
                        onClick={() => setShowRejectModal(true)}
                        disabled={!isSuperAdmin}
                        className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-rose-300 bg-white hover:bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 shadow-sm transition disabled:opacity-50 cursor-pointer"
                        title={!isSuperAdmin ? 'Only Super Admin can reject proposals' : 'Reject proposal'}
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject</span>
                      </button>

                      <button
                        id="btn-review-approve"
                        onClick={handleOpenApprovalModal}
                        disabled={!isSuperAdmin}
                        className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-amber-600 hover:bg-amber-700 px-5 py-3 text-xs font-extrabold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                        title={!isSuperAdmin ? 'Only Super Admin can approve token resets' : 'Review and approve proposed distribution'}
                      >
                        {!isSuperAdmin ? <Lock className="h-4 w-4 text-white/80" /> : <ShieldCheck className="h-4 w-4 text-white" />}
                        <span>Review & Approve & Distribute</span>
                      </button>
                    </>
                  ) : (
                    <button
                      id="btn-reapprove"
                      onClick={handleOpenApprovalModal}
                      disabled={!isSuperAdmin}
                      className="btn-tactile inline-flex items-center gap-2 rounded-2xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
                      title="Modify quotas or re-apply distribution"
                    >
                      {!isSuperAdmin ? <Lock className="h-4 w-4 text-emerald-700" /> : <Coins className="h-4 w-4 text-emerald-700" />}
                      <span>Modify / Re-Approve Distribution</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: MANUAL ALLOCATION CONTROLS (Displayed when Automatic Mode is OFF) */}
          {!isAutomaticMode && (
            <div className="overflow-hidden rounded-3xl border border-amber-300 bg-white p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-amber-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-2xs">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-ink">
                        Manual Token Allocation (Automatic Mode is OFF)
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 border border-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                        Manual Execution Required
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-mute">
                      Enter monthly token amounts for each shift. Inputs default to saved company policy quotas (never previous month's actual allocations).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                  <button
                    id="btn-reset-inputs"
                    onClick={handleResetInputsToPolicy}
                    className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    title="Reset inputs to saved policy quotas"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset to Policy</span>
                  </button>

                  <button
                    id="btn-allocate-all-shifts"
                    onClick={() => {
                      if (!isSuperAdmin) {
                        toast.info('Only Super Admin can execute manual allocation.');
                        return;
                      }
                      openConfirmModal('all');
                    }}
                    disabled={!isSuperAdmin || assigningShift !== null || totalEmployees === 0}
                    title={!isSuperAdmin ? 'Only Super Admin can assign tokens' : 'Allocate All Shifts at once'}
                    className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                  >
                    {!isSuperAdmin ? <Lock className="h-4 w-4 text-white/80" /> : <Sparkles className="h-4 w-4 text-white" />}
                    <span>{assigningShift === 'all' ? 'Allocating All...' : 'Allocate All Shifts Now'}</span>
                  </button>
                </div>
              </div>

              {/* 3-Column Shift Input Grid for Manual Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                {['day_shift', 'mid_shift', 'night_shift'].map(shiftKey => {
                  const cfg = SHIFT_CONFIGS[shiftKey];
                  const shiftId = cfg.id;
                  const data = tokenData[shiftKey] || {};
                  const userCount = data.users?.length || 0;
                  const policyQuota = data.quota_per_user ?? 100;

                  return (
                    <div key={shiftKey} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-2 text-xs font-bold text-ink">
                            <cfg.icon className="h-4 w-4 text-cobalt-600" />
                            {cfg.name}
                          </span>
                          <span className="font-mono-tokens text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                            {userCount} active diners
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-ink-mute mb-3">
                          <span>Policy Default:</span>
                          <span className="font-mono-tokens font-bold text-slate-700">
                            {policyQuota} tk / diner
                          </span>
                        </div>

                        {/* Editable Token Input */}
                        <div className="space-y-1.5 mb-3">
                          <label className="text-[11px] font-semibold text-ink-mute block">
                            Tokens to Allocate per Diner:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id={`input-tokens-${shiftId}`}
                              type="number"
                              min="0"
                              max="5000"
                              disabled={!isSuperAdmin}
                              value={customTokens[shiftId]}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setCustomTokens(prev => ({
                                  ...prev,
                                  [shiftId]: raw === '' ? '' : Math.max(0, parseInt(raw) || 0)
                                }));
                              }}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tokens text-sm font-bold text-ink outline-none focus:border-cobalt-500 disabled:bg-slate-100 disabled:text-slate-500"
                              placeholder="Enter tokens"
                            />
                            <span className="font-mono-tokens text-xs font-bold text-ink-mute">tk</span>
                          </div>
                        </div>

                        <div className="rounded-xl bg-white border border-slate-200 p-2 text-xs font-mono-tokens flex justify-between mb-3">
                          <span className="text-slate-500">Shift Total:</span>
                          <span className="font-bold text-cobalt-700">
                            {(Number(customTokens[shiftId]) || 0) * userCount} tk
                          </span>
                        </div>
                      </div>

                      <button
                        id={`btn-allocate-${shiftId}`}
                        onClick={() => openConfirmModal(shiftKey)}
                        disabled={!isSuperAdmin || assigningShift !== null || userCount === 0}
                        className="btn-tactile w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-cobalt-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-cobalt-700 disabled:opacity-50 cursor-pointer"
                      >
                        {!isSuperAdmin ? <Lock className="h-3.5 w-3.5 text-white/80" /> : <Coins className="h-3.5 w-3.5 text-white" />}
                        <span>{assigningShift === shiftId ? 'Allocating…' : `Allocate ${cfg.name}`}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 4: SHIFT POLICY QUOTAS & DAILY SPENDING LIMITS (Super Admin Configurable) */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 shadow-2xs">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-ink">
                      Shift Policy Quotas & Daily Limits Configuration
                    </h3>
                    {isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Super Admin Configurable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 border border-amber-300">
                        <Lock className="h-3.5 w-3.5 text-amber-700" />
                        Super Admin Only (Read-Only)
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    Saved default monthly quotas, spending caps, and reset schedule day (20th to 19th). Used for automatic proposals and manual defaults.
                  </p>
                </div>
              </div>

              {isSuperAdmin && (
                <button
                  id="btn-save-policy"
                  onClick={handleSaveShiftPolicy}
                  disabled={savingSettings}
                  className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingSettings ? 'Saving Policy...' : 'Save Policy Quotas'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4">
              {/* Day Policy Quota */}
              <div className="rounded-2xl border border-cobalt-200/70 bg-cobalt-50/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-cobalt-900">
                    <Sun className="h-4 w-4 text-cobalt-600" />
                    Day Policy Quota
                  </span>
                  <span className="font-mono-tokens text-xs font-black text-cobalt-700 bg-cobalt-100/70 px-2 py-0.5 rounded-lg">
                    {settings.day_shift_policy_quota || 100} tk
                  </span>
                </div>
                <p className="text-[11px] text-ink-mute mb-2">Monthly allowance per diner</p>
                <div className="flex items-center gap-2">
                  <input
                    id="input-policy-day"
                    type="number"
                    min="0"
                    max="5000"
                    disabled={!isSuperAdmin}
                    value={settings.day_shift_policy_quota ?? 100}
                    onChange={(e) => setSettings(prev => ({ ...prev, day_shift_policy_quota: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tokens text-sm font-bold text-ink outline-none focus:border-cobalt-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <span className="font-mono-tokens text-xs font-bold text-ink-mute">tk</span>
                </div>
              </div>

              {/* Mid Policy Quota */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Sunset className="h-4 w-4 text-slate-600" />
                    Mid Policy Quota
                  </span>
                  <span className="font-mono-tokens text-xs font-black text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded-lg">
                    {settings.mid_shift_policy_quota || 100} tk
                  </span>
                </div>
                <p className="text-[11px] text-ink-mute mb-2">Monthly allowance per diner</p>
                <div className="flex items-center gap-2">
                  <input
                    id="input-policy-mid"
                    type="number"
                    min="0"
                    max="5000"
                    disabled={!isSuperAdmin}
                    value={settings.mid_shift_policy_quota ?? 100}
                    onChange={(e) => setSettings(prev => ({ ...prev, mid_shift_policy_quota: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tokens text-sm font-bold text-ink outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <span className="font-mono-tokens text-xs font-bold text-ink-mute">tk</span>
                </div>
              </div>

              {/* Night Policy Quota */}
              <div className="rounded-2xl border border-slate-300 bg-slate-100/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Moon className="h-4 w-4 text-slate-700" />
                    Night Policy Quota
                  </span>
                  <span className="font-mono-tokens text-xs font-black text-slate-900 bg-slate-300/70 px-2 py-0.5 rounded-lg">
                    {settings.night_shift_policy_quota || 100} tk
                  </span>
                </div>
                <p className="text-[11px] text-ink-mute mb-2">Monthly allowance per diner</p>
                <div className="flex items-center gap-2">
                  <input
                    id="input-policy-night"
                    type="number"
                    min="0"
                    max="5000"
                    disabled={!isSuperAdmin}
                    value={settings.night_shift_policy_quota ?? 100}
                    onChange={(e) => setSettings(prev => ({ ...prev, night_shift_policy_quota: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tokens text-sm font-bold text-ink outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <span className="font-mono-tokens text-xs font-bold text-ink-mute">tk</span>
                </div>
              </div>

              {/* Reset Day */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                    <Calendar className="h-4 w-4 text-amber-700" />
                    Reset Cycle Day
                  </span>
                  <span className="font-mono-tokens text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                    Day {settings.token_allocation_day || 20}
                  </span>
                </div>
                <p className="text-[11px] text-ink-mute mb-2">Cycle: 20th through 19th</p>
                <div className="flex items-center gap-2">
                  <input
                    id="input-policy-day-of-month"
                    type="number"
                    min="1"
                    max="28"
                    disabled={!isSuperAdmin}
                    value={settings.token_allocation_day ?? 20}
                    onChange={(e) => setSettings(prev => ({ ...prev, token_allocation_day: e.target.value === '' ? '' : parseInt(e.target.value) || 20 }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tokens text-sm font-bold text-ink outline-none focus:border-amber-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <span className="font-mono-tokens text-xs font-bold text-ink-mute">of mo.</span>
                </div>
              </div>

              {/* Advance Reminder Notice */}
              <div className="rounded-2xl border border-teal-200 bg-teal-50/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-teal-950">
                    <Clock className="h-4 w-4 text-teal-700" />
                    Admin Reminder
                  </span>
                  <span className="font-mono-tokens text-xs font-black text-teal-900 bg-teal-100 px-2 py-0.5 rounded-lg border border-teal-200">
                    {settings.reminder_days_before_reset || 3}d before
                  </span>
                </div>
                <p className="text-[11px] text-ink-mute mb-2">Advance notice to Super Admin</p>
                <div className="flex items-center gap-2">
                  <input
                    id="input-policy-reminder-days"
                    type="number"
                    min="1"
                    max="14"
                    disabled={!isSuperAdmin}
                    value={settings.reminder_days_before_reset ?? 3}
                    onChange={(e) => setSettings(prev => ({ ...prev, reminder_days_before_reset: e.target.value === '' ? '' : parseInt(e.target.value) || 3 }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tokens text-sm font-bold text-ink outline-none focus:border-teal-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <span className="font-mono-tokens text-xs font-bold text-ink-mute">days</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: LIVE METRICS SUMMARY CARDS */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="spotlight-card rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-mute">Total Personnel</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Users className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-mono-tokens text-2xl font-black text-ink">{totalEmployees}</p>
              <span className="mt-0.5 inline-block text-[11px] text-ink-mute">Active diners in system</span>
            </div>

            <div className="spotlight-card rounded-3xl border border-emerald-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-900">Tokens Distributed</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Coins className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-mono-tokens text-2xl font-black text-emerald-950">
                {overallMetrics.distributed}
                <span className="text-xs font-normal text-emerald-700 ml-1">tk</span>
              </p>
              <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-emerald-700">
                Current billing cycle
              </span>
            </div>

            <div className="spotlight-card rounded-3xl border border-rose-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-rose-900">Tokens Spent</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <TrendingDown className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-mono-tokens text-2xl font-black text-rose-950">
                {overallMetrics.spent}
                <span className="text-xs font-normal text-rose-700 ml-1">tk</span>
              </p>
              <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-rose-700">
                Consumed in orders
              </span>
            </div>

            <div className="spotlight-card rounded-3xl border border-cobalt-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-cobalt-900">Unused Tokens</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cobalt-100 text-cobalt-700">
                  <Wallet className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-mono-tokens text-2xl font-black text-cobalt-950">
                {overallMetrics.unused}
                <span className="text-xs font-normal text-cobalt-700 ml-1">tk</span>
              </p>
              <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-cobalt-700">
                Live available wallet balance
              </span>
            </div>
          </div>

          {/* SECTION 6: CURRENT PERSONNEL ROSTER & TOKEN BALANCES */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">Active Diner Token Roster</h3>
                <p className="text-xs text-ink-mute">Per-user distribution, spent, and live balance for current billing cycle.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    id="input-roster-search"
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search diner name or ID..."
                    className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-ink outline-none focus:border-cobalt-500 w-48 sm:w-56"
                  />
                </div>

                <select
                  id="select-roster-shift"
                  value={rosterShiftFilter}
                  onChange={(e) => setRosterShiftFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-cobalt-500"
                >
                  <option value="all">All Shifts</option>
                  <option value="day_shift">Day Shift</option>
                  <option value="mid_shift">Mid Shift</option>
                  <option value="night_shift">Night Shift</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                    <th className="py-2.5 px-3">User ID</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3 text-right">Distributed</th>
                    <th className="py-2.5 px-3 text-right">Spent</th>
                    <th className="py-2.5 px-3 text-right">Live Balance</th>
                    <th className="py-2.5 px-3 text-center">Orders</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoster.length > 0 ? (
                    filteredRoster.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-mono-tokens font-bold text-slate-900">{u.user_id || 'N/A'}</td>
                        <td className="py-2 px-3 font-medium text-ink">{u.name || u.username}</td>
                        <td className="py-2 px-3 text-slate-700">{u.shiftName}</td>
                        <td className="py-2 px-3 text-right font-mono-tokens font-bold text-emerald-700">{u.tokens_distributed ?? 0} tk</td>
                        <td className="py-2 px-3 text-right font-mono-tokens font-bold text-rose-600">{u.tokens_spent ?? 0} tk</td>
                        <td className="py-2 px-3 text-right font-mono-tokens font-black text-cobalt-700">{u.tokens_unused ?? u.tokens ?? 0} tk</td>
                        <td className="py-2 px-3 text-center font-mono-tokens">{u.month_orders_count ?? 0}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleOpenUserHistory(u)}
                            className="btn-tactile inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-cobalt-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <History className="h-3 w-3" />
                            <span>Ledger</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400">
                        No diners matching filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* SECTION 7: DEDICATED MONTHLY ALLOCATION HISTORY VIEW */
        <div className="space-y-6">
          {/* History Header & Filters */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-ink tracking-tight flex items-center gap-2">
                  <History className="h-5 w-5 text-cobalt-600" />
                  Monthly Allocation History Ledger
                </h3>
                <p className="text-xs text-ink-mute mt-0.5">
                  Comprehensive audit trail of all monthly token allocation cycles, shift quotas, distribution modes, and diner consumption.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-history-export-csv"
                  onClick={handleExportHistoryCSV}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Export 13-Column History CSV</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              {/* Billing Period Filter */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Billing Period
                </label>
                <select
                  id="filter-history-cycle"
                  value={historyFilters.cycle}
                  onChange={(e) => {
                    const next = { ...historyFilters, cycle: e.target.value };
                    setHistoryFilters(next);
                    loadHistory(next);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-cobalt-500"
                >
                  <option value="">All Billing Periods</option>
                  {(historyData.available_cycle_starts || []).map((cs) => (
                    <option key={cs} value={cs}>Cycle starting {cs}</option>
                  ))}
                </select>
              </div>

              {/* Shift Filter */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Shift
                </label>
                <select
                  id="filter-history-shift"
                  value={historyFilters.shift}
                  onChange={(e) => {
                    const next = { ...historyFilters, shift: e.target.value };
                    setHistoryFilters(next);
                    loadHistory(next);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-cobalt-500"
                >
                  <option value="">All Shifts</option>
                  <option value="day_shift">Day Shift</option>
                  <option value="mid_shift">Mid Shift</option>
                  <option value="night_shift">Night Shift</option>
                </select>
              </div>

              {/* Mode Filter */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Allocation Mode
                </label>
                <select
                  id="filter-history-mode"
                  value={historyFilters.mode}
                  onChange={(e) => {
                    const next = { ...historyFilters, mode: e.target.value };
                    setHistoryFilters(next);
                    loadHistory(next);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-cobalt-500"
                >
                  <option value="">All Modes (Auto & Manual)</option>
                  <option value="automatic">Automatic Mode</option>
                  <option value="manual">Manual Mode</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Approval Status
                </label>
                <select
                  id="filter-history-status"
                  value={historyFilters.status}
                  onChange={(e) => {
                    const next = { ...historyFilters, status: e.target.value };
                    setHistoryFilters(next);
                    loadHistory(next);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-cobalt-500"
                >
                  <option value="">All Statuses</option>
                  <option value="approved">Approved & Allocated</option>
                  <option value="pending">Pending Approval</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* 13-Column Master History Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">
                Found {historyData.cycles?.length || 0} billing cycle record(s)
              </span>
              <span className="text-[11px] text-slate-400">
                Click any cycle row to expand shift breakdowns, user balances, and audit history.
              </span>
            </div>

            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin text-cobalt-600" />
                <p className="text-sm font-semibold text-slate-600">Loading historical allocations...</p>
              </div>
            ) : (historyData.cycles?.length || 0) === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <History className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No historical allocations found</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing your filters or check back after the next allocation run.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200">
                      <th className="py-3 px-3 w-8"></th>
                      <th className="py-3 px-3">1. Billing Cycle</th>
                      <th className="py-3 px-3">2. Mode</th>
                      <th className="py-3 px-3">3. Shift</th>
                      <th className="py-3 px-3 text-right">4. Personnel</th>
                      <th className="py-3 px-3 text-right">5. Policy Quota</th>
                      <th className="py-3 px-3 text-right">6. Proposed</th>
                      <th className="py-3 px-3 text-right">7. Actual Allocated</th>
                      <th className="py-3 px-3 text-right">8. Tokens Spent</th>
                      <th className="py-3 px-3 text-right">9. Unused Balance</th>
                      <th className="py-3 px-3 text-center">10. Status</th>
                      <th className="py-3 px-3">11. Approved By</th>
                      <th className="py-3 px-3">12. Approved At</th>
                      <th className="py-3 px-3">13. Allocated At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {historyData.cycles.map((cycle, idx) => {
                      const isExpanded = !!expandedCycles[cycle.cycle_start];
                      const isUserTableOpen = !!expandedUserTables[cycle.cycle_start];
                      const shifts = cycle.shift_breakdown || {};

                      return (
                        <tr key={cycle.cycle_start || idx} className="contents">
                          {/* Main Cycle Summary Row */}
                          <tr 
                            onClick={() => toggleCycleExpand(cycle.cycle_start)}
                            className="hover:bg-cobalt-50/40 cursor-pointer transition bg-white"
                          >
                            <td className="py-3 px-3 text-slate-400">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </td>
                            <td className="py-3 px-3 font-bold text-ink">
                              {cycle.cycle_label || `${cycle.cycle_start} to ${cycle.cycle_end}`}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                cycle.allocation_mode === 'automatic'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {cycle.allocation_mode || 'automatic'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-700">All Shifts</td>
                            <td className="py-3 px-3 text-right font-mono-tokens font-bold text-slate-900">
                              {cycle.total_eligible_users ?? 0}
                            </td>
                            <td className="py-3 px-3 text-right font-mono-tokens text-slate-600">
                              Policy Defined
                            </td>
                            <td className="py-3 px-3 text-right font-mono-tokens font-bold text-slate-700">
                              {cycle.total_proposed_tokens ?? 0} tk
                            </td>
                            <td className="py-3 px-3 text-right font-mono-tokens font-black text-emerald-700">
                              {cycle.total_allocated_tokens ?? 0} tk
                            </td>
                            <td className="py-3 px-3 text-right font-mono-tokens font-bold text-rose-600">
                              {cycle.total_spent_tokens ?? 0} tk
                            </td>
                            <td className="py-3 px-3 text-right font-mono-tokens font-black text-cobalt-700">
                              {cycle.total_unused_tokens ?? 0} tk
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black capitalize ${
                                cycle.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : cycle.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {cycle.status === 'approved' ? 'Allocated' : cycle.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700">{cycle.approved_by || '—'}</td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">{cycle.approved_at || '—'}</td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">{cycle.allocated_at || '—'}</td>
                          </tr>

                          {/* Expanded Breakdown Sub-rows (Per-shift & Details) */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70 border-b border-slate-200">
                              <td colSpan="14" className="p-4 space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                                      Shift Breakdown for {cycle.cycle_label}
                                    </h4>
                                    <span className="text-[11px] text-slate-500 font-mono-tokens">
                                      Allocated At: {cycle.allocated_at || 'Scheduled'}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {['day_shift', 'mid_shift', 'night_shift'].map((sk) => {
                                      const s = shifts[sk] || {};
                                      const cfg = SHIFT_CONFIGS[sk];
                                      return (
                                        <div key={sk} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 font-bold text-xs text-ink">
                                              <cfg.icon className="h-4 w-4 text-cobalt-600" />
                                              {s.name || cfg.name}
                                            </span>
                                            <span className="text-[11px] font-mono-tokens font-bold text-slate-700">
                                              {s.eligible_count ?? 0} diners
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-slate-600 space-y-1 font-mono-tokens">
                                            <div className="flex justify-between">
                                              <span>Policy Quota:</span>
                                              <span>{s.policy_quota ?? 100} tk / diner</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Proposed:</span>
                                              <span>{s.proposed_tokens ?? 0} tk</span>
                                            </div>
                                            <div className="flex justify-between font-bold text-emerald-700">
                                              <span>Allocated:</span>
                                              <span>{s.actual_allocated_tokens ?? 0} tk</span>
                                            </div>
                                            <div className="flex justify-between text-rose-600">
                                              <span>Spent:</span>
                                              <span>{s.tokens_spent ?? 0} tk</span>
                                            </div>
                                            <div className="flex justify-between font-black text-cobalt-700">
                                              <span>Unused Balance:</span>
                                              <span>{s.tokens_unused ?? 0} tk</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Sub-table toggle button */}
                                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleUserTableExpand(cycle.cycle_start);
                                      }}
                                      className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-slate-50 cursor-pointer"
                                    >
                                      <Users className="h-3.5 w-3.5 text-cobalt-600" />
                                      <span>
                                        {isUserTableOpen ? 'Hide Diner Allocation List' : `View Diners in this Cycle (${cycle.users?.length || 0})`}
                                      </span>
                                    </button>

                                    {cycle.notes && (
                                      <span className="text-xs text-slate-600 italic">
                                        Audit Note: "{cycle.notes}"
                                      </span>
                                    )}
                                  </div>

                                  {/* Per-user ledger sub-table */}
                                  {isUserTableOpen && (
                                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                                      <table className="w-full text-left text-xs">
                                        <thead>
                                          <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700">
                                            <th className="py-2 px-3">User ID</th>
                                            <th className="py-2 px-3">Diner Name</th>
                                            <th className="py-2 px-3">Shift</th>
                                            <th className="py-2 px-3 text-right">Tokens Credited</th>
                                            <th className="py-2 px-3 text-right">Tokens Spent</th>
                                            <th className="py-2 px-3 text-right">Unused Balance</th>
                                            <th className="py-2 px-3 text-center">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {(cycle.users || []).map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50">
                                              <td className="py-1.5 px-3 font-mono-tokens font-semibold">{u.user_id || 'N/A'}</td>
                                              <td className="py-1.5 px-3 font-medium">{u.name || u.username}</td>
                                              <td className="py-1.5 px-3 capitalize">{u.shift?.replace('_shift', '') || 'Day'}</td>
                                              <td className="py-1.5 px-3 text-right font-mono-tokens font-bold text-emerald-700">{u.tokens_credited ?? 0} tk</td>
                                              <td className="py-1.5 px-3 text-right font-mono-tokens text-rose-600">{u.tokens_spent ?? 0} tk</td>
                                              <td className="py-1.5 px-3 text-right font-mono-tokens font-bold text-cobalt-700">{u.tokens_unused ?? 0} tk</td>
                                              <td className="py-1.5 px-3 text-center">
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                                  {u.status || 'Active'}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Manual Allocations */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-ink">{confirmModal.title}</h4>
                  <p className="text-xs text-ink-mute">VDart Cafe Manual Token Distribution</p>
                </div>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-ink-mute leading-relaxed">
                {confirmModal.description}
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-mute">Affected Personnel:</span>
                  <span className="font-mono-tokens font-bold text-ink">{confirmModal.userCount} users</span>
                </div>
                {confirmModal.tokens !== null && (
                  <div className="flex justify-between">
                    <span className="text-ink-mute">Allocation Amount:</span>
                    <span className="font-mono-tokens font-bold text-cobalt-700">
                      {typeof confirmModal.tokens === 'object'
                        ? `Day ${confirmModal.tokens.day} · Mid ${confirmModal.tokens.mid} · Night ${confirmModal.tokens.night}`
                        : `${confirmModal.tokens} tokens / user`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink-mute">Cycle:</span>
                  <span className="font-semibold text-ink">{cycleInfo?.cycle_label || overallMetrics.month}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                  className="btn-tactile rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAssignment}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 shadow-sm cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Confirm & Execute Allocation</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Monthly Token Reset Review & Approval Modal */}
      <AnimatePresence>
        {showApprovalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white border border-white/20 shadow-2xs">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Monthly Token Reset Review & Approval
                    </h3>
                    <p className="text-xs text-amber-100">
                      VDart Cafe Token Governance · Billing Cycle {cycleInfo?.cycle_label || overallMetrics.month}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto p-6 space-y-5 text-ink">
                <div className="rounded-2xl border border-amber-200/90 bg-amber-50/60 p-4 text-xs text-amber-950 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-sm">Corporate Approval Enforcement</span>
                    <p className="mt-0.5 text-slate-700 leading-relaxed">
                      Token distribution executes atomically across all diner accounts strictly upon your authorization. 
                      Quotas default to saved company policy values.
                    </p>
                  </div>
                </div>

                {/* Shift Quota Allocation Table & Config */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-xs text-ink uppercase tracking-wider">
                      Proposed Shift Quotas
                    </span>
                    <span className="text-[11px] text-ink-mute">
                      Cycle Day: {settings.token_allocation_day || 20}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 bg-white">
                    {['day', 'mid', 'night'].map((sh) => {
                      const shData = proposal?.shift_breakdown?.[sh];
                      const shiftCfg = SHIFT_CONFIGS[`${sh}_shift`];
                      const dinerCount = shData?.count ?? (tokenData[`${sh}_shift`]?.users?.length || 0);
                      const currentQuota = approvalQuotas[sh];
                      const totalTokensForShift = (Number(currentQuota) || 0) * dinerCount;

                      return (
                        <div key={sh} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                          <div className="flex items-center gap-2.5">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${shiftCfg.iconBg}`}>
                              <shiftCfg.icon className="h-4 w-4" />
                            </span>
                            <div>
                              <span className="font-bold text-xs text-ink block">{shiftCfg.name}</span>
                              <span className="text-[11px] text-ink-mute">
                                {dinerCount} active diners · Policy: {shData?.policy_quota ?? 100} tk
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] font-semibold text-ink-mute">Quota:</label>
                              <input
                                type="number"
                                min="0"
                                max="5000"
                                value={currentQuota}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setApprovalQuotas(prev => ({ ...prev, [sh]: val === '' ? '' : Math.max(0, parseInt(val) || 0) }));
                                }}
                                className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono-tokens text-xs font-bold text-ink outline-none focus:border-cobalt-500"
                              />
                              <span className="font-mono-tokens text-xs text-ink-mute">tk/diner</span>
                            </div>
                            <span className="font-mono-tokens text-xs font-bold text-cobalt-700 bg-cobalt-100/70 px-2 py-1 rounded-md min-w-[70px] text-right">
                              = {totalTokensForShift} tk
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total Distribution Summary */}
                <div className="rounded-2xl border border-cobalt-200 bg-cobalt-50/40 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-cobalt-950 block">Total Tokens to Credit</span>
                    <span className="text-[11px] text-cobalt-800">
                      Across {(proposal?.total_eligible_diners ?? totalEmployees)} active personnel
                    </span>
                  </div>
                  <div className="font-mono-tokens text-xl sm:text-2xl font-black text-cobalt-950">
                    {((Number(approvalQuotas.day) || 0) * (proposal?.shift_breakdown?.day?.count ?? (tokenData.day_shift?.users?.length || 0))) +
                     ((Number(approvalQuotas.mid) || 0) * (proposal?.shift_breakdown?.mid?.count ?? (tokenData.mid_shift?.users?.length || 0))) +
                     ((Number(approvalQuotas.night) || 0) * (proposal?.shift_breakdown?.night?.count ?? (tokenData.night_shift?.users?.length || 0)))}
                    <span className="text-xs font-normal text-cobalt-700 ml-1">tokens</span>
                  </div>
                </div>

                {/* Optional Approval Notes */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Approval Audit Notes (Optional):
                  </label>
                  <input
                    type="text"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="e.g. Approved monthly token distribution as per corporate welfare policy"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-ink outline-none focus:border-cobalt-500"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  disabled={approvingReset}
                  className="btn-tactile rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-ink hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-approve-distribute"
                  type="button"
                  onClick={handleExecuteApproval}
                  disabled={approvingReset}
                  className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-amber-600 hover:bg-amber-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {approvingReset ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  )}
                  <span>{approvingReset ? 'Processing Distribution...' : 'Approve & Distribute Monthly Tokens'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Proposal Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-800">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-ink">Reject Monthly Token Proposal</h4>
                  <p className="text-xs text-ink-mute">Cycle {cycleInfo?.cycle_label || overallMetrics.month}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Rejecting this proposal will prevent tokens from being automatically credited for this cycle. 
                A record will be kept in the audit log.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Rejection Reason / Notes:
                </label>
                <textarea
                  rows="3"
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="Enter reason for rejecting this allocation proposal..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-ink outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejectingReset}
                  className="btn-tactile rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-ink hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-rejection"
                  type="button"
                  onClick={handleExecuteRejection}
                  disabled={rejectingReset}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  <span>{rejectingReset ? 'Rejecting...' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Corporate Token Audit Report & Printable Modal */}
      <AnimatePresence>
        {showAuditModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
            >
              {/* Top Control Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-cobalt-600 px-6 py-4 text-white print:hidden">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Official Corporate Token Audit Report
                    </h3>
                    <p className="text-[11px] text-cobalt-100">
                      VDart Cafe Token Governance · Billing Cycle {cycleInfo?.cycle_label || overallMetrics.month}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-cobalt-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print PDF</span>
                  </button>
                  <button
                    onClick={() => setShowAuditModal(false)}
                    aria-label="Close audit report"
                    className="rounded-full p-1.5 text-white hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div className="overflow-y-auto p-8 space-y-6 text-ink bg-white font-sans text-xs sm:text-sm print:p-0">
                <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-black text-lg sm:text-xl tracking-tight">
                      <Building2 className="h-6 w-6 text-cobalt-700" />
                      <span>VDART TECHNOLOGIES</span>
                    </div>
                    <p className="text-xs text-ink-mute mt-0.5">Corporate Canteen & Employee Welfare Division</p>
                    <p className="text-[11px] text-ink-mute">Global Technology Park, Campus 2 · Facility ID: VDC-FAC-01</p>
                  </div>
                  <div className="sm:text-right">
                    <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-mono-tokens font-bold text-slate-800 border border-slate-200">
                      CYCLE: {cycleInfo?.cycle_label || overallMetrics.month}
                    </span>
                    <p className="text-[11px] text-ink-mute mt-1">Generated: {today.toLocaleString()}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="text-base font-extrabold text-ink uppercase tracking-wide">
                    Monthly Token Allocation & Distribution Ledger
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Formal accounting of corporate canteen token subsidies. Allocation Mode: <strong>{(settings.monthly_token_allocation_mode || 'automatic').toUpperCase()}</strong>.
                  </p>
                </div>

                {/* Summary Metrics Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-ink-mute uppercase">Total Personnel</span>
                    <p className="font-mono-tokens text-xl font-black text-ink mt-1">{totalEmployees}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-emerald-900 uppercase">Distributed</span>
                    <p className="font-mono-tokens text-xl font-black text-emerald-950 mt-1">{overallMetrics.distributed} tk</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-rose-900 uppercase">Spent</span>
                    <p className="font-mono-tokens text-xl font-black text-rose-950 mt-1">{overallMetrics.spent} tk</p>
                  </div>
                  <div className="rounded-2xl border border-cobalt-200 bg-cobalt-50/40 p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-cobalt-900 uppercase">Unused Balance</span>
                    <p className="font-mono-tokens text-xl font-black text-cobalt-950 mt-1">{overallMetrics.unused} tk</p>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-dashed border-slate-200 grid grid-cols-2 gap-8 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">Audited & Certified by:</p>
                    <p className="text-ink-mute mt-0.5">VDart Corporate Operations & Canteen Administration</p>
                    <div className="mt-8 border-b border-slate-400 w-48" />
                    <p className="text-[10px] text-ink-mute mt-1">Authorized Administrator Signature</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">Corporate Finance & HR Governance:</p>
                    <p className="text-ink-mute mt-0.5">Subsidy Verification & Payroll Reconciliation</p>
                    <div className="mt-8 border-b border-slate-400 w-48 ml-auto" />
                    <p className="text-[10px] text-ink-mute mt-1">Compliance Officer Signature</p>
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
                <button
                  onClick={handleExportCSV}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-ink hover:bg-slate-100 transition cursor-pointer"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span>Download CSV Ledger</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAuditModal(false)}
                    className="btn-tactile rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-ink-mute hover:text-ink transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-cobalt-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cobalt-700 transition cursor-pointer shadow-sm"
                  >
                    <Printer className="h-4 w-4 text-white" />
                    <span>Print Report (PDF)</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Individual User Transaction History & Tracking Modal */}
      <AnimatePresence>
        {selectedUserForHistory && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-cobalt-900 via-slate-900 to-cobalt-950 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">
                        {selectedUserForHistory.name || selectedUserForHistory.username}
                      </h3>
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        {selectedUserForHistory.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      User ID: {selectedUserForHistory.user_id || selectedUserForHistory.username} · Shift: {selectedUserForHistory.work_shift || selectedUserForHistory.shiftName || 'Day'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserForHistory(null)}
                  className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-6 space-y-6">
                {loadingUserHistory ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-cobalt-600" />
                    <p className="text-sm font-semibold text-ink-mute">Loading transaction ledger...</p>
                  </div>
                ) : userHistoryData ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
                        <span className="text-[11px] font-bold text-emerald-900 uppercase">Distributed</span>
                        <p className="font-mono-tokens text-xl font-black text-emerald-950 mt-1">
                          {userHistoryData.metrics?.tokens_distributed ?? 0} tk
                        </p>
                      </div>

                      <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-3.5">
                        <span className="text-[11px] font-bold text-rose-900 uppercase">Spent This Month</span>
                        <p className="font-mono-tokens text-xl font-black text-rose-950 mt-1">
                          {userHistoryData.metrics?.tokens_spent ?? 0} tk
                        </p>
                      </div>

                      <div className="rounded-2xl border border-cobalt-200/80 bg-cobalt-50/50 p-3.5">
                        <span className="text-[11px] font-bold text-cobalt-900 uppercase">Unused Balance</span>
                        <p className="font-mono-tokens text-xl font-black text-cobalt-950 mt-1">
                          {userHistoryData.metrics?.tokens_unused ?? 0} tk
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                        <span className="text-[11px] font-bold text-slate-700 uppercase">All-Time Spent</span>
                        <p className="font-mono-tokens text-xl font-black text-slate-900 mt-1">
                          {userHistoryData.metrics?.all_time_spent ?? 0} tk
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-ink">Recent Order Transactions</h4>
                      {userHistoryData.orders?.length > 0 ? (
                        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                          {userHistoryData.orders.map((order) => (
                            <div key={order.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between">
                              <div>
                                <span className="font-mono-tokens text-xs font-bold text-ink">Order #{order.id}</span>
                                <span className="text-[11px] text-ink-mute ml-2">{order.created_at}</span>
                              </div>
                              <span className="font-mono-tokens text-xs font-black text-rose-600">
                                -{order.total_tokens} tk
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-mute py-4 text-center rounded-2xl border border-dashed border-slate-200">
                          No order transactions found for this diner.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-center text-sm text-ink-mute py-12">Failed to load user details.</p>
                )}
              </div>

              <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3.5">
                <button
                  onClick={() => setSelectedUserForHistory(null)}
                  className="btn-tactile rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTokens;