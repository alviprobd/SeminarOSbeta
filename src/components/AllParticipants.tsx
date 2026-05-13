import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  Search, Users, Download, Filter, X, Loader2, 
  LayoutDashboard, ChevronRight, Mail, User as UserIcon,
  BookOpen, GraduationCap
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { DEPARTMENTS } from '../constants';

export function AllParticipants() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [seminars, setSeminars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [seminarFilter, setSeminarFilter] = useState('all');

  useEffect(() => {
    // Fetch seminars first to have titles
    const fetchSeminars = async () => {
      try {
        const q = query(collection(db, 'seminars'), where('createdBy', '==', auth.currentUser?.uid));
        const snapshot = await getDocs(q);
        const seminarMap: Record<string, string> = {};
        snapshot.docs.forEach(doc => {
          seminarMap[doc.id] = doc.data().title;
        });
        setSeminars(seminarMap);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'seminars');
      }
    };

    fetchSeminars();

    // Fetch all registrations for seminars created by this admin
    // Note: In a real app with many registrations, we might need a more complex query or indexing
    // For now, we'll fetch all and filter client-side if needed, or fetch per seminar
    const q = query(collection(db, 'registrations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Filter registrations for seminars owned by this admin
      // This is a client-side filter because Firestore doesn't support joins easily
      const allRegs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistrations(allRegs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registrations');
    });

    return () => unsubscribe();
  }, []);

  const filteredRegistrations = registrations.filter(r => {
    // Only show registrations for seminars that belong to this admin
    if (!seminars[r.seminarId]) return false;

    const matchesSearch = r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         r.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         r.studentEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDept = deptFilter === 'all' || r.studentDept === deptFilter;
    const matchesSeminar = seminarFilter === 'all' || r.seminarId === seminarFilter;

    return matchesSearch && matchesDept && matchesSeminar;
  });

  const exportToCSV = () => {
    if (filteredRegistrations.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Student Name', 'Student ID', 'Email', 'Department', 'Seminar', 'Registration Date'];
    const rows = filteredRegistrations.map(r => [
      r.studentName,
      r.studentId,
      r.studentEmail,
      r.studentDept,
      seminars[r.seminarId] || 'Unknown Seminar',
      format(new Date(r.registeredAt), 'yyyy-MM-dd HH:mm:ss')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `participants_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
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
          <h1 className="text-4xl font-black text-slate-900 mb-2">All Participants</h1>
          <p className="text-slate-500 font-medium">View and manage all students registered for your seminars.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={exportToCSV}
            className="px-6 py-3 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <Link 
            to="/dashboard"
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
        <div className="grid md:grid-cols-12 gap-4">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Search by name, ID, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-medium"
            />
          </div>
          
          <div className="md:col-span-3">
            <select 
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-medium text-slate-600"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => (
                <option key={d.short} value={d.short}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <select 
              value={seminarFilter}
              onChange={(e) => setSeminarFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-medium text-slate-600"
            >
              <option value="all">All Seminars</option>
              {Object.entries(seminars).map(([id, title]) => (
                <option key={id} value={id}>{title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Participants Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Info</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seminar</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reg. Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredRegistrations.map((r) => (
                  <motion.tr 
                    key={r.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center text-brand-teal-light">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{r.studentName}</span>
                          <span className="text-xs text-slate-400 font-medium">{r.studentEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">
                          {DEPARTMENTS.find(d => d.name === r.studentDept)?.short || r.studentDept}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{r.studentId}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-sm font-medium text-slate-600 line-clamp-1">
                          {seminars[r.seminarId] || 'Unknown Seminar'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-medium text-slate-500">
                        {format(new Date(r.registeredAt), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <Link 
                        to={`/admin/participant/${r.studentUid}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-brand-teal-light hover:underline"
                      >
                        Details
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredRegistrations.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-400 font-medium">No participants found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 flex justify-between items-center px-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Showing {filteredRegistrations.length} of {registrations.length} total registrations
        </p>
      </div>
    </div>
  );
}
