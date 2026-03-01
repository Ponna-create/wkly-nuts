import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import {
  Upload, Search, X, Trash2, FileText, Image, File, Download,
  Filter, Eye, FolderOpen
} from 'lucide-react';

const DOC_TYPES = [
  { value: 'bill', label: 'Bill / Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'invoice', label: 'Sales Invoice' },
  { value: 'label', label: 'Label / Sticker' },
  { value: 'photo', label: 'Photo' },
  { value: 'contract', label: 'Contract / Agreement' },
  { value: 'license', label: 'License / Permit' },
  { value: 'misc', label: 'Other' },
];

const FILE_ICONS = {
  'image/': Image,
  'application/pdf': FileText,
};

function getFileIcon(fileType) {
  if (!fileType) return File;
  for (const [prefix, Icon] of Object.entries(FILE_ICONS)) {
    if (fileType.startsWith(prefix)) return Icon;
  }
  return File;
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Documents() {
  const { showToast } = useApp();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [previewUrl, setPreviewUrl] = useState(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const { data } = await dbService.getDocuments();
    setDocuments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const filtered = documents.filter(d => {
    const matchesSearch = !search ||
      (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.file_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === 'all' || d.document_type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return;
    const { error } = await dbService.deleteDocument(id);
    if (error) { showToast('Failed to delete document', 'error'); return; }
    setDocuments(prev => prev.filter(d => d.id !== id));
    showToast('Document deleted');
  };

  const getTypeLabel = (val) => DOC_TYPES.find(t => t.value === val)?.label || val || 'Other';

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Documents</p>
          <p className="text-2xl font-bold">{documents.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Bills / Receipts</p>
          <p className="text-2xl font-bold text-amber-600">{documents.filter(d => ['bill', 'receipt'].includes(d.document_type)).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Photos</p>
          <p className="text-2xl font-bold text-blue-600">{documents.filter(d => d.document_type === 'photo' || (d.file_type || '').startsWith('image/')).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Size</p>
          <p className="text-2xl font-bold">{formatFileSize(documents.reduce((sum, d) => sum + (d.file_size || 0), 0))}</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
            <option value="all">All Types</option>
            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium">
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading documents...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No documents found</p>
          <button onClick={() => setShowUpload(true)} className="mt-3 text-violet-600 text-sm font-medium">+ Upload your first document</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(doc => {
            const IconComp = getFileIcon(doc.file_type);
            const isImage = (doc.file_type || '').startsWith('image/');
            return (
              <div key={doc.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow">
                {/* Preview area */}
                <div className="h-32 bg-gray-50 flex items-center justify-center relative overflow-hidden">
                  {isImage && doc.file_url ? (
                    <img src={doc.file_url} alt={doc.name} className="w-full h-full object-cover" />
                  ) : (
                    <IconComp className="w-12 h-12 text-gray-300" />
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {doc.file_url && (
                      <>
                        <button onClick={() => setPreviewUrl(doc.file_url)}
                          className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100">
                          <Eye className="w-4 h-4 text-gray-700" />
                        </button>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" download
                          className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100">
                          <Download className="w-4 h-4 text-gray-700" />
                        </a>
                      </>
                    )}
                    <button onClick={() => handleDelete(doc.id)}
                      className="p-2 bg-white rounded-full shadow-md hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="font-medium text-sm text-gray-900 truncate" title={doc.name}>{doc.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full">{getTypeLabel(doc.document_type)}</span>
                    <span className="text-xs text-gray-400">{formatFileSize(doc.file_size)}</span>
                  </div>
                  {doc.description && <p className="text-xs text-gray-500 mt-1 truncate">{doc.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(doc.created_at).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadForm
          onClose={() => setShowUpload(false)}
          onUpload={async (file, metadata) => {
            const { data, error } = await dbService.uploadDocument(file, metadata);
            if (error) { showToast('Failed to upload document: ' + error.message, 'error'); return; }
            if (data) setDocuments(prev => [data, ...prev]);
            showToast('Document uploaded');
            setShowUpload(false);
          }}
        />
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="max-w-4xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewUrl(null)} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
            {previewUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) || previewUrl.includes('image') ? (
              <img src={previewUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            ) : (
              <iframe src={previewUrl} className="w-full h-[85vh] rounded-lg bg-white" title="Document Preview" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadForm({ onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    documentType: 'misc',
    tags: '',
  });
  const [uploading, setUploading] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const f = e.dataTransfer.files[0];
      setFile(f);
      if (!metadata.name) setMetadata(m => ({ ...m, name: f.name.split('.')[0] }));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      setFile(f);
      if (!metadata.name) setMetadata(m => ({ ...m, name: f.name.split('.')[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    await onUpload(file, {
      ...metadata,
      tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Upload Document</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Drop zone */}
          <div
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileText className="w-8 h-8 text-violet-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => setFile(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Drag & drop a file here, or</p>
                <label className="mt-2 inline-block px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm cursor-pointer">
                  Browse Files
                  <input type="file" onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                </label>
                <p className="text-xs text-gray-400 mt-2">Images, PDFs, Documents up to 10MB</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
              <input type="text" value={metadata.name} onChange={e => setMetadata(m => ({ ...m, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Document name" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={metadata.documentType} onChange={e => setMetadata(m => ({ ...m, documentType: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={metadata.description} onChange={e => setMetadata(m => ({ ...m, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional description" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input type="text" value={metadata.tags} onChange={e => setMetadata(m => ({ ...m, tags: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="tag1, tag2, tag3 (comma separated)" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={!file || uploading} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
