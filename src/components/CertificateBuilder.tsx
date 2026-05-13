import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, useDragControls } from 'motion/react';
import { toast } from 'sonner';
import { 
  Plus, Trash2, Save, Image as ImageIcon, 
  Type, Move, ChevronLeft, Loader2, 
  Settings2, Layout, Check, X, Upload,
  Maximize2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

import { BoundingBox, Template } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, renderCertificateToCanvas } from '../lib/certificateRenderer';

export function CertificateBuilder() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [activeElement, setActiveElement] = useState<'studentName' | 'seminarTitle' | 'verificationCode' | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newTemplate, setNewTemplate] = useState<Omit<Template, 'id'>>({
    name: 'New Template',
    backgroundImage: 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&q=80&w=1200',
    elements: {
      studentName: { x: 300, y: 350, width: 600, height: 80, maxFontSize: 60, color: '#1e293b', fontWeight: 'bold', fontFamily: 'Poppins', visible: true },
      seminarTitle: { x: 300, y: 450, width: 600, height: 60, maxFontSize: 40, color: '#64748b', fontWeight: 'normal', fontFamily: 'Poppins', visible: true },
      verificationCode: { x: 900, y: 780, width: 200, height: 30, maxFontSize: 12, color: '#94a3b8', fontWeight: 'normal', fontFamily: 'Poppins', visible: true },
    }
  });

  const activeTemplate = selectedTemplate || (isCreating ? newTemplate : null);

  useEffect(() => {
    const q = query(collection(db, 'certificateTemplates'), where('createdBy', '==', auth.currentUser?.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedTemplates = snapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure all required elements exist for older templates
        const elements = {
          studentName: { 
            ...(data.elements?.studentName || { x: 300, y: 350, width: 600, height: 80, maxFontSize: 60, color: '#1e293b', fontWeight: 'bold' }),
            fontFamily: data.elements?.studentName?.fontFamily || 'Poppins',
            visible: data.elements?.studentName?.visible !== false
          },
          seminarTitle: { 
            ...(data.elements?.seminarTitle || { x: 300, y: 450, width: 600, height: 60, maxFontSize: 40, color: '#64748b', fontWeight: 'normal' }),
            fontFamily: data.elements?.seminarTitle?.fontFamily || 'Poppins',
            visible: data.elements?.seminarTitle?.visible !== false
          },
          verificationCode: { 
            ...(data.elements?.verificationCode || { x: 900, y: 780, width: 200, height: 30, maxFontSize: 12, color: '#94a3b8', fontWeight: 'normal' }),
            fontFamily: data.elements?.verificationCode?.fontFamily || 'Poppins',
            visible: data.elements?.verificationCode?.visible !== false
          },
        };
        return { id: doc.id, ...data, elements } as Template;
      });
      setTemplates(loadedTemplates);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificateTemplates');
    });
    return () => unsubscribe();
  }, []);

  // Rendering logic
  useEffect(() => {
    if (!activeTemplate || !previewCanvasRef.current) return;
    renderCertificateToCanvas(
      previewCanvasRef.current,
      activeTemplate as Template,
      { studentName: '[STUDENT NAME]', seminarTitle: '[SEMINAR TITLE]', verificationCode: '[CODE-1234]' },
      { showDebug }
    );
  }, [activeTemplate, showDebug]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedTemplate) {
        await updateDoc(doc(db, 'certificateTemplates', selectedTemplate.id), {
          ...selectedTemplate,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const docRef = await addDoc(collection(db, 'certificateTemplates'), {
          ...newTemplate,
          createdBy: auth.currentUser?.uid,
          createdAt: new Date().toISOString(),
        });
        setSelectedTemplate({ id: docRef.id, ...newTemplate });
      }
      setIsCreating(false);
      toast.success('Template saved successfully!');
    } catch (error) {
      toast.error('Failed to save template');
      handleFirestoreError(error, OperationType.WRITE, 'certificateTemplates');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'certificateTemplates', id));
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
      setShowDeleteConfirm(null);
      toast.success('Template deleted successfully');
    } catch (error) {
      toast.error('Failed to delete template');
      handleFirestoreError(error, OperationType.DELETE, `certificateTemplates/${id}`);
    }
  };

  const updateElement = (key: 'studentName' | 'seminarTitle' | 'verificationCode', updates: Partial<BoundingBox>) => {
    const defaultBox: BoundingBox = { x: 0, y: 0, width: 100, height: 50, maxFontSize: 20, color: '#000000', fontWeight: 'normal', fontFamily: 'Poppins', visible: true };
    
    if (selectedTemplate) {
      setSelectedTemplate({
        ...selectedTemplate,
        elements: {
          ...selectedTemplate.elements,
          [key]: { ...(selectedTemplate.elements[key] || defaultBox), ...updates }
        }
      });
    } else {
      setNewTemplate({
        ...newTemplate,
        elements: {
          ...newTemplate.elements,
          [key]: { ...(newTemplate.elements[key] || defaultBox), ...updates }
        }
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const compressedBase64 = await compressImage(base64String);
      
      if (selectedTemplate) {
        setSelectedTemplate({ ...selectedTemplate, backgroundImage: compressedBase64 });
      } else {
        setNewTemplate({ ...newTemplate, backgroundImage: compressedBase64 });
      }
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(base64);
        }
      };
      img.onerror = () => resolve(base64);
    });
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-teal-light" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-teal-light transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-black text-slate-900 mb-2">Certificate Builder</h1>
          <p className="text-slate-500 font-medium">Deterministic bounding box system for perfect alignment.</p>
        </div>
        {!isCreating && !selectedTemplate && (
          <button 
            onClick={() => setIsCreating(true)}
            className="px-6 py-3 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Template List */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Layout className="w-5 h-5 text-brand-teal-light" />
            Templates
          </h2>
          <div className="space-y-3">
            {templates.map(t => (
              <div 
                key={t.id}
                className={cn(
                  "group p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center",
                  selectedTemplate?.id === t.id ? "bg-brand-teal-light border-brand-teal-light text-white" : "bg-white border-slate-100 hover:border-teal-200"
                )}
                onClick={() => {
                  setSelectedTemplate(t);
                  setIsCreating(false);
                }}
              >
                <span className="font-bold truncate pr-2">{t.name}</span>
                <div className="flex items-center">
                  {showDeleteConfirm === t.id ? (
                    <div className="flex items-center gap-1 bg-white/20 p-0.5 rounded-lg">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                        className="p-1 hover:bg-white/20 rounded text-white"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(null); }}
                        className="p-1 hover:bg-white/20 rounded text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(t.id); }}
                      className={cn(
                        "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                        selectedTemplate?.id === t.id ? "hover:bg-brand-teal-dark text-white" : "hover:bg-red-50 text-red-500"
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Builder Area */}
        <div className="lg:col-span-9">
          {activeTemplate ? (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-6">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Template Name</label>
                  <input 
                    type="text"
                    value={activeTemplate.name || ''}
                    onChange={(e) => selectedTemplate ? setSelectedTemplate({...selectedTemplate, name: e.target.value}) : setNewTemplate({...newTemplate, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-brand-teal-light transition-all font-bold"
                  />
                </div>
                <div className="flex gap-2">
                  {selectedTemplate && (
                    <div className="relative">
                      {showDeleteConfirm === selectedTemplate.id ? (
                        <div className="flex items-center gap-2 bg-red-50 p-1 rounded-xl border border-red-100">
                          <span className="text-[10px] font-bold text-red-600 px-2 uppercase">Confirm?</span>
                          <button 
                            onClick={() => handleDelete(selectedTemplate.id)}
                            className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(null)}
                            className="p-1.5 bg-white text-slate-400 rounded-lg hover:text-slate-600 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowDeleteConfirm(selectedTemplate.id)}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                  <button 
                    onClick={() => setShowDebug(!showDebug)}
                    className={cn(
                      "px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
                      showDebug ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"
                    )}
                  >
                    <Settings2 className="w-4 h-4" />
                    Debug Boxes
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-brand-teal-light text-white font-bold rounded-xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Template
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-12 gap-8">
                {/* Canvas Preview */}
                <div className="md:col-span-8">
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <canvas 
                      ref={previewCanvasRef}
                      width={CANVAS_WIDTH}
                      height={CANVAS_HEIGHT}
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="mt-4 p-4 bg-teal-50 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <ImageIcon className="w-4 h-4 text-brand-teal-light" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-teal-900">Template Image</p>
                      <p className="text-xs text-teal-600 mb-2">Upload a PNG/JPG for the certificate background.</p>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-black text-brand-teal-light uppercase tracking-widest hover:underline"
                      >
                        Change Background
                      </button>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="md:col-span-4 space-y-6">
                  <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col gap-4 mb-6">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Type className="w-4 h-4 text-brand-teal-light" />
                        Boxes
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => setActiveElement('studentName')}
                          className={cn("px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex-1 text-center", activeElement === 'studentName' ? "bg-brand-teal-light text-white" : "bg-slate-50 text-slate-400")}
                        >
                          Name
                        </button>
                        <button 
                          onClick={() => setActiveElement('seminarTitle')}
                          className={cn("px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex-1 text-center", activeElement === 'seminarTitle' ? "bg-brand-teal-light text-white" : "bg-slate-50 text-slate-400")}
                        >
                          Seminar
                        </button>
                        <button 
                          onClick={() => setActiveElement('verificationCode')}
                          className={cn("px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex-1 text-center", activeElement === 'verificationCode' ? "bg-brand-teal-light text-white" : "bg-slate-50 text-slate-400")}
                        >
                          Code
                        </button>
                      </div>
                    </div>

                    {activeElement && activeTemplate.elements[activeElement] ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Visibility</span>
                          <button 
                            onClick={() => updateElement(activeElement, { visible: !activeTemplate.elements[activeElement]?.visible })}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                              activeTemplate.elements[activeElement]?.visible !== false ? "bg-brand-teal-light text-white" : "bg-slate-200 text-slate-500"
                            )}
                          >
                            {activeTemplate.elements[activeElement]?.visible !== false ? 'Shown' : 'Hidden'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">X Position</label>
                            <input 
                              type="number"
                              value={activeTemplate.elements[activeElement]?.x ?? 0}
                              onChange={(e) => updateElement(activeElement, { x: parseInt(e.target.value) || 0 })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Y Position</label>
                            <input 
                              type="number"
                              value={activeTemplate.elements[activeElement]?.y ?? 0}
                              onChange={(e) => updateElement(activeElement, { y: parseInt(e.target.value) || 0 })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Width</label>
                            <input 
                              type="number"
                              value={activeTemplate.elements[activeElement]?.width ?? 0}
                              onChange={(e) => updateElement(activeElement, { width: parseInt(e.target.value) || 0 })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Height</label>
                            <input 
                              type="number"
                              value={activeTemplate.elements[activeElement]?.height ?? 0}
                              onChange={(e) => updateElement(activeElement, { height: parseInt(e.target.value) || 0 })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                            />
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-50">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Max Font Size</label>
                              <input 
                                type="number"
                                value={activeTemplate.elements[activeElement]?.maxFontSize ?? 0}
                                onChange={(e) => updateElement(activeElement, { maxFontSize: parseInt(e.target.value) || 0 })}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Color</label>
                              <input 
                                type="color"
                                value={activeTemplate.elements[activeElement]?.color || '#000000'}
                                onChange={(e) => updateElement(activeElement, { color: e.target.value })}
                                className="w-full h-9 bg-slate-50 border border-slate-100 rounded-xl p-1 outline-none focus:ring-2 focus:ring-brand-teal-light"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Font Family</label>
                              <select 
                                value={activeTemplate.elements[activeElement]?.fontFamily || 'Poppins'}
                                onChange={(e) => updateElement(activeElement, { fontFamily: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                              >
                                <option value="Poppins">Poppins (Modern)</option>
                                <option value="Inter">Inter (Sans)</option>
                                <option value="Dancing Script">Dancing Script (Cursive)</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Font Weight</label>
                            <select 
                              value={activeTemplate.elements[activeElement]?.fontWeight || 'normal'}
                              onChange={(e) => updateElement(activeElement, { fontWeight: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal-light"
                            >
                              <option value="normal">Normal</option>
                              <option value="medium">Medium</option>
                              <option value="bold">Bold</option>
                              <option value="black">Black</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Move className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                        <p className="text-xs text-slate-400 font-medium">Select an element above to edit its bounding box.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 text-center p-12">
              <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6">
                <Layout className="w-10 h-10 text-brand-teal-light" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Deterministic Certificate Design</h3>
              <p className="text-slate-500 max-w-xs mx-auto mb-8">Define precise bounding boxes for dynamic text fields.</p>
              <button 
                onClick={() => setIsCreating(true)}
                className="px-8 py-4 bg-brand-teal-light text-white font-bold rounded-2xl hover:bg-brand-teal-dark transition-all shadow-lg shadow-teal-100 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create First Template
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
