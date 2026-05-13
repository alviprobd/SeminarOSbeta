import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { 
  CheckCircle, XCircle, Loader2, AlertCircle, 
  Calendar, MapPin, User, Info, ArrowRight,
  Clock, ShieldCheck, CheckCircle2, Award, Users,
  Send, Star
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { AnimatePresence } from 'motion/react';

export function AttendancePage() {
  const { seminarId } = useParams();
  const navigate = useNavigate();
  const [seminar, setSeminar] = useState<any>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [marked, setMarked] = useState<boolean | null>(null);
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedback, setFeedback] = useState({ 
    rating: 5, 
    comment: '',
    referralSource: '',
    ambassadorCode: ''
  });
  const [referralSettings, setReferralSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const brandingDoc = await getDoc(doc(db, 'siteSettings', 'branding'));
        if (brandingDoc.exists()) {
          setSiteSettings(brandingDoc.data());
        }
      } catch (error) {
        console.error('Error fetching branding settings:', error);
      }

      try {
        const referralDoc = await getDoc(doc(db, 'siteSettings', 'referral'));
        if (referralDoc.exists()) {
          setReferralSettings(referralDoc.data());
        }
      } catch (error) {
        console.error('Error fetching referral settings:', error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!seminarId) return;
      
      try {
        const semDoc = await getDoc(doc(db, 'seminars', seminarId));
        if (semDoc.exists()) {
          setSeminar({ id: semDoc.id, ...semDoc.data() });
          
          if (auth.currentUser) {
            // Check registration
            const regQ = query(
              collection(db, 'registrations'), 
              where('seminarId', '==', seminarId),
              where('studentUid', '==', auth.currentUser.uid)
            );
            const regSnapshot = await getDocs(regQ);
            setIsRegistered(!regSnapshot.empty);

            // Check existing attendance
            const attDoc = await getDoc(doc(db, 'attendance', `${seminarId}_${auth.currentUser.uid}`));
            if (attDoc.exists()) {
              setMarked(attDoc.data().attended);
            }

            // Check existing feedback
            const feedbackDoc = await getDoc(doc(db, 'feedback', `${seminarId}_${auth.currentUser.uid}`));
            if (feedbackDoc.exists()) {
              setFeedbackSubmitted(true);
            }
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

  const handleMarkAttendance = async (attended: boolean) => {
    if (!auth.currentUser || !seminarId) return;

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'attendance', `${seminarId}_${auth.currentUser.uid}`), {
        seminarId,
        studentUid: auth.currentUser.uid,
        studentEmail: auth.currentUser.email,
        attended,
        markedAt: new Date().toISOString(),
      });
      setMarked(attended);
      toast.success('Attendance marked successfully!');

      // Send automated feedback email if enabled
      if (attended && siteSettings?.enableFeedback && siteSettings?.gmailEmail && siteSettings?.gmailAppPassword) {
        try {
          const feedbackLink = `${window.location.origin}/attendance/${seminarId}`;
          const subject = siteSettings.feedbackEmailSubject
            .replace(/{student_name}/g, auth.currentUser.displayName || 'Student')
            .replace(/{seminar_title}/g, seminar.title)
            .replace(/{site_name}/g, siteSettings.siteName || 'Seminar OS');
          
          const body = siteSettings.feedbackEmailBody
            .replace(/{student_name}/g, auth.currentUser.displayName || 'Student')
            .replace(/{seminar_title}/g, seminar.title)
            .replace(/{feedback_link}/g, feedbackLink)
            .replace(/{site_name}/g, siteSettings.siteName || 'Seminar OS');

          const idToken = await auth.currentUser?.getIdToken();
          fetch('/api/send-certificate', { // Reusing the same endpoint for sending general emails
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              gmailEmail: siteSettings.gmailEmail,
              gmailAppPassword: siteSettings.gmailAppPassword,
              to: auth.currentUser.email,
              subject,
              body,
              attachmentBase64: '', // No attachment for feedback
              fileName: ''
            })
          });
        } catch (emailErr) {
          console.error('Error sending feedback email:', emailErr);
        }
      }
    } catch (err) {
      toast.error('Failed to mark attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!auth.currentUser || !seminarId) return;
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'feedback', `${seminarId}_${auth.currentUser.uid}`), {
        seminarId,
        seminarTitle: seminar.title,
        studentUid: auth.currentUser.uid,
        studentName: auth.currentUser.displayName || 'Anonymous',
        studentEmail: auth.currentUser.email,
        rating: feedback.rating,
        comment: feedback.comment,
        referralSource: feedback.referralSource,
        ambassadorCode: feedback.referralSource === 'Career Ambassador' ? feedback.ambassadorCode : '',
        submittedAt: new Date().toISOString(),
      });
      setFeedbackSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (err) {
      toast.error('Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light" />
        <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Verifying Attendance Status...</p>
      </div>
    );
  }

  if (!auth.currentUser) {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 text-center shadow-2xl shadow-teal-50 dark:shadow-teal-900/10">
        <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <User className="w-10 h-10 text-brand-teal-light dark:text-brand-teal-light" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Sign In Required</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">You must be signed in to mark your attendance for this seminar.</p>
        <button 
          onClick={() => navigate('/auth', { state: { from: `/attendance/${seminarId}` } })} 
          className="w-full py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-xl shadow-teal-100 dark:shadow-teal-900/20"
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 text-center shadow-2xl shadow-teal-50 dark:shadow-teal-900/10">
        <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <AlertCircle className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Not Registered</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">You must register for this seminar before you can mark your attendance.</p>
        <button 
          onClick={() => navigate(`/register/${seminarId}`)} 
          className="w-full py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-xl shadow-teal-100 dark:shadow-teal-900/20"
        >
          Register Now
        </button>
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
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[120px] translate-y-1/2" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <span className="px-4 py-1.5 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                Attendance Verification
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.1] tracking-tight mb-8">
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
            className="lg:col-span-2 space-y-12"
          >
            <div className="bg-white dark:bg-slate-900 rounded-[40px] p-10 md:p-16 shadow-2xl shadow-slate-200/50 dark:shadow-teal-900/10 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Mark Your Attendance</h2>
              </div>
              
              {marked !== null ? (
                <div className="space-y-10">
                  {marked && siteSettings?.enableFeedback && !feedbackSubmitted ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-teal-50/50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-[32px] p-8 md:p-12 mb-8"
                    >
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <Award className="w-8 h-8 text-brand-teal-light dark:text-brand-teal-light" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Wait! One Last Step...</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Please provide your feedback to complete the process.</p>
                      </div>

                      <div className="space-y-8">
                        <div className="flex flex-col items-center gap-4">
                          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Rate your experience</p>
                          <div className="flex gap-3">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setFeedback({ ...feedback, rating: star })}
                                className={cn(
                                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                  feedback.rating >= star 
                                    ? "bg-brand-teal-light text-white shadow-lg shadow-teal-100 dark:shadow-teal-900/20 scale-110" 
                                    : "bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 border border-slate-100 dark:border-slate-700 hover:border-teal-200 dark:hover:border-teal-800"
                                )}
                              >
                                <Award className={cn("w-6 h-6", feedback.rating >= star ? "fill-current" : "")} />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">How did you hear about this event?</label>
                          <select
                            value={feedback.referralSource}
                            onChange={(e) => setFeedback({ ...feedback, referralSource: e.target.value, ambassadorCode: '' })}
                            className="w-full px-6 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium shadow-sm dark:text-white appearance-none"
                          >
                            <option value="">Select an option</option>
                            {referralSettings?.referralOptions?.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>

                          <AnimatePresence>
                            {feedback.referralSource === 'Career Ambassador' && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3 overflow-hidden"
                              >
                                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">Career Ambassador Code</label>
                                <select
                                  value={feedback.ambassadorCode}
                                  onChange={(e) => setFeedback({ ...feedback, ambassadorCode: e.target.value })}
                                  className="w-full px-6 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium shadow-sm dark:text-white appearance-none"
                                >
                                  <option value="">Select Ambassador Code</option>
                                  {referralSettings?.ambassadorCodes?.map((code: string) => (
                                    <option key={code} value={code}>Career Ambassador Code - {code}</option>
                                  ))}
                                </select>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">Your Comments</label>
                          <textarea
                            value={feedback.comment}
                            onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                            placeholder="What did you like? What can we improve?"
                            rows={4}
                            className="w-full px-6 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium resize-none shadow-sm dark:text-white"
                          />
                        </div>

                        <button
                          onClick={handleFeedbackSubmit}
                          disabled={submitting || !feedback.rating || !feedback.referralSource || (feedback.referralSource === 'Career Ambassador' && !feedback.ambassadorCode)}
                          className="w-full py-5 bg-brand-teal-light text-white font-black rounded-2xl hover:bg-brand-teal-dark transition-all shadow-xl shadow-teal-100 dark:shadow-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                          Complete & Submit Feedback
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      <div className={cn(
                        "p-10 rounded-[32px] border flex flex-col items-center text-center gap-6",
                        marked ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800"
                      )}>
                        <div className={cn(
                          "w-20 h-20 rounded-3xl flex items-center justify-center shadow-sm",
                          marked ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400" : "bg-white dark:bg-slate-800 text-red-600 dark:text-red-400"
                        )}>
                          {marked ? <CheckCircle2 className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
                        </div>
                        <div>
                          <h3 className={cn(
                            "text-2xl font-black mb-2",
                            marked ? "text-emerald-900 dark:text-emerald-400" : "text-red-900 dark:text-red-400"
                          )}>
                            {feedbackSubmitted ? 'Feedback Received!' : (marked ? 'Attendance Confirmed' : 'Attendance Declined')}
                          </h3>
                          <p className={cn(
                            "text-sm font-medium",
                            marked ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-red-600/80 dark:text-red-400/80"
                          )}>
                            {feedbackSubmitted 
                              ? 'Thank you for helping us grow. Your certificate will be available soon.' 
                              : 'Your response has been securely recorded in our system.'}
                          </p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-6 mt-10">
                        <button 
                          onClick={() => navigate('/dashboard')}
                          className="w-full py-5 bg-slate-900 dark:bg-brand-teal-light text-white font-black rounded-2xl hover:bg-slate-800 dark:hover:bg-brand-teal-dark transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 dark:shadow-teal-900/20 group"
                        >
                          Go to Dashboard
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button 
                          onClick={() => navigate('/')}
                          className="w-full py-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3"
                        >
                          Browse More Seminars
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-800 flex gap-4">
                    <Info className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
                      Please confirm your presence at the seminar. This action is final and will be used for certificate generation.
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <button
                      onClick={() => handleMarkAttendance(true)}
                      disabled={submitting}
                      className="group p-10 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[40px] hover:border-emerald-500 dark:hover:border-emerald-600 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-all flex flex-col items-center text-center gap-6 shadow-sm hover:shadow-xl hover:shadow-emerald-100/50 dark:hover:shadow-emerald-900/20"
                    >
                      <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <span className="block text-xl font-black text-slate-900 dark:text-white mb-1">YES, I AM IN</span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Confirm Presence</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleMarkAttendance(false)}
                      disabled={submitting}
                      className="group p-10 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[40px] hover:border-red-500 dark:hover:border-red-600 hover:bg-red-50/30 dark:hover:bg-red-900/20 transition-all flex flex-col items-center text-center gap-6 shadow-sm hover:shadow-xl hover:shadow-red-100/50 dark:hover:shadow-red-900/20"
                    >
                      <div className="w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <span className="block text-xl font-black text-slate-900 dark:text-white mb-1">NO, I AM NOT</span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Decline Presence</span>
                      </div>
                    </button>
                  </div>

                  {submitting && (
                    <div className="flex flex-col items-center justify-center gap-3 py-4">
                      <Loader2 className="w-8 h-8 animate-spin text-brand-teal-light" />
                      <p className="text-xs font-black text-brand-teal-light uppercase tracking-widest">Recording Attendance...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Sidebar Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-8"
          >
            <div className="sticky top-24">
              <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl shadow-teal-100 dark:shadow-teal-900/10 border border-teal-50 dark:border-slate-800 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 dark:bg-teal-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Attendance Policy</h3>
                  <div className="space-y-6">
                    {[
                      { icon: <ShieldCheck className="w-5 h-5 text-brand-teal-light" />, text: "Verified Identity Required" },
                      { icon: <Clock className="w-5 h-5 text-brand-teal-light" />, text: "Mark during session hours" },
                      { icon: <Award className="w-5 h-5 text-brand-teal-light" />, text: "Required for Certificate" }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-50 dark:bg-teal-900/30 rounded-lg flex items-center justify-center shrink-0">
                          {item.icon}
                        </div>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* WhatsApp Group Card */}
              {seminar.whatsappEnabled && seminar.whatsappLink && (
                <div className="mt-8 p-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-[40px] border border-emerald-100 dark:border-emerald-800/50 overflow-hidden relative group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                      <Send className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h4 className="text-xl font-black text-emerald-900 dark:text-emerald-400 mb-2 tracking-tight">Join WhatsApp Group</h4>
                    <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 font-medium leading-relaxed mb-6">
                      Join the official group for real-time updates, networking, and resources shared during the seminar.
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
                  If you are having trouble marking your attendance, please approach the seminar coordinator at the venue.
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Coordinator Desk</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
