import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Mail, Lock, User, Building2, ArrowRight, Loader2, AlertCircle, ChevronDown, RefreshCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDepartments } from '../hooks/useDepartments';
import { useLocation, useNavigate } from 'react-router-dom';

export function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialIsLogin = location.state?.mode === 'signup' ? false : true;
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const { departments } = useDepartments();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    dept: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (showForgot) {
        await sendPasswordResetEmail(auth, formData.email);
        toast.success('Password reset email sent!');
        setShowForgot(false);
        setIsLogin(true);
      } else if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        toast.success('Welcome back!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: formData.displayName });
        
        const adminEmails = ['alvicourse@gmail.com', 'cdc@creativealvi.com'];
        const isAdmin = Boolean(formData.email) && adminEmails.includes((formData.email || '').toLowerCase());
        const role = isAdmin ? 'admin' : 'student';

        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: formData.email,
            displayName: formData.displayName,
            dept: formData.dept,
            role: role,
            createdAt: new Date().toISOString(),
          });
          toast.success('Account created successfully!');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      let errorMessage = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        // Not a JSON error
        if (err.code === 'auth/user-not-found') errorMessage = 'User not found. Please Sign Up instead.';
        if (err.code === 'auth/wrong-password') errorMessage = 'Incorrect password.';
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-teal-100 dark:shadow-teal-900/10 border border-slate-100 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {showForgot ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {showForgot 
                ? 'Enter your email to receive a reset link' 
                : (isLogin ? 'Sign in to access your dashboard' : 'Join Seminar OS to start attending seminars')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {!showForgot && !isLogin && (
                <motion.div
                  key="signup-fields"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-5 overflow-hidden"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-teal-light focus:border-transparent outline-none transition-all dark:text-white"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Department</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                      <select
                        required
                        className="w-full pl-12 pr-10 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-teal-light focus:border-transparent outline-none transition-all appearance-none cursor-pointer dark:text-white"
                        value={formData.dept}
                        onChange={(e) => setFormData({ ...formData, dept: e.target.value })}
                      >
                        <option value="" disabled className="dark:bg-slate-900">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.short} value={dept.short} className="dark:bg-slate-900">
                            {dept.name} ({dept.short})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-teal-light focus:border-transparent outline-none transition-all dark:text-white"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {!showForgot && (
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                  {isLogin && (
                    <button 
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-xs font-bold text-slate-400 hover:text-brand-teal-light transition-colors"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-teal-light focus:border-transparent outline-none transition-all dark:text-white"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 dark:shadow-teal-900/20 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {showForgot ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Create Account')}
                  {showForgot ? <RefreshCcw className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center space-y-3">
            {showForgot ? (
              <button
                onClick={() => setShowForgot(false)}
                className="text-sm font-bold text-slate-500 hover:text-brand-teal-light transition-colors"
              >
                Back to Login
              </button>
            ) : (
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-bold text-brand-teal-light dark:text-brand-teal-light hover:text-brand-teal-dark dark:hover:text-brand-teal-dark transition-colors"
              >
                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
