import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/Auth0Context';
import { creditItemService } from '../services/api';
import { 
  Plus, Trash2, Edit, AlertCircle, X, Search, Filter, 
  DollarSign, Building2, CreditCard, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, XCircle, MoreVertical, Eye
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function CreditItems() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBureau, setFilterBureau] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    itemType: 'late_payment',
    creditorName: '',
    accountNumber: '',
    bureau: 'all',
    balance: '',
    description: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await creditItemService.getItems(user.id);
      setItems(res.data.items || []);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await creditItemService.addItem({ ...formData, clientId: user.id });
      setShowForm(false);
      setFormData({ itemType: 'late_payment', creditorName: '', accountNumber: '', bureau: 'all', balance: '', description: '' });
      loadItems();
    } catch (error) {
      alert('Error al agregar item');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este item?')) {
      await creditItemService.deleteItem(id);
      loadItems();
    }
  };

  // Stats and filtered data
  const stats = useMemo(() => {
    const totalBalance = items.reduce((sum, item) => sum + parseFloat(item.balance || 0), 0);
    const byStatus = items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    const byBureau = items.reduce((acc, item) => {
      acc[item.bureau] = (acc[item.bureau] || 0) + 1;
      return acc;
    }, {});
    return { totalBalance, byStatus, byBureau, total: items.length };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.creditor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.account_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBureau = filterBureau === 'all' || item.bureau === filterBureau;
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      return matchesSearch && matchesBureau && matchesStatus;
    });
  }, [items, searchTerm, filterBureau, filterStatus]);

  const pieData = Object.entries(stats.byBureau).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));
  
  const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

  const getStatusConfig = (status) => {
    const configs = {
      identified: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Identified' },
      pending: { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Clock, label: 'Pending' },
      disputing: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: AlertCircle, label: 'In Dispute' },
      in_dispute: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: AlertCircle, label: 'In Dispute' },
      deleted: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2, label: 'Removed' },
      resolved: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2, label: 'Resolved' },
      verified: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Verified' }
    };
    return configs[status] || configs.pending;
  };

  const getBureauColor = (bureau) => {
    const colors = {
      equifax: 'bg-red-500',
      experian: 'bg-blue-500',
      transunion: 'bg-green-500',
      all: 'bg-purple-500'
    };
    return colors[bureau] || 'bg-gray-500';
  };

  const itemTypeLabels = {
    late_payment: 'Late Payment',
    collection: 'Collection',
    charge_off: 'Charge Off',
    bankruptcy: 'Bankruptcy',
    inquiry: 'Hard Inquiry',
    repossession: 'Repossession'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading credit items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl text-white">
              <AlertCircle size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Credit Items</h1>
              <p className="text-gray-500">Manage and track negative items on your credit report</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(true)} 
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          Add New Item
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <CreditCard size={24} className="text-slate-400" />
            <span className="text-xs bg-white/10 px-2 py-1 rounded-full">Total</span>
          </div>
          <p className="text-4xl font-bold">{stats.total}</p>
          <p className="text-slate-400 text-sm mt-1">Total Items</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <DollarSign size={24} className="text-red-200" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Balance</span>
          </div>
          <p className="text-4xl font-bold">${stats.totalBalance.toLocaleString()}</p>
          <p className="text-red-100 text-sm mt-1">Total Balance Reported</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <AlertTriangle size={24} className="text-blue-200" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Active</span>
          </div>
          <p className="text-4xl font-bold">{stats.byStatus.disputing || stats.byStatus.in_dispute || 0}</p>
          <p className="text-blue-100 text-sm mt-1">In Dispute</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle2 size={24} className="text-emerald-200" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Success</span>
          </div>
          <p className="text-4xl font-bold">{(stats.byStatus.deleted || 0) + (stats.byStatus.resolved || 0)}</p>
          <p className="text-emerald-100 text-sm mt-1">Removed/Resolved</p>
        </div>
      </div>

      {/* Charts and Filters Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Distribution by Bureau</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                      <span className="text-sm text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-gray-400">
              <p>No items to display</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Filter Items</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search creditor or account..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <select
              value={filterBureau}
              onChange={(e) => setFilterBureau(e.target.value)}
              className="select-field"
            >
              <option value="all">All Bureaus</option>
              <option value="equifax">Equifax</option>
              <option value="experian">Experian</option>
              <option value="transunion">TransUnion</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="select-field"
            >
              <option value="all">All Statuses</option>
              <option value="identified">Identified</option>
              <option value="in_dispute">In Dispute</option>
              <option value="resolved">Resolved</option>
              <option value="deleted">Removed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Credit Items ({filteredItems.length})</h3>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No items found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or add a new item</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map((item) => {
              const statusConfig = getStatusConfig(item.status);
              const StatusIcon = statusConfig.icon;
              return (
                <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 ${getBureauColor(item.bureau)} rounded-xl text-white`}>
                      <Building2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 truncate">{item.creditor_name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="uppercase font-medium">{item.bureau}</span>
                        <span>•</span>
                        <span>{itemTypeLabels[item.item_type] || item.item_type}</span>
                        {item.account_number && (
                          <>
                            <span>•</span>
                            <span>Acct: ***{item.account_number.slice(-4)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">${parseFloat(item.balance || 0).toLocaleString()}</p>
                      <p className="text-sm text-gray-500">Balance</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedItem(item)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add New Credit Item</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Item Type</label>
                  <select 
                    value={formData.itemType} 
                    onChange={(e) => setFormData({...formData, itemType: e.target.value})} 
                    className="select-field"
                  >
                    <option value="late_payment">Late Payment</option>
                    <option value="collection">Collection</option>
                    <option value="charge_off">Charge Off</option>
                    <option value="bankruptcy">Bankruptcy</option>
                    <option value="inquiry">Hard Inquiry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bureau</label>
                  <select 
                    value={formData.bureau} 
                    onChange={(e) => setFormData({...formData, bureau: e.target.value})} 
                    className="select-field"
                  >
                    <option value="all">All Bureaus</option>
                    <option value="experian">Experian</option>
                    <option value="equifax">Equifax</option>
                    <option value="transunion">TransUnion</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Creditor Name</label>
                <input 
                  type="text" 
                  value={formData.creditorName} 
                  onChange={(e) => setFormData({...formData, creditorName: e.target.value})} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                  placeholder="Enter creditor name"
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                  <input 
                    type="text" 
                    value={formData.accountNumber} 
                    onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                    placeholder="****1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Balance</label>
                  <input 
                    type="number" 
                    value={formData.balance} 
                    onChange={(e) => setFormData({...formData, balance: e.target.value})} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                  rows="3"
                  placeholder="Add any notes about this item..."
                ></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  Add Item
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Item Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Item Details</h2>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className={`p-3 ${getBureauColor(selectedItem.bureau)} rounded-xl text-white`}>
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedItem.creditor_name}</h3>
                  <p className="text-sm text-gray-500 uppercase">{selectedItem.bureau}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Item Type</p>
                  <p className="font-medium text-gray-900">{itemTypeLabels[selectedItem.item_type] || selectedItem.item_type}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Balance</p>
                  <p className="font-bold text-xl text-gray-900">${parseFloat(selectedItem.balance || 0).toLocaleString()}</p>
                </div>
              </div>
              {selectedItem.account_number && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Account Number</p>
                  <p className="font-medium text-gray-900">{selectedItem.account_number}</p>
                </div>
              )}
              {selectedItem.description && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-900">{selectedItem.description}</p>
                </div>
              )}
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
