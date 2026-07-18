import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Trophy, Building2, Award, Loader2, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { useDepartments } from '../hooks/useDepartments';

interface TopParticipant {
  uid: string;
  count: number;
  name: string;
  dept: string;
}

export function Leaderboard() {
  const { departments } = useDepartments();
  const [topParticipants, setTopParticipants] = useState<TopParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const path = 'attendance';
      try {
        const now = new Date();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();

        // Query attendance where attended is true
        const attQ = query(
          collection(db, path),
          where('attended', '==', true)
        );

        const attSnapshot = await getDocs(attQ);
        const participantData: Record<string, { count: number, name: string, dept: string }> = {};

        attSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const isThisMonth = data.markedAt >= monthStart && data.markedAt <= monthEnd;
          
          if (isThisMonth) {
            if (!participantData[data.studentUid]) {
              participantData[data.studentUid] = { 
                count: 0, 
                name: data.studentName || 'Anonymous Student', 
                dept: data.studentDept || 'N/A' 
              };
            }
            participantData[data.studentUid].count++;
          }
        });

        // If no one is active this month, show all time
        if (Object.keys(participantData).length === 0) {
          attSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!participantData[data.studentUid]) {
              participantData[data.studentUid] = { 
                count: 0, 
                name: data.studentName || 'Anonymous Student', 
                dept: data.studentDept || 'N/A' 
              };
            }
            participantData[data.studentUid].count++;
          });
        }

        // Sort and take top 5 UIDs
        const sortedUids = Object.entries(participantData)
          .sort(([, a], [, b]) => b.count - a.count)
          .slice(0, 5);

        // Fetch user details for the top 5 to ensure we have the real names and depts
        const topData = await Promise.all(
          sortedUids.map(async ([uid, data]) => {
            try {
              // Try to fetch from users collection first for latest info
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                const deptShort = departments.find(d => d.name === userData.dept || d.short === userData.dept)?.short || userData.dept || 'N/A';
                return {
                  uid,
                  count: data.count,
                  name: userData.displayName || data.name || 'Student',
                  dept: deptShort,
                };
              }
              
              // Fallback to what was in the attendance record
              const deptShort = departments.find(d => d.name === data.dept || d.short === data.dept)?.short || data.dept || 'N/A';
              return {
                uid,
                count: data.count,
                name: data.name !== 'Anonymous Student' ? data.name : 'Student',
                dept: deptShort,
              };
            } catch (err) {
              console.warn(`Could not fetch user details for ${uid}`, err);
              const deptShort = departments.find(d => d.name === data.dept || d.short === data.dept)?.short || data.dept || 'N/A';
              return {
                uid,
                count: data.count,
                name: data.name !== 'Anonymous Student' ? data.name : 'Student',
                dept: deptShort,
              };
            }
          })
        );

        setTopParticipants(topData);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        handleFirestoreError(error, OperationType.LIST, path);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal-light dark:text-brand-teal-light" />
      </div>
    );
  }

  if (topParticipants.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-200 dark:border-slate-800">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-400 dark:text-slate-500">No Leaderboard Data Yet</h2>
          <p className="text-slate-400 dark:text-slate-500">Start attending seminars to see the leaderboard!</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-200 dark:border-slate-800">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-flex p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl mb-6"
        >
          <Trophy className="w-8 h-8 text-amber-500 dark:text-amber-400" />
        </motion.div>
        <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Top Seminar Achievers</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xl mx-auto">
          Recognizing the top 5 participants with the highest seminar attendance this month.
        </p>
      </div>

      <div className="grid gap-6 max-w-3xl mx-auto">
        {topParticipants.map((participant, index) => (
          <motion.div
            key={participant.uid}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "flex items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-3xl border transition-all",
              index === 0 ? "border-amber-200 dark:border-amber-900/50 shadow-xl shadow-amber-50 dark:shadow-amber-900/10" : "border-slate-100 dark:border-slate-800 shadow-sm"
            )}
          >
            <div className="flex items-center gap-6">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl",
                index === 0 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" : 
                index === 1 ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" :
                index === 2 ? "bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400" : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              )}>
                {index + 1}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{participant.name}</h3>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <Building2 className="w-3 h-3" />
                  {participant.dept}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-brand-teal-light dark:text-brand-teal-light font-black text-2xl">
                <Award className="w-6 h-6" />
                {participant.count}
              </div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Seminars</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Link 
          to="/explore" 
          className="inline-flex items-center gap-2 px-8 py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-xl shadow-teal-100 dark:shadow-teal-900/20 group"
        >
          Explore All Upcoming Seminars
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </section>
  );
}
