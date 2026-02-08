import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/Auth0Context';
import { dashboardService } from '../services/api';
import { 
  TrendingUp, TrendingDown, AlertCircle, FileText, CheckCircle, Zap, ArrowRight, 
  Target, Shield, Clock, Calendar, ChevronRight, Award, BarChart3, PieChart,
  Bell, Sparkles, RefreshCw, Eye, Activity, CreditCard, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart as RechartsPie, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar
} from 'recharts';
import { format, subDays, isAfter, parseISO } from 'date-fns';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [disputeStats, setDisputeStats] = useState(null);
  const [creditItems, setCreditItems] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsRes, itemsRes, disputesRes] = await Promise.all([
        dashboardService.getClientStats(user.id),
        api.get('/credit-items').catch(() => ({ data: { items: [] } })),
        api.get('/ai-disputes/drafts').catch(() => ({ data: [] }))
      ]);

      setStats(statsRes.data);
      setCreditItems(itemsRes.data?.items || itemsRes.data || []);
      
      const disputes = disputesRes.data || [];
      const sentDisputes = disputes.filter(d => d.status === 'sent');
      const draftDisputes = disputes.filter(d => d.status === 'draft');
      setDisputeStats({
        total: disputes.length,
        sent: sentDisputes.length,
        drafts: draftDisputes.length,
        disputes: disputes
      });

      // Build activity timeline
      const activities = [];
      disputes.forEach(d => {
        activities.push({
          id: `dispute-${d.id}`,
          type: d.status === 'sent' ? 'dispute_sent' : 'dispute_created',
          title: d.status === 'sent' ? 'Dispute Letter Sent' : 'Dispute Letter Created',
          description: `${d.bureau} - ${d.account_name || 'Account'}`,
          date: d.created_at,
          icon: d.status === 'sent' ? FileText : Zap
        });
      });
      
      // Sort by date and take latest 10
      activities.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentActivity(activities.slice(0, 10));

      // Generate score history mock data for chart (in real app, fetch from API)
      if (statsRes.data?.scoreImprovement?.length > 0) {
        const history = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = subDays(today, i * 30);
          const entry = { date: format(date, 'MMM yyyy') };
          statsRes.data.scoreImprovement.forEach(s => {
            const baseScore = parseInt(s.first_score) || 600;
            const currentScore = parseInt(s.latest_score) || baseScore;
            const progress = (currentScore - baseScore) / 6;
            entry[s.bureau] = Math.round(baseScore + progress * (6 - i));
          });
          history.push(entry);
        }
        setScoreHistory(history);
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Computed data
  const computedData = useMemo(() => {
    const items = creditItems || [];
    const currentScores = stats?.currentScores || [];
    
    // Items by bureau for pie chart
    const bureauCounts = items.reduce((acc, item) => {
      acc[item.bureau] = (acc[item.bureau] || 0) + 1;
      return acc;
    }, {});
    
    const bureauData = Object.entries(bureauCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));

    // Items by status
    const statusCounts = items.reduce((acc, item) => {
      const status = item.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Average score
    const avgScore = currentScores.length > 0 
      ? Math.round(currentScores.reduce((sum, s) => sum + parseInt(s.score), 0) / currentScores.length)
      : 0;

    // Score health (for radial chart)
    const scoreHealth = avgScore > 0 ? Math.round((avgScore / 850) * 100) : 0;
    
    // Credit score category
    let scoreCategory = 'Unknown';
    let scoreCategoryColor = 'text-slate-400';
    if (avgScore >= 800) { scoreCategory = 'Excellent'; scoreCategoryColor = 'text-emerald-500'; }
    else if (avgScore >= 740) { scoreCategory = 'Very Good'; scoreCategoryColor = 'text-green-500'; }
    else if (avgScore >= 670) { scoreCategory = 'Good'; scoreCategoryColor = 'text-blue-500'; }
    else if (avgScore >= 580) { scoreCategory = 'Fair'; scoreCategoryColor = 'text-yellow-500'; }
    else if (avgScore > 0) { scoreCategory = 'Poor'; scoreCategoryColor = 'text-red-500'; }

    // Items needing attention
    const itemsNeedingAction = items.filter(i => 
      i.status === 'pending' || i.status === 'negative'
    ).length;

    // Dispute success rate
    const resolvedItems = items.filter(i => i.status === 'deleted' || i.status === 'resolved').length;
    const totalDisputed = items.filter(i => i.status !== 'pending').length;
    const successRate = totalDisputed > 0 ? Math.round((resolvedItems / totalDisputed) * 100) : 0;

    return {
      bureauData,
      statusCounts,
      avgScore,
      scoreHealth,
      scoreCategory,
      scoreCategoryColor,
      itemsNeedingAction,
      successRate,
      totalItems: items.length,
      resolvedItems
    };
  }, [creditItems, stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const currentScores = stats?.currentScores || [];
  const scoreImprovement = stats?.scoreImprovement || [];
  const aiStats = disputeStats || { total: 0, sent: 0, drafts: 0 };

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  const BUREAU_COLORS = { equifax: '#ef4444', experian: '#3b82f6', transunion: '#10b981' };

  const getScoreColor = (score) => {
    if (score >= 800) return 'text-emerald-500';
    if (score >= 740) return 'text-green-500';
    if (score >= 670) return 'text-blue-500';
    if (score >= 580) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreGradient = (score) => {
    if (score >= 800) return 'from-emerald-500 to-emerald-600';
    if (score >= 740) return 'from-green-500 to-green-600';
    if (score >= 670) return 'from-blue-500 to-blue-600';
    if (score >= 580) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header with greeting and quick actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Welcome back, <span className="text-indigo-400">{user.firstName}</span>! 👋
          </h1>
          <p className="text-slate-400 mt-1">
            Here's your credit repair progress overview for {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            className={`flex items-center gap-2 px-4 py-2 text-slate-300 bg-slate-800/60 border border-slate-700/50 rounded-xl hover:bg-slate-700/60 transition-all ${refreshing ? 'animate-pulse' : ''}`}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link 
            to="/credit-report-analysis"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25"
          >
            <Sparkles size={18} />
            Analyze Report
          </Link>
        </div>
      </div>

      {/* Credit Score Overview - Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Score Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-2xl p-6 text-white relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="text-indigo-300" size={24} />
              <h2 className="text-xl font-semibold text-indigo-200">Credit Score Overview</h2>
            </div>
            
            {currentScores.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {currentScores.map((score, index) => (
                  <div key={score.bureau} className="relative">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/15 transition-all">
                      <p className="text-xs uppercase tracking-wider text-indigo-300 mb-2">{score.bureau}</p>
                      <div className="flex items-end gap-2">
                        <span className={`text-4xl font-bold ${getScoreColor(score.score)}`}>
                          {score.score}
                        </span>
                        {scoreImprovement.find(s => s.bureau === score.bureau)?.improvement > 0 && (
                          <span className="flex items-center text-emerald-400 text-sm pb-1">
                            <TrendingUp size={14} className="mr-1" />
                            +{scoreImprovement.find(s => s.bureau === score.bureau).improvement}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-indigo-300 mt-2">
                        Updated {format(new Date(score.score_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/10">
                <CreditCard size={48} className="mx-auto mb-4 text-indigo-300" />
                <p className="text-indigo-200 mb-4">No credit scores registered yet</p>
                <Link 
                  to="/credit-report-analysis"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all text-sm"
                >
                  <Sparkles size={16} />
                  Upload Credit Report
                </Link>
              </div>
            )}

            {/* Average Score Indicator */}
            {computedData.avgScore > 0 && (
              <div className="mt-6 flex items-center justify-between bg-white/5 rounded-xl p-4">
                <div>
                  <p className="text-indigo-300 text-sm">Average Score</p>
                  <p className="text-2xl font-bold">{computedData.avgScore}</p>
                </div>
                <div className="text-right">
                  <p className="text-indigo-300 text-sm">Rating</p>
                  <p className={`text-xl font-semibold ${computedData.scoreCategoryColor}`}>
                    {computedData.scoreCategory}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${getScoreGradient(computedData.avgScore)} rounded-full transition-all duration-1000`}
                      style={{ width: `${computedData.scoreHealth}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-indigo-300 mt-1">{computedData.scoreHealth}% of max score</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          {/* Items Needing Attention */}
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <AlertTriangle size={24} className="text-orange-200" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Action Needed</span>
              </div>
              <p className="text-4xl font-bold">{computedData.itemsNeedingAction}</p>
              <p className="text-orange-100 text-sm mt-1">Items needing attention</p>
              <Link to="/credit-items" className="mt-3 flex items-center text-sm text-white/80 hover:text-white transition-colors">
                View items <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <Award size={24} className="text-emerald-200" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Success</span>
              </div>
              <p className="text-4xl font-bold">{computedData.successRate}%</p>
              <p className="text-emerald-100 text-sm mt-1">Dispute success rate</p>
              <p className="mt-2 text-sm text-white/70">{computedData.resolvedItems} items resolved</p>
            </div>
          </div>

          {/* AI Letters */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <Zap size={24} className="text-indigo-200" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">AI Powered</span>
              </div>
              <p className="text-4xl font-bold">{aiStats.total}</p>
              <p className="text-indigo-100 text-sm mt-1">Dispute letters generated</p>
              <div className="mt-2 flex gap-3 text-sm">
                <span className="text-white/70">{aiStats.sent} sent</span>
                <span className="text-white/70">{aiStats.drafts} drafts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score History Chart */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl">
                <Activity size={20} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Score Trend</h3>
                <p className="text-sm text-slate-400">Last 6 months progress</p>
              </div>
            </div>
          </div>
          
          {scoreHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={scoreHistory}>
                <defs>
                  <linearGradient id="colorEquifax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExperian" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTransunion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis domain={[300, 850]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                  }}
                />
                <Legend />
                {scoreHistory[0]?.equifax !== undefined && (
                  <Area type="monotone" dataKey="equifax" name="Equifax" stroke="#ef4444" strokeWidth={2} fill="url(#colorEquifax)" />
                )}
                {scoreHistory[0]?.experian !== undefined && (
                  <Area type="monotone" dataKey="experian" name="Experian" stroke="#3b82f6" strokeWidth={2} fill="url(#colorExperian)" />
                )}
                {scoreHistory[0]?.transunion !== undefined && (
                  <Area type="monotone" dataKey="transunion" name="TransUnion" stroke="#10b981" strokeWidth={2} fill="url(#colorTransunion)" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500">
              <div className="text-center">
                <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
                <p>No score history available</p>
              </div>
            </div>
          )}
        </div>

        {/* Items Distribution */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-xl">
                <PieChart size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Items by Bureau</h3>
                <p className="text-sm text-slate-400">{computedData.totalItems} total items</p>
              </div>
            </div>
          </div>
          
          {computedData.bureauData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="60%" height={200}>
                <RechartsPie>
                  <Pie
                    data={computedData.bureauData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {computedData.bureauData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {computedData.bureauData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-sm text-slate-400">{item.name}</span>
                    </div>
                    <span className="font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-500">
              <div className="text-center">
                <PieChart size={48} className="mx-auto mb-2 opacity-50" />
                <p>No items to display</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dispute Progress */}
        <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                <Target size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Dispute Progress</h3>
                <p className="text-sm text-slate-400">Track your credit repair journey</p>
              </div>
            </div>
            <Link to="/disputes" className="text-indigo-400 text-sm hover:text-indigo-700 flex items-center gap-1">
              View all <ChevronRight size={16} />
            </Link>
          </div>

          {/* Progress Steps */}
          <div className="space-y-4">
            {[
              { 
                label: 'Items Identified', 
                count: computedData.totalItems,
                icon: Eye,
                color: 'bg-sky-500',
                bgColor: 'bg-blue-100',
                textColor: 'text-sky-400'
              },
              { 
                label: 'Disputes Created', 
                count: aiStats.total,
                icon: FileText,
                color: 'bg-purple-500',
                bgColor: 'bg-purple-100',
                textColor: 'text-purple-400'
              },
              { 
                label: 'Letters Sent', 
                count: aiStats.sent,
                icon: CheckCircle2,
                color: 'bg-indigo-500',
                bgColor: 'bg-indigo-100',
                textColor: 'text-indigo-400'
              },
              { 
                label: 'Items Resolved', 
                count: computedData.resolvedItems,
                icon: Award,
                color: 'bg-emerald-500',
                bgColor: 'bg-green-100',
                textColor: 'text-emerald-400'
              },
            ].map((step, index) => (
              <div key={step.label} className="flex items-center gap-4">
                <div className={`p-2 ${step.bgColor} rounded-xl`}>
                  <step.icon size={20} className={step.textColor} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-300">{step.label}</span>
                    <span className="text-sm font-bold text-white">{step.count}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${step.color} rounded-full transition-all duration-500`}
                      style={{ 
                        width: computedData.totalItems > 0 
                          ? `${Math.min((step.count / computedData.totalItems) * 100, 100)}%` 
                          : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-500/20 rounded-xl">
              <Clock size={20} className="text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Recent Activity</h3>
              <p className="text-sm text-slate-400">Latest updates</p>
            </div>
          </div>

          {recentActivity.length > 0 ? (
            <div className="space-y-4 max-h-[300px] overflow-y-auto">
              {recentActivity.map((activity, index) => (
                <div key={activity.id} className="flex gap-3 items-start">
                  <div className={`p-1.5 rounded-lg ${
                    activity.type === 'dispute_sent' ? 'bg-emerald-500/20' : 'bg-indigo-500/20'
                  }`}>
                    <activity.icon size={14} className={
                      activity.type === 'dispute_sent' ? 'text-emerald-400' : 'text-indigo-400'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                    <p className="text-xs text-slate-400 truncate">{activity.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(activity.date), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Bell size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link 
          to="/credit-report-analysis"
          className="group bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl p-5 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-indigo-300">Analyze Credit Report</h3>
              <p className="text-sm text-indigo-400/70">AI-powered analysis</p>
            </div>
            <ArrowRight size={20} className="ml-auto text-indigo-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link 
          to="/ai-disputes"
          className="group bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-2xl p-5 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-purple-300">Generate AI Letters</h3>
              <p className="text-sm text-purple-400/70">Create dispute letters</p>
            </div>
            <ArrowRight size={20} className="ml-auto text-purple-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link 
          to="/credit-items"
          className="group bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-5 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-xl text-white group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-300">Manage Items</h3>
              <p className="text-sm text-emerald-400/70">Review credit items</p>
            </div>
            <ArrowRight size={20} className="ml-auto text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-slate-500 pt-4">
        <p>© {new Date().getFullYear()} TriExpert Credit Repair. All rights reserved.</p>
      </div>
    </div>
  );
}
