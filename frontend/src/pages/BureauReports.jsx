import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/Auth0Context';
import { useAccess } from '../context/AccessContext';
import api, { getErrorMessage } from '../services/api';
import {
  Building2, RefreshCw, Shield, AlertTriangle, TrendingUp, TrendingDown,
  Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Eye, Download,
  Settings, Zap, ArrowUpRight, ArrowDownRight, Minus, Bell, BarChart3,
  Activity, FileText, Globe, Lock, Loader2, Info, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';

const BUREAU_COLORS = {
  experian: { primary: '#3B82F6', gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  equifax: { primary: '#EF4444', gradient: 'from-red-500 to-red-600', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  transunion: { primary: '#10B981', gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

const SEVERITY_STYLES = {
  high: { bg: 'bg-red-500/20', text: 'text-red-300', icon: AlertTriangle },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: Info },
  low: { bg: 'bg-blue-500/20', text: 'text-blue-300', icon: Activity },
};

export default function BureauReports() {
  const { user } = useAuth();
  const { isAdmin } = useAccess();

  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data state
  const [bureauStatus, setBureauStatus] = useState({});
  const [snapshots, setSnapshots] = useState([]);
  const [changes, setChanges] = useState([]);
  const [pullHistory, setPullHistory] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [autoPullConfig, setAutoPullConfig] = useState(null);
  const [timeline, setTimeline] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSnapshot, setExpandedSnapshot] = useState(null);
  const [showAutoPullModal, setShowAutoPullModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);

  const clientId = selectedClient || user?.id;

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');

    try {
      const promises = [
        api.get(`/bureau/snapshots/${clientId}`).catch(() => ({ data: { snapshots: [] } })),
        api.get(`/bureau/changes/${clientId}?limit=30`).catch(() => ({ data: { changes: [] } })),
        api.get(`/bureau/pull-history/${clientId}`).catch(() => ({ data: { history: [] } })),
        api.get(`/bureau/compare/${clientId}`).catch(() => ({ data: null })),
        api.get(`/bureau/auto-pull/${clientId}`).catch(() => ({ data: { config: null } })),
        api.get(`/bureau/changes/${clientId}/timeline`).catch(() => ({ data: { timeline: [] } })),
      ];

      if (isAdmin) {
        promises.push(api.get('/bureau/status').catch(() => ({ data: {} })));
        promises.push(api.get('/clients').catch(() => ({ data: [] })));
      }

      const results = await Promise.all(promises);

      setSnapshots(results[0].data?.snapshots || results[0].data || []);
      const changesData = results[1].data?.changes || results[1].data || [];
      setChanges(Array.isArray(changesData) ? changesData : changesData.changes || []);
      setPullHistory(results[2].data?.history || results[2].data || []);
      setComparison(results[3].data);
      setAutoPullConfig(results[4].data?.config || results[4].data || null);
      setTimeline(results[5].data?.timeline || results[5].data || []);

      if (isAdmin) {
        setBureauStatus(results[6]?.data || {});
        setClients(Array.isArray(results[7]?.data) ? results[7].data : []);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Error cargando datos de bureaus'));
    } finally {
      setLoading(false);
    }
  }, [clientId, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Pull report from a single bureau
  const pullReport = async (bureau) => {
    setPulling((prev) => ({ ...prev, [bureau]: true }));
    setError('');
    setSuccess('');

    try {
      if (isAdmin && selectedClient) {
        await api.post(`/bureau/pull/${clientId}/${bureau}`);
      } else {
        await api.post(`/bureau/pull-own/${bureau}`);
      }
      setSuccess(`Reporte de ${bureau} importado exitosamente`);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, `Error importando reporte de ${bureau}`));
    } finally {
      setPulling((prev) => ({ ...prev, [bureau]: false }));
    }
  };

  // Pull from all bureaus
  const pullAllBureaus = async () => {
    setPulling({ experian: true, equifax: true, transunion: true });
    setError('');
    setSuccess('');

    try {
      await api.post(`/bureau/pull-all/${clientId}`);
      setSuccess('Reportes de los 3 bureaus importados exitosamente');
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, 'Error importando reportes'));
    } finally {
      setPulling({});
    }
  };

  // Save auto-pull config
  const saveAutoPull = async (config) => {
    try {
      await api.put(`/bureau/auto-pull/${clientId}`, config);
      setAutoPullConfig(config);
      setShowAutoPullModal(false);
      setSuccess('Configuración de auto-pull actualizada');
    } catch (err) {
      setError(getErrorMessage(err, 'Error guardando configuración'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400">Cargando datos de bureaus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reportes de Crédito</h1>
            <p className="text-slate-400 text-sm">Importación automática desde Experian, Equifax y TransUnion</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <select
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500"
              value={selectedClient || ''}
              onChange={(e) => setSelectedClient(e.target.value || null)}
            >
              <option value="">Mi cuenta</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} — {c.email}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={pullAllBureaus}
            disabled={Object.values(pulling).some(Boolean)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {Object.values(pulling).some(Boolean) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Importar 3 Bureaus
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
          <XCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm">{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-emerald-400 hover:text-emerald-300">&times;</button>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex items-center gap-1 p-1 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-x-auto">
        {[
          { id: 'overview', label: 'Vista General', icon: BarChart3 },
          { id: 'changes', label: 'Cambios', icon: Activity },
          { id: 'history', label: 'Historial', icon: Clock },
          { id: 'settings', label: 'Configuración', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          snapshots={snapshots}
          comparison={comparison}
          timeline={timeline}
          changes={changes}
          pulling={pulling}
          onPull={pullReport}
          expandedSnapshot={expandedSnapshot}
          setExpandedSnapshot={setExpandedSnapshot}
        />
      )}
      {activeTab === 'changes' && (
        <ChangesTab changes={changes} />
      )}
      {activeTab === 'history' && (
        <HistoryTab pullHistory={pullHistory} />
      )}
      {activeTab === 'settings' && (
        <SettingsTab
          autoPullConfig={autoPullConfig}
          onSave={saveAutoPull}
          bureauStatus={bureauStatus}
          isAdmin={isAdmin}
        />
      )}

      {/* Auto-pull Modal */}
      {showAutoPullModal && (
        <AutoPullModal
          config={autoPullConfig}
          onSave={saveAutoPull}
          onClose={() => setShowAutoPullModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({ snapshots, comparison, timeline, changes, pulling, onPull, expandedSnapshot, setExpandedSnapshot }) {
  const bureaus = ['experian', 'equifax', 'transunion'];

  return (
    <div className="space-y-6">
      {/* Bureau Cards — one per bureau */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bureaus.map((bureau) => {
          const snapshot = snapshots.find((s) => s.bureau === bureau);
          const colors = BUREAU_COLORS[bureau];
          const isPulling = pulling[bureau];

          return (
            <div
              key={bureau}
              className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden"
            >
              {/* Bureau header */}
              <div className={`p-4 bg-gradient-to-r ${colors.gradient} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold capitalize">{bureau}</span>
                </div>
                <button
                  onClick={() => onPull(bureau)}
                  disabled={isPulling}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-50"
                >
                  {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Importar
                </button>
              </div>

              {/* Score & Stats */}
              <div className="p-5">
                {snapshot ? (
                  <>
                    <div className="flex items-end gap-3 mb-4">
                      <span className="text-4xl font-bold text-white">{snapshot.score || '—'}</span>
                      <span className="text-slate-400 text-sm mb-1">
                        {getScoreLabel(snapshot.score)}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-400">
                        <span>Fecha del reporte</span>
                        <span className="text-slate-300">{formatDate(snapshot.report_date)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Cambios detectados</span>
                        <span className={snapshot.changes_count > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                          {snapshot.changes_count || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Última actualización</span>
                        <span className="text-slate-300">{formatTimeAgo(snapshot.created_at)}</span>
                      </div>
                    </div>

                    {/* Expand/collapse raw data */}
                    <button
                      onClick={() => setExpandedSnapshot(expandedSnapshot === bureau ? null : bureau)}
                      className="mt-4 w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {expandedSnapshot === bureau ? (
                        <><ChevronUp className="w-3.5 h-3.5" /> Ocultar detalles</>
                      ) : (
                        <><ChevronDown className="w-3.5 h-3.5" /> Ver detalles</>
                      )}
                    </button>

                    {expandedSnapshot === bureau && snapshot.report_data && (
                      <SnapshotDetail data={typeof snapshot.report_data === 'string' ? JSON.parse(snapshot.report_data) : snapshot.report_data} />
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center py-6 text-slate-500">
                    <Globe className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">Sin reporte importado</p>
                    <p className="text-xs mt-1">Haz clic en "Importar" para obtenerlo</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-Bureau Comparison */}
      {comparison && comparison.scores && Object.keys(comparison.scores).length >= 2 && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Comparación entre Bureaus</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score comparison chart */}
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(comparison.scores).map(([b, s]) => ({ bureau: b, score: s }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="bureau" stroke="#94a3b8" fontSize={12} textTransform="capitalize" />
                  <YAxis domain={[300, 850]} stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '0.75rem' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                    {Object.entries(comparison.scores).map(([b]) => (
                      <Cell key={b} fill={BUREAU_COLORS[b]?.primary || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Discrepancies */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Spread máximo</span>
                <span className={`font-medium ${comparison.maxScoreSpread > 40 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {comparison.maxScoreSpread} pts
                </span>
              </div>

              {(comparison.discrepancies || []).map((disc, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-amber-300">{disc.description}</p>
                    <p className="text-xs text-slate-500 mt-1">Severidad: {disc.severity}</p>
                  </div>
                </div>
              ))}

              {(!comparison.discrepancies || comparison.discrepancies.length === 0) && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm text-emerald-300">No se detectaron discrepancias significativas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Changes */}
      {changes.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">Cambios Recientes</h3>
            </div>
            <span className="text-xs text-slate-500 bg-slate-700/50 px-2.5 py-1 rounded-full">{changes.length} cambios</span>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {changes.slice(0, 10).map((change, i) => {
              const sev = SEVERITY_STYLES[change.severity] || SEVERITY_STYLES.low;
              const SevIcon = sev.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                  <div className={`p-1.5 rounded-lg ${sev.bg}`}>
                    <SevIcon className={`w-4 h-4 ${sev.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{change.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs capitalize ${BUREAU_COLORS[change.bureau]?.text || 'text-slate-400'}`}>
                        {change.bureau}
                      </span>
                      <span className="text-xs text-slate-500">{formatTimeAgo(change.created_at)}</span>
                      {change.delta && (
                        <span className={`text-xs flex items-center gap-0.5 ${change.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {change.delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {change.delta > 0 ? '+' : ''}{change.delta}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score Timeline Chart */}
      {timeline.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Línea de Tiempo de Cambios</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={timeline.map((t) => ({ ...t, week: formatDate(t.week) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '0.75rem' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="change_count" stroke="#818cf8" fill="#818cf8" fillOpacity={0.2} name="Cambios" />
              <Area type="monotone" dataKey="high_severity" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Alta Severidad" />
              <Area type="monotone" dataKey="positive_changes" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Positivos" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Snapshot Detail — expandable view of a bureau's report data
// ============================================================================

function SnapshotDetail({ data }) {
  if (!data) return null;

  return (
    <div className="mt-4 space-y-4 border-t border-slate-700/30 pt-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Cuentas abiertas', value: data.summary?.openAccounts },
          { label: 'Balance total', value: data.summary?.totalBalance ? `$${data.summary.totalBalance.toLocaleString()}` : '—' },
          { label: 'Items negativos', value: data.summary?.totalNegativeItems },
          { label: 'Hard inquiries', value: data.summary?.totalInquiries },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/50 rounded-lg p-2.5">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="text-sm font-medium text-white">{stat.value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Score factors */}
      {data.score?.factors?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Factores del Score</p>
          <div className="space-y-1">
            {data.score.factors.map((f, i) => (
              <p key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                <Minus className="w-3 h-3 mt-0.5 shrink-0 text-slate-600" />
                {f.description}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Negative items */}
      {data.negativeItems?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-red-400 mb-2">Items Negativos ({data.negativeItems.length})</p>
          <div className="space-y-1.5">
            {data.negativeItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2 bg-red-500/5 rounded-lg border border-red-500/10">
                <div>
                  <span className="text-slate-300">{item.creditor}</span>
                  <span className="text-slate-600 ml-2">({item.type})</span>
                </div>
                <span className="text-red-400 font-medium">${item.balance?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Changes Tab
// ============================================================================

function ChangesTab({ changes }) {
  const [filterBureau, setFilterBureau] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const filtered = changes.filter((c) => {
    if (filterBureau !== 'all' && c.bureau !== filterBureau) return false;
    if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterBureau}
          onChange={(e) => setFilterBureau(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
        >
          <option value="all">Todos los Bureaus</option>
          <option value="experian">Experian</option>
          <option value="equifax">Equifax</option>
          <option value="transunion">TransUnion</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
        >
          <option value="all">Todas las Severidades</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
        <span className="text-xs text-slate-500">{filtered.length} cambios</span>
      </div>

      {/* Changes list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-500">
          <Activity className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm">No se encontraron cambios</p>
          <p className="text-xs mt-1">Importa reportes para comenzar a rastrear cambios</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((change, i) => {
            const sev = SEVERITY_STYLES[change.severity] || SEVERITY_STYLES.low;
            const SevIcon = sev.icon;
            return (
              <div key={i} className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${sev.bg}`}>
                    <SevIcon className={`w-4 h-4 ${sev.text}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${BUREAU_COLORS[change.bureau]?.bg} ${BUREAU_COLORS[change.bureau]?.text}`}>
                        {change.bureau}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>
                        {change.severity}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                        {change.change_type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 mt-2">{change.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>{formatTimeAgo(change.created_at)}</span>
                      {change.delta !== null && change.delta !== undefined && (
                        <span className={`flex items-center gap-0.5 ${change.delta > 0 ? 'text-emerald-400' : change.delta < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {change.delta > 0 ? <TrendingUp className="w-3 h-3" /> : change.delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {change.delta > 0 ? '+' : ''}{change.delta}
                        </span>
                      )}
                      {change.is_positive && (
                        <span className="flex items-center gap-0.5 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Positivo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// History Tab
// ============================================================================

function HistoryTab({ pullHistory }) {
  const statusStyles = {
    completed: { icon: CheckCircle2, text: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    failed: { icon: XCircle, text: 'text-red-400', bg: 'bg-red-500/20' },
    in_progress: { icon: Loader2, text: 'text-amber-400', bg: 'bg-amber-500/20' },
    pending: { icon: Clock, text: 'text-slate-400', bg: 'bg-slate-500/20' },
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/30 flex items-center gap-2">
        <Clock className="w-5 h-5 text-slate-400" />
        <h3 className="text-lg font-semibold text-white">Historial de Importaciones</h3>
      </div>

      {pullHistory.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm">Sin historial de importaciones</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-700/30">
          {pullHistory.map((pull, i) => {
            const status = statusStyles[pull.status] || statusStyles.pending;
            const StatusIcon = status.icon;
            return (
              <div key={i} className="p-4 flex items-center gap-4 hover:bg-slate-700/10 transition-colors">
                <div className={`p-2 rounded-lg ${status.bg}`}>
                  <StatusIcon className={`w-4 h-4 ${status.text} ${pull.status === 'in_progress' ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium capitalize ${BUREAU_COLORS[pull.bureau]?.text || 'text-white'}`}>
                      {pull.bureau}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                      {pull.pull_type}
                    </span>
                  </div>
                  {pull.error_message && (
                    <p className="text-xs text-red-400 mt-1 truncate">{pull.error_message}</p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{formatTimeAgo(pull.created_at)}</p>
                  {pull.requested_by_name && <p className="mt-0.5">por {pull.requested_by_name}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Settings Tab
// ============================================================================

function SettingsTab({ autoPullConfig, onSave, bureauStatus, isAdmin }) {
  const [config, setConfig] = useState({
    enabled: autoPullConfig?.enabled || false,
    frequency: autoPullConfig?.frequency || 'monthly',
    bureaus: autoPullConfig?.bureaus 
      ? (typeof autoPullConfig.bureaus === 'string' ? JSON.parse(autoPullConfig.bureaus) : autoPullConfig.bureaus) 
      : ['experian', 'equifax', 'transunion'],
  });

  const freqOptions = [
    { value: 'weekly', label: 'Semanal' },
    { value: 'biweekly', label: 'Quincenal' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'quarterly', label: 'Trimestral' },
  ];

  return (
    <div className="space-y-6">
      {/* Auto-Pull Configuration */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Importación Automática</h3>
        </div>

        <div className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Activar auto-pull</p>
              <p className="text-xs text-slate-500 mt-0.5">Los reportes se importarán automáticamente según la frecuencia configurada</p>
            </div>
            <button
              onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Frecuencia</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {freqOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setConfig((prev) => ({ ...prev, frequency: opt.value }))}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    config.frequency === opt.value
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-slate-900/50 text-slate-400 border border-slate-700/30 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bureau selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Bureaus a importar</label>
            <div className="grid grid-cols-3 gap-2">
              {['experian', 'equifax', 'transunion'].map((bureau) => {
                const isSelected = config.bureaus.includes(bureau);
                const colors = BUREAU_COLORS[bureau];
                return (
                  <button
                    key={bureau}
                    onClick={() => {
                      setConfig((prev) => ({
                        ...prev,
                        bureaus: isSelected
                          ? prev.bureaus.filter((b) => b !== bureau)
                          : [...prev.bureaus, bureau],
                      }));
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium capitalize transition-all ${
                      isSelected
                        ? `${colors.bg} ${colors.text} border ${colors.border}`
                        : 'bg-slate-900/50 text-slate-500 border border-slate-700/30 hover:border-slate-600'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    {bureau}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next pull info */}
          {autoPullConfig?.next_pull_date && (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900/50 p-3 rounded-xl">
              <Clock className="w-4 h-4" />
              <span>Próxima importación: {formatDate(autoPullConfig.next_pull_date)}</span>
            </div>
          )}

          {/* Save */}
          <button
            onClick={() => onSave(config)}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium transition-all"
          >
            Guardar Configuración
          </button>
        </div>
      </div>

      {/* Admin: Bureau Connections */}
      {isAdmin && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-white">Conexiones de Bureau (Admin)</h3>
          </div>

          <div className="space-y-3">
            {['experian', 'equifax', 'transunion'].map((bureau) => {
              const status = bureauStatus[bureau] || {};
              const colors = BUREAU_COLORS[bureau];
              return (
                <div key={bureau} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <Shield className={`w-5 h-5 ${colors.text}`} />
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{bureau}</p>
                      <p className="text-xs text-slate-500">{status.baseUrl || 'No configurado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      status.mode === 'live'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {status.mode === 'live' ? 'En vivo' : 'Sandbox'}
                    </span>
                  </div>
                </div>
              );
            })}

            <p className="text-xs text-slate-500 mt-2">
              Las credenciales de API se configuran via variables de entorno
              (EXPERIAN_CLIENT_ID, EQUIFAX_CLIENT_ID, TRANSUNION_CLIENT_ID, etc.)
              o desde Configuración del Admin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Auto-Pull Modal
// ============================================================================

function AutoPullModal({ config, onSave, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Configurar Auto-Pull</h3>
        <p className="text-sm text-slate-400">Usa la pestaña de Configuración para gestionar la importación automática.</p>
        <button onClick={onClose} className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getScoreLabel(score) {
  if (!score) return '';
  if (score >= 800) return 'Excelente';
  if (score >= 740) return 'Muy Bueno';
  if (score >= 670) return 'Bueno';
  if (score >= 580) return 'Regular';
  return 'Pobre';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '—';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days}d`;
    return formatDate(dateStr);
  } catch {
    return '—';
  }
}
