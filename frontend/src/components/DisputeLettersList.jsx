import React, { useState, useEffect } from 'react';
import { Trash2, Send, Eye, AlertCircle } from 'lucide-react';
import api from '../services/api';

const STATUS_COLORS = {
  draft: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  sent: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
};

export default function DisputeLettersList() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, draft, sent
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/ai-disputes/drafts');
      setDisputes(response.data);
    } catch (err) {
      setError('Failed to load disputes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendDispute = async (disputeId) => {
    setSendingId(disputeId);
    setError('');
    try {
      await api.patch(`/api/ai-disputes/${disputeId}/send`);
      setSuccess('Dispute letter sent successfully!');
      fetchDisputes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send dispute');
    } finally {
      setSendingId(null);
    }
  };

  const handleDeleteDispute = async (disputeId) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) return;

    setDeletingId(disputeId);
    setError('');
    try {
      await api.delete(`/api/ai-disputes/${disputeId}`);
      setSuccess('Draft deleted successfully');
      fetchDisputes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete dispute');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDisputes = disputes.filter((dispute) => {
    if (filter === 'draft') return dispute.status === 'draft';
    if (filter === 'sent') return dispute.status === 'sent';
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">Loading disputes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          All ({disputes.length})
        </button>
        <button
          onClick={() => setFilter('draft')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'draft'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          Drafts ({disputes.filter((d) => d.status === 'draft').length})
        </button>
        <button
          onClick={() => setFilter('sent')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'sent'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          Sent ({disputes.filter((d) => d.status === 'sent').length})
        </button>
      </div>

      {/* Disputes List */}
      {filteredDisputes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-2">No disputes found</p>
          <p className="text-gray-400 text-sm">Generate your first dispute letter to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((dispute) => {
            const statusColor = STATUS_COLORS[dispute.status] || STATUS_COLORS.draft;
            return (
              <div
                key={dispute.id}
                className={`rounded-lg border-2 p-4 ${statusColor.border} ${statusColor.bg}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {dispute.creditItem?.creditorName || 'Unknown Creditor'}
                      </h3>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor.text}`}
                      >
                        {dispute.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">Dispute Type:</span> {dispute.disputeType}
                    </p>
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">Bureau:</span> {dispute.bureau}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created: {new Date(dispute.createdAt).toLocaleDateString()}
                      {dispute.sentAt && (
                        <>
                          {' | '}
                          Sent: {new Date(dispute.sentAt).toLocaleDateString()}
                        </>
                      )}
                      {dispute.trackingNumber && (
                        <>
                          {' | '}
                          Tracking: {dispute.trackingNumber}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedDispute(dispute);
                        setShowPreview(true);
                      }}
                      title="Preview"
                      className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {dispute.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleSendDispute(dispute.id)}
                          disabled={sendingId === dispute.id}
                          title="Send"
                          className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 transition"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDispute(dispute.id)}
                          disabled={deletingId === dispute.id}
                          title="Delete"
                          className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-gray-100 px-6 py-4 flex justify-between items-center border-b">
              <h3 className="font-semibold text-gray-900">Letter Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-600 hover:text-gray-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 font-serif text-sm text-gray-800 whitespace-pre-wrap">
              {selectedDispute.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
