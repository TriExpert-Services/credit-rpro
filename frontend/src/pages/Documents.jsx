import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/Auth0Context';
import { documentService } from '../services/api';
import { 
  Upload, Trash2, File, FileText, Image, Download, Eye, X,
  FolderOpen, Clock, HardDrive, Search, Filter, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await documentService.getDocuments(user.id);
      setDocuments(res.data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('document', file);
      formData.append('clientId', user.id);
      formData.append('documentCategory', 'other');

      try {
        await documentService.uploadDocument(formData);
        setUploadProgress(((i + 1) / files.length) * 100);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    loadDocuments();
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this document?')) {
      await documentService.deleteDocument(id);
      loadDocuments();
    }
  };

  const stats = useMemo(() => {
    const totalSize = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
    const byType = documents.reduce((acc, doc) => {
      const ext = doc.file_name?.split('.').pop()?.toLowerCase() || 'other';
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {});
    return { total: documents.length, totalSize, byType };
  }, [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => 
      doc.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [documents, searchTerm]);

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return Image;
    if (['pdf'].includes(ext)) return FileText;
    return File;
  };

  const getFileColor = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'bg-emerald-500';
    if (['pdf'].includes(ext)) return 'bg-rose-500';
    if (['doc', 'docx'].includes(ext)) return 'bg-sky-500';
    return 'bg-slate-700/300';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-500/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300 font-medium">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl text-white">
              <FolderOpen size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Documents</h1>
              <p className="text-slate-400">Upload and manage your credit repair documents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <File size={24} className="text-blue-200" />
            <span className="text-xs bg-slate-800/50/20 px-2 py-1 rounded-full">Total</span>
          </div>
          <p className="text-4xl font-bold">{stats.total}</p>
          <p className="text-blue-100 text-sm mt-1">Documents Uploaded</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <HardDrive size={24} className="text-purple-200" />
            <span className="text-xs bg-slate-800/50/20 px-2 py-1 rounded-full">Storage</span>
          </div>
          <p className="text-4xl font-bold">{formatFileSize(stats.totalSize)}</p>
          <p className="text-purple-100 text-sm mt-1">Total Size</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle size={24} className="text-emerald-200" />
            <span className="text-xs bg-slate-800/50/20 px-2 py-1 rounded-full">Types</span>
          </div>
          <p className="text-4xl font-bold">{Object.keys(stats.byType).length}</p>
          <p className="text-emerald-100 text-sm mt-1">File Types</p>
        </div>
      </div>

      {/* Upload Zone */}
      <div 
        className={`relative bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border-2 border-dashed transition-all ${
          dragActive 
            ? 'border-indigo-500 bg-indigo-500/15' 
            : 'border-slate-700/50 hover:border-indigo-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <label className="flex flex-col items-center justify-center p-12 cursor-pointer">
          <div className={`p-4 rounded-2xl mb-4 transition-all ${dragActive ? 'bg-indigo-500 text-white' : 'bg-indigo-500/20 text-indigo-400'}`}>
            <Upload size={40} />
          </div>
          <span className="text-xl font-semibold text-white mb-2">
            {dragActive ? 'Drop files here' : 'Upload Documents'}
          </span>
          <span className="text-slate-400 mb-4">Drag and drop files or click to browse</span>
          <div className="flex gap-2">
            {['PDF', 'JPG', 'PNG', 'DOC'].map((type) => (
              <span key={type} className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-sm">{type}</span>
            ))}
          </div>
          <input 
            type="file" 
            className="hidden" 
            onChange={(e) => handleUpload(e.target.files)} 
            disabled={uploading} 
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            multiple
          />
        </label>

        {/* Upload Progress */}
        {uploading && (
          <div className="absolute inset-0 bg-slate-800/50/90 backdrop-blur-sm flex items-center justify-center rounded-2xl">
            <div className="text-center">
              <div className="w-20 h-20 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white font-medium">Uploading...</p>
              <div className="w-48 h-2 bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/30">
          <h3 className="font-semibold text-white">My Documents ({filteredDocs.length})</h3>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen size={48} className="mx-auto mb-4 text-slate-500" />
            <p className="text-slate-400 font-medium">No documents found</p>
            <p className="text-slate-500 text-sm mt-1">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {filteredDocs.map((doc) => {
              const FileIcon = getFileIcon(doc.file_name);
              return (
                <div key={doc.id} className="group bg-slate-700/30 rounded-xl p-4 hover:bg-indigo-500/20 transition-all border border-transparent hover:border-indigo-500/30">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 ${getFileColor(doc.file_name)} rounded-xl text-white flex-shrink-0`}>
                      <FileIcon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate" title={doc.file_name}>
                        {doc.file_name}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {doc.uploaded_at ? format(new Date(doc.uploaded_at), 'MMM d, yyyy') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-300 rounded-lg border border-slate-700/50 hover:bg-slate-700/50 transition-colors text-sm">
                      <Eye size={14} />
                      View
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-300 rounded-lg border border-slate-700/50 hover:bg-slate-700/50 transition-colors text-sm">
                      <Download size={14} />
                      Download
                    </button>
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-rose-400 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-rose-500/20 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/30 rounded-2xl p-6">
        <h3 className="font-semibold text-indigo-400 mb-3">💡 Tips for Document Management</h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Upload credit reports from all three bureaus',
            'Keep copies of all dispute letters sent',
            'Save response letters from bureaus',
            'Store proof of identity documents securely'
          ].map((tip, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-indigo-700">
              <CheckCircle size={16} className="text-indigo-500 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
