import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { disputeService, creditItemService } from '../services/api';
import { Send, Eye } from 'lucide-react';

export default function Disputes() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);

  useEffect(() => {
    loadDisputes();
    creditItemService.getItems(user.id).then(res => setItems(res.data.items));
  }, []);

  const loadDisputes = async () => {
    const res = await disputeService.getDisputes(user.id);
    setDisputes(res.data.disputes);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await disputeService.createDispute({
      clientId: user.id,
      creditItemId: formData.get('creditItemId'),
      disputeType: formData.get('disputeType'),
      bureau: formData.get('bureau')
    });
    setShowForm(false);
    loadDisputes();
  };

  const viewLetter = async (id) => {
    const res = await disputeService.getDispute(id);
    setSelectedDispute(res.data.dispute);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Disputas</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Send size={20} className="inline mr-2" />
          Nueva Disputa
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Crear Disputa</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Item a Disputar</label>
              <select name="creditItemId" className="input-field" required>
                <option value="">Seleccionar...</option>
                {items.filter(i => i.status !== 'deleted').map(item => (
                  <option key={item.id} value={item.id}>{item.creditor_name} - {item.item_type}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Disputa</label>
                <select name="disputeType" className="input-field" required>
                  <option value="not_mine">No es mío</option>
                  <option value="inaccurate_info">Información incorrecta</option>
                  <option value="paid">Ya pagado</option>
                  <option value="outdated">Desactualizado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Bureau</label>
                <select name="bureau" className="input-field" required>
                  <option value="experian">Experian</option>
                  <option value="equifax">Equifax</option>
                  <option value="transunion">TransUnion</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Crear Disputa</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Mis Disputas</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Acreedor</th>
                <th className="text-left py-3 px-4">Bureau</th>
                <th className="text-left py-3 px-4">Tipo</th>
                <th className="text-left py-3 px-4">Estado</th>
                <th className="text-left py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{dispute.creditor_name}</td>
                  <td className="py-3 px-4 uppercase">{dispute.bureau}</td>
                  <td className="py-3 px-4 capitalize">{dispute.dispute_type.replace('_', ' ')}</td>
                  <td className="py-3 px-4"><span className="badge badge-info">{dispute.status}</span></td>
                  <td className="py-3 px-4">
                    <button onClick={() => viewLetter(dispute.id)} className="text-blue-600 hover:text-blue-700">
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDispute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedDispute(null)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Carta de Disputa</h3>
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">{selectedDispute.letter_content}</pre>
            <button onClick={() => setSelectedDispute(null)} className="btn-secondary mt-4">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
