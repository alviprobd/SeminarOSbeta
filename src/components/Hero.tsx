import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle, Users, Award, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export function Hero() {
  return (
    <div className="relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none opacity-20 dark:opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-teal-light rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-blue-light rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-brand-teal-light dark:text-brand-teal-light text-sm font-bold tracking-wide uppercase mb-8">
              <Zap className="w-4 h-4 fill-brand-teal-light" />
              Streamline Your Academic Events
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]">
              Elevate Your Seminar <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-teal-light to-brand-blue-light">Experience</span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
              The premier platform for academic excellence. Organize, track, and certify seminars with automated attendance and powerful analytics.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/auth" 
                className="w-full sm:w-auto px-8 py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-xl shadow-teal-200 dark:shadow-teal-900/20 flex items-center justify-center gap-2 group"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                to="/verify" 
                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-5 h-5 text-brand-teal-light" />
                Verify Certificate
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          {[
            {
              icon: <Users className="w-6 h-6 text-brand-teal-light" />,
              title: "Smart Attendance",
              desc: "Real-time attendance tracking with unique links for every seminar session."
            },
            {
              icon: <Award className="w-6 h-6 text-brand-blue-light" />,
              title: "Digital Certificates",
              desc: "Generate and issue verified digital certificates to participants in one click."
            },
            {
              icon: <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
              title: "Robust Analytics",
              desc: "Deep insights into participation rates, department engagement, and more."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Social Proof / Stats */}
        <div className="mt-32 pt-20 border-t border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-black text-brand-teal-light mb-1">500+</p>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Seminars Hosted</p>
            </div>
            <div>
              <p className="text-4xl font-black text-brand-teal-light mb-1">10k+</p>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Students Registered</p>
            </div>
            <div>
              <p className="text-4xl font-black text-brand-teal-light mb-1">50+</p>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Departments</p>
            </div>
            <div>
              <p className="text-4xl font-black text-brand-teal-light mb-1">99%</p>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Satisfaction</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
