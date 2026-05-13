import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { 
  BarChart3, TrendingUp, Users, Award, 
  Calendar, ChevronLeft, Loader2, Filter,
  ArrowUpRight, ArrowDownRight, Clock, Star,
  UserPlus
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area
} from 'recharts';
import { format, startOfMonth, startOfWeek, isSameMonth, isSameWeek, parseISO, subMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { DEPARTMENTS } from '../constants';

export function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalSeminars: 0,
    totalParticipants: 0,
    totalAttendance: 0,
    totalCertificates: 0,
    totalUsers: 0,
    avgRating: 0,
    totalFeedback: 0,
    recentFeedback: [],
    monthlyTrend: [],
    weeklyTrend: [],
    deptDistribution: [],
    seminarPerformance: [],
    ambassadorLeaderboard: []
  });
  const [timeRange, setTimeRange] = useState<'all' | 'monthly' | 'weekly'>('all');

  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const seminarsSnap = await getDocs(query(collection(db, 'seminars'), where('createdBy', '==', auth.currentUser?.uid)));
        const registrationsSnap = await getDocs(collection(db, 'registrations'));
        const attendanceSnap = await getDocs(collection(db, 'attendance'));
        const certificatesSnap = await getDocs(collection(db, 'certificates'));
        const feedbackSnap = await getDocs(collection(db, 'feedback'));
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));

        const seminars = seminarsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const registrations = registrationsSnap.docs.map(doc => doc.data());
        const attendance = attendanceSnap.docs.map(doc => doc.data());
        const certificates = certificatesSnap.docs.map(doc => doc.data());
        const feedback = feedbackSnap.docs.map(doc => doc.data());
        const totalUsers = usersSnap.size;

        // Filter registrations to only those belonging to admin's seminars
        const adminSeminarIds = new Set(seminars.map(s => s.id));
        const filteredRegs = registrations.filter(r => adminSeminarIds.has(r.seminarId));
        const filteredAtt = attendance.filter(a => adminSeminarIds.has(a.seminarId) && a.attended);
        const filteredCerts = certificates.filter(c => adminSeminarIds.has(c.seminarId));
        const filteredFeedback = feedback.filter(f => adminSeminarIds.has(f.seminarId));

        // Calculate average rating
        const totalRating = filteredFeedback.reduce((acc, f) => acc + (f.rating || 0), 0);
        const avgRating = filteredFeedback.length > 0 ? (totalRating / filteredFeedback.length).toFixed(1) : 0;

        // Monthly Trend (Last 6 months)
        const last6Months = Array.from({ length: 6 }).map((_, i) => {
          const date = subMonths(new Date(), i);
          return {
            name: format(date, 'MMM'),
            month: startOfMonth(date),
            count: 0
          };
        }).reverse();

        filteredRegs.forEach(reg => {
          const regDate = parseISO(reg.registeredAt || new Date().toISOString());
          const monthIndex = last6Months.findIndex(m => isSameMonth(m.month, regDate));
          if (monthIndex !== -1) last6Months[monthIndex].count++;
        });

        // Weekly Trend (Last 4 weeks)
        const last4Weeks = Array.from({ length: 4 }).map((_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (i * 7));
          return {
            name: `Week ${4-i}`,
            week: startOfWeek(date),
            count: 0
          };
        }).reverse();

        filteredRegs.forEach(reg => {
          const regDate = parseISO(reg.registeredAt || new Date().toISOString());
          const weekIndex = last4Weeks.findIndex(w => isSameWeek(w.week, regDate));
          if (weekIndex !== -1) last4Weeks[weekIndex].count++;
        });

        // Dept Distribution
        const depts: any = {};
        filteredRegs.forEach(r => {
          const deptShort = DEPARTMENTS.find(d => d.name === r.studentDept || d.short === r.studentDept)?.short || r.studentDept || 'N/A';
          depts[deptShort] = (depts[deptShort] || 0) + 1;
        });
        const deptDistribution = Object.keys(depts).map(name => ({ name, value: depts[name] }));

        // Seminar Performance
        const seminarPerformance = seminars.map(s => {
          const regs = filteredRegs.filter(r => r.seminarId === s.id).length;
          const atts = filteredAtt.filter(a => a.seminarId === s.id).length;
          return {
            name: s.title.substring(0, 15) + '...',
            registrations: regs,
            attendance: atts,
            rate: regs > 0 ? Math.round((atts / regs) * 100) : 0
          };
        }).sort((a, b) => b.registrations - a.registrations).slice(0, 5);

        // Ambassador Leaderboard
        const ambassadorCounts: any = {};
        filteredFeedback.forEach(f => {
          if (f.referralSource === 'Career Ambassador' && f.ambassadorCode) {
            ambassadorCounts[f.ambassadorCode] = (ambassadorCounts[f.ambassadorCode] || 0) + 1;
          }
        });
        const ambassadorLeaderboard = Object.keys(ambassadorCounts)
          .map(code => ({ code, count: ambassadorCounts[code] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        setStats({
          totalSeminars: seminars.length,
          totalParticipants: filteredRegs.length,
          totalAttendance: filteredAtt.length,
          totalCertificates: filteredCerts.length,
          totalUsers,
          totalFeedback: filteredFeedback.length,
          avgRating,
          recentFeedback: filteredFeedback.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 5),
          monthlyTrend: last6Months,
          weeklyTrend: last4Weeks,
          deptDistribution,
          seminarPerformance,
          ambassadorLeaderboard
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'analytics_data');
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalStats();
  }, []);

  const COLORS = ['#14202F', '#265D90', '#235c71', '#268693', '#0f172a'];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
      <Loader2 className="w-12 h-12 text-brand-teal-light dark:text-brand-teal-light animate-spin" />
    </div>
  );

  const trendData = timeRange === 'weekly' ? stats.weeklyTrend : stats.monthlyTrend;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8 sm:mb-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors mb-6">
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base">Comprehensive overview of all your seminars and student engagement.</p>
          </div>
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {(['all', 'monthly', 'weekly'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize",
                  timeRange === range ? "bg-brand-teal-light text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {[
          { label: 'Total Seminars', value: stats.totalSeminars, icon: <Calendar className="w-5 h-5" />, color: 'bg-blue-50 dark:bg-blue-900/20 text-brand-blue-light dark:text-brand-blue-light', trend: '+12%', up: true },
          { label: 'Total Registrations', value: stats.totalParticipants, icon: <Users className="w-5 h-5" />, color: 'bg-teal-50 dark:bg-teal-900/20 text-brand-teal-light dark:text-brand-teal-light', trend: '+18%', up: true },
          { label: 'Total Attendance', value: stats.totalAttendance, icon: <TrendingUp className="w-5 h-5" />, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', trend: '+5%', up: true },
          { label: 'Certificates Issued', value: stats.totalCertificates, icon: <Award className="w-5 h-5" />, color: 'bg-blue-50 dark:bg-blue-900/20 text-brand-blue-light dark:text-brand-blue-light', trend: '+22%', up: true },
          { label: 'Total Users', value: stats.totalUsers, icon: <UserPlus className="w-5 h-5" />, color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400', trend: 'Active', up: true },
          { label: 'Average Rating', value: stats.avgRating + '/5', icon: <Star className="w-5 h-5" />, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', trend: stats.totalFeedback + ' reviews', up: true },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex items-center gap-5"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", card.color)}>
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{card.label}</p>
                <div className={cn(
                  "flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-lg shrink-0 ml-2",
                  card.up ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                )}>
                  {card.up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                  {card.trend}
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Trend Chart */}
        <div className="lg:col-span-8 p-4 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-teal-light" />
              Registration Trends
            </h3>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500">
              <Clock className="w-4 h-4" />
              Real-time data
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#268693" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#268693" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--tooltip-bg, #fff)', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  itemStyle={{ color: '#268693', fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="count" stroke="#268693" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dept Distribution */}
        <div className="lg:col-span-4 p-4 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-teal-light" />
            Top Departments
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.deptDistribution}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.deptDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ 
                    backgroundColor: 'var(--tooltip-bg, #fff)', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-6">
            {stats.deptDistribution.slice(0, 4).map((entry: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{entry.name}</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Seminars */}
        <div className="lg:col-span-8 p-4 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-teal-light" />
            Top Performing Seminars
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {stats.seminarPerformance.map((seminar: any, i: number) => (
              <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4 truncate">{seminar.name}</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">Attendance Rate</span>
                    <span className="text-brand-teal-light">{seminar.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-teal-light rounded-full transition-all duration-1000" 
                      style={{ width: `${seminar.rate}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-900 dark:text-white">{seminar.registrations}</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Regs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-900 dark:text-white">{seminar.attendance}</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Attended</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ambassador Leaderboard Section */}
          <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Award className="w-5 h-5" />
                </div>
                Ambassador Leaderboard
              </h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall Referrals</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.ambassadorLeaderboard.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-brand-teal-light transition-all">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm transition-transform group-hover:scale-110",
                    i === 0 ? "bg-amber-100 text-amber-700" : 
                    i === 1 ? "bg-slate-200 text-slate-700" :
                    i === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-white dark:bg-slate-900 text-slate-400"
                  )}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-0.5">Code</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">Ambassador {item.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-brand-teal-light leading-none">{item.count}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Referrals</p>
                  </div>
                </div>
              ))}
              {stats.ambassadorLeaderboard.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                  <p className="text-slate-400 font-medium">No ambassador referrals tracked yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Feedback */}
        <div className="lg:col-span-4 p-4 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Recent Feedback
          </h3>
          <div className="space-y-6">
            {stats.recentFeedback.length > 0 ? (
              stats.recentFeedback.map((f: any, i: number) => (
                <div key={i} className="space-y-2 pb-4 border-b border-slate-50 dark:border-slate-800 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{f.studentName}</p>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs font-black">{f.rating}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 italic">"{f.comment}"</p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{f.seminarTitle.substring(0, 20)}...</p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
                  <Star className="w-6 h-6 text-slate-200 dark:text-slate-700" />
                </div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">No feedback yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
