import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, handleFirestoreError, OperationType, storage, logEmailClientSide } from '../lib/firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { 
  Plus, Calendar, Users, Award, Link as LinkIcon, 
  Copy, CheckCircle, XCircle, Trash2, BarChart3, 
  Mail, Download, Loader2, AlertCircle, Search,
  ChevronRight, ExternalLink, Clock, MapPin, Edit3,
  FileText, Eye, Layout, QrCode, User, Menu,
  TrendingUp, Activity, Info, ChevronDown, ChevronUp,
  MoreVertical, Share2, Settings, Circle, CheckCircle2,
  MessageSquare, Star, PieChart as PieChartIcon, Upload, Image as ImageIcon, X
} from 'lucide-react';
import QRCode from 'qrcode';
import { format, startOfMonth, startOfWeek, isSameMonth, isSameWeek, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { cn, getApiUrl, apiFetch } from '../lib/utils';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { DEPARTMENTS, PREDEFINED_LOCATIONS } from '../constants';
import { CertificatePreview } from './CertificatePreview';
import { Template } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, renderCertificateToCanvas } from '../lib/certificateRenderer';

export const getSeminarStatus = (dateString: string): 'upcoming' | 'ongoing' | 'completed' => {
  const now = new Date();
  const seminarDate = new Date(dateString);
  const diffInHours = (now.getTime() - seminarDate.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 0) return 'upcoming';
  if (diffInHours >= 0 && diffInHours <= 6) return 'ongoing';
  return 'completed';
};

