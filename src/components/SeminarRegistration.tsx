import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { 
  Calendar, MapPin, Clock, CheckCircle, 
  AlertCircle, Loader2, ArrowRight, User, 
  Mail, Building2, ShieldCheck, Info, Award, Users, CheckCircle2,
  Send, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';

export function SeminarRegistration() {
  const { seminarId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [seminar, setSeminar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!seminarId) return;
      
      try {
        const semDoc = await getDoc(doc(db, 'seminars', seminarId));
        if (semDoc.exists()) {
          setSeminar({ id: semDoc.id, ...semDoc.data() });
          
          if (auth.currentUser) {
            const q = query(
              collection(db, 'registrations'), 
              where('seminarId', '==', seminarId),
              where('studentUid', '==', auth.currentUser.uid)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) setAlreadyRegistered(true);
          }
        } else {
          toast.error('Seminar not found.');
        }
      } catch (err) {
        toast.error('Error loading seminar details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [seminarId]);

  useEffect(() => {
    if (!loading && seminar && location.state?.scrollToRegister) {
      const element = document.getElementById('registration-card');
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [loading, seminar, location.state]);

  const handleRegister = async () => {
    if (!auth.currentUser) {
      navigate('/auth', { state: { from: `/register/${seminarId}`, mode: 'signup', scrollToRegister: true } });
      return;
    }

    setRegistering(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();

      await addDoc(collection(db, 'registrations'), {
        seminarId: seminar.id,
        seminarTitle: seminar.title,
        studentUid: auth.currentUser.uid,
        studentEmail: auth.currentUser.email,
        studentName: auth.currentUser.displayName || 'Student',
        studentDept: userData?.dept || 'N/A',
        registeredAt: new Date().toISOString(),
      });
      setAlreadyRegistered(true);
      toast.success('Successfully registered for the seminar!');
    } catch (err) {
      toast.error('Failed to register. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light" />
        <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Seminar Details...</p>
      </div>
    );
  }

  if (!seminar) {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 text-center shadow-2xl shadow-teal-50 dark:shadow-teal-900/10">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Seminar Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">The seminar you're looking for might have been removed or the link is incorrect.</p>
        <button 
          onClick={() => navigate('/')} 
          className="w-full py-4 bg-slate-900 dark:bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-slate-800 dark:hover:bg-brand-teal-dark transition-all shadow-xl shadow-slate-200 dark:shadow-teal-900/20"
        >
          Return to Homepage
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative bg-brand-blue-dark dark:bg-slate-950 pt-32 pb-48 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-teal-light rounded-full blur-[120px] -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-teal-dark rounded-full blur-[120px] translate-y-1/2" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <span className="px-4 py-1.5 bg-teal-500/20 backdrop-blur-md border border-teal-500/30 text-teal-300 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                Live Seminar
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white leading-[1.1] tracking-tight mb-8">
              {seminar.title}
            </h1>
            <div className="flex flex-wrap items-center gap-8 text-slate-400">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-brand-teal-light" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date</p>
                  <p className="text-sm font-bold text-white">{format(new Date(seminar.date), 'MMMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-brand-teal-light" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Time</p>
                  <p className="text-sm font-bold text-white">{format(new Date(seminar.date), 'hh:mm a')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Venue</p>
                  <p className="text-sm font-bold text-white">{seminar.location}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-20">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Main Info */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 space-y-8 sm:space-y-12"
          >
            <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 md:p-16 shadow-2xl shadow-slate-200/50 dark:shadow-teal-900/10 border border-slate-100 dark:border-slate-800">
              {seminar.bannerImage && (
                <div className="mb-10 rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-800">
                  <img 
                    src={seminar.bannerImage} 
                    alt={seminar.title} 
                    className="w-full h-auto object-cover max-h-[500px]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="flex items-center gap-4 mb-8 sm:mb-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-50 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center">
                  <Info className="w-5 h-5 sm:w-6 sm:h-6 text-brand-teal-light dark:text-brand-teal-light" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Seminar Overview</h2>
              </div>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                  {seminar.description}
                </p>
              </div>

              <div className="mt-16 pt-16 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-widest text-center">What you'll get</h3>
                <div className="grid sm:grid-cols-3 gap-8">
                  {[
                    { icon: <Award className="w-6 h-6" />, title: 'Certificate', desc: 'Digital certificate of completion' },
                    { icon: <ShieldCheck className="w-6 h-6" />, title: 'Verified', desc: 'Official university recognized session' },
                    { icon: <Users className="w-6 h-6" />, title: 'Networking', desc: 'Connect with peers and experts' }
                  ].map((benefit, i) => (
                    <div key={i} className="text-center group">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-[24px] flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-teal-50 dark:group-hover:bg-teal-900/30 transition-all duration-500">
                        <div className="text-slate-400 dark:text-slate-500 group-hover:text-brand-teal-light dark:group-hover:text-brand-teal-light transition-colors">
                          {benefit.icon}
                        </div>
                      </div>
                      <h4 className="font-black text-slate-900 dark:text-white text-sm mb-1">{benefit.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{benefit.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Registration Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-8"
          >
            <div className="sticky top-24" id="registration-card">
              <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl shadow-teal-100 dark:shadow-teal-900/10 border border-teal-50 dark:border-slate-800 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 dark:bg-teal-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Secure your spot</h3>
                  
                  {alreadyRegistered ? (
                    <div className="space-y-8">
                      <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-800">
                        <div className="flex items-center gap-4 text-emerald-700 dark:text-emerald-400 mb-3">
                          <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <span className="font-black text-lg">Registered!</span>
                        </div>
                        <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium leading-relaxed">
                          You're all set! We've reserved a seat for you. Check your dashboard for more details.
                        </p>
                      </div>
                      <button 
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-4 bg-slate-900 dark:bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-slate-800 dark:hover:bg-brand-teal-dark transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 dark:shadow-teal-900/20 group"
                      >
                        Go to Dashboard
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                          <ShieldCheck className="w-5 h-5 text-brand-teal-light" />
                          <span className="text-sm font-bold">Free Registration</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                          <Users className="w-5 h-5 text-brand-teal-light" />
                          <span className="text-sm font-bold">Limited Seats Available</span>
                        </div>
                      </div>

                      <button 
                        onClick={handleRegister}
                        disabled={registering}
                        className="w-full py-5 bg-brand-teal-light text-white font-black rounded-2xl hover:bg-brand-teal-dark transition-all shadow-2xl shadow-teal-200 dark:shadow-teal-900/20 flex items-center justify-center gap-3 disabled:opacity-70 group"
                      >
                        {registering ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            {auth.currentUser ? 'Register Now' : 'Sign In to Register'}
                            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>

                      {!auth.currentUser && (
                        <div className="text-center">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.2em] mb-2">
                            Authentication Required
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Please sign in to complete your registration.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp Group Card */}
              {alreadyRegistered && seminar.whatsappEnabled && seminar.whatsappLink && (
                <div className="mt-8 p-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-[40px] border border-emerald-100 dark:border-emerald-800/50 overflow-hidden relative group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                      <Send className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h4 className="text-xl font-black text-emerald-900 dark:text-emerald-400 mb-2 tracking-tight">Join WhatsApp Group</h4>
                    <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 font-medium leading-relaxed mb-6">
                      Join the official group for real-time updates and networking.
                    </p>
                    <a 
                      href={seminar.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
                    >
                      Join Group Now
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Help Card */}
              <div className="mt-8 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[32px] border border-slate-100 dark:border-slate-800">
                <h4 className="font-black text-slate-900 dark:text-white text-sm mb-4 uppercase tracking-widest">Need Help?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6">
                  If you have any questions regarding the registration process or the seminar content, please contact the department coordinator.
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">support@seminaros.edu</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
