import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import { 
  Upload, FileText, CheckCircle, AlertCircle, Sparkles, TrendingUp, 
  BarChart3, Shield, Zap, ChevronRight, X, FileUp, Brain, Target,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Download, Eye,
  AlertTriangle, TrendingDown, Activity, Award
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';

const bureaus = [
  { id: 'experian', name: 'Experian', color: 'from-blue-500 to-blue-600', bg: 'bg-sky-500', light: 'bg-sky-500/10', text: 'text-sky-400' },
  { id: 'equifax', name: 'Equifax', color: 'from-red-500 to-red-600', bg: 'bg-rose-500', light: 'bg-rose-500/10', text: 'text-rose-400' },
  { id: 'transunion', name: 'TransUnion', color: 'from-green-500 to-green-600', bg: 'bg-emerald-500', light: 'bg-emerald-500/10', text: 'text-emerald-400' }
];

export default function CreditReportAnalysis() {
  const { user } = useAuth();
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [creditItems, setCreditItems] = useState([]);
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatingDisputes, setGeneratingDisputes] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [projections, setProjections] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const clientId = user.role === 'admin' ? (new URLSearchParams(window.location.search).get('clientId') || user.id) : user.id;
      
      const [itemsRes, scoresRes] = await Promise.all([
        api.get(`/credit-reports/items/${clientId}`),
        api.get(`/credit-reports/scores/${clientId}`)
      ]);
      
      setCreditItems(itemsRes.data.items || []);
      setScores(scoresRes.data);

      // Fetch anomalies and projections in parallel
      try {
        const [anomaliesRes, projectionsRes] = await Promise.all([
          api.get(`/credit-scores/${clientId}/anomalies`),
          api.get(`/credit-scores/${clientId}/projections`)
        ]);
        setAnomalies(anomaliesRes.data);
        setProjections(projectionsRes.data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = creditItems.length;
    const identified = creditItems.filter(i => i.status === 'identified').length;
    const inDispute = creditItems.filter(i => i.status === 'in_dispute').length;
    const resolved = creditItems.filter(i => i.status === 'resolved').length;
    const totalBalance = creditItems.reduce((sum, i) => sum + parseFloat(i.balance || 0), 0);
    return { total, identified, inDispute, resolved, totalBalance };
  }, [creditItems]);

  const pieData = useMemo(() => {
    return [
      { name: 'Identified', value: stats.identified, color: '#f59e0b' },
      { name: 'In Dispute', value: stats.inDispute, color: '#3b82f6' },
      { name: 'Resolved', value: stats.resolved, color: '#10b981' }
    ].filter(d => d.value > 0);
  }, [stats]);

  const handleFileChange = (bureau, e) => {
    const file = e.target.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, [bureau]: file }));
    }
  };

  const handleDrop = (bureau, e) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, [bureau]: file }));
    }
  };

  const handleUpload = async () => {
    const selectedBureaus = Object.keys(files);
    if (selectedBureaus.length === 0) {
      setError('Por favor selecciona al menos un reporte');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      const bureauList = [];
      
      selectedBureaus.forEach(bureau => {
        formData.append('reports', files[bureau]);
        bureauList.push(bureau);
      });
      
      formData.append('bureaus', JSON.stringify(bureauList));
      
      const clientId = user.role === 'admin' ? (new URLSearchParams(window.location.search).get('clientId') || user.id) : user.id;
      formData.append('clientId', clientId);

      const response = await api.post('/credit-reports/upload-and-analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setAnalysisResult(response.data);
      setSuccess(`Análisis completado: ${response.data.totalItemsFound} items encontrados`);
      setFiles({});
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al analizar reportes');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateDisputes = async () => {
    setGeneratingDisputes(true);
    setError('');
    
    try {
      const clientId = user.role === 'admin' ? (new URLSearchParams(window.location.search).get('clientId') || user.id) : user.id;
      const itemIds = creditItems.filter(item => item.status === 'identified').map(item => item.id);
      
      if (itemIds.length === 0) {
        setError('No hay items identificados para disputar');
        return;
      }

      const response = await api.post(`/credit-reports/generate-disputes/${clientId}`, {
        itemIds,
        disputeType: 'inaccurate_info'
      });

      setSuccess(`${response.data.disputesGenerated} cartas de disputa generadas exitosamente`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar disputas');
    } finally {
      setGeneratingDisputes(false);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      identified: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: AlertCircle, label: 'Identificado' },
      in_dispute: { bg: 'bg-sky-500/20', text: 'text-sky-400', icon: FileText, label: 'En Disputa' },
      resolved: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle, label: 'Resuelto' },
      deleted: { bg: 'bg-slate-700/50', text: 'text-slate-300', icon: X, label: 'Eliminado' }
    };
    return configs[status] || configs.identified;
  };

  const getScoreCategory = (score) => {
    if (score >= 750) return { label: 'Excelente', color: 'text-emerald-600', bg: 'bg-emerald-500' };
    if (score >= 700) return { label: 'Bueno', color: 'text-sky-400', bg: 'bg-sky-500' };
    if (score >= 650) return { label: 'Regular', color: 'text-amber-500', bg: 'bg-amber-500' };
    if (score >= 600) return { label: 'Bajo', color: 'text-orange-600', bg: 'bg-orange-500' };
    return { label: 'Muy Bajo', color: 'text-rose-400', bg: 'bg-rose-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Cargando análisis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/25">
            <Brain size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Análisis IA de Crédito</h1>
            <p className="text-slate-400">Analiza tus reportes con inteligencia artificial</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl shadow-lg">
            <Sparkles size={18} className="animate-pulse" />
            <span className="text-sm font-semibold">Powered by GPT-4</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {creditItems.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-700/30">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl">
                <Target size={20} className="text-indigo-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-sm text-slate-400">Total Items</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-700/30">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <AlertCircle size={20} className="text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-500">{stats.identified}</p>
            <p className="text-sm text-slate-400">Identificados</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-700/30">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-sky-500/20 rounded-xl">
                <FileText size={20} className="text-sky-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-sky-400">{stats.inDispute}</p>
            <p className="text-sm text-slate-400">En Disputa</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-700/30">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <CheckCircle size={20} className="text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{stats.resolved}</p>
            <p className="text-sm text-slate-400">Resueltos</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-700/30">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-rose-100 rounded-xl">
                <TrendingUp size={20} className="text-rose-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">${stats.totalBalance.toLocaleString()}</p>
            <p className="text-sm text-slate-400">Balance Total</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl text-white">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Subir Reportes de Crédito</h2>
              <p className="text-sm text-slate-400">Arrastra o selecciona tus reportes de los 3 burós</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* How it works */}
          <div className="mb-6 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={18} className="text-indigo-400" />
              <span className="font-semibold text-indigo-400">¿Cómo funciona?</span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span className="text-slate-300">Sube tus reportes</span>
              </div>
              <ChevronRight size={16} className="text-slate-500 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span className="text-slate-300">IA analiza items negativos</span>
              </div>
              <ChevronRight size={16} className="text-slate-500 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span className="text-slate-300">Genera disputas automáticas</span>
              </div>
            </div>
          </div>

          {/* Bureau Upload Cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {bureaus.map(bureau => (
              <div 
                key={bureau.id}
                onDragOver={(e) => { e.preventDefault(); setDragOver(bureau.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleDrop(bureau.id, e)}
                className={`relative border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer hover:shadow-md ${
                  files[bureau.id] 
                    ? 'border-emerald-400 bg-emerald-500/10' 
                    : dragOver === bureau.id 
                      ? 'border-indigo-400 bg-indigo-500/15'
                      : 'border-slate-700/50 hover:border-slate-600/50'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileChange(bureau.id, e)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <div className={`w-12 h-12 bg-gradient-to-br ${bureau.color} rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg`}>
                  <span className="text-lg font-bold">{bureau.name[0]}</span>
                </div>
                
                <h3 className="text-center font-semibold text-white mb-2">{bureau.name}</h3>
                
                {files[bureau.id] ? (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-100 rounded-lg">
                      <CheckCircle size={16} className="text-emerald-600" />
                      <span className="text-sm text-emerald-700 truncate max-w-[150px]">
                        {files[bureau.id].name}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-sm text-slate-400">
                    Arrastra o haz clic para subir
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Messages */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl mb-4">
              <AlertCircle size={20} className="text-rose-400 shrink-0" />
              <p className="text-rose-400">{error}</p>
              <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-rose-400">
                <X size={18} />
              </button>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-4">
              <CheckCircle size={20} className="text-emerald-600 shrink-0" />
              <p className="text-emerald-700">{success}</p>
              <button onClick={() => setSuccess('')} className="ml-auto text-emerald-400 hover:text-emerald-600">
                <X size={18} />
              </button>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading || Object.keys(files).length === 0}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-3 ${
              uploading || Object.keys(files).length === 0 
                ? 'bg-slate-600 cursor-not-allowed' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-xl'
            }`}
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Analizando con IA...</span>
              </>
            ) : (
              <>
                <Brain size={20} />
                <span>Analizar {Object.keys(files).length || 0} Reporte(s) con IA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Credit Scores Section */}
      {scores && scores.latestScores && scores.latestScores.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl text-white">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Puntajes de Crédito</h2>
                <p className="text-sm text-slate-400">Resumen de tus puntajes actuales</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              {/* Average Score */}
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-800/50/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <p className="text-purple-200 text-sm mb-1">Promedio</p>
                <p className="text-5xl font-bold mb-2">{scores.averageScore || '--'}</p>
                {scores.averageScore && (
                  <span className={`text-sm px-2 py-1 rounded-full ${getScoreCategory(scores.averageScore).bg} bg-opacity-30`}>
                    {getScoreCategory(scores.averageScore).label}
                  </span>
                )}
              </div>
              
              {/* Individual Bureau Scores */}
              {scores.latestScores.map(score => {
                const bureau = bureaus.find(b => b.id === score.bureau);
                const improvement = scores.improvements?.[score.bureau] || 0;
                const category = getScoreCategory(score.score);
                return (
                  <div key={score.bureau} className={`bg-gradient-to-br ${bureau?.color || 'from-gray-500 to-gray-600'} rounded-2xl p-6 text-white relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-800/50/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <p className="text-white/80 text-sm mb-1">{bureau?.name || score.bureau}</p>
                    <p className="text-4xl font-bold mb-2">{score.score}</p>
                    {improvement !== 0 && (
                      <div className={`flex items-center gap-1 text-sm ${improvement > 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                        {improvement > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        <span>{Math.abs(improvement)} pts</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Score History Chart */}
            {scores.scoreHistory && scores.scoreHistory.length > 0 && (
              <div className="bg-slate-700/30 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-4">Historial de Puntajes</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scores.scoreHistory.slice(-12)}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="score_date" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickFormatter={(val) => new Date(val).toLocaleDateString('es', { month: 'short' })}
                      />
                      <YAxis domain={[500, 850]} tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                        formatter={(value) => [value, 'Puntaje']}
                      />
                      <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} fill="url(#scoreGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Anomaly Alerts */}
      {anomalies && anomalies.totalAlerts > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl text-white">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Alertas Detectadas</h2>
                <p className="text-sm text-slate-400">
                  {anomalies.criticalCount > 0 && <span className="text-rose-400 font-medium">{anomalies.criticalCount} críticas</span>}
                  {anomalies.criticalCount > 0 && anomalies.warningCount > 0 && ' · '}
                  {anomalies.warningCount > 0 && <span className="text-amber-500 font-medium">{anomalies.warningCount} advertencias</span>}
                  {(anomalies.criticalCount > 0 || anomalies.warningCount > 0) && anomalies.infoCount > 0 && ' · '}
                  {anomalies.infoCount > 0 && <span className="text-sky-400">{anomalies.infoCount} informativas</span>}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {anomalies.alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border-l-4 ${
                  alert.severity === 'critical' ? 'bg-rose-500/10 border-rose-500' :
                  alert.severity === 'warning' ? 'bg-amber-500/10 border-amber-500' :
                  'bg-sky-500/10 border-sky-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg ${
                    alert.severity === 'critical' ? 'bg-rose-500/20' :
                    alert.severity === 'warning' ? 'bg-amber-500/20' : 'bg-sky-500/20'
                  }`}>
                    {alert.type === 'sudden_drop' && <TrendingDown size={16} className={alert.severity === 'critical' ? 'text-rose-400' : 'text-amber-500'} />}
                    {alert.type === 'bureau_inconsistency' && <Activity size={16} className="text-amber-500" />}
                    {alert.type === 'stagnant_score' && <Minus size={16} className="text-sky-400" />}
                    {alert.type === 'approaching_expiration' && <AlertCircle size={16} className={alert.severity === 'critical' ? 'text-rose-400' : 'text-sky-400'} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${
                      alert.severity === 'critical' ? 'text-rose-400' :
                      alert.severity === 'warning' ? 'text-amber-400' : 'text-sky-400'
                    }`}>
                      {alert.message}
                    </p>
                    {alert.detail && <p className="text-xs text-slate-300 mt-1">{alert.detail}</p>}
                    {alert.recommendation && (
                      <p className="text-xs mt-2 p-2 bg-slate-800/50/60 rounded-lg">
                        💡 <strong>Recomendación:</strong> {alert.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Projections & Item Impact */}
      {projections && projections.totalNegativeItems > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Projection Timeline */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
            <div className="p-6 border-b border-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl text-white">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Proyección de Mejora</h2>
                  <p className="text-sm text-slate-400">
                    Puntaje actual: <span className="font-medium">{projections.currentAverageScore}</span> → Potencial: <span className="font-bold text-emerald-600">{projections.bestCaseScore}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {/* Score gauge */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-amber-500 via-emerald-500 to-blue-500 rounded-full transition-all duration-1000"
                      style={{ width: `${((projections.currentAverageScore - 300) / 550) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>300</span>
                    <span>580</span>
                    <span>670</span>
                    <span>740</span>
                    <span>850</span>
                  </div>
                </div>
              </div>

              {/* Projection summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <p className="text-xs text-slate-400">Actual</p>
                  <p className="text-xl font-bold text-white">{projections.currentAverageScore}</p>
                  <p className="text-xs text-slate-500">{projections.currentCategory?.range}</p>
                </div>
                <div className="text-center p-3 bg-emerald-500/10 rounded-xl">
                  <p className="text-xs text-emerald-600">Conservador</p>
                  <p className="text-xl font-bold text-emerald-700">{projections.conservativeScore}</p>
                  <p className="text-xs text-emerald-500">+{projections.conservativeScore - projections.currentAverageScore} pts</p>
                </div>
                <div className="text-center p-3 bg-indigo-500/15 rounded-xl">
                  <p className="text-xs text-indigo-400">Mejor Caso</p>
                  <p className="text-xl font-bold text-indigo-700">{projections.bestCaseScore}</p>
                  <p className="text-xs text-indigo-500">+{projections.bestCaseScore - projections.currentAverageScore} pts</p>
                </div>
              </div>

              {/* Step-by-step projection */}
              {projections.projectionTimeline && projections.projectionTimeline.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Si se eliminan por prioridad:</h4>
                  {projections.projectionTimeline.slice(0, 5).map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-slate-700/30 rounded-lg text-sm">
                      <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {step.step}
                      </span>
                      <span className="flex-1 text-slate-300 truncate">{step.itemRemoved}</span>
                      <span className="text-emerald-600 font-medium whitespace-nowrap">+{step.pointsGained} pts</span>
                      <span className="text-slate-400 font-medium whitespace-nowrap">→ {step.cumulativeScore}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* High Impact Items */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
            <div className="p-6 border-b border-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl text-white">
                  <Target size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Items de Mayor Impacto</h2>
                  <p className="text-sm text-slate-400">{projections.totalNegativeItems} items negativos activos</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {(projections.topPriorityItems || projections.itemImpacts?.slice(0, 5) || []).map((item, idx) => {
                const priorityColors = {
                  critical: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
                  high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                  medium: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
                };
                return (
                  <div key={idx} className="p-4 bg-slate-700/30 rounded-xl hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${priorityColors[item.priority] || priorityColors.medium}`}>
                            {item.priority === 'critical' ? '🔴 Crítico' : item.priority === 'high' ? '🟡 Alto' : '🔵 Medio'}
                          </span>
                          <span className="text-xs text-slate-500">{item.itemTypeName}</span>
                        </div>
                        <h4 className="font-medium text-white truncate">{item.creditorName}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.bureau} · ${parseFloat(item.balance || 0).toLocaleString()} · {item.status}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-emerald-600 font-bold text-sm">
                          +{item.estimatedImpact?.estimatedMin}–{item.estimatedImpact?.estimatedMax}
                        </p>
                        <p className="text-xs text-slate-500">puntos</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.priority === 'critical' ? 'bg-rose-500' :
                            item.priority === 'high' ? 'bg-amber-500' : 'bg-sky-500'
                          }`}
                          style={{ width: `${Math.min(100, (item.estimatedImpact?.estimatedMax / 150) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {projections.totalNegativeItems > 5 && (
                <p className="text-center text-sm text-slate-400 pt-2">
                  +{projections.totalNegativeItems - 5} items adicionales
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credit Items Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl text-white">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Items Identificados para Disputa</h2>
                <p className="text-sm text-slate-400">{creditItems.length} items encontrados en tus reportes</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded-xl transition-colors"
              >
                <RefreshCw size={20} />
              </button>
              {(user.role === 'admin' || user.role === 'staff') && stats.identified > 0 && (
                <button
                  onClick={handleGenerateDisputes}
                  disabled={generatingDisputes}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                >
                  {generatingDisputes ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Generar Disputas IA</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {creditItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={32} className="text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No hay items identificados aún</h3>
              <p className="text-slate-400 max-w-md mx-auto">
                Sube tus reportes de crédito para que nuestra IA analice y detecte items negativos automáticamente.
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Items List */}
              <div className="lg:col-span-2 space-y-3">
                {creditItems.map(item => {
                  const bureau = bureaus.find(b => b.id === item.bureau);
                  const statusConfig = getStatusConfig(item.status);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div key={item.id} className="p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs text-white ${bureau?.bg || 'bg-slate-700/300'}`}>
                              {bureau?.name || item.bureau}
                            </span>
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${statusConfig.bg} ${statusConfig.text}`}>
                              <StatusIcon size={12} />
                              {statusConfig.label}
                            </span>
                          </div>
                          <h4 className="font-semibold text-white truncate">{item.creditor_name}</h4>
                          <p className="text-sm text-slate-400">{item.account_number} • {item.item_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">${parseFloat(item.balance || 0).toLocaleString()}</p>
                          {item.dispute_id ? (
                            <a 
                              href={`/disputes/${item.dispute_id}`}
                              className="text-sm text-indigo-400 hover:text-indigo-400 flex items-center gap-1 justify-end mt-1"
                            >
                              <Eye size={14} />
                              Ver Carta
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">Pendiente</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pie Chart */}
              {pieData.length > 0 && (
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <h3 className="font-semibold text-white mb-4 text-center">Distribución por Estado</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, 'Items']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    {pieData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        <span className="text-xs text-slate-300">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Analysis Result Modal */}
      {analysisResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-700/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
                  <BarChart3 size={20} />
                </div>
                <h3 className="text-xl font-bold text-white">Resultado del Análisis</h3>
              </div>
              <button 
                onClick={() => setAnalysisResult(null)}
                className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {analysisResult.data?.scores && (
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(analysisResult.data.scores).map(([bureau, score]) => {
                    const bureauInfo = bureaus.find(b => b.id === bureau);
                    return (
                      <div key={bureau} className={`bg-gradient-to-br ${bureauInfo?.color || 'from-gray-500 to-gray-600'} rounded-xl p-4 text-white text-center`}>
                        <p className="text-white/80 text-sm">{bureauInfo?.name || bureau}</p>
                        <p className="text-3xl font-bold">{score}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="bg-indigo-500/15 p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle size={20} className="text-indigo-400" />
                  <p className="font-semibold text-indigo-400">Items encontrados: {analysisResult.data?.totalItemsFound || 0}</p>
                </div>
                <p className="text-sm text-indigo-700">
                  Burós analizados: {analysisResult.data?.bureausAnalyzed?.join(', ') || 'N/A'}
                </p>
              </div>

              {analysisResult.data?.errors?.length > 0 && (
                <div className="bg-amber-500/10 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={18} className="text-amber-500" />
                    <p className="font-semibold text-amber-400">Advertencias</p>
                  </div>
                  {analysisResult.data.errors.map((err, idx) => (
                    <p key={idx} className="text-sm text-amber-300">{err.bureau}: {err.error}</p>
                  ))}
                </div>
              )}

              <button
                onClick={() => setAnalysisResult(null)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
