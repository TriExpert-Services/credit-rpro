import React, { useState, useEffect } from 'react';
import { AlertCircle, Download, Save, Eye, Sparkles, Shield, Target, ChevronDown, ChevronUp, Scale, Lightbulb, Zap } from 'lucide-react';
import api from '../services/api';

const DISPUTE_TYPES = [
  { value: 'not_mine', label: 'Not My Account / Identity Theft', icon: '🚫', description: 'You never opened or authorized this account. Demands proof of signed agreement.' },
  { value: 'paid', label: 'Account Already Paid / Settled', icon: '✅', description: 'Account paid in full but still reporting as delinquent. Challenges balance and status.' },
  { value: 'inaccurate_info', label: 'Inaccurate Information', icon: '⚠️', description: 'Account details (balance, dates, status) are incorrect. Challenges every data point.' },
  { value: 'outdated', label: 'Outdated / Expired Information', icon: '📅', description: 'Negative item past 7-year reporting limit under FCRA §605(a). Demands deletion.' },
  { value: 'duplicate', label: 'Duplicate Account Entry', icon: '📋', description: 'Same account listed multiple times. Inflates obligations and damages utilization ratio.' },
  { value: 'other', label: 'Other Dispute Reason', icon: '📝', description: 'Custom dispute — provide your specific reason in the details field below.' },
];

const BUREAUS = [
  { value: 'equifax', label: 'Equifax', color: 'bg-red-500', tactic: 'Challenge automated ACDV verification — demand human review' },
  { value: 'experian', label: 'Experian', color: 'bg-blue-500', tactic: 'Demand they forward COMPLETE dispute documentation to furnisher' },
  { value: 'transunion', label: 'TransUnion', color: 'bg-green-500', tactic: 'Request specific Method of Verification with contact details' },
];

