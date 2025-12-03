import React from 'react';
import { Award, ArrowRight, FileCheck2, Clock, ShieldCheck } from 'lucide-react';
import { Language, View } from '../types';
import { TRANSLATIONS } from '../constants';

interface HomeProps {
    currentLang: Language;
    onNavigate: (view: View) => void;
}

const Home: React.FC<HomeProps> = ({ currentLang, onNavigate }) => {
    const t = TRANSLATIONS[currentLang];
    
    return (
        <div className="flex-grow fade-in">
            {/* Hero Section */}
            <section className="relative overflow-hidden border-b border-slate-200/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
                    <div className="text-center max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-brand-100 text-brand-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-6 shadow-sm">
                            <Award className="w-4 h-4" /> <span>{t.hero_badge}</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">{t.hero_headline}</h1>
                        <p className="text-lg sm:text-xl text-slate-600 mb-10 leading-relaxed">{t.hero_subtext}</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={() => onNavigate('quote')} className="bg-gradient-brand text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                                <span>{t.btn_get_quote}</span> <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                            </button>
                            <button onClick={() => onNavigate('about')} className="bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold text-lg hover:border-brand-500 hover:text-brand-700 transition-all"><span>{t.btn_learn_more}</span></button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Documents We Translate (Text Box List) */}
            <section className="py-16 bg-white/40 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 md:p-12 shadow-lg shadow-slate-200/50 border border-slate-100">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-extrabold text-slate-900">{t.services_title}</h2>
                            <div className="h-1 w-20 bg-brand-500 mx-auto rounded-full mt-4"></div>
                        </div>
                        
                        <ul className="list-disc pl-6 space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-4 text-lg text-slate-700 marker:text-brand-500 font-medium">
                            <li>{t.srv_medical}</li>
                            <li>{t.srv_legal}</li>
                            <li>{t.srv_commercial}</li>
                            <li>{t.srv_technical}</li>
                            <li>{t.srv_ids}</li>
                            <li>{t.srv_licenses}</li>
                            <li>{t.srv_other}</li>
                        </ul>
                    </div>
                </div>
            </section>
            
            {/* Features Grid */}
            <section className="py-16 border-t border-slate-100/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="w-14 h-14 bg-brand-100 rounded-xl flex items-center justify-center text-brand-600 mb-6"><FileCheck2 className="w-7 h-7" /></div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t.feat_1_title}</h3>
                            <p className="text-slate-500 leading-relaxed">{t.feat_1_desc}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6"><Clock className="w-7 h-7" /></div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t.feat_2_title}</h3>
                            <p className="text-slate-500 leading-relaxed">{t.feat_2_desc}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-6"><ShieldCheck className="w-7 h-7" /></div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t.feat_3_title}</h3>
                            <p className="text-slate-500 leading-relaxed">{t.feat_3_desc}</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;