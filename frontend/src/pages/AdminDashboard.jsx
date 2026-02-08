import { useEffect, useState, useMemo } from 'react';
import { dashboardService, clientService, userService, getErrorMessage } from '../services/api';
import { 
  Users, DollarSign, FileText, TrendingUp, ArrowUpRight, ArrowDownRight,
  UserPlus, Calendar, Activity, Clock, ChevronRight, Eye, MoreVertical,
  CreditCard, Zap, CheckCircle, AlertCircle, Search, Filter, Trash2, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await dashboardService.getAdminStats();
      setStats(res.data);
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModal.user) return;
    setDeleting(true);
    try {
      await userService.deleteUser(deleteModal.user.id);
      setDeleteModal({ open: false, user: null });
      // Refresh dashboard data
      const res = await dashboardService.getAdminStats();
      setStats(res.data);
    } catch (error) {
      alert(getErrorMessage(error, 'Error al eliminar usuario'));
    } finally {
      setDeleting(false);
    }
  };

  // Use real revenue trend data from backend, fall back to generated data
  const revenueData = useMemo(() => {
    if (stats?.revenueTrend?.length > 0) {
      return stats.revenueTrend.map((item) => ({
        month: format(new Date(item.month), 'MMM'),
        revenue: parseFloat(item.total) || 0,
      }));
    }
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i * 30);
      data.push({
        month: format(date, 'MMM'),
        revenue: stats?.monthlyRevenue || 0,
      });
    }
    return data;
  }, [stats]);

  // Use real dispute status data from backend
  const DISPUTE_COLORS = { draft: '#94a3b8', pending: '#f59e0b', sent: '#3b82f6', investigating: '#8b5cf6', resolved: '#10b981', rejected: '#ef4444' };
  const disputeStatusData = useMemo(() => {
    if (stats?.disputesByStatus?.length > 0) {
      return stats.disputesByStatus.map((item) => ({
        name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
        value: parseInt(item.count),
        color: DISPUTE_COLORS[item.status] || '#94a3b8',
      }));
    }
    return [
      { name: 'Draft', value: 0, color: '#94a3b8' },
      { name: 'Sent', value: 0, color: '#3b82f6' },
      { name: 'Resolved', value: 0, color: '#10b981' },
    ];
  }, [stats]);

  const filteredClients = useMemo(() => {
    if (!stats?.recentClients) return [];
    return stats.recentClients.filter(client =>
      `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stats, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-800 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back! Here's what's happening with your business.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="px-4 py-2 border border-slate-700/50 rounded-xl bg-slate-800/60 text-slate-200 focus:ring-2 focus:ring-indigo-500">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </select>
          <Link 
            to="/admin/clients"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25"
          >
            <UserPlus size={18} />
            Add Client
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <Users size={24} className="text-blue-200" />
              <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <ArrowUpRight size={12} />
                +12%
              </span>
            </div>
            <p className="text-4xl font-bold">{stats?.totalClients || 0}</p>
            <p className="text-blue-100 text-sm mt-1">Total Clients</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp size={24} className="text-emerald-200" />
              <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <ArrowUpRight size={12} />
                +8%
              </span>
            </div>
            <p className="text-4xl font-bold">{stats?.activeSubscriptions || 0}</p>
            <p className="text-emerald-100 text-sm mt-1">Active Subscriptions</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <FileText size={24} className="text-purple-200" />
              <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <ArrowUpRight size={12} />
                +24%
              </span>
            </div>
            <p className="text-4xl font-bold">{stats?.totalDisputes || 0}</p>
            <p className="text-purple-100 text-sm mt-1">Total Disputes</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <DollarSign size={24} className="text-amber-200" />
              <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <ArrowUpRight size={12} />
                +18%
              </span>
            </div>
            <p className="text-4xl font-bold">${stats?.monthlyRevenue?.toLocaleString() || 0}</p>
            <p className="text-amber-100 text-sm mt-1">Monthly Revenue</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-white">Revenue Overview</h3>
              <p className="text-sm text-slate-400">Monthly revenue trend</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-slate-300">Revenue</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  borderRadius: '12px',
                  color: '#e2e8f0'
                }}
                formatter={(value) => [`$${value}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Dispute Status Chart */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-white">Dispute Status</h3>
              <p className="text-sm text-slate-400">Current distribution</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={disputeStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {disputeStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {disputeStatusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-semibold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Recent Clients</h3>
              <p className="text-sm text-slate-400">Manage and view client information</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-700/50 rounded-xl bg-slate-800/60 text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64"
                />
              </div>
              <Link to="/admin/clients" className="text-indigo-400 text-sm hover:text-indigo-300 flex items-center gap-1">
                View all <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/30">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Client</th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Joined</th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Items</th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredClients.length > 0 ? filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-medium">
                        {client.first_name?.[0]}{client.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-white">{client.first_name} {client.last_name}</p>
                        <p className="text-sm text-slate-400">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      client.subscription_status === 'active' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-slate-700/50 text-slate-300'
                    }`}>
                      {client.subscription_status || 'Free'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-400">
                    {client.created_at ? format(new Date(client.created_at), 'MMM d, yyyy') : 'N/A'}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{client.items_count || 0}</span>
                      <span className="text-sm text-slate-400">items</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors" title="Ver detalles">
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteModal({ open: true, user: client })}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    <Users size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No clients found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/clients" className="group bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 rounded-2xl p-5 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Manage Clients</h3>
              <p className="text-sm text-sky-400">View and edit client data</p>
            </div>
            <ChevronRight size={20} className="ml-auto text-sky-500 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link to="/admin/disputes" className="group bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 rounded-2xl p-5 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white">View All Disputes</h3>
              <p className="text-sm text-purple-400">Track dispute progress</p>
            </div>
            <ChevronRight size={20} className="ml-auto text-purple-500 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link to="/admin/reports" className="group bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-2xl p-5 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Activity size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Generate Reports</h3>
              <p className="text-sm text-emerald-400">Export analytics data</p>
            </div>
            <ChevronRight size={20} className="ml-auto text-emerald-500 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 rounded-xl">
                  <Trash2 size={20} className="text-rose-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Eliminar Usuario</h3>
              </div>
              <button
                onClick={() => setDeleteModal({ open: false, user: null })}
                className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-slate-300 mb-3">
                ¿Estás seguro de que deseas eliminar a este usuario? Esta acción es <span className="font-semibold text-rose-400">irreversible</span> y eliminará todos sus datos asociados.
              </p>
              <div className="bg-slate-700/30 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-medium text-sm">
                  {deleteModal.user?.first_name?.[0]}{deleteModal.user?.last_name?.[0]}
                </div>
                <div>
                  <p className="font-medium text-white">{deleteModal.user?.first_name} {deleteModal.user?.last_name}</p>
                  <p className="text-sm text-slate-400">{deleteModal.user?.email}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, user: null })}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-slate-700/50 text-slate-300 rounded-xl hover:bg-slate-700/30 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
