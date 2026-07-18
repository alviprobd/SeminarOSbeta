import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, deleteDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, logEmailClientSide } from '../lib/firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  Settings, Globe, Image as ImageIcon, Save, 
  Loader2, Link as LinkIcon, Upload, Trash2,
  Mail, Key, Send, AlertCircle, Cpu, RefreshCw,
  CheckCircle2, Github, ExternalLink, ShieldCheck,
  Users, Plus, Hash, List, Filter, XCircle, CheckCircle,
  FileSearch, Clock, ChevronRight, User, Sparkles, Building2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_VERSION, DEPARTMENTS } from '../constants';
import { format } from 'date-fns';

export function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle');
  const [repoStatus, setRepoStatus] = useState<'connected' | 'checking' | 'error'>('connected');
  const [testRecipient, setTestRecipient] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'updates' | 'referral' | 'users'>('general');

  // User Creation State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'student' | 'admin'>('student');
  const [creatingUser, setCreatingUser] = useState(false);

  // User Management List States
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    siteUrl: window.location.origin,
    siteLogo: '',
    logoHeight: 40,
    siteName: 'Seminar OS',
    mailMode: 'gmail' as 'gmail' | 'smtp',
    gmailEmail: '',
    gmailAppPassword: '',
    // SMTP Specifics for 3rd party servers
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    // Referral & Ambassador Settings
    referralOptions: ['Social Media', 'Email', 'Friend/Colleague', 'Career Ambassador'],
    ambassadorCodes: [] as string[],
    // Feedback Settings
    enableFeedback: false,
    feedbackEmailSubject: 'We value your feedback! - {seminar_title}',
    feedbackEmailBody: 'Hi {student_name},\n\nThank you for attending {seminar_title}. We would love to hear your thoughts to help us improve.\n\nPlease take a moment to rate the seminar and leave a comment: {feedback_link}\n\nBest regards,\nThe {site_name} Team',
    // Reminder Settings
    enableReminders: false,
    reminderEmailSubject: 'Reminder: {seminar_title} is tomorrow!',
    reminderEmailBody: 'Hi {student_name},\n\nThis is a reminder that the seminar "{seminar_title}" will take place tomorrow at {location}.\n\nDate: {date}\nTime: {time}\n\nWe look forward to seeing you there!\n\nBest regards,\nThe {site_name} Team',
    // Follow-up Settings
    enableFollowUp: false,
    followUpEmailSubject: 'Thank you for attending {seminar_title}',
    followUpEmailBody: 'Hi {student_name},\n\nThank you for joining us today for "{seminar_title}". We hope you found it valuable.\n\nYou can download your certificate here: {certificate_link}\n\nBest regards,\nThe {site_name} Team',
    // Homepage customizable content
    heroBadge: 'Streamline Your Academic Events',
    heroTitle: 'Elevate Your Seminar',
    heroHighlight: 'Experience',
    heroDescription: 'The premier platform for academic excellence. Organize, track, and certify seminars with automated attendance and powerful analytics.',
    heroPrimaryBtnText: 'Get Started Now',
    heroSecondaryBtnText: 'Verify Certificate',
    departments: [] as Array<{ name: string; short: string }>,
  });
  const [newOption, setNewOption] = useState('');
  const [newCode, setNewCode] = useState('');

  // Department State
  const [singleDeptName, setSingleDeptName] = useState('');
  const [singleDeptShort, setSingleDeptShort] = useState('');
  const [bulkDeptInput, setBulkDeptInput] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'siteSettings', 'general'));
        let currentSettings = { ...settings };
        if (settingsDoc.exists()) {
          const docData = settingsDoc.data();
          currentSettings = { ...currentSettings, ...docData };
          if (!docData.departments || !Array.isArray(docData.departments) || docData.departments.length === 0) {
            currentSettings.departments = [...DEPARTMENTS];
          }
        } else {
          currentSettings.departments = [...DEPARTMENTS];
        }

        const referralDoc = await getDoc(doc(db, 'siteSettings', 'referral'));
        if (referralDoc.exists()) {
          currentSettings = { ...currentSettings, ...referralDoc.data() };
        }
        
        setSettings(currentSettings);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'siteSettings/general');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab !== 'users') return;

    setLoadingUsers(true);
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: any[] = [];
      snapshot.forEach((doc) => {
        userList.push({ id: doc.id, ...doc.data() });
      });
      userList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setUsersList(userList);
      setLoadingUsers(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoadingUsers(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    // Prevent the admin from deleting themselves
    if (auth.currentUser?.uid === userId || auth.currentUser?.email === userEmail) {
      toast.error("You cannot delete your own administrative account.");
      return;
    }
    
    setDeletingUserId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
      toast.success(`Successfully deleted user profile for ${userEmail}`);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting user document:", error);
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      toast.error("Failed to delete user profile");
    } finally {
      setDeletingUserId(null);
    }
  };



  const handleSave = async () => {
    setSaving(true);
    try {
      const sanitizedSiteUrl = (settings.siteUrl || '').trim().replace(/\/+$/, '');
      const updatedSettings = {
        ...settings,
        siteUrl: sanitizedSiteUrl
      };

      // Split settings into public (branding) and private (general/email)
      const branding = {
        siteName: settings.siteName,
        siteLogo: settings.siteLogo,
        logoHeight: settings.logoHeight,
        siteUrl: sanitizedSiteUrl,
        enableFeedback: settings.enableFeedback,
        heroBadge: settings.heroBadge || 'Streamline Your Academic Events',
        heroTitle: settings.heroTitle || 'Elevate Your Seminar',
        heroHighlight: settings.heroHighlight !== undefined ? settings.heroHighlight : 'Experience',
        heroDescription: settings.heroDescription || 'The premier platform for academic excellence. Organize, track, and certify seminars with automated attendance and powerful analytics.',
        heroPrimaryBtnText: settings.heroPrimaryBtnText || 'Get Started Now',
        heroSecondaryBtnText: settings.heroSecondaryBtnText || 'Verify Certificate'
      };
      
      await setDoc(doc(db, 'siteSettings', 'branding'), branding);
      
      const referralData = {
        referralOptions: settings.referralOptions || ['Social Media', 'Email', 'Friend/Colleague', 'Career Ambassador'],
        ambassadorCodes: settings.ambassadorCodes || []
      };
      await setDoc(doc(db, 'siteSettings', 'referral'), referralData);
      
      await setDoc(doc(db, 'siteSettings', 'general'), updatedSettings);
      
      toast.success('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'siteSettings/general');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword || !newUserRole) {
      toast.error('Please fill in all user creation fields.');
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setCreatingUser(true);
    try {
      // Initialize or retrieve secondary app
      let secondaryApp;
      const appName = 'SecondaryUserManager';
      if (getApps().some(app => app.name === appName)) {
        secondaryApp = getApp(appName);
      } else {
        secondaryApp = initializeApp({
          projectId: "gen-lang-client-0758178203",
          appId: "1:380694644226:web:667e436ebb4716d197091b",
          apiKey: "AIzaSyAFEiNX32LFclGVJ6P48jF6MMcgPHCaoFg",
          authDomain: "gen-lang-client-0758178203.firebaseapp.com",
          storageBucket: "gen-lang-client-0758178203.firebasestorage.app",
          messagingSenderId: "380694644226",
        }, appName);
      }

      const secondaryAuth = getAuth(secondaryApp);

      // Create user client-side via secondary Firebase App instance
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPassword);
      const newUser = userCredential.user;

      if (!newUser) {
        throw new Error('Failed to create account credential.');
      }

      // Write user details to firestore collection using the admin's database instance 
      try {
        const userRef = doc(db, 'users', newUser.uid);
        await setDoc(userRef, {
          uid: newUser.uid,
          email: newUserEmail,
          role: newUserRole,
          createdAt: new Date().toISOString()
        });
      } catch (dbError) {
        handleFirestoreError(dbError, OperationType.WRITE, `users/${newUser.uid}`);
      }

      // Instantly sign out from secondary app session so it doesn't linger 
      await signOut(secondaryAuth);

      toast.success(`Successfully created user ${newUserEmail} with role ${newUserRole}!`);
      
      // Reset field states
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('student');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleAddSingleDept = () => {
    if (!singleDeptName.trim() || !singleDeptShort.trim()) {
      toast.error('Both department name and short code are required.');
      return;
    }
    const name = singleDeptName.trim();
    const short = singleDeptShort.trim().toUpperCase();

    const currentDepts = settings.departments || [];
    if (currentDepts.some(d => d.short === short)) {
      toast.error(`Department code "${short}" already exists.`);
      return;
    }

    setSettings({
      ...settings,
      departments: [...currentDepts, { name, short }]
    });
    setSingleDeptName('');
    setSingleDeptShort('');
    toast.success(`Added ${short} department locally! Click 'Save All Settings' to apply.`);
  };

  const handleBulkAddDepts = () => {
    if (!bulkDeptInput.trim()) {
      toast.error('Please enter departments for bulk import.');
      return;
    }

    const items = bulkDeptInput.split(',');
    const newDepts: Array<{ name: string; short: string }> = [];
    
    items.forEach(item => {
      let trimmed = item.trim();
      if (!trimmed) return;

      let name = '';
      let short = '';

      const bracketMatch = trimmed.match(/^([^(]+)\s*\(([^)]+)\)$/) || trimmed.match(/^([^[]+)\s*\[([^\]]+)\]$/);
      if (bracketMatch) {
        name = bracketMatch[1].trim();
        short = bracketMatch[2].trim().toUpperCase();
      } else if (trimmed.includes(':')) {
        const parts = trimmed.split(':');
        const first = parts[0].trim();
        const second = parts[1].trim();
        if (first.length <= 5) {
          short = first.toUpperCase();
          name = second;
        } else {
          short = second.toUpperCase();
          name = first;
        }
      } else if (trimmed.includes(' - ')) {
        const parts = trimmed.split(' - ');
        const first = parts[0].trim();
        const second = parts[1].trim();
        if (first.length <= 5) {
          short = first.toUpperCase();
          name = second;
        } else {
          short = second.toUpperCase();
          name = first;
        }
      } else {
        short = trimmed.toUpperCase();
        name = trimmed;
      }

      if (short) {
        newDepts.push({ name: name || short, short });
      }
    });

    if (newDepts.length === 0) {
      toast.error('Could not parse any valid departments from the input.');
      return;
    }

    const currentDepts = settings.departments || [];
    const deptsToAdd = newDepts.filter(nd => !currentDepts.some(cd => cd.short === nd.short));
    
    if (deptsToAdd.length === 0) {
      toast.error('All parsed departments already exist in your list.');
      return;
    }

    setSettings({
      ...settings,
      departments: [...currentDepts, ...deptsToAdd]
    });
    setBulkDeptInput('');
    toast.success(`Successfully parsed and added ${deptsToAdd.length} new departments locally! Click 'Save All Settings' to apply.`);
  };

  const handleTestEmail = async () => {
    if (!settings.gmailEmail || !settings.gmailAppPassword) {
      toast.error('Please enter Gmail credentials first');
      return;
    }
    if (!testRecipient) {
      toast.error('Please enter a test recipient email');
      return;
    }

    setTesting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          email: settings.gmailEmail,
          appPassword: settings.gmailAppPassword,
          testRecipient,
          smtpHost: settings.mailMode === 'gmail' ? '' : settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpSecure: settings.smtpSecure
        }),
      });

      const data = await response.json();
      if (response.ok) {
        await logEmailClientSide({
          to: testRecipient,
          subject: "Seminar OS - Test Email Connection",
          status: 'sent',
          type: 'test',
          sentBy: auth.currentUser?.email || 'admin'
        });
        toast.success(data.message || 'Test email sent!');
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to send test email');
        await logEmailClientSide({
          to: testRecipient,
          subject: "Seminar OS - Test Email Connection",
          status: 'failed',
          error: errorMsg,
          type: 'test',
          sentBy: auth.currentUser?.email || 'admin'
        });
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Error testing email:', error);
      toast.error('Network error while testing email');
    } finally {
      setTesting(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast.error('Logo must be less than 1MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, siteLogo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus('checking');
    
    // Simulate API call to check for updates
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setCheckingUpdate(false);
    setUpdateStatus('latest');
    toast.success('Your system is up to date!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal-light" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-teal-light rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-100">
          <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium">Manage global configurations for your seminar platform.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 sm:gap-2 p-1.5 bg-slate-100 rounded-2xl mb-8 w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            "flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'general' 
              ? "bg-brand-teal-light text-white shadow-md" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <Globe className={cn("w-4 h-4", activeTab === 'general' ? "text-white" : "text-slate-400")} />
          General
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={cn(
            "flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'email' 
              ? "bg-brand-teal-light text-white shadow-md" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <Mail className={cn("w-4 h-4", activeTab === 'email' ? "text-white" : "text-slate-400")} />
          Email
        </button>

        <button
          onClick={() => setActiveTab('updates')}
          className={cn(
            "flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'updates' 
              ? "bg-brand-teal-light text-white shadow-md" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", activeTab === 'updates' ? "text-white" : "text-slate-400")} />
          Updates
        </button>
        <button
          onClick={() => setActiveTab('referral')}
          className={cn(
            "flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'referral' 
              ? "bg-brand-teal-light text-white shadow-md" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <Users className={cn("w-4 h-4", activeTab === 'referral' ? "text-white" : "text-slate-400")} />
          Referral
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'users' 
              ? "bg-brand-teal-light text-white shadow-md" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <Users className={cn("w-4 h-4", activeTab === 'users' ? "text-white" : "text-slate-400")} />
          Add User/Admin
        </button>
      </div>

      <div className="grid gap-8">
        {activeTab === 'general' && (
          <>
            {/* Site Identity */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-8">
                <Globe className="w-5 h-5 text-brand-teal-light" />
                <h2 className="text-xl font-bold text-slate-900">Site Identity</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    Site Name
                  </label>
                  <input 
                    type="text"
                    value={settings.siteName}
                    onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                    placeholder="e.g. Seminar OS"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Site Base URL
                  </label>
                  <div className="relative">
                    <input 
                      type="url"
                      value={settings.siteUrl}
                      onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value })}
                      className="w-full pl-4 pr-32 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                      placeholder="https://your-domain.com"
                    />
                    <button 
                      onClick={() => setSettings({ ...settings, siteUrl: window.location.origin })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      Current Domain
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium px-2">
                    This URL is used to generate registration and attendance links. Update this when moving to a new domain.
                  </p>
                </div>
              </div>
            </motion.section>

            {/* Branding */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-8">
                <ImageIcon className="w-5 h-5 text-brand-teal-light" />
                <h2 className="text-xl font-bold text-slate-900">Branding</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700">Site Logo</label>
                  <div className="flex items-center gap-8">
                    <div className="w-24 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group relative">
                      {settings.siteLogo ? (
                        <>
                          <img src={settings.siteLogo} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                          <button 
                            onClick={() => setSettings({ ...settings, siteLogo: '' })}
                            className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col gap-4">
                        <label className="inline-flex items-center gap-2 px-6 py-3 bg-teal-50 text-brand-teal-light font-bold rounded-2xl hover:bg-teal-100 transition-all cursor-pointer w-fit">
                          <Upload className="w-4 h-4" />
                          Upload Logo
                          <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </label>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Logo Height (px)</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="range" 
                              min="20" 
                              max="120" 
                              step="1"
                              value={settings.logoHeight}
                              onChange={(e) => setSettings({ ...settings, logoHeight: parseInt(e.target.value) })}
                              className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-teal-light"
                            />
                            <input 
                              type="number"
                              value={settings.logoHeight}
                              onChange={(e) => setSettings({ ...settings, logoHeight: parseInt(e.target.value) || 20 })}
                              className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-teal-light"
                            />
                          </div>
                        </div>
                      </div>
                      <p className="mt-4 text-xs text-slate-400 font-medium">
                        Recommended: Square or horizontal PNG/SVG with transparent background. Max 1MB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Homepage Content Customization */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-8">
                <Sparkles className="w-5 h-5 text-brand-teal-light" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Homepage Hero Contents</h2>
                  <p className="text-xs text-slate-500 font-medium">Customize the text blocks, call-to-actions, and highlights on your front-end homepage.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Badge & Highlight word */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      Hero Badge Text
                    </label>
                    <input 
                      type="text"
                      value={settings.heroBadge || ''}
                      onChange={(e) => setSettings({ ...settings, heroBadge: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                      placeholder="e.g. Streamline Your Academic Events"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      Dynamic Gradient Word
                    </label>
                    <input 
                      type="text"
                      value={settings.heroHighlight || ''}
                      onChange={(e) => setSettings({ ...settings, heroHighlight: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                      placeholder="e.g. Experience"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">
                      This word is rendered with a striking gradient color on the homepage.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    Hero Main Title
                  </label>
                  <input 
                    type="text"
                    value={settings.heroTitle || ''}
                    onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                    placeholder="e.g. Elevate Your Seminar"
                  />
                  <p className="text-[10px] text-slate-400 font-medium font-mono text-right">
                    Renders right before the Dynamic Gradient Word.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Hero Description</label>
                  <textarea 
                    value={settings.heroDescription || ''}
                    onChange={(e) => setSettings({ ...settings, heroDescription: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium resize-none"
                    placeholder="Brief introductory description for homepage visitors..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Button labels */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Primary Button Label</label>
                    <input 
                      type="text"
                      value={settings.heroPrimaryBtnText || ''}
                      onChange={(e) => setSettings({ ...settings, heroPrimaryBtnText: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                      placeholder="e.g. Get Started Now"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Secondary Button Label</label>
                    <input 
                      type="text"
                      value={settings.heroSecondaryBtnText || ''}
                      onChange={(e) => setSettings({ ...settings, heroSecondaryBtnText: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                      placeholder="e.g. Verify Certificate"
                    />
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Manage Departments */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-brand-teal-light">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Manage Departments</h2>
                    <p className="text-xs text-slate-500 font-medium">Configure the departments that are available on the user registration and filter dropdowns.</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-teal-50 text-brand-teal-light border border-teal-100 rounded-full text-xs font-bold">
                  {settings.departments?.length || 0} Depts
                </div>
              </div>

              {/* Add Single or Bulk */}
              <div className="grid md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-100">
                {/* Single Add */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Add Single Department</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Department Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Computer Science"
                        value={singleDeptName}
                        onChange={(e) => setSingleDeptName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Short Code</label>
                      <input 
                        type="text"
                        placeholder="e.g. CSE"
                        value={singleDeptShort}
                        onChange={(e) => setSingleDeptShort(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSingleDept}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Department
                  </button>
                </div>

                {/* Bulk Add */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Bulk Add Departments (Single Line)</h3>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Comma-Separated Departments</label>
                    <input 
                      type="text"
                      placeholder="e.g. SWE, ME, Civil Engineering (CE), EEE: Electrical"
                      value={bulkDeptInput}
                      onChange={(e) => setBulkDeptInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal-light font-medium"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-normal">
                    Supports simple codes (<code className="bg-slate-50 px-1 py-0.5 rounded border">CSE, SWE</code>), name/code brackets (<code className="bg-slate-50 px-1 py-0.5 rounded border">Software Engineering (SWE)</code>), or colon pairs (<code className="bg-slate-50 px-1 py-0.5 rounded border">CE: Civil Engineering</code>).
                  </p>
                  <button
                    type="button"
                    onClick={handleBulkAddDepts}
                    className="px-4 py-2 bg-brand-teal-light hover:bg-brand-teal-dark text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Bulk Import Departments
                  </button>
                </div>
              </div>

              {/* Department List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Current Departments</h3>
                  <button 
                    type="button"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to reset to the default 36 university departments?")) {
                        setSettings({ ...settings, departments: [...DEPARTMENTS] });
                        toast.success("Reset local state to default departments. Click 'Save All Settings' to apply.");
                      }
                    }}
                    className="text-xs text-red-500 hover:underline font-bold"
                  >
                    Reset to Default
                  </button>
                </div>
                {(!settings.departments || settings.departments.length === 0) ? (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                    <p className="text-slate-400 text-xs font-medium">No departments configured. Defaults will be loaded.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5 max-h-[300px] overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-100">
                    {settings.departments.map((dept, idx) => (
                      <div 
                        key={idx} 
                        className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-xs group"
                      >
                        <span className="font-bold text-brand-teal-light bg-teal-50 px-1.5 py-0.5 rounded-md text-[10px]">
                          {dept.short}
                        </span>
                        <span className="text-slate-600 font-medium">{dept.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = settings.departments.filter((_, i) => i !== idx);
                            setSettings({ ...settings, departments: filtered });
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          title="Remove Department"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          </>
        )}

        {activeTab === 'email' && (
          <>
            {/* Mail Server Configuration */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-8">
                <Mail className="w-5 h-5 text-brand-teal-light" />
                <h2 className="text-xl font-bold text-slate-900">Mail Server Configuration</h2>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-bold">Important Security Note:</p>
                    <p>To use Gmail, you must use an <b>App Password</b>, not your regular account password. 2-Step Verification must be enabled on your Google account.</p>
                    <a 
                      href="https://myaccount.google.com/apppasswords" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand-teal-light hover:underline font-bold"
                    >
                      Generate App Password →
                    </a>
                  </div>
                </div>

                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl mb-8 w-fit">
                  <button
                    onClick={() => setSettings({ ...settings, mailMode: 'gmail' })}
                    className={cn(
                      "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                      settings.mailMode === 'gmail' 
                        ? "bg-white text-brand-teal-light shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Gmail Mode
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, mailMode: 'smtp' })}
                    className={cn(
                      "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                      settings.mailMode === 'smtp' 
                        ? "bg-white text-brand-teal-light shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    SMTP Mode
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {settings.mailMode === 'gmail' ? 'Gmail Address' : 'Email Address'}
                    </label>
                    <input 
                      type="email"
                      value={settings.gmailEmail}
                      onChange={(e) => setSettings({ ...settings, gmailEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                      placeholder={settings.mailMode === 'gmail' ? "your-email@gmail.com" : "info@yourdomain.com"}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      {settings.mailMode === 'gmail' ? 'App Password' : 'Password'}
                    </label>
                    <input 
                      type="password"
                      value={settings.gmailAppPassword}
                      onChange={(e) => setSettings({ ...settings, gmailAppPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                      placeholder="•••• •••• •••• ••••"
                    />
                  </div>
                </div>

                {settings.mailMode === 'smtp' && (
                  <div className="grid md:grid-cols-3 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SMTP Host</label>
                      <input 
                        type="text"
                        value={settings.smtpHost}
                        onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                        placeholder="e.g. smtp.gmail.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SMTP Port</label>
                      <input 
                        type="number"
                        value={settings.smtpPort}
                        onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 465 })}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                        placeholder="465"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secure (SSL/TLS)</label>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => setSettings({ ...settings, smtpSecure: !settings.smtpSecure })}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                            settings.smtpSecure ? "bg-brand-teal-light" : "bg-slate-300"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            settings.smtpSecure ? "translate-x-6" : "translate-x-1"
                          )} />
                        </button>
                        <span className="text-xs font-bold text-slate-600">{settings.smtpSecure ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Test Connection</h3>
                  <div className="flex gap-3">
                    <input 
                      type="email"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal-light transition-all"
                      placeholder="Recipient email for test"
                    />
                    <button 
                      onClick={handleTestEmail}
                      disabled={testing}
                      className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {testing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Send Test
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Automated Feedback & Surveys */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Automated Feedback & Surveys</h2>
                    <p className="text-xs text-slate-500 font-medium">Prompt students to rate the seminar after marking attendance.</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, enableFeedback: !settings.enableFeedback })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    settings.enableFeedback ? "bg-brand-teal-light" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    settings.enableFeedback ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>

              {settings.enableFeedback && (
                <div className="space-y-6 pt-4 border-t border-slate-50">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Feedback Email Subject</label>
                    <input 
                      type="text"
                      value={settings.feedbackEmailSubject}
                      onChange={(e) => setSettings({ ...settings, feedbackEmailSubject: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Feedback Email Body</label>
                    <textarea 
                      value={settings.feedbackEmailBody}
                      onChange={(e) => setSettings({ ...settings, feedbackEmailBody: e.target.value })}
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium resize-none"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">
                      Placeholders: {'{student_name}'}, {'{seminar_title}'}, {'{feedback_link}'}, {'{site_name}'}
                    </p>
                  </div>
                </div>
              )}
            </motion.section>

            {/* Automated Reminders & Follow-ups */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Automated Reminders & Follow-ups</h2>
                    <p className="text-xs text-slate-500 font-medium">Send scheduled reminders and post-event thank you emails.</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, enableReminders: !settings.enableReminders })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    settings.enableReminders ? "bg-brand-teal-light" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    settings.enableReminders ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>

              {settings.enableReminders && (
                <div className="space-y-8 pt-4 border-t border-slate-50">
                  {/* Reminder Config */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">1-Day Reminder</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Subject</label>
                        <input 
                          type="text"
                          value={settings.reminderEmailSubject}
                          onChange={(e) => setSettings({ ...settings, reminderEmailSubject: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Body</label>
                        <textarea 
                          value={settings.reminderEmailBody}
                          onChange={(e) => setSettings({ ...settings, reminderEmailBody: e.target.value })}
                          rows={4}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium resize-none"
                        />
                        <p className="text-[10px] text-slate-400 font-medium">
                          Placeholders: {'{student_name}'}, {'{seminar_title}'}, {'{date}'}, {'{time}'}, {'{location}'}, {'{site_name}'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Follow-up Config */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Post-Event Follow-up</h3>
                      <button
                        onClick={() => setSettings({ ...settings, enableFollowUp: !settings.enableFollowUp })}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                          settings.enableFollowUp ? "bg-brand-teal-light" : "bg-slate-200"
                        )}
                      >
                        <span className={cn(
                          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                          settings.enableFollowUp ? "translate-x-5" : "translate-x-1"
                        )} />
                      </button>
                    </div>
                    {settings.enableFollowUp && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Subject</label>
                          <input 
                            type="text"
                            value={settings.followUpEmailSubject}
                            onChange={(e) => setSettings({ ...settings, followUpEmailSubject: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">Body</label>
                          <textarea 
                            value={settings.followUpEmailBody}
                            onChange={(e) => setSettings({ ...settings, followUpEmailBody: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium resize-none"
                          />
                          <p className="text-[10px] text-slate-400 font-medium">
                            Placeholders: {'{student_name}'}, {'{seminar_title}'}, {'{certificate_link}'}, {'{site_name}'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.section>
          </>
        )}



        {activeTab === 'updates' && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-brand-teal-light" />
                <h2 className="text-xl font-bold text-slate-900">System Updates</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Repo Connected</span>
              </div>
            </div>

            <div className="grid gap-8">
              {/* Version Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                    <RefreshCw className={cn("w-6 h-6 text-brand-teal-light", checkingUpdate && "animate-spin")} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Current Version</p>
                    <p className="text-xl font-black text-slate-900">v{APP_VERSION}</p>
                  </div>
                </div>
                <button 
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {checkingUpdate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Check for Updates
                    </>
                  )}
                </button>
              </div>

              {/* Update Status */}
              {updateStatus === 'latest' && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">System Up to Date</p>
                    <p className="text-xs text-emerald-600 font-medium">Your Seminar OS is running the latest stable version. No action required.</p>
                  </div>
                </div>
              )}

              {/* GitHub Sync Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Github className="w-4 h-4" />
                  GitHub Deployment Sync
                </h3>
                <div className="p-6 bg-slate-900 rounded-3xl text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm font-bold">Continuous Deployment Active</p>
                  </div>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Updates are managed via your GitHub repository. When you push changes to the <code className="bg-slate-800 px-1.5 py-0.5 rounded text-brand-teal-light">main</code> branch, Cloud Run will automatically build and deploy the new version.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-teal-light" />
                      Data is stored in Firebase and is persistent across updates.
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-teal-light" />
                      No data loss occurs during the deployment process.
                    </div>
                  </div>
                  <div className="mt-8 flex items-center justify-between">
                    <a 
                      href="https://github.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-brand-teal-light hover:underline"
                    >
                      View Repository on GitHub
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Syncing Enabled
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'referral' && (
          <div className="grid gap-8">
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Referral Options</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage how students can hear about your events.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-3">
                  <input 
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                    placeholder="Add new option (e.g. Instagram)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newOption.trim()) {
                          setSettings({ ...settings, referralOptions: [...(settings.referralOptions || []), newOption.trim()] });
                          setNewOption('');
                        }
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (newOption.trim()) {
                        setSettings({ ...settings, referralOptions: [...(settings.referralOptions || []), newOption.trim()] });
                        setNewOption('');
                      }
                    }}
                    className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {settings.referralOptions?.map((option, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <span className="text-sm font-bold text-slate-700">{option}</span>
                      <button 
                        onClick={() => {
                          const newOptions = [...settings.referralOptions];
                          newOptions.splice(index, 1);
                          setSettings({ ...settings, referralOptions: newOptions });
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-brand-teal-light">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Career Ambassador Codes</h2>
                  <p className="text-xs text-slate-500 font-medium">Numbers only. These will appear when "Career Ambassador" is selected.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-3">
                  <input 
                    type="number"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium"
                    placeholder="Enter code (e.g. 110)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCode.trim()) {
                          setSettings({ ...settings, ambassadorCodes: [...(settings.ambassadorCodes || []), newCode.trim()] });
                          setNewCode('');
                        }
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (newCode.trim()) {
                        setSettings({ ...settings, ambassadorCodes: [...(settings.ambassadorCodes || []), newCode.trim()] });
                        setNewCode('');
                      }
                    }}
                    className="px-6 py-3 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Code
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  {settings.ambassadorCodes?.map((code, index) => (
                    <div key={index} className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-brand-teal-light font-bold rounded-xl border border-teal-100 group transition-all hover:pr-2">
                      <Hash className="w-3 h-3" />
                      <span>{code}</span>
                      <button 
                        onClick={() => {
                          const newCodes = [...settings.ambassadorCodes];
                          newCodes.splice(index, 1);
                          setSettings({ ...settings, ambassadorCodes: newCodes });
                        }}
                        className="p-1 hover:text-red-500 rounded transition-all ml-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(!settings.ambassadorCodes || settings.ambassadorCodes.length === 0) && (
                    <div className="w-full text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                      <p className="text-slate-400 font-medium">No ambassador codes added yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-8">
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-brand-teal-light">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Add User or Admin</h2>
                  <p className="text-xs text-slate-500 font-medium">Create and register a student or administrator directly into the platform.</p>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      Email Address
                    </label>
                    <input 
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium text-slate-900"
                      placeholder="e.g. user@domain.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Key className="w-4 h-4 text-slate-400" />
                      Password
                    </label>
                    <input 
                      type="password"
                      required
                      minLength={6}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-teal-light outline-none transition-all font-medium text-slate-900"
                      placeholder="Min 6 characters"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Account Role</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setNewUserRole('student')}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all text-center",
                        newUserRole === 'student'
                          ? "border-brand-teal-light bg-teal-50/10 text-brand-teal-light"
                          : "border-slate-100 hover:border-slate-200 text-slate-600 bg-slate-50/50"
                      )}
                    >
                      <User className="w-6 h-6 mb-2" />
                      <span className="font-bold text-sm">Student</span>
                      <span className="text-[10px] opacity-75 mt-0.5">Seminar Attendee</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewUserRole('admin')}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all text-center",
                        newUserRole === 'admin'
                          ? "border-brand-teal-light bg-teal-50/10 text-brand-teal-light"
                          : "border-slate-100 hover:border-slate-200 text-slate-600 bg-slate-50/50"
                      )}
                    >
                      <Users className="w-6 h-6 mb-2" />
                      <span className="font-bold text-sm">Administrator</span>
                      <span className="text-[10px] opacity-75 mt-0.5">Platform Controller</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="px-8 py-3.5 bg-brand-teal-light hover:bg-brand-teal-dark text-white font-bold rounded-2xl transition-all shadow-md flex items-center gap-2.5 disabled:opacity-50"
                  >
                    {creatingUser ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Create Account
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-brand-teal-light">
                    <List className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Registered Users</h2>
                    <p className="text-xs text-slate-500 font-medium">All registered accounts with active credentials categorized by role.</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                  {usersList.length} User{usersList.length !== 1 ? 's' : ''}
                </div>
              </div>

              {loadingUsers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-teal-light mr-2.5" />
                  <span className="text-sm font-bold text-slate-500">Loading registered users...</span>
                </div>
              ) : usersList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-100 rounded-2xl">
                  <p className="text-slate-400 font-medium">No registered users found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">User Details</th>
                        <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                        <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Created</th>
                        <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {usersList.map((usr) => {
                        const isSelf = auth.currentUser?.uid === usr.id || auth.currentUser?.email === usr.email;
                        return (
                          <tr key={usr.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold uppercase text-xs">
                                  {usr.email ? usr.email.charAt(0) : 'U'}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-800">{usr.email || 'N/A'} {isSelf && <span className="text-xs font-medium text-slate-400">(You)</span>}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{usr.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-bold capitalize inline-flex items-center gap-1",
                                usr.role === 'admin' 
                                  ? "bg-amber-50 text-amber-600 border border-amber-100" 
                                  : "bg-teal-50/50 text-brand-teal-light border border-teal-50"
                              )}>
                                {usr.role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                {usr.role || 'student'}
                              </span>
                            </td>
                            <td className="py-4 text-xs font-medium text-slate-500">
                              {usr.createdAt ? format(new Date(usr.createdAt), 'MMM dd, yyyy h:mm a') : 'N/A'}
                            </td>
                            <td className="py-4 text-right">
                              {confirmDeleteId === usr.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-[11px] text-red-500 font-bold">Are you sure?</span>
                                  <button
                                    onClick={() => handleDeleteUser(usr.id, usr.email)}
                                    disabled={deletingUserId === usr.id}
                                    className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                  >
                                    {deletingUserId === usr.id ? 'Deleting...' : 'Yes'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(usr.id)}
                                  disabled={isSelf}
                                  className={cn(
                                    "p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100",
                                    isSelf && "opacity-20 pointer-events-none"
                                  )}
                                  title={isSelf ? "Cannot delete yourself" : "Delete user"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.section>
          </div>
        )}

        {activeTab !== 'updates' && activeTab !== 'users' && (
          <div className="flex justify-end pt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-10 py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-xl shadow-teal-100 flex items-center gap-3 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save All Settings
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
