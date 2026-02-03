import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService, creditScoreService } from '../services/api';
import { TrendingUp, AlertCircle, FileText, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await dashboardService.getClientStats(user.id);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Cargando dashboard...</div>;
  }

  const currentScores = stats?.currentScores || [];
  const itemsSummary = stats?.itemsSummary || [];
  const disputesSummary = stats?.disputesSummary || [];
  const scoreImprovement = stats?.scoreImprovement || [];

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="card hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon size={24} className={color} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mi Dashboard</h1>
        <p className="text-gray-600 mt-1">Bienvenido, {user.firstName}!</p>
      </div>

      {/* Current Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currentScores.length > 0 ? (
          currentScores.map((score) => (
            <StatCard
              key={score.bureau}
              title={score.bureau.toUpperCase()}
              value={score.score}
              icon={TrendingUp}
              color="text-blue-600"
              subtitle={new Date(score.score_date).toLocaleDateString()}
            />
          ))
        ) : (
          <div className="col-span-3 card text-center py-8 text-gray-500">
            No hay puntajes registrados aún
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Items Negativos"
          value={itemsSummary.reduce((acc, item) => acc + parseInt(item.count), 0)}
          icon={AlertCircle}
          color="text-orange-600"
        />
        <StatCard
          title="Disputas Activas"
          value={disputesSummary.find(d => d.status === 'sent')?.count || 0}
          icon={FileText}
          color="text-purple-600"
        />
        <StatCard
          title="Items Eliminados"
          value={itemsSummary.find(i => i.status === 'deleted')?.count || 0}
          icon={CheckCircle}
          color="text-green-600"
        />
      </div>

      {/* Score Trends */}
      {scoreImprovement.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Progreso de Puntaje</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scoreImprovement.map((item) => (
              <div key={item.bureau} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                <p className="text-sm text-gray-600 uppercase font-semibold">{item.bureau}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {item.latest_score}
                  {item.improvement > 0 && (
                    <span className="text-green-600 text-lg ml-2">+{item.improvement}</span>
                  )}
                </p>
                <p className="text-sm text-gray-500 mt-1">Desde {item.first_score}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
