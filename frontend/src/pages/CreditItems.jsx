import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { creditItemService } from '../services/api';
import { Plus, Trash2, Edit } from 'lucide-react';

export default function CreditItems() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    itemType: 'late_payment',
    creditorName: '',
    accountNumber: '',
    bureau: 'all',
    balance: '',
    description: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const res = await creditItemService.getItems(user.id);
      setItems(res.data.items);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await creditItemService.addItem({ ...formData, clientId: user.id });
      setShowForm(false);
      setFormData({ itemType: 'late_payment', creditorName: '', accountNumber: '', bureau: 'all', balance: '', description: '' });
      loadItems();
    } catch (error) {
      alert('Error al agregar item');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este item?')) {
      await creditItemService.deleteItem(id);
      loadItems();
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      identified: 'badge-warning',
      disputing: 'badge-info',
      deleted: 'badge-success',
      verified: 'badge-danger'
    };
    return badges[status] || 'badge';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Items de Crédito</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={20} className="inline mr-2" />
          Agregar Item
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Nuevo Item Negativo</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Item</label>
                <select value={formData.itemType} onChange={(e) => setFormData({...formData, itemType: e.target.value})} className="input-field">
                  <option value="late_payment">Pago Tardío</option>
                  <option value="collection">Colección</option>
                  <option value="charge_off">Cargo Cancelado</option>
                  <option value="bankruptcy">Bancarrota</option>
                  <option value="inquiry">Consulta</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Bureau</label>
                <select value={formData.bureau} onChange={(e) => setFormData({...formData, bureau: e.target.value})} className="input-field">
                  <option value="all">Todos</option>
                  <option value="experian">Experian</option>
                  <option value="equifax">Equifax</option>
                  <option value="transunion">TransUnion</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Acreedor</label>
              <input type="text" value={formData.creditorName} onChange={(e) => setFormData({...formData, creditorName: e.target.value})} className="input-field" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Número de Cuenta</label>
                <input type="text" value={formData.accountNumber} onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Balance</label>
                <input type="number" value={formData.balance} onChange={(e) => setFormData({...formData, balance: e.target.value})} className="input-field" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Descripción</label>
              <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input-field" rows="3"></textarea>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Guardar</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Mis Items Negativos</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Tipo</th>
                <th className="text-left py-3 px-4">Acreedor</th>
                <th className="text-left py-3 px-4">Bureau</th>
                <th className="text-left py-3 px-4">Estado</th>
                <th className="text-left py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 capitalize">{item.item_type.replace('_', ' ')}</td>
                  <td className="py-3 px-4">{item.creditor_name}</td>
                  <td className="py-3 px-4 uppercase">{item.bureau}</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${getStatusBadge(item.status)}`}>{item.status}</span>
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
