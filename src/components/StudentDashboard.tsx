import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc as fsDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { 
  Calendar, Award, CheckCircle, Clock, 
  Download, Loader2, Search, ExternalLink,
  BookOpen, TrendingUp, PieChart as PieChartIcon,
  MapPin, Facebook, Linkedin, Share2, Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import { CANVAS_WIDTH, CANVAS_HEIGHT, renderCertificateToCanvas } from '../lib/certificateRenderer';
import { Template } from '../types';
import { toast } from 'sonner';

export function StudentDashboard() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [upcomingSeminars, setUpcomingSeminars] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const regQ = query(collection(db, 'registrations'), where('studentUid', '==', uid));
    const certQ = query(collection(db, 'certificates'), where('studentUid', '==', uid));
    const attQ = query(collection(db, 'attendance'), where('studentUid', '==', uid));
    const templatesQ = query(collection(db, 'certificateTemplates'));

    const unsubReg = onSnapshot(regQ, (snapshot) => {
      setRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registrations');
    });
    const unsubCert = onSnapshot(certQ, (snapshot) => {
      setCertificates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificates');
    });
    const unsubAtt = onSnapshot(attQ, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });
    const unsubTemplates = onSnapshot(templatesQ, (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Template[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificateTemplates');
    });

    const seminarsQ = query(collection(db, 'seminars'));
    const unsubSeminars = onSnapshot(seminarsQ, (snapshot) => {
      const allSeminars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const now = new Date();
      const upcoming = allSeminars.filter(s => new Date(s.date) > now);
      setUpcomingSeminars(upcoming);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'seminars');
    });

    return () => {
      unsubReg();
      unsubCert();
      unsubAtt();
      unsubTemplates();
      unsubSeminars();
    };
  }, []);

  const downloadCertificate = async (cert: any, format: 'pdf' | 'jpeg' = 'pdf') => {
    const template = templates.find(t => t.id === cert.templateId);
    if (!template) {
      toast.error('Template not found for this certificate.');
      return;
    }

    setDownloading(cert.id);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      await renderCertificateToCanvas(
        canvas,
        template,
        { 
          studentName: cert.studentName, 
          seminarTitle: cert.seminarTitle,
          verificationCode: cert.verificationCode
        }
      );

      if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`certificate_${cert.studentName.replace(/\s+/g, '_')}.pdf`);
        toast.success('Certificate downloaded as PDF!');
      } else {
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `certificate_${cert.studentName.replace(/\s+/g, '_')}.jpg`;
        link.click();
        toast.success('Certificate downloaded as JPEG!');
      }
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error(`Failed to generate ${format.toUpperCase()}.`);
    } finally {
      setDownloading(null);
    }
  };

  const shareCertificate = async (cert: any, platform: 'facebook' | 'linkedin' | 'system') => {
    const shareUrl = `${window.location.origin}/verify?code=${cert.verificationCode}`;
    const text = `I just earned a certificate for ${cert.seminarTitle}!`;
    const title = `My Certificate: ${cert.seminarTitle}`;

    // Helper to generate JPEG file
    const generateImageFile = async () => {
      const template = templates.find(t => t.id === cert.templateId);
      if (!template) throw new Error('Template not found');

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      await renderCertificateToCanvas(canvas, template, {
        studentName: cert.studentName,
        seminarTitle: cert.seminarTitle,
        verificationCode: cert.verificationCode
      });

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
      return new File([blob], `certificate_${cert.verificationCode}.jpg`, { type: 'image/jpeg' });
    };

    setDownloading(cert.id);
    try {
      // 1. System Share (Mobile) - Shares Actual File
      if (platform === 'system' && navigator.share) {
        const file = await generateImageFile();
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title,
            text,
            url: shareUrl
          });
          return;
        }
      }

      // 2. Platform Share - Open Window
      let url = '';
      if (platform === 'facebook') {
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      } else if (platform === 'linkedin') {
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
      } else if (platform === 'system') {
        // Fallback for system share if file sharing not supported
        if (navigator.share) {
          await navigator.share({ title, text, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          toast.success('Link copied to clipboard!');
        }
        return;
      }

      if (url) window.open(url, '_blank', 'width=600,height=400');
    } catch (error) {
      console.error('Share failed:', error);
      toast.error('Sharing failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  // Analytics Data
  const monthlyData = registrations.reduce((acc: any, curr) => {
    const month = format(new Date(curr.registeredAt), 'MMM');
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.keys(monthlyData).map(name => ({ name, count: monthlyData[name] }));

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light" />
      <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Your Journey...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 transition-colors duration-300">
      <div className="mb-8 sm:mb-12">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Student Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base">Track your seminar journey and download your certificates.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {[
          { label: 'Seminars Registered', value: registrations.length, icon: <BookOpen className="w-6 h-6" />, color: 'bg-teal-50 dark:bg-teal-900/20 text-brand-teal-light' },
          { label: 'Attendance Rate', value: registrations.length ? `${Math.round((attendance.filter(a => a.attended).length / registrations.length) * 100)}%` : '0%', icon: <TrendingUp className="w-6 h-6" />, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
          { label: 'Certificates Earned', value: certificates.length, icon: <Award className="w-6 h-6" />, color: 'bg-teal-50 dark:bg-teal-900/20 text-brand-teal-light' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 sm:p-8 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm flex items-center gap-4 sm:gap-6"
          >
            <div className={cn("w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0", stat.color)}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-[10px] sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-8">
          {/* Analytics Chart */}
          <div className="p-4 sm:p-8 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-brand-teal-light" />
              Registration Activity
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#268693" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#268693" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#268693" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Certificates List */}
          <div className="p-8 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-brand-teal-light" />
              Your Certificates
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {certificates.length === 0 ? (
                <div className="col-span-2 text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-slate-400 dark:text-slate-500 font-medium">No certificates earned yet.</p>
                </div>
              ) : (
                certificates.map(cert => (
                  <div key={cert.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center text-brand-teal-light">
                        <Award className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        {format(new Date(cert.issuedAt), 'MMM yyyy')}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{cert.seminarTitle}</h4>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mb-4">ID: {cert.verificationCode}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button 
                        onClick={() => downloadCertificate(cert, 'pdf')}
                        disabled={downloading === cert.id}
                        className="py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-lg hover:bg-brand-teal-light hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </button>
                      <button 
                        onClick={() => downloadCertificate(cert, 'jpeg')}
                        disabled={downloading === cert.id}
                        className="py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-lg hover:bg-brand-teal-light hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <ImageIcon className="w-3 h-3" />
                        JPEG
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-auto">Share:</div>
                      <button 
                        onClick={() => shareCertificate(cert, 'system')}
                        className="p-2 text-slate-400 hover:text-brand-teal-light hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-all"
                        title="Share Image & Link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => shareCertificate(cert, 'facebook')}
                        className="p-2 text-slate-400 hover:text-[#1877F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Share on Facebook"
                      >
                        <Facebook className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => shareCertificate(cert, 'linkedin')}
                        className="p-2 text-slate-400 hover:text-[#0A66C2] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Share on LinkedIn"
                      >
                        <Linkedin className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {/* Upcoming Seminars Card */}
          <div className="p-8 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-teal-light" />
              Upcoming Seminars
            </h3>
            <div className="space-y-4">
              {upcomingSeminars.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No upcoming seminars.</p>
              ) : (
                upcomingSeminars
                  .filter(s => !registrations.find(r => r.seminarId === s.id))
                  .slice(0, 3)
                  .map(seminar => (
                    <div key={seminar.id} className="p-4 bg-teal-50/50 dark:bg-teal-900/10 rounded-2xl border border-teal-100/50 dark:border-teal-900/20 group hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{seminar.title}</h4>
                        <Link 
                          to={`/register/${seminar.id}`}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-brand-teal-light hover:bg-brand-teal-light hover:text-white transition-all shadow-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(seminar.date), 'MMM d')}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {seminar.location}</span>
                      </div>
                    </div>
                  ))
              )}
              <Link 
                to="/explore" 
                className="block w-full py-3 text-center text-xs font-bold text-brand-teal-light hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-all border border-dashed border-teal-200 dark:border-teal-900/40 mt-2"
              >
                Explore All Seminars
              </Link>
            </div>
          </div>

          <div className="p-8 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-teal-light" />
              Recent Registrations
            </h3>
            <div className="space-y-4">
              {registrations.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No registrations yet.</p>
              ) : (
                registrations.map(reg => {
                  const att = attendance.find(a => a.seminarId === reg.seminarId);
                  return (
                    <div key={reg.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{reg.seminarTitle || 'Seminar'}</p>
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {format(new Date(reg.registeredAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0",
                        att ? (att.attended ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400") : "bg-teal-50 dark:bg-teal-900/20 text-brand-teal-light"
                      )}>
                        {att ? (att.attended ? 'Attended' : 'Absent') : 'Registered'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-8 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-3xl text-white shadow-xl shadow-teal-100 dark:shadow-none">
            <h3 className="text-xl font-bold mb-2">Need Help?</h3>
            <p className="text-teal-100 dark:text-teal-200 text-sm mb-6 leading-relaxed">If you have any issues with your certificates or attendance, please contact the seminar administrator.</p>
            <button className="w-full py-3 bg-white/20 backdrop-blur-md text-white font-bold rounded-xl hover:bg-white/30 transition-all text-sm">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
