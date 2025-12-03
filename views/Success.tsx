import React from 'react';
import { Check, Mail } from 'lucide-react';
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
                <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"><Check className="w-12 h-12 text-brand-600" /></div>
                <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">{t.success_title}</h2>
                <p className="text-xl text-slate-500"><span>{t.success_ref}</span> <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-1 rounded-md">{data.refId}</span></p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                    <div className="h-1.5 bg-blue-500 w-full"></div>
                    <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Mail className="w-5 h-5" /></div>
                        <span className="font-medium text-blue-900"><span>{t.email_to}</span> <span className="font-bold">{data.email}</span></span>
                    </div>
                    <div className="p-8 font-mono text-sm text-slate-600 space-y-4">
                        <p><strong className="text-slate-900">{t.email_subject}</strong> Order Confirmation</p>
                        <p><span>{t.email_dear}</span> <span>{data.name}</span>,</p>
                        <p><span>{t.email_received}</span> <span className="bg-slate-100 px-1 rounded text-slate-900 font-medium">{data.serviceType}</span></p>
                        <p>{t.email_footer}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden p-8 text-center flex flex-col items-center justify-center">
                     <h3 className="text-lg font-bold text-slate-900 mb-2">{t.next_steps_title}</h3>
                     <p className="text-slate-500 font-medium">{t.next_steps_desc}</p>
                </div>
            </div>
            <div className="mt-12 text-center">
                <button onClick={onReset} className="px-8 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-600 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-sm">{t.btn_new_request}</button>
            </div>
        </div>
    );
};

export default Success;