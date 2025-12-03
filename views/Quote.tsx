import React, { useState, useEffect, useRef } from 'react';
import { FileText, User, Phone, Mail, ChevronDown, ShieldCheck, Truck, MapPin, UploadCloud, FileCheck, RefreshCw, Calculator, Info, ArrowRight } from 'lucide-react';
import { Language, QuoteFormData, SuccessData } from '../types';
import { TRANSLATIONS } from '../constants';

interface QuoteProps {
    currentLang: Language;
    onSuccess: (data: SuccessData) => void;
}

const Quote: React.FC<QuoteProps> = ({ currentLang, onSuccess }) => {
    const t = TRANSLATIONS[currentLang];
    
    // State
    const [formData, setFormData] = useState<QuoteFormData>({
        fullName: '',
        mobile: '',
        email: '',
        translationType: 'eng_to_ar',
        otherNotes: '',
        needsAttestation: false,
        needsDelivery: false,
        deliveryAddress: '',
        file: null
    });
    
    const [errors, setErrors] = useState<{[key: string]: string}>({});
    const [captcha, setCaptcha] = useState('');
    const [userCaptcha, setUserCaptcha] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // References
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Captcha Logic
    const generateCaptcha = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 4; i++) { 
            result += chars.charAt(Math.floor(Math.random() * chars.length)); 
        }
        setCaptcha(result);
        setUserCaptcha('');
    };

    useEffect(() => {
        generateCaptcha();
    }, []);

    // Handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
        // Clear error on change
        if (errors[id]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[id];
                return newErrors;
            });
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, checked } = e.target;
        setFormData(prev => ({ ...prev, [id]: checked }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, file: e.target.files![0] }));
            if (errors.file) {
                 setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.file;
                    return newErrors;
                });
            }
        }
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: {[key: string]: string} = {};
        
        // Validation
        if (!formData.fullName.trim()) newErrors.fullName = t.err_required;
        
        const saudiRegex = /^(05\d{8}|(\+9665)\d{8})$/;
        if (!formData.mobile.trim()) newErrors.mobile = t.err_required;
        else if (!saudiRegex.test(formData.mobile.replace(/\s/g, ''))) newErrors.mobile = t.err_mobile;
        
        if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = t.err_email;
        
        if (formData.needsDelivery && !formData.deliveryAddress.trim()) newErrors.deliveryAddress = t.err_address;
        
        if (!formData.file) newErrors.file = t.err_file;
        
        if (userCaptcha.toUpperCase() !== captcha) {
            newErrors.captcha = t.err_captcha;
            generateCaptcha();
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        
        // Simulate API call
        setTimeout(() => {
            const refId = '#ALF-' + Math.floor(Math.random() * 10000);
            
            let serviceParts = [];
            if (currentLang === 'en') {
                serviceParts.push('Translation');
                if (formData.needsAttestation) serviceParts.push('Attestation');
                if (formData.needsDelivery) serviceParts.push('Delivery');
            } else {
                serviceParts.push('ترجمة');
                if (formData.needsAttestation) serviceParts.push('تصديق');
                if (formData.needsDelivery) serviceParts.push('توصيل');
            }

            const successData: SuccessData = {
                name: formData.fullName,
                email: formData.email,
                serviceType: serviceParts.join(' + '),
                refId: refId
            };
            
            setIsSubmitting(false);
            onSuccess(successData);
        }, 1500);
    };

    return (
        <div className="flex-grow fade-in bg-brand-50/80 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
                <div className="text-center mb-16">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">{t.quote_title}</h2>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">{t.quote_desc}</p>
                </div>
                <div className="grid lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-8 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-brand"></div>
                        <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-brand-600"><FileText className="w-5 h-5" /></div>
                            <h3 className="text-lg font-semibold text-slate-900">{t.form_title}</h3>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-8" noValidate>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">{t.label_name} <span className="text-red-500">*</span></label>
                                    <div className="relative group/input">
                                        <User className="absolute start-3 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-brand-500 transition-colors" />
                                        <input 
                                            type="text" 
                                            id="fullName" 
                                            value={formData.fullName} 
                                            onChange={handleInputChange}
                                            className={`w-full ps-10 pe-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all focus:bg-white placeholder:text-slate-400 ${errors.fullName ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} 
                                            placeholder={t.placeholder_name} 
                                        />
                                    </div>
                                    {errors.fullName && <p className="text-xs text-red-500 font-medium mt-1">{errors.fullName}</p>}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">{t.label_mobile} <span className="text-red-500">*</span></label>
                                    <div className="relative group/input">
                                        <Phone className="absolute start-3 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-brand-500 transition-colors" />
                                        <input 
                                            type="tel" 
                                            id="mobile" 
                                            value={formData.mobile} 
                                            onChange={handleInputChange}
                                            className={`w-full ps-10 pe-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all focus:bg-white placeholder:text-slate-400 font-mono ${errors.mobile ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} 
                                            placeholder="0501234567" 
                                            style={{ direction: 'ltr', textAlign: 'start' }}
                                        />
                                    </div>
                                    {errors.mobile && <p className="text-xs text-red-500 font-medium mt-1">{errors.mobile}</p>}
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-semibold text-slate-700">{t.label_email} <span className="text-red-500">*</span></label>
                                    <div className="relative group/input">
                                        <Mail className="absolute start-3 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-brand-500 transition-colors" />
                                        <input 
                                            type="email" 
                                            id="email" 
                                            value={formData.email} 
                                            onChange={handleInputChange}
                                            className={`w-full ps-10 pe-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all focus:bg-white placeholder:text-slate-400 ${errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} 
                                            placeholder={t.placeholder_email} 
                                        />
                                    </div>
                                    {errors.email && <p className="text-xs text-red-500 font-medium mt-1">{errors.email}</p>}
                                </div>
                            </div>
                            
                            <div className="h-px bg-slate-100"></div>
                            
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">{t.label_trans_type}</label>
                                    <div className="relative">
                                        <select 
                                            id="translationType" 
                                            value={formData.translationType} 
                                            onChange={handleInputChange}
                                            className="w-full ps-4 pe-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none cursor-pointer appearance-none transition-all"
                                        >
                                            <option value="eng_to_ar">{t.opt_eng_ar}</option>
                                            <option value="ar_to_eng">{t.opt_ar_eng}</option>
                                            <option value="other">{t.opt_other}</option>
                                        </select>
                                        <ChevronDown className="absolute end-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                                    </div>
                                    <div className="space-y-2 fade-in mt-3">
                                        <label className="text-sm font-semibold text-slate-700">{t.label_notes}</label>
                                        <textarea 
                                            id="otherNotes" 
                                            rows={2} 
                                            value={formData.otherNotes}
                                            onChange={handleInputChange}
                                            className="w-full ps-4 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all focus:bg-white resize-none" 
                                            placeholder="..."
                                        ></textarea>
                                    </div>
                                </div>

                                {/* Attestation Checkbox */}
                                <label className="flex items-start gap-4 p-5 rounded-xl border border-slate-200 cursor-pointer hover:border-brand-500 hover:bg-brand-50/30 transition-all group/check">
                                    <div className="relative flex items-center mt-1">
                                        <input 
                                            type="checkbox" 
                                            id="needsAttestation" 
                                            checked={formData.needsAttestation}
                                            onChange={handleCheckboxChange}
                                            className="peer h-5 w-5 cursor-pointer accent-brand-600 rounded border-slate-300 focus:ring-offset-0 focus:ring-2 focus:ring-brand-500/30" 
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-semibold text-slate-900 flex items-center gap-2 group-hover/check:text-brand-700 transition-colors">
                                            {t.label_attest} <ShieldCheck className="w-5 h-5 text-brand-500" />
                                        </span>
                                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                            {t.desc_attest}<br/>
                                            <span className="text-xs text-brand-600 font-bold uppercase tracking-wide mt-1 inline-block">{t.desc_attest_note}</span>
                                        </p>
                                    </div>
                                </label>

                                {/* Delivery Checkbox */}
                                <label className="flex items-start gap-4 p-5 rounded-xl border border-slate-200 cursor-pointer hover:border-brand-500 hover:bg-brand-50/30 transition-all group/check">
                                    <div className="relative flex items-center mt-1">
                                        <input 
                                            type="checkbox" 
                                            id="needsDelivery" 
                                            checked={formData.needsDelivery}
                                            onChange={handleCheckboxChange}
                                            className="peer h-5 w-5 cursor-pointer accent-brand-600 rounded border-slate-300 focus:ring-offset-0 focus:ring-2 focus:ring-brand-500/30" 
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-semibold text-slate-900 flex items-center gap-2 group-hover/check:text-brand-700 transition-colors">
                                            {t.label_delivery} <Truck className="w-5 h-5 text-brand-500" />
                                        </span>
                                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                            {t.desc_delivery}
                                        </p>
                                    </div>
                                </label>

                                {formData.needsDelivery && (
                                    <div className="space-y-2 fade-in">
                                        <label className="text-sm font-semibold text-slate-700">{t.label_address} <span className="text-red-500">*</span></label>
                                        <div className="relative group/input">
                                            <MapPin className="absolute start-3 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-brand-500 transition-colors" />
                                            <textarea 
                                                id="deliveryAddress" 
                                                rows={3} 
                                                value={formData.deliveryAddress}
                                                onChange={handleInputChange}
                                                className={`w-full ps-10 pe-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all focus:bg-white resize-none ${errors.deliveryAddress ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} 
                                                placeholder={t.placeholder_address}
                                            ></textarea>
                                        </div>
                                        {errors.deliveryAddress && <p className="text-xs text-red-500 font-medium mt-1">{errors.deliveryAddress}</p>}
                                    </div>
                                )}
                            </div>
                            
                            <div className="h-px bg-slate-100"></div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">{t.label_upload} <span className="text-red-500">*</span></label>
                                <div 
                                    onClick={triggerFileUpload}
                                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 relative group/upload ${errors.file ? 'border-red-300' : 'border-slate-300'} ${formData.file ? 'border-brand-400 bg-brand-50/30' : ''}`}
                                >
                                    <input 
                                        type="file" 
                                        id="file-upload" 
                                        accept=".pdf,image/*" 
                                        className="hidden" 
                                        onChange={handleFileChange} 
                                        ref={fileInputRef}
                                    />
                                    
                                    {!formData.file ? (
                                        <div className="group-hover/upload:-translate-y-1 transition-transform duration-300">
                                            <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4"><UploadCloud className="w-8 h-8" /></div>
                                            <p className="text-slate-700 font-medium">{t.upload_prompt}</p>
                                            <p className="text-sm text-slate-400 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="w-14 h-14 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center shadow-sm"><FileCheck className="w-7 h-7" /></div>
                                            <span className="text-slate-900 font-medium break-all">{formData.file.name}</span>
                                            <span className="text-xs text-brand-600 font-medium hover:underline">{t.upload_change}</span>
                                        </div>
                                    )}
                                </div>
                                {errors.file && <p className="text-xs text-red-500 text-center font-medium mt-2">{errors.file}</p>}
                            </div>
                            
                            <div className="h-px bg-slate-100"></div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">{t.label_security} <span className="text-red-500">*</span></label>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="bg-slate-100 select-none border border-slate-200 rounded-xl px-6 py-3 flex items-center justify-between gap-4 min-w-[180px] shadow-inner">
                                        <span className="captcha-text text-2xl font-bold">{captcha}</span>
                                        <button type="button" onClick={generateCaptcha} className="text-slate-400 hover:text-brand-600 transition-colors p-2 rounded-full hover:bg-slate-200"><RefreshCw className="w-5 h-5" /></button>
                                    </div>
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            maxLength={4} 
                                            value={userCaptcha}
                                            onChange={(e) => setUserCaptcha(e.target.value)}
                                            className={`w-full px-4 py-3.5 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all uppercase font-mono placeholder:text-slate-400 text-start ${errors.captcha ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} 
                                            placeholder={t.placeholder_captcha}
                                        />
                                        {errors.captcha && <p className="text-xs text-red-500 mt-2 font-medium">{errors.captcha}</p>}
                                    </div>
                                </div>
                            </div>
                            
                            <button disabled={isSubmitting} type="submit" className="w-full bg-gradient-brand text-white py-4 rounded-xl shadow-lg hover:-translate-y-0.5 font-bold text-lg transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed">
                                <span>{isSubmitting ? (currentLang === 'en' ? 'Sending...' : 'جاري الإرسال...') : t.btn_submit}</span> 
                                {!isSubmitting && <ArrowRight className="w-5 h-5 rtl:rotate-180" />}
                            </button>
                        </form>
                    </div>
                    
                    {/* Prices */}
                    <div className="lg:col-span-4 space-y-6 sticky top-24">
                        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3 mb-6">
                                <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><Calculator className="w-5 h-5" /></div>
                                <span>{t.price_title}</span>
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline pb-4 border-b border-slate-50"><span className="text-slate-600 font-medium">{t.price_trans}</span><div className="text-end"><span className="font-bold text-slate-900 text-lg font-mono">95.00 SAR</span><span className="block text-[10px] text-slate-400 uppercase font-semibold">{t.price_per_page}</span></div></div>
                                <div className="flex justify-between items-baseline pb-4 border-b border-slate-50"><span className="text-slate-600 font-medium">{t.price_attest}</span><span className="font-bold text-slate-900 text-lg font-mono">35.00 SAR</span></div>
                                <div className="flex justify-between items-baseline pb-4 border-b border-slate-50"><span className="text-slate-600 font-medium">{t.price_delivery}</span><span className="font-bold text-slate-900 text-lg font-mono">100.00 SAR*</span></div>
                                <div className="flex justify-between items-center p-4 bg-brand-50/50 rounded-xl border border-brand-100/50">
                                    <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-600" /><span className="text-brand-900 font-semibold text-sm">{t.price_chamber}</span></div>
                                    <div className="text-end"><span className="font-bold text-brand-700 text-lg font-mono">45.00 SAR</span><span className="block text-[10px] text-brand-600 uppercase font-semibold">{t.price_gov_fee}</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100 text-sm text-blue-800">
                            <div className="flex gap-3"><Info className="w-5 h-5 shrink-0 text-blue-600" /><div><p className="font-bold mb-1">{t.note_title}</p><ul className="list-disc ps-4 space-y-1 opacity-80"><li>{t.note_1}</li><li>{t.note_2}</li><li>{t.note_3}</li><li>{t.note_4}</li></ul></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Quote;