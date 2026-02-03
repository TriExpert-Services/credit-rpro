import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { Save } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authService.getProfile().then(res => {
      setProfile(res.data.user);
      setFormData(res.data.user);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.updateProfile(formData);
      alert('Perfil actualizado exitosamente');
    } catch (error) {
      alert('Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return <div>Cargando...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Mi Perfil</h1>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre</label>
              <input type="text" value={formData.first_name || ''} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Apellido</label>
              <input type="text" value={formData.last_name || ''} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input type="email" value={formData.email || ''} className="input-field bg-gray-100" disabled />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Teléfono</label>
            <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Dirección</label>
            <input type="text" value={formData.address_line1 || ''} onChange={(e) => setFormData({...formData, address_line1: e.target.value})} className="input-field" placeholder="Calle y número" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Ciudad</label>
              <input type="text" value={formData.city || ''} onChange={(e) => setFormData({...formData, city: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Estado</label>
              <input type="text" value={formData.state || ''} onChange={(e) => setFormData({...formData, state: e.target.value})} className="input-field" maxLength={2} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Código Postal</label>
              <input type="text" value={formData.zip_code || ''} onChange={(e) => setFormData({...formData, zip_code: e.target.value})} className="input-field" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            <Save size={20} className="inline mr-2" />
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