export default function DisputeLetterGenerator() {
  const [creditItems, setCreditItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [disputeType, setDisputeType] = useState('not_mine');
  const [bureau, setBureau] = useState('equifax');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [letterPreview, setLetterPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [strategy, setStrategy] = useState(null);
  const [showStrategyDetails, setShowStrategyDetails] = useState(false);

  useEffect(() => {
    fetchCreditItems();
  }, []);

  // Fetch strategy when item or bureau changes
  useEffect(() => {
    if (selectedItem && bureau) {
      fetchStrategy();
    }
  }, [selectedItem, bureau]);

  const fetchCreditItems = async () => {
    try {
      const response = await api.get('/credit-items');
      const rawItems = Array.isArray(response.data) ? response.data : response.data?.items || [];
      const items = rawItems.map(item => ({
        id: item.id,
        creditorName: item.creditor_name || item.creditorName,
        accountNumber: item.account_number || item.accountNumber,
        accountType: item.item_type || item.accountType,
        itemType: item.item_type || item.itemType,
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

  const fetchStrategy = async () => {
    try {
      const response = await api.get(`/ai-disputes/strategy/${selectedItem}?bureau=${bureau}`);
      setStrategy(response.data);
      
      // Auto-select recommended dispute type
      if (response.data?.strategy?.recommendedDisputeType) {
        setDisputeType(response.data.strategy.recommendedDisputeType);
      }
    } catch (err) {
      console.error('Failed to load strategy:', err);
      setStrategy(null);
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
        additionalDetails: {
          details: additionalDetails,
          round: strategy?.currentRound ? `Round ${strategy.currentRound} - ${strategy.strategy?.round?.name || 'Initial Dispute'}` : 'Round 1 - Initial Dispute'
        }
      });
      setLetterPreview(response.data.letter);
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
      await api.post('/ai-disputes/save', {
        creditItemId: selectedItem,
        content: letterPreview,
        disputeType,
        bureau,
      });
      setSuccess('Letter saved as draft! You can edit and send it later.');
      setLetterPreview('');
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
    element.download = `dispute-letter-${bureau}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const selectedDisputeType = DISPUTE_TYPES.find(t => t.value === disputeType);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-emerald-700 flex-1">{success}</p>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-600">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-800">Generate Dispute Letter</h2>
            </div>

            {/* Credit Item Selection */}
            <div className="mb-4">
              <label htmlFor="credit-item-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Credit Item
              </label>
              <select
                id="credit-item-select"
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Choose an item...</option>
                {creditItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.creditorName} — {item.itemType} ({item.bureau}) — ${item.balance || 0}
                  </option>
                ))}
              </select>
            </div>

            {/* Dispute Type Selection with descriptions */}
            <div className="mb-4">
              <label htmlFor="dispute-type-select" className="block text-sm font-medium text-gray-700 mb-2">
                Dispute Type
                {strategy?.strategy?.recommendedDisputeType && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                    AI Recommended
                  </span>
                )}
              </label>
              <select
                id="dispute-type-select"
                value={disputeType}
                onChange={(e) => setDisputeType(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {DISPUTE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
              {selectedDisputeType && (
                <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  {selectedDisputeType.description}
                </p>
              )}
            </div>

            {/* Bureau Selection with tactics */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Credit Bureau
              </label>
              <div className="space-y-2">
                {BUREAUS.map((b) => (
                  <label
                    key={b.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      bureau === b.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bureau"
                      value={b.value}
                      checked={bureau === b.value}
                      onChange={(e) => setBureau(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${b.color}`}></span>
                        <span className="font-medium text-gray-900">{b.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{b.tactic}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Details */}
            <div className="mb-4">
              <label htmlFor="additional-details" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Details (Optional)
              </label>
              <textarea
                id="additional-details"
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                placeholder="Add any specific information to strengthen your dispute..."
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Strategy Round Indicator */}
            {strategy && (
              <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-indigo-900">
                    Strategy Round {strategy.currentRound || 1}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full">
                    {strategy.strategy?.round?.name || 'Initial Dispute'}
                  </span>
                </div>
                <p className="text-xs text-indigo-700">{strategy.strategy?.round?.approach}</p>
              </div>
            )}

            {/* Action Buttons */}
            <button
              onClick={handleGenerateLetter}
              disabled={loading || !selectedItem}
              className="w-full mb-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-semibold transition-all shadow-lg shadow-indigo-200 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Letter</span>
                </>
              )}
            </button>

            {letterPreview && (
              <>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full mb-3 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 font-medium transition flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Hide' : 'Preview'} Letter
                </button>

                <button
                  onClick={handleDownloadLetter}
                  className="w-full mb-3 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 font-medium transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Letter
                </button>

                <button
                  onClick={handleSaveLetter}
                  disabled={saving}
                  className="w-full px-4 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Preview + Strategy Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Strategy Panel */}
          {strategy && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowStrategyDetails(!showStrategyDetails)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl text-white">
                    <Target size={20} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">AI Strategy Recommendation</h3>
                    <p className="text-sm text-gray-500">
                      {strategy.strategy?.itemType} — Estimated impact: +{strategy.scoreImpact?.estimatedMin}–{strategy.scoreImpact?.estimatedMax} points
                    </p>
                  </div>
                </div>
                {showStrategyDetails ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>

              {showStrategyDetails && (
                <div className="p-4 pt-0 space-y-4">
                  {/* Score Impact */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <p className="text-xs text-emerald-600 font-medium">Estimated Score Gain</p>
                      <p className="text-lg font-bold text-emerald-700">
                        +{strategy.scoreImpact?.estimatedMin}–{strategy.scoreImpact?.estimatedMax} pts
                      </p>
                    </div>
                    <div className="bg-indigo-50 rounded-xl p-3">
                      <p className="text-xs text-indigo-600 font-medium">Projected Score</p>
                      <p className="text-lg font-bold text-indigo-700">
                        {strategy.scoreImpact?.projectedScoreMin}–{strategy.scoreImpact?.projectedScoreMax}
                      </p>
                    </div>
                  </div>

                  {/* Tips */}
                  {strategy.strategy?.tips && strategy.strategy.tips.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2">
                        <Lightbulb size={16} className="text-amber-500" />
                        Strategy Tips
                      </h4>
                      <ul className="space-y-1.5">
                        {strategy.strategy.tips.slice(0, 4).map((tip, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Legal Arguments */}
                  {strategy.strategy?.legalArguments && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2">
                        <Scale size={16} className="text-indigo-500" />
                        Key Legal Citations
                      </h4>
                      <ul className="space-y-1">
                        {strategy.strategy.legalArguments.map((arg, idx) => (
                          <li key={idx} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                            {arg}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bureau-specific tactics */}
                  {strategy.strategy?.bureauStrategy && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2">
                        <Shield size={16} className="text-red-500" />
                        {strategy.strategy.bureauStrategy.name} Specific Tactics
                      </h4>
                      <ul className="space-y-1.5">
                        {strategy.strategy.bureauStrategy.bestTactics.slice(0, 3).map((tactic, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex gap-2">
                            <span className="text-red-400 mt-0.5">→</span>
                            <span>{tactic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Letter Preview */}
          {showPreview && letterPreview && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Letter Preview</h3>
                <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Ready to send</span>
              </div>
              <div className="p-6 bg-amber-50/30 max-h-[600px] overflow-y-auto font-serif text-sm text-gray-800 whitespace-pre-wrap leading-relaxed border-l-4 border-amber-200">
                {letterPreview}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!showPreview && !strategy && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} className="text-indigo-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Item to Begin</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Choose a credit item from the dropdown and our AI will recommend the best dispute strategy with legal citations and bureau-specific tactics.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
