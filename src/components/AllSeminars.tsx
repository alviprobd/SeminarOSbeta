import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  Search, Calendar, MapPin, Clock, Edit3, Trash2, 
  ChevronRight, Filter, X, Loader2, AlertCircle,
  ArrowUpDown, LayoutDashboard, Plus, CheckCircle, XCircle, Download, MessageSquare
} from 'lucide-react';
import { format, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { PREDEFINED_LOCATIONS } from '../constants';

const getSeminarStatus = (dateString: string): 'upcoming' | 'ongoing' | 'completed' => {
  const now = new Date();
  const seminarDate = new Date(dateString);
  const diffInHours = (now.getTime() - seminarDate.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 0) return 'upcoming';
  if (diffInHours >= 0 && diffInHours <= 6) return 'ongoing';
  return 'completed';
};

export function AllSeminars() {
  const [seminars, setSeminars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSeminar, setEditingSeminar] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'seminars'), where('createdBy', '==', auth.currentUser?.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSeminars(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'seminars');
    });

    const templatesQ = query(collection(db, 'certificateTemplates'), where('createdBy', '==', auth.currentUser?.uid));
    const unsubTemplates = onSnapshot(templatesQ, (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificateTemplates');
    });

    return () => {
      unsubscribe();
      unsubTemplates();
    };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'seminars', id));
      setShowDeleteConfirm(null);
      toast.success('Seminar deleted successfully');
    } catch (err) {
      toast.error('Failed to delete seminar');
      handleFirestoreError(err, OperationType.DELETE, `seminars/${id}`);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeminar) return;
    try {
      await updateDoc(doc(db, 'seminars', editingSeminar.id), {
        title: editingSeminar.title,
        description: editingSeminar.description,
        date: editingSeminar.date,
        location: editingSeminar.location,
        status: getSeminarStatus(editingSeminar.date),
        templateId: editingSeminar.templateId,
        whatsappLink: editingSeminar.whatsappLink || '',
        isWhatsappEnabled: editingSeminar.isWhatsappEnabled || false,
      });
      setShowEditModal(false);
      setEditingSeminar(null);
      toast.success('Seminar updated successfully!');
    } catch (err) {
      toast.error('Failed to update seminar');
      handleFirestoreError(err, OperationType.WRITE, `seminars/${editingSeminar.id}`);
    }
  };

  const filteredSeminars = seminars
    .filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.location.toLowerCase().includes(searchQuery.toLowerCase());
      
      const seminarDate = parseISO(s.date);
      const matchesStartDate = !dateFilter.start || isAfter(seminarDate, startOfDay(parseISO(dateFilter.start)));
      const matchesEndDate = !dateFilter.end || isBefore(seminarDate, endOfDay(parseISO(dateFilter.end)));
      
      const matchesStatus = statusFilter === 'all' || getSeminarStatus(s.date) === statusFilter;

      return matchesSearch && matchesStartDate && matchesEndDate && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        return sortOrder === 'asc' 
          ? a.title.localeCompare(b.title) 
          : b.title.localeCompare(a.title);
      }
    });

  const handleExportCSV = () => {
    if (filteredSeminars.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['ID', 'Title', 'Description', 'Date', 'Location', 'Status', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...filteredSeminars.map(s => [
        `"${s.id}"`,
        `"${s.title.replace(/"/g, '""')}"`,
        `"${s.description.replace(/"/g, '""')}"`,
        `"${format(new Date(s.date), 'yyyy-MM-dd HH:mm')}"`,
        `"${s.location.replace(/"/g, '""')}"`,
        `"${getSeminarStatus(s.date)}"`,
        `"${format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `seminars_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2">All Seminars</h1>
          <p className="text-slate-500 font-medium">Manage and filter your entire seminar catalog.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV}
            className="px-6 py-3 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all flex items-center gap-2 shadow-lg shadow-teal-100"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <Link 
            to="/"
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <LayoutDashboard className="w-5 h-5" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 space-y-6">
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Search by title or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-medium"
            />
          </div>
          
          <div className="md:col-span-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-medium text-slate-600"
            >
              <option value="all">All Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="md:col-span-4 flex gap-2">
            <button 
              onClick={() => {
                setSortBy('date');
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border transition-all font-bold text-sm",
                sortBy === 'date' ? "bg-teal-50 border-teal-200 text-brand-teal-light" : "bg-white border-slate-100 text-slate-600"
              )}
            >
              <Calendar className="w-4 h-4" />
              Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => {
                setSortBy('title');
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border transition-all font-bold text-sm",
                sortBy === 'title' ? "bg-teal-50 border-teal-200 text-brand-teal-light" : "bg-white border-slate-100 text-slate-600"
              )}
            >
              <ArrowUpDown className="w-4 h-4" />
              Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Start Date</label>
            <input 
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-medium"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">End Date</label>
            <input 
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-medium"
            />
          </div>
        </div>

        {(searchQuery || dateFilter.start || dateFilter.end || statusFilter !== 'all') && (
          <div className="flex justify-end">
            <button 
              onClick={() => {
                setSearchQuery('');
                setDateFilter({ start: '', end: '' });
                setStatusFilter('all');
              }}
              className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Seminar Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredSeminars.map((s) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                    getSeminarStatus(s.date) === 'upcoming' ? "bg-teal-50 text-brand-teal-light" :
                    getSeminarStatus(s.date) === 'ongoing' ? "bg-emerald-50 text-emerald-600" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {getSeminarStatus(s.date)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setEditingSeminar(s);
                        setShowEditModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-brand-teal-light hover:bg-teal-50 rounded-lg transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(s.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">{s.title}</h3>
                <p className="text-sm text-slate-500 mb-6 line-clamp-3">{s.description}</p>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 text-brand-teal-light" />
                    <span className="font-medium">{format(new Date(s.date), 'PPP')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <MapPin className="w-4 h-4 text-brand-teal-light" />
                    <span className="font-medium">{s.location}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <Link 
                  to={`/admin/seminar/${s.id}`}
                  className="text-xs font-bold text-brand-teal-light hover:underline flex items-center gap-1"
                >
                  View Details
                  <ChevronRight className="w-3 h-3" />
                </Link>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Created {format(new Date(s.createdAt), 'MMM d')}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredSeminars.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No seminars found</h3>
            <p className="text-slate-500">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingSeminar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-2xl font-black text-slate-900">Edit Seminar</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white rounded-full transition-all">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Seminar Title</label>
                  <input 
                    required
                    type="text"
                    value={editingSeminar.title}
                    onChange={(e) => setEditingSeminar({ ...editingSeminar, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Description</label>
                  <textarea 
                    required
                    rows={3}
                    value={editingSeminar.description}
                    onChange={(e) => setEditingSeminar({ ...editingSeminar, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Date</label>
                  <input 
                    required
                    type="date"
                    value={editingSeminar.date}
                    onChange={(e) => setEditingSeminar({ ...editingSeminar, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Location</label>
                  <input 
                    required
                    type="text"
                    list="predefined-locations-all"
                    value={editingSeminar.location}
                    onChange={(e) => setEditingSeminar({ ...editingSeminar, location: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light"
                  />
                  <datalist id="predefined-locations-all">
                    {PREDEFINED_LOCATIONS.map(loc => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Certificate Template</label>
                  <select 
                    value={editingSeminar.templateId}
                    onChange={(e) => setEditingSeminar({ ...editingSeminar, templateId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light"
                  >
                    <option value="">No Template Selected</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm font-bold text-slate-700">Enable WhatsApp Group</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingSeminar({ ...editingSeminar, isWhatsappEnabled: !editingSeminar.isWhatsappEnabled })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        editingSeminar.isWhatsappEnabled ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        editingSeminar.isWhatsappEnabled ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>
                  {editingSeminar.isWhatsappEnabled && (
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">WhatsApp Group Link</label>
                      <input
                        type="url"
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        value={editingSeminar.whatsappLink || ''}
                        onChange={(e) => setEditingSeminar({ ...editingSeminar, whatsappLink: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden p-8 text-center"
          >
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Delete Seminar?</h2>
            <p className="text-slate-500 font-medium mb-8">
              Are you sure you want to delete this seminar? This action cannot be undone and all associated data will be lost.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-100"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
