import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Calendar, MapPin, Clock, 
  ChevronRight, Filter, X, Loader2, AlertCircle,
  ArrowUpDown, ExternalLink, BookOpen, GraduationCap
} from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';

export function ExploreSeminars() {
  const [seminars, setSeminars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch all seminars
    const q = query(collection(db, 'seminars'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSeminars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const now = new Date();
      // Only upcoming seminars
      const upcoming = allSeminars.filter(s => new Date(s.date) > now);
      setSeminars(upcoming);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'seminars');
    });

    // Listen for auth changes to fetch registrations
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const regQ = query(collection(db, 'registrations'), where('studentUid', '==', user.uid));
        const unsubReg = onSnapshot(regQ, (snapshot) => {
          setRegistrations(snapshot.docs.map(doc => doc.data().seminarId));
        }, (error) => {
          console.error("Error fetching registrations:", error);
        });
        return () => unsubReg();
      } else {
        setRegistrations([]);
      }
    });

    return () => {
      unsubscribe();
      unsubAuth();
    };
  }, []);

  const filteredSeminars = seminars.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light" />
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Discovering Opportunities...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center text-brand-teal-light">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Explore Seminars</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Discover upcoming seminars and reserve your spot.</p>
          </div>
        </div>

        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Search by topic, venue, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-medium shadow-sm dark:text-white"
          />
        </div>
      </div>

      {filteredSeminars.length === 0 ? (
        <div className="text-center py-32 bg-white dark:bg-slate-900/40 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No Upcoming Seminars</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Check back later for new sessions and exciting opportunities.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredSeminars.map((s, i) => {
            const isRegistered = registrations.includes(s.id);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden"
              >
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-brand-teal-light text-[10px] font-black uppercase tracking-widest rounded-full">
                      Upcoming
                    </div>
                    {isRegistered && (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <GraduationCap className="w-4 h-4 fill-current" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Registered</span>
                      </div>
                    )}
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-brand-teal-light transition-colors">
                    {s.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 line-clamp-3 leading-relaxed font-medium">
                    {s.description}
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-brand-teal-light shadow-sm">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date & Time</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {format(new Date(s.date), 'MMMM d, hh:mm a')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-brand-teal-light shadow-sm">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Venue</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                          {s.location}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
                  {isRegistered ? (
                    <Link 
                      to="/dashboard"
                      className="w-full py-4 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      View in Dashboard
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <Link 
                      to={`/register/${s.id}`}
                      className="w-full py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 dark:shadow-none flex items-center justify-center gap-2 group/btn"
                    >
                      Register Now
                      <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
