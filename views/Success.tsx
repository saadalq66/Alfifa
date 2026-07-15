import React from 'react';
import { Check, Mail, ArrowLeft } from 'lucide-react';
import { Language, SuccessData } from '../types';
import { TRANSLATIONS } from '../constants';

interface SuccessProps {
    currentLang: Language;
    data: SuccessData;
    onReset: () => void;
}

const Success: React.FC<SuccessProps> = ({ currentLang, data, onReset }) => {
    const t = TRANSLATIONS[currentLang];
    
    return (
        <div className="max-w-4xl mx-auto py-16 px-4 w-full flex-grow fade-in">
             <div className="text-center mb-16">
                <div className="w-24 h-24 bg-cyan-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"><Check className="w-12 h-12 text-cyan-600" /></div>
                <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">{t.success_title}</h2>
                <p className="text-xl text-slate-600">{t.success_msg}</p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 w-full"></div>
                    <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                        <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><Mail className="w-5 h-5" /></div>
                        <span className="font-medium text-cyan-900"><span>{t.email_to}</span> <span className="font-bold">{data.email}</span></span>
                    </div>
                    <div className="p-8 font-mono text-sm text-slate-600 space-y-4">
                        <p><strong className="text-slate-900">{t.email_subject}</strong> {data.serviceType}</p>
                        <p><span>{t.email_dear}</span> <span>{data.name}</span>,</p>
                        <p>Reference ID: <span className="bg-slate-100 px-1 rounded text-slate-900 font-medium">{data.refId}</span></p>
                        <p>We will contact you within 24 hours.</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden p-8 text-center flex flex-col items-center justify-center">
                     <h3 className="text-lg font-bold text-slate-900 mb-2">Thank You!</h3>
                     <p className="text-slate-500 font-medium">Our team will review your inquiry and get back to you shortly.</p>
                </div>
            </div>
            <div className="mt-12 text-center">
                <button onClick={onReset} className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2 mx-auto shadow-md">
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t.btn_home}</span>
                </button>
            </div>
        </div>
    );
};

export default Success;