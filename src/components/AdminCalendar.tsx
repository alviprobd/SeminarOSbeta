import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Filter,
  Search,
  Info,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { PREDEFINED_LOCATIONS } from '../constants';
import { Link } from 'react-router-dom';

const getSeminarStatus = (dateString: string): 'upcoming' | 'ongoing' | 'completed' => {
  const now = new Date();
  const seminarDate = new Date(dateString);
  const diffInHours = (now.getTime() - seminarDate.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 0) return 'upcoming';
  if (diffInHours >= 0 && diffInHours <= 6) return 'ongoing';
  return 'completed';
};

export function AdminCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [seminars, setSeminars] = useState<any[]>([]);
  const [locationFilter, setLocationFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'seminars'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSeminars(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const filteredSeminars = seminars.filter(s => 
    locationFilter === 'all' || s.location === locationFilter
  );

  const getSeminarsForDay = (day: Date) => {
    return filteredSeminars.filter(s => isSameDay(parseISO(s.date), day));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Seminar Calendar</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">View and manage seminar schedules and venue availability.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
        >
          <div className="flex items-center gap-2 px-4 border-r border-slate-100 dark:border-slate-800">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Venue</span>
          </div>
          <select 
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 dark:text-slate-300 pr-8 cursor-pointer"
          >
            <option value="all">All Venues</option>
            {PREDEFINED_LOCATIONS.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </motion.div>
      </div>

      {/* Calendar Header */}
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl border-x border-t border-slate-100 dark:border-slate-800 p-6 flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-brand-teal-light"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 text-sm font-bold text-brand-teal-light hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-xl transition-all"
          >
            Today
          </button>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-brand-teal-light"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-b-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto">
        <div className="min-w-[800px] lg:min-w-full">
          {/* Days of week */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-4 text-center text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const daySeminars = getSeminarsForDay(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());

              return (
                <div 
                  key={day.toString()} 
                  className={cn(
                    "min-h-[140px] p-2 border-r border-b border-slate-100 dark:border-slate-800 transition-all",
                    !isCurrentMonth && "bg-slate-50/30 dark:bg-slate-800/10 opacity-50",
                    (i + 1) % 7 === 0 && "border-r-0"
                  )}
                >
                <div className="flex justify-between items-center mb-2">
                  <span className={cn(
                    "w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full",
                    isToday ? "bg-brand-teal-light text-white shadow-lg shadow-teal-100 dark:shadow-teal-900/20" : "text-slate-700 dark:text-slate-300"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {daySeminars.length > 0 && (
                    <span className="text-[10px] font-black text-brand-teal-light bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full uppercase">
                      {daySeminars.length} {daySeminars.length === 1 ? 'Event' : 'Events'}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {daySeminars.map(seminar => (
                      <Link
                        key={seminar.id}
                        to={`/admin/seminar/${seminar.id}`}
                        className={cn(
                          "block p-2 rounded-xl text-left transition-all group",
                          getSeminarStatus(seminar.date) === 'ongoing' ? "bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800" :
                          getSeminarStatus(seminar.date) === 'upcoming' ? "bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-100 dark:border-teal-800" :
                          "bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700"
                        )}
                      >
                        <p className={cn(
                          "text-[10px] font-bold truncate mb-0.5",
                          getSeminarStatus(seminar.date) === 'ongoing' ? "text-emerald-700 dark:text-emerald-400" :
                          getSeminarStatus(seminar.date) === 'upcoming' ? "text-brand-teal-light" :
                          "text-slate-700 dark:text-slate-300"
                        )}>
                          {seminar.title}
                        </p>
                      <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        <Clock className="w-2 h-2" />
                        {format(parseISO(seminar.date), 'p')}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

      {/* Legend */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 flex flex-wrap items-center gap-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800"
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-teal-light" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Ongoing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-400 dark:bg-slate-600" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Completed</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-slate-400 dark:text-slate-500">
          <Info className="w-4 h-4" />
          <span className="text-xs font-medium italic">Click on an event to view details in Focus Mode.</span>
        </div>
      </motion.div>
    </div>
  );
}
