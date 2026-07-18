import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { 
  User, Mail, Building2, GraduationCap, Calendar, 
  CheckCircle, XCircle, Clock, Award, ChevronLeft,
  ExternalLink, BookOpen, Loader2, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { useDepartments } from '../hooks/useDepartments';
import { CertificatePreview } from './CertificatePreview';

export function ParticipantDetails() {
  const { departments } = useDepartments();
  const { studentUid } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingCertificate, setViewingCertificate] = useState<any>(null);

  useEffect(() => {
    if (!studentUid) return;

    const fetchStudent = async () => {
      try {
        const studentDoc = await getDoc(doc(db, 'users', studentUid));
        if (studentDoc.exists()) {
          setStudent(studentDoc.data());
        } else {
          // If not in users, try to find from registrations
          const regQ = query(collection(db, 'registrations'), where('studentUid', '==', studentUid));
          // Use a one-time getDocs instead of onSnapshot for the "is it found?" check to keep logic simple
          const regSnap = await getDocs(regQ);
          if (!regSnap.empty) {
            const firstReg = regSnap.docs[0].data();
            setStudent({
              displayName: firstReg.studentName,
              email: firstReg.studentEmail,
              dept: firstReg.studentDept,
              studentId: firstReg.studentId,
            });
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${studentUid}`);
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();

    // Fetch all registrations for this student
    const regQ = query(collection(db, 'registrations'), where('studentUid', '==', studentUid));
    const unsubReg = onSnapshot(regQ, (snapshot) => {
      setRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch all attendance for this student
    const attQ = query(collection(db, 'attendance'), where('studentUid', '==', studentUid));
    const unsubAtt = onSnapshot(attQ, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch all certificates for this student
    const certQ = query(collection(db, 'certificates'), where('studentUid', '==', studentUid));
    const unsubCert = onSnapshot(certQ, (snapshot) => {
      setCertificates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch feedback for this student
    const feedbackQ = query(collection(db, 'feedback'), where('studentUid', '==', studentUid));
    const unsubFeedback = onSnapshot(feedbackQ, (snapshot) => {
      setFeedback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch templates for preview
    const templatesQ = collection(db, 'certificateTemplates');
    const unsubTemplates = onSnapshot(templatesQ, (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubReg();
      unsubAtt();
      unsubCert();
      unsubFeedback();
      unsubTemplates();
    };
  }, [studentUid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light" />
      </div>
    );
  }

  if (!student && !loading) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-3xl border border-slate-100 text-center shadow-xl shadow-teal-50">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Participant Not Found</h2>
        <p className="text-slate-500 mb-8">We couldn't find any information for this participant.</p>
        <button onClick={() => navigate('/admin/participants')} className="w-full py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all">Back to List</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-brand-teal-light font-bold text-sm mb-8 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back
      </button>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Profile Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-brand-teal-light" />
            <div className="relative z-10">
              <div className="w-24 h-24 bg-white rounded-3xl shadow-xl mx-auto flex items-center justify-center text-brand-teal-light mb-4 border-4 border-white">
                <User className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-1">{student?.displayName || 'Student'}</h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">{student?.studentId || 'No ID'}</p>
              
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Mail className="w-5 h-5 text-brand-teal-light" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</span>
                    <span className="text-sm font-bold text-slate-700 truncate">{student?.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Building2 className="w-5 h-5 text-brand-teal-light" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</span>
                    <span className="text-sm font-bold text-slate-700">
                      {departments.find(d => d.short === student?.dept || d.name === student?.dept)?.name || student?.dept || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-brand-blue-dark p-8 rounded-[40px] text-white shadow-xl shadow-teal-100">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-brand-teal-light" />
              Summary
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/10 rounded-2xl">
                <p className="text-2xl font-black">{registrations.length}</p>
                <p className="text-[10px] font-bold text-teal-300 uppercase tracking-widest">Registered</p>
              </div>
              <div className="p-4 bg-white/10 rounded-2xl">
                <p className="text-2xl font-black">{attendance.filter(a => a.attended).length}</p>
                <p className="text-[10px] font-bold text-teal-300 uppercase tracking-widest">Attended</p>
              </div>
              <div className="p-4 bg-white/10 rounded-2xl">
                <p className="text-2xl font-black">{certificates.length}</p>
                <p className="text-[10px] font-bold text-teal-300 uppercase tracking-widest">Certificates</p>
              </div>
              <div className="p-4 bg-white/10 rounded-2xl">
                <p className="text-2xl font-black">
                  {registrations.length > 0 
                    ? Math.round((attendance.filter(a => a.attended).length / registrations.length) * 100) 
                    : 0}%
                </p>
                <p className="text-[10px] font-bold text-teal-300 uppercase tracking-widest">Attendance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-brand-teal-light" />
              Seminar History
            </h3>
            
            <div className="space-y-4">
              {registrations.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">No seminar registrations found.</p>
                </div>
              ) : (
                registrations.map(reg => {
                  const att = attendance.find(a => a.seminarId === reg.seminarId);
                  const cert = certificates.find(c => c.seminarId === reg.seminarId);
                  const fback = feedback.find(f => f.seminarId === reg.seminarId);
                  const status = att ? (att.attended ? 'attended' : 'absent') : 'pending';

                  return (
                    <div key={reg.id} className="group p-6 bg-white border border-slate-100 rounded-3xl hover:border-teal-200 hover:shadow-md transition-all">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                              status === 'attended' ? "bg-emerald-50 text-emerald-600" :
                              status === 'absent' ? "bg-red-50 text-red-600" :
                              "bg-amber-50 text-amber-600"
                            )}>
                              {status}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {format(new Date(reg.registeredAt), 'MMM d, yyyy')}
                            </span>
                            {fback?.referralSource && (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                Referrer: {fback.referralSource} {fback.ambassadorCode ? `(#${fback.ambassadorCode})` : ''}
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 group-hover:text-brand-teal-light transition-colors">{reg.seminarTitle}</h4>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {cert ? (
                            <button 
                              onClick={() => setViewingCertificate(cert)}
                              className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-brand-teal-light rounded-xl text-xs font-bold hover:bg-teal-100 transition-all"
                            >
                              <Award className="w-4 h-4" />
                              View Certificate
                            </button>
                          ) : status === 'attended' ? (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Certificate Pending
                            </span>
                          ) : null}
                          <Link 
                            to="/dashboard"
                            onClick={() => localStorage.setItem('selectedSeminarId', reg.seminarId)}
                            className="p-2 text-slate-400 hover:text-brand-teal-light hover:bg-teal-50 rounded-lg transition-all"
                            title="View Seminar Details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {viewingCertificate && (
        <CertificatePreview 
          certificate={viewingCertificate}
          template={templates.find(t => t.id === viewingCertificate.templateId)}
          onClose={() => setViewingCertificate(null)}
        />
      )}
    </div>
  );
}