const BannerUpload = ({ value, onChange, label = "Banner Image" }: { value: string, onChange: (url: string) => void, label?: string }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // 1. Sanitize filename (remove special chars/spaces)
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `banners/${auth.currentUser?.uid || 'anonymous'}/${Date.now()}_${sanitizedName}`;
      const storageRef = ref(storage, storagePath);
      
      console.log('Attempting upload to:', storagePath);
      
      // Use Resumable upload for better tracking and reliability
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
          console.log(`Upload progress: ${p.toFixed(2)}%`);
        },
        (error) => {
          console.error('Upload task failed:', error);
          let message = 'Upload failed';
          if (error.code === 'storage/unauthorized') {
            message = 'Unauthorized: Check storage rules';
          } else if (error.code === 'storage/canceled') {
            message = 'Upload canceled';
          } else {
            message = error.message;
          }
          toast.error(message);
          setUploading(false);
        },
        async () => {
          try {
            console.log('Upload complete, fetching download URL...');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Success! Download URL obtained');
            onChange(downloadURL);
            setUploading(false);
            toast.success('Banner uploaded successfully!');
          } catch (err: any) {
            console.error('Error after upload success:', err);
            if (err.code === 'storage/object-not-found') {
              toast.error('File uploaded but could not be retrieved. Please try again.');
            } else {
              toast.error(`Failed to retrieve upload: ${err.message}`);
            }
            setUploading(false);
          }
        }
      );
    } catch (error: any) {
      console.error('Initial upload error:', error);
      toast.error(`Failed to start upload: ${error.message}`);
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    
    if (value.includes('firebasestorage.googleapis.com')) {
      try {
        const storageRef = ref(storage, value);
        await deleteObject(storageRef);
        toast.success('Banner removed from storage');
      } catch (error) {
        console.error('Error deleting banner from storage:', error);
      }
    }
    onChange('');
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-bold text-slate-700">{label}</label>
      
      {value ? (
        <div className="relative group rounded-3xl overflow-hidden aspect-video bg-slate-100 border border-slate-200">
          <img 
            src={value} 
            alt="Banner preview" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-white text-slate-900 rounded-2xl hover:scale-110 transition-transform shadow-xl"
              title="Change Image"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-3 bg-red-500 text-white rounded-2xl hover:scale-110 transition-transform shadow-xl"
              title="Remove Image"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative cursor-pointer group rounded-3xl border-2 border-dashed border-slate-200 hover:border-brand-teal-light hover:bg-teal-50/30 transition-all flex flex-col items-center justify-center aspect-video p-8",
            uploading && "pointer-events-none opacity-50"
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-brand-teal-light animate-spin" />
              <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-teal-light transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Uploading... {Math.round(progress)}%
              </p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-slate-50 group-hover:bg-teal-100 rounded-full flex items-center justify-center mb-4 transition-colors">
                <ImageIcon className="w-8 h-8 text-slate-300 group-hover:text-brand-teal-light" />
              </div>
              <p className="text-sm font-bold text-slate-600 group-hover:text-brand-teal-light transition-colors">
                Click to upload banner
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">
                JPG, PNG up to 5MB
              </p>
            </>
          )}
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

export function AdminDashboard() {
  const { seminarId } = useParams();
  const navigate = useNavigate();
  const [seminars, setSeminars] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSeminar, setShareSeminar] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeRegConfirm, setShowDeRegConfirm] = useState<{
    regId: string;
    studentUid: string;
    studentName: string;
  } | null>(null);
  const [editingSeminar, setEditingSeminar] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const hiddenCertRef = useRef<HTMLDivElement>(null);
  const [currentCertToGen, setCurrentCertToGen] = useState<any>(null);
  const [selectedSeminar, setSelectedSeminar] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [viewingCertificate, setViewingCertificate] = useState<any>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState({
    subject: 'Your Certificate for {seminar_title}',
    body: 'Dear {student_name},\n\nCongratulations on completing the seminar "{seminar_title}"! Please find your certificate attached to this email.\n\nVerification Code: {verification_code}\n\nBest regards,\nSeminar Team'
  });
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantDeptFilter, setParticipantDeptFilter] = useState('all');
  const [participantStatusFilter, setParticipantStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'participants' | 'analytics' | 'certificates' | 'reviews'>('participants');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const [checkingAutomatedEmails, setCheckingAutomatedEmails] = useState(false);
  const [newSeminar, setNewSeminar] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    templateId: '',
    whatsappEnabled: false,
    whatsappLink: '',
    bannerImage: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'seminars'), where('createdBy', '==', auth.currentUser?.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSeminars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSeminars(fetchedSeminars);
      
      // Handle seminar selection from URL or localStorage
      const targetId = seminarId || localStorage.getItem('selectedSeminarId');
      if (targetId) {
        const found = fetchedSeminars.find(s => s.id === targetId);
        if (found) {
          setSelectedSeminar(found);
          localStorage.removeItem('selectedSeminarId');
        } else if (fetchedSeminars.length > 0 && !seminarId) {
          // If not found and no URL param, default to first one
          setSelectedSeminar(fetchedSeminars[0]);
        }
      } else if (fetchedSeminars.length > 0) {
        setSelectedSeminar(fetchedSeminars[0]);
      }
      
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

    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'siteSettings', 'general'));
        if (settingsDoc.exists()) {
          setSiteSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error('Error fetching site settings:', error);
      }
    };
    fetchSettings();

    return () => {
      unsubscribe();
      unsubTemplates();
    };
  }, []);

  // Automated Reminders & Follow-ups Logic
  useEffect(() => {
    if (!siteSettings || !siteSettings.gmailEmail || !siteSettings.gmailAppPassword || !siteSettings.enableReminders) return;

    const checkAndSendAutomatedEmails = async () => {
      if (checkingAutomatedEmails) return;
      setCheckingAutomatedEmails(true);

      try {
        const now = new Date();
        const oneDayInMs = 24 * 60 * 60 * 1000;

        // 1. Check for Reminders (Seminars in next 24-48 hours)
        const upcomingSeminars = seminars.filter(s => {
          const seminarDate = new Date(s.date);
          const diff = seminarDate.getTime() - now.getTime();
          return diff > 0 && diff <= oneDayInMs * 2; // Check seminars in next 2 days
        });

        for (const seminar of upcomingSeminars) {
          const regSnap = await getDocs(query(
            collection(db, 'registrations'), 
            where('seminarId', '==', seminar.id)
          ));
          
          const pendingReminders = regSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(r => !r.reminderSentAt);

          if (pendingReminders.length > 0) {
            console.log(`Sending ${pendingReminders.length} reminders for ${seminar.title}`);
            const emailBatchData = pendingReminders.map(r => {
              let subject = (siteSettings.reminderSubject || 'Reminder: {seminar_title} is tomorrow!')
                .replace(/{seminar_title}/g, seminar.title)
                .replace(/{student_name}/g, r.studentName)
                .replace(/{date}/g, format(new Date(seminar.date), 'PPP'))
                .replace(/{time}/g, format(new Date(seminar.date), 'p'))
                .replace(/{location}/g, seminar.location)
                .replace(/{site_name}/g, siteSettings.siteName || 'Seminar Portal');

              let body = (siteSettings.reminderBody || 'Hi {student_name},\n\nThis is a reminder that the seminar "{seminar_title}" is happening tomorrow at {location}.\n\nDate: {date}\nTime: {time}\n\nWe look forward to seeing you there!')
                .replace(/{seminar_title}/g, seminar.title)
                .replace(/{student_name}/g, r.studentName)
                .replace(/{date}/g, format(new Date(seminar.date), 'PPP'))
                .replace(/{time}/g, format(new Date(seminar.date), 'p'))
                .replace(/{location}/g, seminar.location)
                .replace(/{site_name}/g, siteSettings.siteName || 'Seminar Portal');

              return {
                to: r.studentEmail,
                subject,
                body
              };
            });
            
            const idToken = await auth.currentUser?.getIdToken();
            const response = await apiFetch('/api/send-certificates-bulk', {
              method: 'POST',
              idToken,
              body: JSON.stringify({
                gmailEmail: siteSettings.gmailEmail,
                gmailAppPassword: siteSettings.gmailAppPassword,
                smtpHost: siteSettings.mailMode === 'gmail' ? '' : siteSettings.smtpHost,
                smtpPort: siteSettings.smtpPort,
                smtpSecure: siteSettings.smtpSecure,
                emails: emailBatchData
              }),
            }, siteSettings);
            
            if (response.ok) {
              const batchResult = await response.json();
              
              // Client-side logging for each email in the batch
              if (batchResult.results && Array.isArray(batchResult.results)) {
                for (const result of batchResult.results) {
                  await logEmailClientSide({
                    to: result.to || 'unknown',
                    subject: seminar.title + ' Reminder',
                    status: result.success ? 'sent' : 'failed',
                    error: result.error,
                    type: 'bulk',
                    sentBy: 'System Automation'
                  });
                }
              }

              const batch = writeBatch(db);
              pendingReminders.forEach(r => {
                batch.update(doc(db, 'registrations', r.id), { reminderSentAt: new Date().toISOString() });
              });
              await batch.commit();
              toast.info(`Sent ${pendingReminders.length} automated reminders for "${seminar.title}"`);
            }
          }
        }

        // 2. Check for Follow-ups (Seminars ended in last 48 hours)
        const recentlyEndedSeminars = seminars.filter(s => {
          const seminarDate = new Date(s.date);
          const diff = now.getTime() - seminarDate.getTime();
          return diff > 0 && diff <= oneDayInMs * 2;
        });

        for (const seminar of recentlyEndedSeminars) {
          const attSnap = await getDocs(query(
            collection(db, 'attendance'), 
            where('seminarId', '==', seminar.id),
            where('attended', '==', true)
          ));
          
          const pendingFollowUps = attSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(a => !a.followUpSentAt);

          if (pendingFollowUps.length > 0) {
            console.log(`Sending ${pendingFollowUps.length} follow-ups for ${seminar.title}`);
            const emailBatchData = pendingFollowUps.map(a => {
              const studentName = a.studentName || 'Student';
              const certLink = `${siteSettings.siteUrl || window.location.origin}/verify`;

              let subject = (siteSettings.followUpSubject || 'Thank you for attending {seminar_title}!')
                .replace(/{seminar_title}/g, seminar.title)
                .replace(/{student_name}/g, studentName)
                .replace(/{site_name}/g, siteSettings.siteName || 'Seminar Portal');

              let body = (siteSettings.followUpBody || 'Hi {student_name},\n\nThank you for attending the seminar "{seminar_title}". We hope you found it valuable.\n\nYou can download your certificate here: {certificate_link}\n\nBest regards,\n{site_name}')
                .replace(/{seminar_title}/g, seminar.title)
                .replace(/{student_name}/g, studentName)
                .replace(/{certificate_link}/g, certLink)
                .replace(/{site_name}/g, siteSettings.siteName || 'Seminar Portal');

              return {
                to: a.studentEmail,
                subject,
                body
              };
            });

            const idToken = await auth.currentUser?.getIdToken();
            const response = await apiFetch('/api/send-certificates-bulk', {
              method: 'POST',
              idToken,
              body: JSON.stringify({
                gmailEmail: siteSettings.gmailEmail,
                gmailAppPassword: siteSettings.gmailAppPassword,
                smtpHost: siteSettings.mailMode === 'gmail' ? '' : siteSettings.smtpHost,
                smtpPort: siteSettings.smtpPort,
                smtpSecure: siteSettings.smtpSecure,
                emails: emailBatchData
              }),
            }, siteSettings);

            if (response.ok) {
              const batchResult = await response.json();
              
              // Client-side logging for each email in the batch
              if (batchResult.results && Array.isArray(batchResult.results)) {
                for (const result of batchResult.results) {
                  await logEmailClientSide({
                    to: result.to || 'unknown',
                    subject: seminar.title + ' Follow-up',
                    status: result.success ? 'sent' : 'failed',
                    error: result.error,
                    type: 'bulk',
                    sentBy: 'System Automation'
                  });
                }
              }

              const batch = writeBatch(db);
              pendingFollowUps.forEach(a => {
                batch.update(doc(db, 'attendance', a.id), { followUpSentAt: new Date().toISOString() });
              });
              await batch.commit();
              toast.info(`Sent ${pendingFollowUps.length} automated follow-ups for "${seminar.title}"`);
            }
          }
        }

      } catch (error) {
        console.error('Error in automated emails:', error);
      } finally {
        setCheckingAutomatedEmails(false);
      }
    };

    // Run check after a short delay to ensure seminars are loaded
    const timer = setTimeout(checkAndSendAutomatedEmails, 5000);
    return () => clearTimeout(timer);
  }, [siteSettings, seminars]);

  useEffect(() => {
    if (seminarId && seminars.length > 0) {
      const found = seminars.find(s => s.id === seminarId);
      if (found) {
        setSelectedSeminar(found);
      }
    }
  }, [seminarId, seminars]);

  useEffect(() => {
    if (selectedSeminar) {
      const regQ = query(collection(db, 'registrations'), where('seminarId', '==', selectedSeminar.id));
      const attQ = query(collection(db, 'attendance'), where('seminarId', '==', selectedSeminar.id));
      const certQ = query(collection(db, 'certificates'), where('seminarId', '==', selectedSeminar.id));
      const feedbackQ = query(collection(db, 'feedback'), where('seminarId', '==', selectedSeminar.id));
      
      const unsubReg = onSnapshot(regQ, (snapshot) => {
        setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'registrations');
      });
      
      const unsubAtt = onSnapshot(attQ, (snapshot) => {
        setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      });

      const unsubCert = onSnapshot(certQ, (snapshot) => {
        setCertificates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'certificates');
      });

      const unsubFeedback = onSnapshot(feedbackQ, (snapshot) => {
        setFeedback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'feedback');
      });

      return () => {
        unsubReg();
        unsubAtt();
        unsubCert();
        unsubFeedback();
      };
    }
  }, [selectedSeminar]);

  const handleCreateSeminar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'seminars'), {
        ...newSeminar,
        status: getSeminarStatus(newSeminar.date),
        createdBy: auth.currentUser?.uid,
        createdAt: new Date().toISOString(),
      });
      setShowCreateModal(false);
      setNewSeminar({ 
        title: '', 
        description: '', 
        date: '', 
        location: '', 
        templateId: '',
        whatsappEnabled: false,
        whatsappLink: '',
        bannerImage: '',
      });
      toast.success('Seminar created successfully!');
    } catch (err) {
      toast.error('Failed to create seminar');
      handleFirestoreError(err, OperationType.WRITE, 'seminars');
    }
  };

  const toggleAttendance = useCallback(async (studentUid: string, currentStatus: boolean | null) => {
    if (!selectedSeminar) return;
    
    const attendanceId = `${selectedSeminar.id}_${studentUid}`;
    const attendanceRef = doc(db, 'attendance', attendanceId);
    
    try {
      if (currentStatus === null) {
        // If no attendance record exists, create one as attended
        const participant = participants.find(p => p.studentUid === studentUid);
        await setDoc(attendanceRef, {
          seminarId: selectedSeminar.id,
          studentUid,
          studentEmail: participant?.studentEmail || '',
          studentName: participant?.studentName || 'Student',
          studentDept: participant?.studentDept || 'N/A',
          attended: true,
          markedAt: new Date().toISOString(),
        });
        toast.success('Attendance marked successfully!');
      } else {
        // Toggle existing status
        await updateDoc(attendanceRef, {
          attended: !currentStatus,
          markedAt: new Date().toISOString(),
        });
        toast.success(`Attendance ${!currentStatus ? 'marked' : 'cancelled'} successfully!`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    }
  }, [selectedSeminar, participants]);

  const deRegisterParticipant = (regId: string, studentUid: string, studentName: string) => {
    setShowDeRegConfirm({ regId, studentUid, studentName });
  };

  const confirmDeRegister = async () => {
    if (!selectedSeminar || !showDeRegConfirm) return;
    
    const { regId, studentUid, studentName } = showDeRegConfirm;

    try {
      const batch = writeBatch(db);
      
      // 1. Delete registration
      batch.delete(doc(db, 'registrations', regId));
      
      // 2. Delete attendance
      batch.delete(doc(db, 'attendance', `${selectedSeminar.id}_${studentUid}`));
      
      // 3. Delete feedback
      batch.delete(doc(db, 'feedback', `${selectedSeminar.id}_${studentUid}`));
      
      // 4. Delete certificate
      batch.delete(doc(db, 'certificates', `${selectedSeminar.id}_${studentUid}`));
      
      await batch.commit();
      toast.success(`${studentName} has been de-registered.`);
      setShowDeRegConfirm(null);
    } catch (error) {
      console.error('Error de-registering participant:', error);
      toast.error('Failed to de-register participant.');
    }
  };

  const sendWhatsAppLinkEmail = async (seminar: any) => {
    if (!siteSettings?.gmailEmail || !siteSettings?.gmailAppPassword) {
      toast.error('Gmail settings not configured. Cannot send WhatsApp link email.');
      return;
    }

    try {
      const regSnap = await getDocs(query(
        collection(db, 'registrations'), 
        where('seminarId', '==', seminar.id)
      ));
      
      const participantsToNotify = regSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      if (participantsToNotify.length === 0) {
        toast.info('No registered participants to notify.');
        return;
      }

      const emailBatchData = participantsToNotify.map(p => {
        const subject = `WhatsApp Group for ${seminar.title}`;
        const body = `Hi ${p.studentName},\n\nA WhatsApp group has been created for the seminar "${seminar.title}".\n\nYou can join the group using this link: ${seminar.whatsappLink}\n\nBest regards,\n${siteSettings.siteName || 'Seminar Portal'}`;

        return {
          to: p.studentEmail,
          subject,
          body
        };
      });

      const idToken = await auth.currentUser?.getIdToken();
      const response = await apiFetch('/api/send-certificates-bulk', {
        method: 'POST',
        idToken,
        body: JSON.stringify({
          gmailEmail: siteSettings.gmailEmail,
          gmailAppPassword: siteSettings.gmailAppPassword,
          smtpHost: siteSettings.mailMode === 'gmail' ? '' : siteSettings.smtpHost,
          smtpPort: siteSettings.smtpPort,
          smtpSecure: siteSettings.smtpSecure,
          emails: emailBatchData
        }),
      }, siteSettings);

      if (response.ok) {
        const batchResult = await response.json();
        
        // Client-side logging
        if (batchResult.results && Array.isArray(batchResult.results)) {
          for (const result of batchResult.results) {
            await logEmailClientSide({
              to: result.to || 'unknown',
              subject: `WhatsApp Group for ${seminar.title}`,
              status: result.success ? 'sent' : 'failed',
              error: result.error,
              type: 'bulk',
              sentBy: auth.currentUser?.email || 'admin'
            });
          }
        }
        
        await updateDoc(doc(db, 'seminars', seminar.id), {
          whatsappLinkSentAt: new Date().toISOString()
        });
        toast.success(`WhatsApp link sent to ${participantsToNotify.length} participants!`);
      } else {
        toast.error('Failed to send WhatsApp link emails.');
      }
    } catch (error) {
      console.error('Error sending WhatsApp link email:', error);
      toast.error('Error sending WhatsApp link emails.');
    }
  };

  const handleUpdateSeminar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeminar) return;
    try {
      const originalSeminar = seminars.find(s => s.id === editingSeminar.id);
      const whatsappLinkAdded = editingSeminar.whatsappEnabled && 
                               editingSeminar.whatsappLink && 
                               (!originalSeminar?.whatsappLink || !originalSeminar?.whatsappEnabled);

      await updateDoc(doc(db, 'seminars', editingSeminar.id), {
        title: editingSeminar.title,
        description: editingSeminar.description,
        date: editingSeminar.date,
        location: editingSeminar.location,
        status: getSeminarStatus(editingSeminar.date),
        templateId: editingSeminar.templateId,
        bannerImage: editingSeminar.bannerImage || '',
        whatsappEnabled: editingSeminar.whatsappEnabled || false,
        whatsappLink: editingSeminar.whatsappLink || '',
      });

      if (whatsappLinkAdded && !editingSeminar.whatsappLinkSentAt) {
        // Automatically send email if link was just added and never sent before
        sendWhatsAppLinkEmail(editingSeminar);
      }

      setShowEditModal(false);
      setEditingSeminar(null);
      // Update selected seminar if it was the one edited
      if (selectedSeminar?.id === editingSeminar.id) {
        setSelectedSeminar({ ...selectedSeminar, ...editingSeminar });
      }
      toast.success('Seminar updated successfully!');
    } catch (err) {
      toast.error('Failed to update seminar');
      handleFirestoreError(err, OperationType.WRITE, `seminars/${editingSeminar.id}`);
    }
  };

  const copyLink = (type: 'register' | 'attendance', id: string) => {
    const baseUrl = siteSettings?.siteUrl || window.location.origin;
    const path = type === 'register' ? `/register/${id}` : `/attendance/${id}`;
    navigator.clipboard.writeText(`${baseUrl}${path}`);
    toast.success(`${type === 'register' ? 'Registration' : 'Attendance'} link copied!`);
  };

  const generateCertificates = async () => {
    if (!selectedSeminar) return;
    const batch = writeBatch(db);
    const attendedStudents = participants.filter(p => 
      attendance.find(a => a.studentUid === p.studentUid && a.attended)
    );

    attendedStudents.forEach(student => {
      const certId = `${selectedSeminar.id}_${student.studentUid}`;
      const certRef = doc(db, 'certificates', certId);
      batch.set(certRef, {
        id: certId,
        seminarId: selectedSeminar.id,
        seminarTitle: selectedSeminar.title,
        studentUid: student.studentUid,
        studentName: student.studentName,
        issuedAt: new Date().toISOString(),
        verificationCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
        templateId: selectedSeminar.templateId || '',
      });
    });

    await batch.commit();
    toast.success('Certificates generated for all attended participants!');
  };

  const sendEmailCertificates = async () => {
    if (!selectedSeminar) return;
    
    const attendedStudents = participants.filter(p => 
      attendance.find(a => a.studentUid === p.studentUid && a.attended)
    );

    if (attendedStudents.length === 0) {
      toast.error('No attended participants found to send certificates to.');
      return;
    }

    if (certificates.length === 0) {
      const confirmGen = window.confirm('No certificates have been generated yet. Would you like to generate and send them now?');
      if (confirmGen) {
        await generateCertificates();
        // Wait a bit for Firestore snapshot to update certificates state
        setTimeout(() => sendEmailCertificates(), 1000);
      }
      return;
    }

    const template = templates.find(t => t.id === selectedSeminar.templateId);
    if (!template) {
      toast.error('Please select a certificate template for this seminar first.');
      return;
    }

    setGenerating(true);
    setProgress(0);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      if (!siteSettings?.gmailEmail || !siteSettings?.gmailAppPassword) {
        toast.error('Please configure Gmail settings in Admin Settings first.');
        return;
      }

      const BATCH_SIZE = 5; // Send in batches of 5 to balance speed and payload size
      const totalCertificates = certificates.length;
      
      for (let i = 0; i < totalCertificates; i += BATCH_SIZE) {
        const batch = certificates.slice(i, i + BATCH_SIZE);
        const emailBatchData = [];

        for (const cert of batch) {
          const student = participants.find(p => p.studentUid === cert.studentUid);
          if (!student) continue;

          setCurrentCertToGen(cert);
          
          // Generate PDF
          await renderCertificateToCanvas(
            canvas,
            template as Template,
            { 
              studentName: cert.studentName, 
              seminarTitle: cert.seminarTitle,
              verificationCode: cert.verificationCode
            }
          );
          
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          
          const pdfBase64 = pdf.output('datauristring');
          
          // Prepare email content
          let subject = emailTemplate.subject
            .replace(/{seminar_title}/g, selectedSeminar.title)
            .replace(/{student_name}/g, cert.studentName);
          
          let body = emailTemplate.body
            .replace(/{seminar_title}/g, selectedSeminar.title)
            .replace(/{student_name}/g, cert.studentName)
            .replace(/{verification_code}/g, cert.verificationCode);

          emailBatchData.push({
            to: student.studentEmail,
            subject,
            body,
            attachmentBase64: pdfBase64,
            fileName: `certificate_${cert.studentName.replace(/\s+/g, '_')}.pdf`
          });
        }

        if (emailBatchData.length > 0) {
          // Call bulk backend API
          const idToken = await auth.currentUser?.getIdToken();
          const response = await apiFetch('/api/send-certificates-bulk', {
            method: 'POST',
            idToken,
            body: JSON.stringify({
              gmailEmail: siteSettings.gmailEmail,
              gmailAppPassword: siteSettings.gmailAppPassword,
              smtpHost: siteSettings.mailMode === 'gmail' ? '' : siteSettings.smtpHost,
              smtpPort: siteSettings.smtpPort,
              smtpSecure: siteSettings.smtpSecure,
              emails: emailBatchData
            }),
          }, siteSettings);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to send batch starting at ${i + 1}`);
          }
          
          const batchResult = await response.json();
          
          // Client-side logging for each email in the batch
          if (batchResult.results && Array.isArray(batchResult.results)) {
            for (const result of batchResult.results) {
              await logEmailClientSide({
                to: result.to || 'unknown',
                subject: 'Certificate Delivery', // Subject is not returned but we know it's a certificate
                status: result.success ? 'sent' : 'failed',
                error: result.error,
                type: 'bulk',
                sentBy: auth.currentUser?.email || 'admin'
              });
            }
          }

          if (batchResult.failed > 0) {
            console.warn(`Some emails in batch failed: ${batchResult.failed} failed out of ${emailBatchData.length}`);
            toast.warning(`Sent ${batchResult.successful} emails, but ${batchResult.failed} failed. Check logs for details.`);
          }
          
          setProgress(Math.min(100, Math.round(((i + emailBatchData.length) / totalCertificates) * 100)));
          console.log(`Batch results: ${batchResult.successful} success, ${batchResult.failed} failed.`);
        }
      }

      toast.success(`Sent ${totalCertificates} certificates! Check email logs for delivery status of each.`);
    } catch (error: any) {
      console.error('Error sending emails:', error);
      toast.error(error.message || 'Failed to send emails');
    } finally {
      setGenerating(false);
      setCurrentCertToGen(null);
      setProgress(0);
    }
  };

  const downloadCertificate = async (cert: any) => {
    const template = templates.find(t => t.id === cert.templateId);
    if (!template) {
      alert('Template not found for this certificate.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      await renderCertificateToCanvas(
        canvas,
        template as Template,
        { 
          studentName: cert.studentName, 
          seminarTitle: cert.seminarTitle,
          verificationCode: cert.verificationCode
        }
      );

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
      toast.success('Certificate downloaded!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const deleteCertificate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this certificate?')) return;
    try {
      await deleteDoc(doc(db, 'certificates', id));
      toast.success('Certificate deleted');
    } catch (err) {
      toast.error('Failed to delete certificate');
      handleFirestoreError(err, OperationType.DELETE, `certificates/${id}`);
    }
  };

  const downloadAllCertificates = async () => {
    if (certificates.length === 0 || !selectedSeminar) return;
    const template = templates.find(t => t.id === selectedSeminar.templateId);
    if (!template) {
      alert('Please select a template for this seminar first.');
      return;
    }

    setGenerating(true);
    setProgress(0);
    const zip = new JSZip();

    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      for (let i = 0; i < certificates.length; i++) {
        const cert = certificates[i];
        setCurrentCertToGen(cert);
        setProgress(Math.round(((i + 1) / certificates.length) * 100));
        
        await renderCertificateToCanvas(
          canvas,
          template as Template,
          { 
            studentName: cert.studentName, 
            seminarTitle: cert.seminarTitle,
            verificationCode: cert.verificationCode
          }
        );
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        const pdfBlob = pdf.output('blob');
        zip.file(`certificate_${cert.studentName.replace(/\s+/g, '_')}.pdf`, pdfBlob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificates_${selectedSeminar.title.replace(/\s+/g, '_')}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Bulk certificates downloaded!');
    } catch (error) {
      console.error('Error generating bulk certificates:', error);
      toast.error('Failed to generate bulk certificates');
    } finally {
      setGenerating(false);
      setCurrentCertToGen(null);
      setProgress(0);
    }
  };

  const deleteSeminar = async (id: string) => {
    try {
      const seminarToDelete = seminars.find(s => s.id === id);
      if (seminarToDelete?.bannerImage && seminarToDelete.bannerImage.includes('firebasestorage.googleapis.com')) {
        try {
          const storageRef = ref(storage, seminarToDelete.bannerImage);
          await deleteObject(storageRef);
        } catch (error) {
          console.error('Error deleting seminar banner:', error);
        }
      }

      await deleteDoc(doc(db, 'seminars', id));
      if (selectedSeminar?.id === id) setSelectedSeminar(null);
      setShowDeleteConfirm(null);
      toast.success('Seminar deleted successfully');
    } catch (err) {
      toast.error('Failed to delete seminar');
      handleFirestoreError(err, OperationType.DELETE, `seminars/${id}`);
    }
  };

  const generateQRCodePDF = async () => {
    if (!selectedSeminar) return;
    const baseUrl = siteSettings?.siteUrl || window.location.origin;
    const registerUrl = `${baseUrl}/register/${selectedSeminar.id}`;
    const attendanceUrl = `${baseUrl}/attendance/${selectedSeminar.id}`;

    try {
      const registerQR = await QRCode.toDataURL(registerUrl, { width: 400, margin: 2 });
      const attendanceQR = await QRCode.toDataURL(attendanceUrl, { width: 400, margin: 2 });

      const pdf = new jsPDF();
      
      // Page 1: Registration
      pdf.setFontSize(22);
      pdf.setTextColor(79, 70, 229); // Indigo-600
      pdf.text('Seminar Registration', 105, 30, { align: 'center' });
      
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42); // Slate-900
      pdf.text(selectedSeminar.title, 105, 45, { align: 'center' });

      pdf.addImage(registerQR, 'PNG', 55, 65, 100, 100);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139); // Slate-500
      pdf.text('Scan to register for this seminar', 105, 175, { align: 'center' });
      pdf.text(registerUrl, 105, 185, { align: 'center' });

      // Page 2: Attendance
      pdf.addPage();
      pdf.setFontSize(22);
      pdf.setTextColor(79, 70, 229); // Indigo-600
      pdf.text('Seminar Attendance', 105, 30, { align: 'center' });
      
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42); // Slate-900
      pdf.text(selectedSeminar.title, 105, 45, { align: 'center' });

      pdf.addImage(attendanceQR, 'PNG', 55, 65, 100, 100);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139); // Slate-500
      pdf.text('Scan to mark your attendance', 105, 175, { align: 'center' });
      pdf.text(attendanceUrl, 105, 185, { align: 'center' });

      pdf.save(`QR_Codes_${selectedSeminar.title.replace(/\s+/g, '_')}.pdf`);
      toast.success('QR Code PDF generated!');
    } catch (err) {
      console.error('Error generating QR codes:', err);
      toast.error('Failed to generate QR codes');
    }
  };

  const ongoingSeminars = useMemo(() => seminars.filter(s => getSeminarStatus(s.date) === 'ongoing'), [seminars]);
  const upcomingSeminars = useMemo(() => seminars.filter(s => getSeminarStatus(s.date) === 'upcoming'), [seminars]);
  const completedSeminars = useMemo(() => seminars.filter(s => getSeminarStatus(s.date) === 'completed'), [seminars]);

  const attendedCount = useMemo(() => attendance.filter(a => a.attended).length, [attendance]);
  const registrationCount = participants.length;
  const attendanceRate = useMemo(() => registrationCount > 0 ? Math.round((attendedCount / registrationCount) * 100) : 0, [attendedCount, registrationCount]);

  // Analytics Data
  const deptData = useMemo(() => participants.reduce((acc: any, curr) => {
    const deptShort = DEPARTMENTS.find(d => d.name === curr.studentDept || d.short === curr.studentDept)?.short || curr.studentDept || 'N/A';
    acc[deptShort] = (acc[deptShort] || 0) + 1;
    return acc;
  }, {}), [participants]);

  const chartData = useMemo(() => Object.keys(deptData).map(name => ({ name, value: deptData[name] })), [deptData]);
  const COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  const filteredOngoing = useMemo(() => ongoingSeminars.filter(s => s.title.toLowerCase().includes(globalSearch.toLowerCase())), [ongoingSeminars, globalSearch]);
  const filteredUpcoming = useMemo(() => upcomingSeminars.filter(s => s.title.toLowerCase().includes(globalSearch.toLowerCase())), [upcomingSeminars, globalSearch]);
  const filteredCompleted = useMemo(() => completedSeminars.filter(s => s.title.toLowerCase().includes(globalSearch.toLowerCase())), [completedSeminars, globalSearch]);

  const topParticipants = useMemo(() => participants
    .map(p => {
      const att = attendance.find(a => a.studentUid === p.studentUid);
      return { ...p, attended: att?.attended || false };
    })
    .filter(p => p.attended)
    .slice(0, 5), [participants, attendance]);

  const filteredParticipants = useMemo(() => participants
    .filter(p => {
      const att = attendance.find(a => a.studentUid === p.studentUid);
      const status = att ? (att.attended ? 'attended' : 'absent') : 'pending';
      const matchesSearch = p.studentName.toLowerCase().includes(participantSearch.toLowerCase()) || p.studentId.toLowerCase().includes(participantSearch.toLowerCase());
      const matchesDept = participantDeptFilter === 'all' || p.studentDept === participantDeptFilter;
      const matchesStatus = participantStatusFilter === 'all' || status === participantStatusFilter;
      return matchesSearch && matchesDept && matchesStatus;
    }), [participants, attendance, participantSearch, participantDeptFilter, participantStatusFilter]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light" />
        <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading Workspace...</p>
      </div>
    </div>
  );

  return (
    <div className="flex bg-slate-50 dark:bg-slate-950 font-sans min-h-[calc(100vh-64px)]">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-16 bottom-0 left-0 z-50 w-72 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border-r border-slate-200 dark:border-slate-800/50 transition-transform duration-300 lg:translate-x-0",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Seminars</h2>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="p-1.5 bg-teal-50 dark:bg-teal-900/20 text-brand-teal-light dark:text-brand-teal-light rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Find seminar..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-teal-light dark:text-white transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
            {/* Ongoing */}
            {filteredOngoing.length > 0 && (
              <div>
                <h3 className="px-2 mb-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  Ongoing
                </h3>
                <div className="space-y-1">
                  {filteredOngoing.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSeminar(s);
                        navigate(`/admin/seminar/${s.id}`, { replace: true });
                      }}
                      className={cn(
                        "w-full p-3 text-left rounded-xl transition-all group relative",
                        selectedSeminar?.id === s.id 
                          ? "bg-teal-50 dark:bg-teal-900/30 text-brand-teal-light dark:text-brand-teal-light shadow-sm" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                    >
                      <p className="text-sm font-bold truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-medium opacity-60">
                        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {format(new Date(s.date), 'MMM d')}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {s.location}</span>
                      </div>
                      {selectedSeminar?.id === s.id && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-teal-light dark:bg-brand-teal-light rounded-r-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <div>
              <h3 className="px-2 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Upcoming
              </h3>
              <div className="space-y-1">
                {filteredUpcoming.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSeminar(s);
                      navigate(`/admin/seminar/${s.id}`, { replace: true });
                    }}
                    className={cn(
                      "w-full p-3 text-left rounded-xl transition-all group relative",
                      selectedSeminar?.id === s.id 
                        ? "bg-teal-50 dark:bg-teal-900/30 text-brand-teal-light dark:text-brand-teal-light shadow-sm" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <p className="text-sm font-bold truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-medium opacity-60">
                      <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {format(new Date(s.date), 'MMM d')}</span>
                    </div>
                    {selectedSeminar?.id === s.id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-teal-light dark:bg-brand-teal-light rounded-r-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Completed */}
            <div>
              <button 
                onClick={() => setIsCompletedCollapsed(!isCompletedCollapsed)}
                className="w-full px-2 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between group"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3" />
                  Completed
                </span>
                {isCompletedCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
              {!isCompletedCollapsed && (
                <div className="space-y-1">
                  {filteredCompleted.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSeminar(s);
                        navigate(`/admin/seminar/${s.id}`, { replace: true });
                      }}
                      className={cn(
                        "w-full p-3 text-left rounded-xl transition-all group relative",
                        selectedSeminar?.id === s.id 
                          ? "bg-teal-50 dark:bg-teal-900/30 text-brand-teal-light dark:text-brand-teal-light shadow-sm" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                    >
                      <p className="text-sm font-bold truncate opacity-70 group-hover:opacity-100">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-medium opacity-40">
                        <span>{format(new Date(s.date), 'MMM d, yyyy')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-3 w-full p-4 bg-brand-teal-light text-white hover:bg-brand-teal-dark transition-all text-sm font-black shadow-lg shadow-teal-100 dark:shadow-none rounded-xl"
            >
              <Plus className="w-5 h-5" />
              Create New Seminar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0 relative transition-all duration-300",
        isSidebarOpen ? "lg:ml-72" : "lg:ml-0"
      )}>
        {/* Mobile Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden absolute top-4 left-4 z-50 p-2 bg-white border border-slate-200 text-slate-500 rounded-lg shadow-sm"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Content Area */}
        <div className="flex-1 p-4 sm:p-8">
          {selectedSeminar ? (
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Hero Section */}
              <section className="relative p-4 sm:p-8 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 dark:bg-teal-900/10 rounded-full -translate-y-32 translate-x-32 blur-3xl opacity-50" />
                
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                        getSeminarStatus(selectedSeminar.date) === 'ongoing' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" :
                        getSeminarStatus(selectedSeminar.date) === 'upcoming' ? "bg-teal-50 dark:bg-teal-900/20 text-brand-teal-light dark:text-brand-teal-light" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {getSeminarStatus(selectedSeminar.date)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(selectedSeminar.date), 'PPP')}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight max-w-2xl">
                      {selectedSeminar.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-brand-teal-light dark:text-brand-teal-light" />
                        {selectedSeminar.location}
                      </span>
                      {selectedSeminar.whatsappEnabled && selectedSeminar.whatsappLink && (
                        <>
                          <span className="text-slate-200 dark:text-slate-800">|</span>
                          <a 
                            href={selectedSeminar.whatsappLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <MessageSquare className="w-4 h-4" />
                            WhatsApp Group
                          </a>
                        </>
                      )}
                      <span className="text-slate-200 dark:text-slate-800">|</span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-brand-teal-light dark:text-brand-teal-light" />
                        {registrationCount} Registered
                      </span>
                    </div>
                  </div>

                  <div className="lg:w-72 space-y-4">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Attendance</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{attendanceRate}%</p>
                      </div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                        <span className="text-brand-teal-light dark:text-brand-teal-light">{attendedCount}</span> / {registrationCount}
                      </p>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${attendanceRate}%` }}
                        className="h-full bg-brand-teal-light dark:bg-brand-teal-light rounded-full shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Quick Actions Bar */}
              <section className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-2 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl shadow-sm">
                {[
                  { label: 'QR Codes', icon: <QrCode className="w-4 h-4" />, onClick: generateQRCodePDF, color: 'text-brand-teal-light bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40' },
                  { label: 'Certificates', icon: <Award className="w-4 h-4" />, onClick: generateCertificates, color: 'text-brand-blue-light bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40' },
                  { label: 'Certificate Builder', icon: <Layout className="w-4 h-4" />, onClick: () => navigate('/admin/certificate-builder'), color: 'text-brand-teal-dark bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40' },
                  { label: 'SEND CERTIFICATE', icon: <Mail className="w-4 h-4" />, onClick: sendEmailCertificates, color: 'text-white bg-brand-teal-light hover:bg-brand-teal-dark shadow-md shadow-teal-100 dark:shadow-none' },
                  { label: 'Download ZIP', icon: <Download className="w-4 h-4" />, onClick: downloadAllCertificates, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' },
                  { label: 'Email Template', icon: <Settings className="w-4 h-4" />, onClick: () => setShowEmailModal(true), color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40' },
                  { label: 'Edit', icon: <Edit3 className="w-4 h-4" />, onClick: () => { setEditingSeminar(selectedSeminar); setShowEditModal(true); }, color: 'text-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700' },
                  { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setShowDeleteConfirm(selectedSeminar.id), color: 'text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40' },
                  { label: 'Share', icon: <Share2 className="w-4 h-4" />, onClick: () => { setShareSeminar(selectedSeminar); setShowShareModal(true); }, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40' },
                  ...(selectedSeminar.whatsappEnabled && selectedSeminar.whatsappLink ? [{ 
                    label: 'Send WhatsApp Link', 
                    icon: <Mail className="w-4 h-4" />, 
                    onClick: () => sendWhatsAppLinkEmail(selectedSeminar), 
                    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' 
                  }] : []),
                ].map((action, i) => (
                  <button
                    key={i}
                    onClick={action.onClick}
                    className={cn(
                      "flex items-center justify-center sm:justify-start gap-2 px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold transition-all w-full sm:w-auto",
                      action.color
                    )}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </section>

              {/* Mini Analytics & Smart Insights */}
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div className="p-6 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800/50 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Department Mix</h3>
                      <PieChartIcon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            innerRadius={45}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                      {chartData.slice(0, 4).map((entry, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-[10px] font-bold text-slate-500">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800/50 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Seminar Checklist</h3>
                      <CheckCircle2 className="w-4 h-4 text-brand-teal-light" />
                    </div>
                    <div className="space-y-3">
                      {[
                        { id: 'venue', label: 'Venue Booked' },
                        { id: 'link', label: 'Link Printed' },
                        { id: 'cert', label: 'Certificate Sent' },
                        { id: 'materials', label: 'Materials Ready' },
                        { id: 'refreshments', label: 'Refreshments Arranged' }
                      ].map((item) => {
                        const isChecked = (selectedSeminar as any).checklist?.[item.id] || false;
                        return (
                          <button
                            key={item.id}
                            onClick={async () => {
                              if (!selectedSeminar) return;
                              const newChecklist = {
                                ...(selectedSeminar as any).checklist || {},
                                [item.id]: !isChecked
                              };
                              try {
                                await updateDoc(doc(db, 'seminars', selectedSeminar.id), {
                                  checklist: newChecklist
                                });
                                setSelectedSeminar({ ...selectedSeminar, checklist: newChecklist } as any);
                                toast.success(`${item.label} updated`);
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, `seminars/${selectedSeminar.id}`);
                              }
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl transition-all border",
                              isChecked 
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                                : "bg-slate-50 border-slate-100 text-slate-600 hover:border-teal-200"
                            )}
                          >
                            {isChecked ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                            <span className="text-xs font-bold">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800/50 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-teal-light" />
                    Smart Insights
                  </h3>
                  <div className="flex-1 space-y-6">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Participants</p>
                      {topParticipants.map((p, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-brand-teal-light font-bold text-[10px]">
                            {p.studentName[0]}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">{p.studentName}</p>
                            <p className="text-[10px] text-slate-400">{p.studentId}</p>
                          </div>
                        </div>
                      ))}
                      {topParticipants.length === 0 && <p className="text-xs text-slate-400 italic">No participants yet</p>}
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</p>
                      {attendance.filter(a => a.attended).slice(0, 3).map((a, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">
                              {participants.find(p => p.studentUid === a.studentUid)?.studentName || 'Student'}
                            </p>
                            <p className="text-[10px] text-slate-400">Marked attendance</p>
                          </div>
                        </div>
                      ))}
                      {attendance.length === 0 && <p className="text-xs text-slate-400 italic">No recent activity</p>}
                    </div>

                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <div className="flex items-start gap-3">
                        <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">Insight</p>
                          <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                            {attendanceRate < 50 ? 'Attendance is currently below 50%. Consider sending a reminder.' : 'Great engagement! Most registered students have attended.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab-Based Content System */}
              <div className="space-y-6">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-full overflow-x-auto custom-scrollbar">
                  {[
                    { id: 'participants', label: 'Participants', icon: <Users className="w-4 h-4" /> },
                    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'certificates', label: 'Certificates', icon: <Award className="w-4 h-4" /> },
                    { id: 'reviews', label: 'Reviews/Feedbacks', icon: <MessageSquare className="w-4 h-4" /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                        activeTab === tab.id 
                          ? "bg-white dark:bg-slate-700 text-brand-teal-light dark:text-brand-teal-light shadow-sm" 
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.split('/')[0]}</span>
                    </button>
                  ))}
                </div>

                <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800/50 shadow-sm overflow-hidden min-h-[400px]">
                  {activeTab === 'participants' && (
                    <div className="p-8">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Participant Directory</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Manage registrations and attendance status.</p>
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                          <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="text"
                              placeholder="Search by name or ID..."
                              value={participantSearch}
                              onChange={(e) => setParticipantSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal-light dark:text-white transition-all"
                            />
                          </div>
                          <select 
                            value={participantDeptFilter}
                            onChange={(e) => setParticipantDeptFilter(e.target.value)}
                            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal-light font-bold text-slate-600 dark:text-slate-400"
                          >
                            <option value="all">All Departments</option>
                            {DEPARTMENTS.map(d => (
                              <option key={d.short} value={d.short}>{d.short}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4">Student Details</th>
                              <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4">Department</th>
                              <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4">Status</th>
                              <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {filteredParticipants.map((p) => {
                              const att = attendance.find(a => a.studentUid === p.studentUid);
                              const status = att ? (att.attended ? 'attended' : 'absent') : 'pending';
                              return (
                                <tr key={p.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="py-5 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-brand-teal-light dark:text-brand-teal-light font-bold text-xs">
                                          {p.studentName[0]}
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-sm font-bold text-slate-900 dark:text-white">{p.studentName}</span>
                                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{p.studentId}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-5 px-4">
                                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        {DEPARTMENTS.find(d => d.name === p.studentDept)?.short || p.studentDept}
                                      </span>
                                    </td>
                                    <td className="py-5 px-4">
                                      <span className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                        status === 'attended' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" :
                                        status === 'absent' ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" :
                                        "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                                      )}>
                                        <div className={cn("w-1.5 h-1.5 rounded-full", 
                                          status === 'attended' ? "bg-emerald-500" :
                                          status === 'absent' ? "bg-red-500" :
                                          "bg-amber-500"
                                        )} />
                                        {status}
                                      </span>
                                    </td>
                                    <td className="py-5 px-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button 
                                          onClick={() => toggleAttendance(p.studentUid, att ? att.attended : null)}
                                          className={cn(
                                            "p-2 rounded-lg transition-all",
                                            status === 'attended' ? "text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                          )}
                                          title={status === 'attended' ? "Cancel Attendance" : "Mark as Attended"}
                                        >
                                          {status === 'attended' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                        </button>
                                        <Link 
                                          to={`/admin/participant/${p.studentUid}`}
                                          className="p-2 text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-all"
                                        >
                                          <User className="w-4 h-4" />
                                        </Link>
                                        <button 
                                          onClick={() => {
                                            const cert = certificates.find(c => c.studentUid === p.studentUid);
                                            if (cert) setViewingCertificate(cert);
                                            else toast.error('Certificate not generated yet');
                                          }}
                                          className="p-2 text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-all"
                                        >
                                          <Award className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => deRegisterParticipant(p.id, p.studentUid, p.studentName)}
                                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                          title="De-register Participant"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                        {participants.length === 0 && (
                          <div className="py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Users className="w-8 h-8 text-slate-200" />
                            </div>
                            <p className="text-slate-400 font-medium">No participants found for this seminar.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'analytics' && (
                    <div className="p-8 space-y-12">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Detailed Analytics</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Deep dive into seminar performance and engagement.</p>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                          <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Department Breakdown</h4>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} width={80} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="value" fill="#268693" radius={[0, 4, 4, 0]} barSize={24} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Attendance Overview</h4>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Attended', value: attendedCount },
                                    { name: 'Absent', value: registrationCount - attendedCount }
                                  ]}
                                  innerRadius={80}
                                  outerRadius={110}
                                  paddingAngle={8}
                                  dataKey="value"
                                >
                                  <Cell fill="#10b981" />
                                  <Cell fill="#f1f5f9" />
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex justify-center gap-8">
                            <div className="text-center">
                              <p className="text-2xl font-black text-emerald-600">{attendedCount}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attended</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-black text-slate-300">{registrationCount - attendedCount}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Absent</p>
                            </div>
                          </div>
                        </div>

                        {/* Ambassador Leaderboard for this Seminar */}
                        <div className="pt-12 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
                                <Award className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Ambassador Leaderboard</h4>
                                <p className="text-[10px] text-slate-500 font-medium">Top referrers for this seminar</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(() => {
                              const counts: any = {};
                              feedback.forEach(f => {
                                if (f.referralSource === 'Career Ambassador' && f.ambassadorCode) {
                                  counts[f.ambassadorCode] = (counts[f.ambassadorCode] || 0) + 1;
                                }
                              });
                              const leaderboard = Object.keys(counts)
                                .map(code => ({ code, count: counts[code] }))
                                .sort((a, b) => b.count - a.count);

                              if (leaderboard.length === 0) {
                                return (
                                  <div className="col-span-full py-10 text-center bg-slate-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                                    <p className="text-slate-400 text-xs font-medium">No ambassador referrals tracked yet.</p>
                                  </div>
                                );
                              }

                              return leaderboard.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-brand-teal-light transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shadow-sm",
                                      i === 0 ? "bg-amber-100 text-amber-700" : "bg-white dark:bg-slate-900 text-slate-400"
                                    )}>
                                      #{i + 1}
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Code {item.code}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-black text-brand-teal-light leading-none">{item.count}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ref</p>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'certificates' && (
                    <div className="p-8 space-y-8">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Certificate Management</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Review and distribute earned certificates.</p>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={generateCertificates}
                            className="px-6 py-2.5 bg-brand-teal-light text-white font-bold rounded-xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 dark:shadow-none flex items-center gap-2 text-sm"
                          >
                            <Award className="w-4 h-4" />
                            Generate All
                          </button>
                          <button 
                            onClick={downloadAllCertificates}
                            className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 text-sm"
                          >
                            <Download className="w-4 h-4" />
                            Download ZIP
                          </button>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {certificates.map(cert => (
                          <div key={cert.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-teal-200 dark:hover:border-teal-900/50 transition-all">
                            <div className="flex justify-between items-start mb-4">
                              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-brand-teal-light dark:text-brand-teal-light shadow-sm">
                                <Award className="w-5 h-5" />
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setViewingCertificate(cert)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => downloadCertificate(cert)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light"><Download className="w-4 h-4" /></button>
                                <button onClick={() => deleteCertificate(cert.id)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{cert.studentName}</p>
                            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mb-4">{cert.verificationCode}</p>
                            <div className="flex items-center justify-between pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Issued {format(new Date(cert.issuedAt), 'MMM d')}</span>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                          </div>
                        ))}
                        {certificates.length === 0 && (
                          <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                            <Award className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-400 dark:text-slate-500 font-medium">No certificates have been generated yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'reviews' && (
                    <div className="p-8 space-y-8">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Participant Feedback</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Reviews and ratings from seminar attendees.</p>
                        </div>
                        <div className="flex items-center gap-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-xl">
                          <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="text-lg font-black">
                              {feedback.length > 0 
                                ? (feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length).toFixed(1) 
                                : '0.0'}
                            </span>
                          </div>
                          <div className="h-4 w-px bg-amber-200 dark:bg-amber-800" />
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{feedback.length} Reviews</span>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {feedback.map(f => (
                          <div key={f.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-brand-teal-light dark:text-brand-teal-light font-bold shadow-sm">
                                  {f.studentName[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">{f.studentName}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{format(new Date(f.submittedAt), 'PPP')}</p>
                                </div>
                              </div>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Star 
                                    key={star} 
                                    className={cn(
                                      "w-3.5 h-3.5",
                                      f.rating >= star ? "text-amber-400 fill-current" : "text-slate-200 dark:text-slate-700"
                                    )} 
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 italic text-sm text-slate-600 dark:text-slate-400 leading-relaxed relative group">
                              "{f.comment}"
                              {f.referralSource && (
                                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Via:</span>
                                  <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-brand-teal-light text-[10px] font-bold rounded-full">
                                    {f.referralSource} {f.ambassadorCode ? `(#${f.ambassadorCode})` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {feedback.length === 0 && (
                          <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                            <MessageSquare className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-400 dark:text-slate-500 font-medium">No feedback has been received for this seminar yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center justify-center mb-8 animate-bounce border border-slate-100 dark:border-slate-800/50">
                <Layout className="w-12 h-12 text-brand-teal-light dark:text-brand-teal-light" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Welcome to Focus Mode</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
                Select a seminar from the sidebar to enter focus mode. Manage participants, track real-time analytics, and distribute certificates with zero distractions.
              </p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="mt-10 px-8 py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-xl shadow-teal-100 flex items-center gap-3"
              >
                <Plus className="w-5 h-5" />
                Create Your First Seminar
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modals and Hidden Elements */}
      {/* ... (Existing modals and hidden certificate generation) */}

      {/* Hidden Certificate for Generation */}
      {generating && currentCertToGen && (
        <div className="fixed -left-[9999px] -top-[9999px]">
          <div 
            ref={hiddenCertRef}
            className="relative aspect-[1.414/1] w-[1123px] bg-white overflow-hidden"
            style={{
              backgroundImage: `url(${templates.find(t => t.id === selectedSeminar?.templateId)?.backgroundImage})`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundColor: '#ffffff' // Standard hex
            }}
          >
            <div
              className="absolute whitespace-nowrap"
              style={{
                left: `${templates.find(t => t.id === selectedSeminar?.templateId)?.elements.studentName.x}%`,
                top: `${templates.find(t => t.id === selectedSeminar?.templateId)?.elements.studentName.y}%`,
                fontSize: `${templates.find(t => t.id === selectedSeminar?.templateId)?.elements.studentName.fontSize}px`,
                color: templates.find(t => t.id === selectedSeminar?.templateId)?.elements.studentName.color,
                fontWeight: templates.find(t => t.id === selectedSeminar?.templateId)?.elements.studentName.fontWeight,
                transform: 'translate(-50%, -50%)',
                fontFamily: 'sans-serif',
                zIndex: 10
              }}
            >
              {currentCertToGen.studentName}
            </div>
            <div
              className="absolute whitespace-nowrap"
              style={{
                left: `${templates.find(t => t.id === selectedSeminar?.templateId)?.elements.seminarTitle.x}%`,
                top: `${templates.find(t => t.id === selectedSeminar?.templateId)?.elements.seminarTitle.y}%`,
                fontSize: `${templates.find(t => t.id === selectedSeminar?.templateId)?.elements.seminarTitle.fontSize}px`,
                color: templates.find(t => t.id === selectedSeminar?.templateId)?.elements.seminarTitle.color,
                fontWeight: templates.find(t => t.id === selectedSeminar?.templateId)?.elements.seminarTitle.fontWeight,
                transform: 'translate(-50%, -50%)',
                fontFamily: 'sans-serif',
                zIndex: 10
              }}
            >
              {currentCertToGen.seminarTitle}
            </div>
            <div 
              className="absolute bottom-4 right-4 text-[8px] font-mono opacity-50"
              style={{ color: '#94a3b8' }}
            >
              Verified: {currentCertToGen.verificationCode}
            </div>
          </div>
        </div>
      )}

      {/* Generation Progress Modal */}
      {generating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
            <Loader2 className="w-12 h-12 text-brand-teal-light animate-spin mx-auto mb-6" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Generating Certificates</h3>
            <p className="text-slate-500 mb-6 font-medium">Please wait while we prepare {certificates.length} certificates...</p>
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
              <motion.div 
                className="bg-brand-teal-light h-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs font-black text-brand-teal-light uppercase tracking-widest">{progress}% Complete</p>
          </div>
        </div>
      )}
      {viewingCertificate && (
        <CertificatePreview 
          certificate={viewingCertificate}
          template={templates.find(t => t.id === (viewingCertificate.templateId || selectedSeminar?.templateId))}
          onClose={() => setViewingCertificate(null)}
        />
      )}

      {/* Email Template Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Email Template</h2>
                  <p className="text-sm text-slate-500">Customize the message sent to participants.</p>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100">
                  <p className="text-xs font-bold text-teal-900 mb-2 uppercase tracking-widest">Available Placeholders</p>
                  <div className="flex flex-wrap gap-2">
                    {['{student_name}', '{seminar_title}', '{verification_code}'].map(p => (
                      <code key={p} className="px-2 py-1 bg-white border border-teal-200 rounded text-brand-teal-light text-[10px] font-bold">{p}</code>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Subject</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                    value={emailTemplate.subject}
                    onChange={(e) => setEmailTemplate({ ...emailTemplate, subject: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Message Body</label>
                  <textarea
                    rows={8}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all resize-none font-medium text-slate-600"
                    value={emailTemplate.body}
                    onChange={(e) => setEmailTemplate({ ...emailTemplate, body: e.target.value })}
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      alert('Email template saved!');
                      setShowEmailModal(false);
                    }}
                    className="flex-1 py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSeminar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Edit Seminar</h2>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleUpdateSeminar} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Seminar Title</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                    value={editingSeminar.title || ''}
                    onChange={(e) => setEditingSeminar({ ...editingSeminar, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Description</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all resize-none"
                    value={editingSeminar.description || ''}
                    onChange={(e) => setEditingSeminar({ ...editingSeminar, description: e.target.value })}
                  />
                </div>
                
                <BannerUpload 
                  value={editingSeminar.bannerImage || ''} 
                  onChange={(url) => setEditingSeminar({ ...editingSeminar, bannerImage: url })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Date</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                      value={editingSeminar.date || ''}
                      onChange={(e) => setEditingSeminar({ ...editingSeminar, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Location</label>
                    <input
                      type="text"
                      required
                      list="predefined-locations-edit"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                      value={editingSeminar.location || ''}
                      onChange={(e) => setEditingSeminar({ ...editingSeminar, location: e.target.value })}
                    />
                    <datalist id="predefined-locations-edit">
                      {PREDEFINED_LOCATIONS.map(loc => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Certificate Template</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                    value={editingSeminar.templateId || ''}
                    onChange={(e) => setEditingSeminar({ ...editingSeminar, templateId: e.target.value })}
                  >
                    <option value="">Default Template</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-900 dark:text-emerald-400">WhatsApp Group</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingSeminar.whatsappEnabled || false}
                        onChange={(e) => setEditingSeminar({ ...editingSeminar, whatsappEnabled: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  
                  {editingSeminar.whatsappEnabled && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest">Group Invite Link</label>
                      <input
                        type="url"
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                        value={editingSeminar.whatsappLink || ''}
                        onChange={(e) => setEditingSeminar({ ...editingSeminar, whatsappLink: e.target.value })}
                      />
                      <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 italic">
                        * Participants will see this link and receive an email notification when you save.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 mt-4"
                >
                  Update Seminar
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Create New Seminar</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleCreateSeminar} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Seminar Title</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                    placeholder="e.g. Modern Web Development with React"
                    value={newSeminar.title || ''}
                    onChange={(e) => setNewSeminar({ ...newSeminar, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Description</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all resize-none"
                    placeholder="Brief overview of the seminar..."
                    value={newSeminar.description || ''}
                    onChange={(e) => setNewSeminar({ ...newSeminar, description: e.target.value })}
                  />
                </div>
                
                <BannerUpload 
                  value={newSeminar.bannerImage || ''} 
                  onChange={(url) => setNewSeminar({ ...newSeminar, bannerImage: url })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Date</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                      value={newSeminar.date || ''}
                      onChange={(e) => setNewSeminar({ ...newSeminar, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Location</label>
                    <input
                      type="text"
                      required
                      list="predefined-locations-create"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                      placeholder="e.g. Hall A / Zoom"
                      value={newSeminar.location || ''}
                      onChange={(e) => setNewSeminar({ ...newSeminar, location: e.target.value })}
                    />
                    <datalist id="predefined-locations-create">
                      {PREDEFINED_LOCATIONS.map(loc => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Certificate Template</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all"
                    value={newSeminar.templateId || ''}
                    onChange={(e) => setNewSeminar({ ...newSeminar, templateId: e.target.value })}
                  >
                    <option value="">Default Template</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-900 dark:text-emerald-400">WhatsApp Group</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={newSeminar.whatsappEnabled || false}
                        onChange={(e) => setNewSeminar({ ...newSeminar, whatsappEnabled: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  
                  {newSeminar.whatsappEnabled && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest">Group Invite Link</label>
                      <input
                        type="url"
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                        value={newSeminar.whatsappLink || ''}
                        onChange={(e) => setNewSeminar({ ...newSeminar, whatsappLink: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 mt-4"
                >
                  Create Seminar
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {showShareModal && shareSeminar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Share Seminar</h2>
                <p className="text-slate-500 text-sm font-medium">Copy links for participants</p>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Registration Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 truncate font-medium">
                    {`${siteSettings?.siteUrl || window.location.origin}/register/${shareSeminar.id}`}
                  </div>
                  <button 
                    onClick={() => copyLink('register', shareSeminar.id)}
                    className="p-3 bg-brand-teal-light text-white rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Attendance Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 truncate font-medium">
                    {`${siteSettings?.siteUrl || window.location.origin}/attendance/${shareSeminar.id}`}
                  </div>
                  <button 
                    onClick={() => copyLink('attendance', shareSeminar.id)}
                    className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  Share the <strong>Registration</strong> link before the seminar starts, and the <strong>Attendance</strong> link during the session.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Seminar Deletion Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-4">Delete Seminar?</h2>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Are you sure you want to delete <strong className="text-slate-900">{seminars.find(s => s.id === showDeleteConfirm)?.title}</strong>? 
                This will permanently remove the seminar and its banner image. Participants records (registrations/attendance) will remain but will be orphaned.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteSeminar(showDeleteConfirm)}
                  className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 font-sans"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Participant De-registration Confirm Modal */}
      {showDeRegConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-4">De-register Participant?</h2>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Are you sure you want to de-register <strong className="text-slate-900">{showDeRegConfirm.studentName}</strong>? 
                This will permanently remove their registration, attendance, feedback, and certificate records for this seminar.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeRegConfirm(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all font-sans"
                >
                  No, Keep
                </button>
                <button
                  onClick={confirmDeRegister}
                  className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 font-sans"
                >
                  Yes, De-register
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
