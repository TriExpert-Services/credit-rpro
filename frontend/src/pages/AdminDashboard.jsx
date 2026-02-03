import { useEffect, useState } from 'react';
import { dashboardService, clientService } from '../services/api';
import { Users, DollarSign, FileText, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    dashboardService.getAdminStats().then(res => setStats(res.data));
  }, []);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={color} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Panel de Administración</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Clientes" value={stats?.totalClients || 0} icon={Users} color="text-blue-600" />
        <StatCard title="Suscripciones Activas" value={stats?.activeSubscriptions || 0} icon={TrendingUp} color="text-green-600" />
        <StatCard title="Total Disputas" value={stats?.totalDisputes || 0} icon={FileText} color="text-purple-600" />
        <StatCard title="Ingresos Mensuales" value={`$${stats?.monthlyRevenue || 0}`} icon={DollarSign} color="text-emerald-600" />
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Clientes Recientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Nombre</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Estado</th>
                <th className="text-left py-3 px-4">Fecha Registro</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentClients?.map((client) => (
                <tr key={client.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{client.first_name} {client.last_name}</td>
                  <td className="py-3 px-4">{client.email}</td>
                  <td className="py-3 px-4">
                    <span className="badge badge-success">{client.subscription_status}</span>
                  </td>
                  <td className="py-3 px-4">{new Date(client.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
