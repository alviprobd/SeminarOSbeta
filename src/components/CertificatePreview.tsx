import { motion } from 'motion/react';
import { X, Download, Printer, Loader2 } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { Template } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, renderCertificateToCanvas } from '../lib/certificateRenderer';

interface CertificatePreviewProps {
  certificate: any;
  template: Template;
  onClose: () => void;
}

export function CertificatePreview({ certificate, template, onClose }: CertificatePreviewProps) {
  const [downloading, setDownloading] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (previewCanvasRef.current && template) {
      renderCertificateToCanvas(
        previewCanvasRef.current,
        template,
        { 
          studentName: certificate.studentName || '[STUDENT NAME]', 
          seminarTitle: certificate.seminarTitle || '[SEMINAR TITLE]',
          verificationCode: certificate.verificationCode || '[CODE-1234]'
        }
      );
    }
  }, [certificate, template]);

  if (!template) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl max-w-md w-full text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4 font-medium">No template found for this certificate.</p>
          <button onClick={onClose} className="px-6 py-2 bg-brand-teal-light text-white rounded-xl hover:bg-brand-teal-dark transition-all">Close</button>
        </div>
      </div>
    );
  }

  const handleDownload = async () => {
    if (!previewCanvasRef.current) return;
    setDownloading(true);
    try {
      const imgData = previewCanvasRef.current.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`certificate_${certificate.studentName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden my-8"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Certificate Preview</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Verification Code: {certificate.verificationCode}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-8 flex justify-center bg-slate-200 dark:bg-slate-950">
          <div className="relative aspect-[1.414/1] w-full max-w-3xl bg-white shadow-2xl overflow-hidden rounded-sm">
            <canvas 
              ref={previewCanvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-full"
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handleDownload}
            disabled={downloading}
            className="px-8 py-2 bg-brand-teal-light text-white font-bold rounded-xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 dark:shadow-none flex items-center gap-2 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
        </div>
      </motion.div>
    </div>
  );
}
