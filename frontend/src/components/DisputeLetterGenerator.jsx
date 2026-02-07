import React, { useState, useEffect } from 'react';
import { AlertCircle, Download, Save, Eye } from 'lucide-react';
import api from '../services/api';

const DISPUTE_TYPES = [
  { value: 'not_mine', label: 'Not My Account (Identity Theft)' },
  { value: 'paid', label: 'Account Already Paid' },
  { value: 'inaccurate_info', label: 'Inaccurate Information' },
  { value: 'outdated', label: 'Outdated Information' },
  { value: 'duplicate', label: 'Duplicate Account' },
  { value: 'other', label: 'Other Reason' },
];

const BUREAUS = [
  { value: 'equifax', label: 'Equifax' },
  { value: 'experian', label: 'Experian' },
  { value: 'transunion', label: 'TransUnion' },
];

export default function DisputeLetterGenerator() {
  const [creditItems, setCreditItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [disputeType, setDisputeType] = useState('not_mine');
  const [bureau, setBureau] = useState('equifax');
  const [letterPreview, setLetterPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchCreditItems();
  }, []);

  const fetchCreditItems = async () => {
    try {
      const response = await api.get('/credit-items');
      // Map snake_case to camelCase
      const items = response.data.map(item => ({
        id: item.id,
        creditorName: item.creditor_name,
        accountNumber: item.account_number,
        accountType: item.item_type,
        itemType: item.item_type,
        balance: item.balance,
        status: item.status,
        bureau: item.bureau,
        description: item.description
      }));
      setCreditItems(items);
      if (items.length > 0) {
        setSelectedItem(items[0].id);
      }
    } catch (err) {
      setError('Failed to load credit items');
      console.error(err);
    }
  };

  const handleGenerateLetter = async () => {
    if (!selectedItem) {
      setError('Please select a credit item');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/ai-disputes/generate', {
        creditItemId: selectedItem,
        disputeType,
        bureau,
      });
      setLetterPreview(response.data.data?.letter || response.data.letter);
      setShowPreview(true);
      setSuccess('Letter generated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to generate letter');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLetter = async () => {
    if (!letterPreview) {
      setError('Generate a letter first');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await api.post('/ai-disputes/save', {
        creditItemId: selectedItem,
        content: letterPreview,
        disputeType,
        bureau,
      });
      setSuccess('Letter saved as draft! You can edit and send it later.');
      setLetterPreview('');
      setSelectedItem('');
      setDisputeType('not_mine');
      setBureau('equifax');
      setShowPreview(false);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to save letter');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadLetter = () => {
    const element = document.createElement('a');
    const file = new Blob([letterPreview], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `dispute-letter-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-800">Generate Dispute Letter</h2>

            {/* Credit Item Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Select Credit Item
              </label>
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="select-field"
              >
                <option value="">Choose an item...</option>
                {creditItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.creditorName} - {item.itemType} ({item.bureau})
                  </option>
                ))}
              </select>
            </div>

            {/* Dispute Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Dispute Type
              </label>
              <select
                value={disputeType}
                onChange={(e) => setDisputeType(e.target.value)}
                className="select-field"
              >
                {DISPUTE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Bureau Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Credit Bureau
              </label>
              <select
                value={bureau}
                onChange={(e) => setBureau(e.target.value)}
                className="select-field"
              >
                {BUREAUS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleGenerateLetter}
              disabled={loading || !selectedItem}
              className="w-full mb-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
            >
              {loading ? 'Generating...' : 'Generate Letter'}
            </button>

            {letterPreview && (
              <>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full mb-3 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium transition flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Hide' : 'Preview'} Letter
                </button>

                <button
                  onClick={handleDownloadLetter}
                  className="w-full mb-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Letter
                </button>

                <button
                  onClick={handleSaveLetter}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Preview Section */}
        {showPreview && letterPreview && (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Letter Preview</h3>
              <div className="bg-gray-50 p-6 rounded-md border border-gray-200 max-h-96 overflow-y-auto font-serif text-sm text-gray-800 whitespace-pre-wrap">
                {letterPreview}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
