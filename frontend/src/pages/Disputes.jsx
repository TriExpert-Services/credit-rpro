import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/Auth0Context';
import { disputeService, creditItemService } from '../services/api';
import { 
  Send, Eye, X, FileText, Plus, Clock, CheckCircle2, AlertCircle,
  ChevronRight, Filter, Building2, Mail, Calendar, Download
} from 'lucide-react';
import { format } from 'date-fns';

export default function Disputes() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [disputesRes, itemsRes] = await Promise.all([
        disputeService.getDisputes(user.id),
        creditItemService.getItems(user.id)
      ]);
      setDisputes(disputesRes.data.disputes || []);
      setItems(itemsRes.data.items || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await disputeService.createDispute({
        clientId: user.id,
        creditItemId: formData.get('creditItemId'),
        disputeType: formData.get('disputeType'),
        bureau: formData.get('bureau')
      });
      setShowForm(false);
      loadData();
    } catch (error) {
      alert('Error creating dispute');
    }
  };

  const viewLetter = async (id) => {
    const res = await disputeService.getDispute(id);
    setSelectedDispute(res.data.dispute);
  };

  const stats = useMemo(() => {
    const byStatus = disputes.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});
    return { total: disputes.length, byStatus };
  }, [disputes]);

  const filteredDisputes = useMemo(() => {
    if (filterStatus === 'all') return disputes;
    return disputes.filter(d => d.status === filterStatus);
  }, [disputes, filterStatus]);

  const getStatusConfig = (status) => {
    const configs = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: FileText, label: 'Draft' },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      sent: { color: 'bg-blue-100 text-blue-800', icon: Mail, label: 'Sent' },
      resolved: { color: 'bg-green-100 text-green-800', icon: CheckCircle2, label: 'Resolved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Rejected' }
    };
    return configs[status] || configs.pending;
  };

  const getBureauColor = (bureau) => {
    const colors = { equifax: 'bg-red-500', experian: 'bg-blue-500', transunion: 'bg-green-500' };
    return colors[bureau] || 'bg-gray-500';
  };

  const disputeTypeLabels = {
    not_mine: 'Not My Account',
    inaccurate_info: 'Inaccurate Information',
    paid: 'Already Paid',
    outdated: 'Outdated Information',
    fraud: 'Fraud/Identity Theft'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading disputes...</p>
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
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Disputes</h1>
              <p className="text-gray-500">Track and manage your credit report disputes</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(true)} 
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-200"
        >
          <Plus size={20} />
          New Dispute
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <FileText size={24} className="text-slate-400" />
            <span className="text-xs bg-white/10 px-2 py-1 rounded-full">Total</span>
          </div>
          <p className="text-4xl font-bold">{stats.total}</p>
          <p className="text-slate-400 text-sm mt-1">All Disputes</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <Clock size={24} className="text-yellow-200" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Pending</span>
          </div>
          <p className="text-4xl font-bold">{stats.byStatus.pending || 0}</p>
          <p className="text-yellow-100 text-sm mt-1">Awaiting Response</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <Mail size={24} className="text-blue-200" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Active</span>
          </div>
          <p className="text-4xl font-bold">{stats.byStatus.sent || 0}</p>
          <p className="text-blue-100 text-sm mt-1">Letters Sent</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle2 size={24} className="text-emerald-200" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Success</span>
          </div>
          <p className="text-4xl font-bold">{stats.byStatus.resolved || 0}</p>
          <p className="text-emerald-100 text-sm mt-1">Resolved</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <Filter size={18} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          <div className="flex gap-2">
            {['all', 'draft', 'pending', 'sent', 'resolved'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === status 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Disputes List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Dispute Letters ({filteredDisputes.length})</h3>
        </div>

        {filteredDisputes.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No disputes found</p>
            <p className="text-gray-400 text-sm mt-1">Create a new dispute to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDisputes.map((dispute) => {
              const statusConfig = getStatusConfig(dispute.status);
              const StatusIcon = statusConfig.icon;
              return (
                <div key={dispute.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 ${getBureauColor(dispute.bureau)} rounded-xl text-white`}>
                      <Building2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 truncate">{dispute.creditor_name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="uppercase font-medium">{dispute.bureau}</span>
                        <span>•</span>
                        <span>{disputeTypeLabels[dispute.dispute_type] || dispute.dispute_type}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {dispute.created_at ? format(new Date(dispute.created_at), 'MMM d, yyyy') : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => viewLetter(dispute.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <Eye size={16} />
                      View Letter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dispute Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-100">Create New Dispute</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-300">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Item to Dispute</label>
                <select 
                  name="creditItemId" 
                  className="select-field" 
                  required
                >
                  <option value="">Select an item...</option>
                  {items.filter(i => i.status !== 'deleted').map(item => (
                    <option key={item.id} value={item.id}>
                      {item.creditor_name} - {item.item_type.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Dispute Type</label>
                  <select 
                    name="disputeType" 
                    className="select-field" 
                    required
                  >
                    <option value="not_mine">Not My Account</option>
                    <option value="inaccurate_info">Inaccurate Info</option>
                    <option value="paid">Already Paid</option>
                    <option value="outdated">Outdated</option>
                    <option value="fraud">Fraud</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bureau</label>
                  <select 
                    name="bureau" 
                    className="select-field" 
                    required
                  >
                    <option value="experian">Experian</option>
                    <option value="equifax">Equifax</option>
                    <option value="transunion">TransUnion</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
                >
                  Create Dispute
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="px-6 py-3 border border-slate-700 text-slate-300 rounded-xl font-medium hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Letter Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedDispute(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${getBureauColor(selectedDispute.bureau)} rounded-lg text-white`}>
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Dispute Letter</h2>
                  <p className="text-sm text-gray-500">{selectedDispute.creditor_name} • {selectedDispute.bureau}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDispute(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="bg-gray-50 rounded-xl p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {selectedDispute.letter_content}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedDispute(null)}
                className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button 
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
