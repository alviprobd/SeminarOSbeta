import { Link, useNavigate } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { LogOut, User as UserIcon, LayoutDashboard, Search, Menu, X, BarChart3, Calendar, Users, Settings, Moon, Sun, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { useDarkMode } from '../context/DarkModeContext';

interface NavbarProps {
  user: User | null;
  role: 'admin' | 'student' | null;
}

export function Navbar({ user, role }: NavbarProps) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'siteSettings', 'branding'), (snapshot) => {
      if (snapshot.exists()) {
        setSiteSettings(snapshot.data());
      }
    }, (error) => {
      console.error('Error fetching site settings:', error);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <nav 
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all duration-300"
      style={{ height: siteSettings?.siteLogo ? 'auto' : '64px' }}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          className="flex justify-between items-center transition-all duration-300"
          style={{ minHeight: siteSettings?.siteLogo ? `${Math.max(64, (siteSettings.logoHeight || 40) + 24)}px` : '64px' }}
        >
          <Link to="/" className="flex items-center gap-2 group py-2 shrink-0">
            {siteSettings?.siteLogo ? (
              <img 
                src={siteSettings.siteLogo} 
                alt="Logo" 
                style={{ height: `${siteSettings.logoHeight || 40}px` }}
                className="w-auto object-contain group-hover:scale-105 transition-transform" 
              />
            ) : (
              <>
                <div className="w-8 h-8 bg-brand-teal-light rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                  {siteSettings?.siteName?.[0] || 'S'}
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white hidden lg:block">
                  {siteSettings?.siteName || 'Seminar OS'}
                </span>
              </>
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-3 lg:gap-5">
            <Link to="/verify" className="text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <Search className="w-4 h-4" />
              Verify
            </Link>
            <Link to="/explore" className="text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <BookOpen className="w-4 h-4" />
              Explore
            </Link>
            {user ? (
              <>
                <Link to="/dashboard" className="text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors flex items-center gap-1.5 whitespace-nowrap">
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </Link>
                {role === 'admin' && (
                  <>
                    <Link to="/admin/manage" className="text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors flex items-center gap-1.5 whitespace-nowrap">
                      <LayoutDashboard className="w-4 h-4" />
                      Manage
                    </Link>
                    <Link to="/admin/seminars" className="text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors flex items-center gap-1.5 whitespace-nowrap">
                      <Calendar className="w-4 h-4" />
                      Seminars
                    </Link>
                    <Link to="/admin/calendar" className="text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors flex items-center gap-1.5 whitespace-nowrap">
                      <Calendar className="w-4 h-4" />
                      Calendar
                    </Link>
                    <Link to="/admin/participants" className="text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors flex items-center gap-1.5 whitespace-nowrap">
                      <Users className="w-4 h-4" />
                      Participants
                    </Link>
                    <Link to="/admin/settings" className="text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:text-brand-teal-light dark:hover:text-brand-teal-light transition-colors flex items-center gap-1.5 whitespace-nowrap">
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                  </>
                )}
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="hidden xl:flex flex-col items-end">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[100px]">{user.displayName || user.email}</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-black">{role}</span>
                  </div>
                  
                  <button 
                    onClick={toggleDarkMode}
                    className="p-2 text-slate-400 hover:text-brand-teal-light hover:bg-teal-50 dark:hover:bg-slate-800 rounded-full transition-all"
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>

                  <button 
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <button 
                  onClick={toggleDarkMode}
                  className="p-2 text-slate-400 hover:text-brand-teal-light hover:bg-teal-50 dark:hover:bg-slate-800 rounded-full transition-all"
                  title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <Link 
                  to="/auth" 
                  className="px-5 py-2 bg-brand-teal-light text-white text-sm font-semibold rounded-full hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-200 dark:shadow-none"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <button 
              onClick={toggleDarkMode}
              className="p-2 text-slate-600 dark:text-slate-400"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="p-2 text-slate-600 dark:text-slate-400" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={cn(
        "md:hidden absolute left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out overflow-y-auto",
        isMenuOpen ? "max-h-[calc(100vh-64px)] py-4" : "max-h-0"
      )}
      style={{ top: siteSettings?.siteLogo ? `${Math.max(64, (siteSettings.logoHeight || 40) + 24)}px` : '64px' }}
      >
        <div className="px-4 flex flex-col gap-4">
          <Link to="/verify" className="text-sm font-medium text-slate-600 dark:text-slate-400 py-2" onClick={() => setIsMenuOpen(false)}>Verify Certificate</Link>
          <Link to="/explore" className="text-sm font-medium text-slate-600 dark:text-slate-400 py-2" onClick={() => setIsMenuOpen(false)}>Explore Seminars</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-medium text-slate-600 dark:text-slate-400 py-2" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>
              {role === 'admin' && (
                <>
                  <Link to="/admin/manage" className="text-sm font-medium text-slate-600 dark:text-slate-400 py-2" onClick={() => setIsMenuOpen(false)}>Manage Seminars</Link>
                  <Link to="/admin/seminars" className="text-sm font-medium text-slate-600 dark:text-slate-400 py-2" onClick={() => setIsMenuOpen(false)}>All Seminars</Link>
                  <Link to="/admin/calendar" className="text-sm font-medium text-slate-600 dark:text-slate-400 py-2" onClick={() => setIsMenuOpen(false)}>Calendar</Link>
                  <Link to="/admin/participants" className="text-sm font-medium text-slate-600 dark:text-slate-400 py-2" onClick={() => setIsMenuOpen(false)}>Participants</Link>
                  <Link to="/admin/settings" className="text-sm font-medium text-slate-600 dark:text-slate-400 py-2" onClick={() => setIsMenuOpen(false)}>Settings</Link>
                </>
              )}
              <button onClick={handleLogout} className="text-sm font-medium text-red-600 py-2 text-left">Logout</button>
            </>
          ) : (
            <Link to="/auth" className="text-sm font-medium text-brand-teal-light py-2" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
