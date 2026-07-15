import React, { useState } from 'react';
import { Mail, User, Phone, MessageSquare, Send, Camera } from 'lucide-react';
import { Language, SuccessData } from '../types';
import { TRANSLATIONS } from '../constants';

interface ContactProps {
    currentLang: Language;
    onSuccess: (data: SuccessData) => void;
}

const Contact: React.FC<ContactProps> = ({ currentLang, onSuccess }) => {
    const t = TRANSLATIONS[currentLang];
    
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        service: 'realestate',
        message: ''
    });
    
    const [errors, setErrors] = useState<{[key: string]: string}>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
        if (errors[id]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[id];
                return newErrors;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: {[key: string]: string} = {};
        
        if (!formData.fullName.trim()) newErrors.fullName = t.err_required;
        
        if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = t.err_email;
        
        if (!formData.phone.trim()) newErrors.phone = t.err_required;
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        
        setTimeout(() => {
            const refId = '#360-' + Math.floor(Math.random() * 10000);
            
            let serviceName = '';
            switch(formData.service) {
                case 'realestate': serviceName = t.opt_realestate; break;
                case 'vehicles': serviceName = t.opt_vehicles; break;
                case 'objects': serviceName = t.opt_objects; break;
                case 'streetview': serviceName = t.opt_streetview; break;
                default: serviceName = t.opt_other;
            }

            const successData: SuccessData = {
                name: formData.fullName,
                email: formData.email,
                serviceType: serviceName,
                refId: refId
            };
            
            setIsSubmitting(false);
            onSuccess(successData);
        }, 1500);
    };

    return (
        <div className="flex-grow fade-in bg-gradient-to-b from-white via-cyan-50/30 to-blue-50/30">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-cyan-200 text-cyan-700 px-4 py-2 rounded-full text-sm font-bold mb-4 shadow-sm">
                        <Camera className="w-5 h-5" />
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">{t.contact_title}</h2>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">{t.contact_desc}</p>
                </div>
                
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>
                    
                    <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8" noValidate>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">{t.label_name} <span className="text-red-500">*</span></label>
                                <div className="relative group/input">
                                    <User className="absolute start-3 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-cyan-500 transition-colors" />
                                    <input 
                                        type="text" 
                                        id="fullName" 
                                        value={formData.fullName} 
                                        onChange={handleInputChange}
                                        className={`w-full ps-10 pe-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all focus:bg-white placeholder:text-slate-400 ${errors.fullName ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} 
                                        placeholder={t.placeholder_name} 
                                    />
                                </div>
                                {errors.fullName && <p className="text-xs text-red-500 font-medium mt-1">{errors.fullName}</p>}
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">{t.label_email} <span className="text-red-500">*</span></label>
                                <div className="relative group/input">
                                    <Mail className="absolute start-3 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-cyan-500 transition-colors" />
                                    <input 
                                        type="email" 
                                        id="email" 
                                        value={formData.email} 
                                        onChange={handleInputChange}
                                        className={`w-full ps-10 pe-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all focus:bg-white placeholder:text-slate-400 ${errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} 
                                        placeholder={t.placeholder_email} 
                                    />
                                </div>
                                {errors.email && <p className="text-xs text-red-500 font-medium mt-1">{errors.email}</p>}
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">{t.label_phone} <span className="text-red-500">*</span></label>
                                <div className="relative group/input">
                                    <Phone className="absolute start-3 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-cyan-500 transition-colors" />
                                    <input 
                                        type="tel" 
                                        id="phone" 
                                        value={formData.phone} 
                                        onChange={handleInputChange}
                                        className={`w-full ps-10 pe-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all focus:bg-white placeholder:text-slate-400 font-mono ${errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} 
                                        placeholder={t.placeholder_phone}
                                        style={{ direction: 'ltr', textAlign: 'start' }}
                                    />
                                </div>
                                {errors.phone && <p className="text-xs text-red-500 font-medium mt-1">{errors.phone}</p>}
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">{t.label_service}</label>
                                <div className="relative">
                                    <select 
                                        id="service" 
                                        value={formData.service} 
                                        onChange={handleInputChange}
                                        className="w-full ps-4 pe-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none cursor-pointer appearance-none transition-all"
                                    >
                                        <option value="realestate">{t.opt_realestate}</option>
                                        <option value="vehicles">{t.opt_vehicles}</option>
                                        <option value="objects">{t.opt_objects}</option>
                                        <option value="streetview">{t.opt_streetview}</option>
                                        <option value="other">{t.opt_other}</option>
                                    </select>
                                    <div className="absolute end-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none">
                                        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">{t.label_message}</label>
                            <div className="relative group/input">
                                <MessageSquare className="absolute start-3 top-4 w-5 h-5 text-slate-400 group-focus-within/input:text-cyan-500 transition-colors" />
                                <textarea 
                                    id="message" 
                                    rows={5} 
                                    value={formData.message}
                                    onChange={handleInputChange}
                                    className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all focus:bg-white resize-none placeholder:text-slate-400" 
                                    placeholder={t.placeholder_message}
                                ></textarea>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    <span>{t.btn_submit}</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Contact;
