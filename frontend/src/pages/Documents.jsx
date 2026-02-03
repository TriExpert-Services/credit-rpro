import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentService } from '../services/api';
import { Upload, Trash2, File } from 'lucide-react';

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const res = await documentService.getDocuments(user.id);
    setDocuments(res.data.documents);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('document', file);
    formData.append('clientId', user.id);
    formData.append('documentCategory', 'other');

    try {
      await documentService.uploadDocument(formData);
      loadDocuments();
      e.target.value = '';
    } catch (error) {
      alert('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este documento?')) {
      await documentService.deleteDocument(id);
      loadDocuments();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Documentos</h1>

      <div className="card">
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12 cursor-pointer hover:border-blue-500 transition-colors">
          <Upload size={48} className="text-gray-400 mb-4" />
          <span className="text-lg font-medium text-gray-700">Subir Documento</span>
          <span className="text-sm text-gray-500 mt-2">PDF, JPG, PNG, DOC (Max 10MB)</span>
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
        </label>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Mis Documentos</h2>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-3">
                <File className="text-blue-600" />
                <div>
                  <p className="font-medium">{doc.file_name}</p>
                  <p className="text-sm text-gray-500">{new Date(doc.uploaded_at).toLocaleDateString()} • {(doc.file_size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button onClick={() => handleDelete(doc.id)} className="text-red-600 hover:text-red-700">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {documents.length === 0 && (
            <p className="text-center text-gray-500 py-8">No hay documentos subidos</p>
          )}
        </div>
      </div>
    </div>
  );
}
