import { useEffect, useState, useMemo } from 'react';
import { dashboardService, clientService } from '../services/api';
import { 
  Users, DollarSign, FileText, TrendingUp, ArrowUpRight, ArrowDownRight,
  UserPlus, Calendar, Activity, Clock, ChevronRight, Eye, MoreVertical,
  CreditCard, Zap, CheckCircle, AlertCircle, Search, Filter
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
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's what's happening with your business.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </select>
          <Link 
            to="/admin/clients"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200"
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Revenue Overview</h3>
              <p className="text-sm text-gray-500">Monthly revenue trend</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-gray-600">Revenue</span>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px'
                }}
                formatter={(value) => [`$${value}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Dispute Status Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Dispute Status</h3>
              <p className="text-sm text-gray-500">Current distribution</p>
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
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent Clients</h3>
              <p className="text-sm text-gray-500">Manage and view client information</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64"
                />
              </div>
              <Link to="/admin/clients" className="text-indigo-600 text-sm hover:text-indigo-700 flex items-center gap-1">
                View all <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.length > 0 ? filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-medium">
                        {client.first_name?.[0]}{client.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{client.first_name} {client.last_name}</p>
                        <p className="text-sm text-gray-500">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      client.subscription_status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {client.subscription_status || 'Free'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500">
                    {client.created_at ? format(new Date(client.created_at), 'MMM d, yyyy') : 'N/A'}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{client.items_count || 0}</span>
                      <span className="text-sm text-gray-500">items</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-500">
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
        <Link to="/admin/clients" className="group bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-2xl p-5 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Manage Clients</h3>
              <p className="text-sm text-blue-600">View and edit client data</p>
            </div>
            <ChevronRight size={20} className="ml-auto text-blue-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link to="/admin/disputes" className="group bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border border-purple-200 rounded-2xl p-5 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900">View All Disputes</h3>
              <p className="text-sm text-purple-600">Track dispute progress</p>
            </div>
            <ChevronRight size={20} className="ml-auto text-purple-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link to="/admin/reports" className="group bg-gradient-to-br from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 border border-emerald-200 rounded-2xl p-5 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Activity size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900">Generate Reports</h3>
              <p className="text-sm text-emerald-600">Export analytics data</p>
            </div>
            <ChevronRight size={20} className="ml-auto text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}
