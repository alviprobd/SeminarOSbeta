/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, Component, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Auth } from './components/Auth';
import { StudentDashboard } from './components/StudentDashboard';
import { SeminarRegistration } from './components/SeminarRegistration';
import { AttendancePage } from './components/AttendancePage';
import { CertificateVerification } from './components/CertificateVerification';
import { Leaderboard } from './components/Leaderboard';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Toaster } from 'sonner';
import { DarkModeProvider, useDarkMode } from './context/DarkModeContext';
import { cn } from './lib/utils';

// Lazy load admin components
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminAnalytics = lazy(() => import('./components/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const CertificateBuilder = lazy(() => import('./components/CertificateBuilder').then(m => ({ default: m.CertificateBuilder })));
const AllSeminars = lazy(() => import('./components/AllSeminars').then(m => ({ default: m.AllSeminars })));
const ExploreSeminars = lazy(() => import('./components/ExploreSeminars').then(m => ({ default: m.ExploreSeminars })));
const AllParticipants = lazy(() => import('./components/AllParticipants').then(m => ({ default: m.AllParticipants })));
const ParticipantDetails = lazy(() => import('./components/ParticipantDetails').then(m => ({ default: m.ParticipantDetails })));
const AdminSettings = lazy(() => import('./components/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminCalendar = lazy(() => import('./components/AdminCalendar').then(m => ({ default: m.AdminCalendar })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] bg-slate-50 dark:bg-slate-950">
    <Loader2 className="w-10 h-10 animate-spin text-brand-teal-light dark:text-brand-teal-light" />
  </div>
);

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 text-center">
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">Application Error</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 break-words font-medium leading-relaxed">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 dark:shadow-teal-900/20"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'student' | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteSettings, setSiteSettings] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'siteSettings', 'branding'), (snapshot) => {
      if (snapshot.exists()) {
        setSiteSettings(snapshot.data());
      }
    }, (error) => {
      console.error('Error fetching branding:', error);
    });
    return () => unsubscribe();
  }, []);

  return (
    <DarkModeProvider>
      <Router>
        <AppContent 
          user={user} 
          userRole={userRole} 
          loading={loading} 
          siteSettings={siteSettings}
          setUser={setUser} 
          setUserRole={setUserRole} 
          setLoading={setLoading} 
        />
      </Router>
    </DarkModeProvider>
  );
}

function AppContent({ user, userRole, loading, siteSettings, setUser, setUserRole, setLoading }: any) {
  const { isDarkMode } = useDarkMode();
  const location = useLocation();
  const headerHeight = siteSettings?.siteLogo ? Math.max(64, (siteSettings.logoHeight || 40) + 24) : 64;
  const isManagePage = location.pathname.startsWith('/admin/manage');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            const adminEmails = ['alvicourse@gmail.com', 'cdc@creativealvi.com'];
            const isAdmin = firebaseUser.email && adminEmails.includes(firebaseUser.email.toLowerCase());
            const role = isAdmin ? 'admin' : 'student';
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: role,
              createdAt: new Date().toISOString(),
            });
            setUserRole(role);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setUserRole, setLoading]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950", isDarkMode && "dark")}>
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal-light dark:text-brand-teal-light" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <div className={cn(
        "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-teal-100 selection:text-teal-900 transition-colors duration-300",
        isDarkMode && "dark"
      )}>
        <Navbar user={user} role={userRole} />
        <main style={{ paddingTop: `${headerHeight}px` }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={
                <>
                  <Hero siteSettings={siteSettings} />
                  <Leaderboard />
                </>
              } />
              <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth />} />
              <Route 
                path="/dashboard" 
                element={
                  user ? (
                    userRole === 'admin' ? (
                      <AdminAnalytics />
                    ) : (
                      <StudentDashboard />
                    )
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route path="/register/:seminarId" element={<SeminarRegistration />} />
              <Route path="/explore" element={<ExploreSeminars />} />
              <Route path="/attendance/:seminarId" element={<AttendancePage />} />
              <Route path="/verify" element={<CertificateVerification />} />
              <Route 
                path="/admin/manage" 
                element={
                  user && userRole === 'admin' ? (
                    <AdminDashboard />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route 
                path="/admin/analytics" 
                element={
                  user && userRole === 'admin' ? (
                    <AdminAnalytics />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route 
                path="/admin/certificate-builder" 
                element={
                  user && userRole === 'admin' ? (
                    <CertificateBuilder />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route 
                path="/admin/seminars" 
                element={
                  user && userRole === 'admin' ? (
                    <AllSeminars />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route 
                path="/admin/seminar/:seminarId" 
                element={
                  user && userRole === 'admin' ? (
                    <AdminDashboard />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route 
                path="/admin/participants" 
                element={
                  user && userRole === 'admin' ? (
                    <AllParticipants />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route 
                path="/admin/participant/:studentUid" 
                element={
                  user && userRole === 'admin' ? (
                    <ParticipantDetails />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route 
                path="/admin/settings" 
                element={
                  user && userRole === 'admin' ? (
                    <AdminSettings />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route 
                path="/admin/calendar" 
                element={
                  user && userRole === 'admin' ? (
                    <AdminCalendar />
                  ) : <Navigate to="/auth" />
                } 
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 mt-24">
          <div className={cn(
            "max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-300",
            isManagePage && "lg:pl-80"
          )}>
            <div className={cn(
              "flex flex-col md:flex-row items-center gap-8",
              isManagePage ? "justify-between" : "justify-center text-center"
            )}>
              <div className="flex items-center gap-4">
                {siteSettings?.siteLogo ? (
                  <img 
                    src={siteSettings.siteLogo} 
                    alt="Logo" 
                    style={{ height: `${Math.min(siteSettings.logoHeight || 40, 60)}px` }}
                    className="w-auto object-contain" 
                  />
                ) : (
                  <>
                    <div className="w-8 h-8 bg-brand-teal-light rounded-lg flex items-center justify-center text-white font-bold">
                      {siteSettings?.siteName?.[0] || 'S'}
                    </div>
                    <span className="text-xl font-bold tracking-tight dark:text-white">
                      {siteSettings?.siteName || 'Seminar OS'}
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-8 text-sm text-slate-500 dark:text-slate-400">
                <Link to="/" className="hover:text-brand-teal-light transition-colors">Home</Link>
                <Link to="/verify" className="hover:text-brand-teal-light transition-colors">Verify Certificate</Link>
                <a href="#" className="hover:text-brand-teal-light transition-colors">Privacy</a>
                <a href="#" className="hover:text-brand-teal-light transition-colors">Terms</a>
              </div>
              <p className="text-sm text-slate-400 dark:text-slate-500">© 2026 Seminar OS. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
