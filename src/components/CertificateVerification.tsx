import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, Search, Award, User, 
  Calendar, CheckCircle, XCircle, Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export function CertificateVerification() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code')?.toUpperCase() || '');
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      verifyCode(codeParam);
    }
  }, [searchParams]);

  const verifyCode = async (searchCode: string) => {
    if (!searchCode.trim()) return;

    setLoading(true);
    setCertificate(null);

    try {
      const q = query(collection(db, 'certificates'), where('verificationCode', '==', searchCode.trim().toUpperCase()));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        setCertificate(snapshot.docs[0].data());
        toast.success('Certificate verified successfully!');
      } else {
        toast.error('No certificate found with this verification code.');
      }
    } catch (err) {
      toast.error('An error occurred during verification.');
      console.error('Verify error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(code);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex p-4 bg-teal-50 rounded-3xl mb-6"
        >
          <ShieldCheck className="w-12 h-12 text-brand-teal-light" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Verify Certificate</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Enter the unique verification code found on the certificate to validate its authenticity.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleVerify} className="relative mb-12">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
            <input
              type="text"
              placeholder="Enter Verification Code (e.g. AB12CD34)"
              className="w-full pl-16 pr-32 py-6 bg-white border-2 border-slate-100 rounded-[32px] focus:ring-4 focus:ring-teal-100 focus:border-brand-teal-light outline-none transition-all text-lg font-bold uppercase tracking-widest shadow-xl shadow-teal-50/50"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-8 py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
            </button>
          </div>
        </form>

        {certificate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-teal-100 overflow-hidden"
          >
            <div className="bg-emerald-500 p-6 text-center text-white flex items-center justify-center gap-3">
              <CheckCircle className="w-6 h-6" />
              <span className="text-lg font-black uppercase tracking-widest">Authentic Certificate</span>
            </div>
            
            <div className="p-10 md:p-16">
              <div className="flex flex-col md:flex-row gap-12 items-center text-center md:text-left">
                <div className="w-32 h-32 bg-slate-50 rounded-[40px] flex items-center justify-center shrink-0 border-4 border-white shadow-xl">
                  <Award className="w-16 h-16 text-brand-teal-light" />
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Seminar Title</p>
                    <h2 className="text-3xl font-black text-slate-900 leading-tight">{certificate.seminarTitle}</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Participant</p>
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <User className="w-4 h-4 text-brand-teal-light" />
                        <span className="font-bold text-slate-900">{certificate.studentName}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Issued Date</p>
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <Calendar className="w-4 h-4 text-brand-teal-light" />
                        <span className="font-bold text-slate-900">{format(new Date(certificate.issuedAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Verification Code</p>
                        <p className="font-mono font-bold text-brand-teal-light text-lg">{certificate.verificationCode}</p>
                      </div>
                      <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Verified by Seminar OS Secure
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
