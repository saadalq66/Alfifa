import React from 'react';
import { Award, ArrowRight, Camera, Building, Car, Watch, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { Language, View } from '../types';
import { TRANSLATIONS } from '../constants';

interface HomeProps {
    currentLang: Language;
    onNavigate: (view: View) => void;
}

const Home: React.FC<HomeProps> = ({ currentLang, onNavigate }) => {
    const t = TRANSLATIONS[currentLang];
    
    const services = [
        {
            icon: Building,
            titleKey: 'srv_realestate_title',
            descKey: 'srv_realestate_desc',
            priceKey: 'srv_realestate_price',
            color: 'bg-blue-100 text-blue-600'
        },
        {
            icon: Car,
            titleKey: 'srv_vehicles_title',
            descKey: 'srv_vehicles_desc',
            priceKey: 'srv_vehicles_price',
            color: 'bg-green-100 text-green-600'
        },
        {
            icon: Watch,
            titleKey: 'srv_objects_title',
            descKey: 'srv_objects_desc',
            priceKey: 'srv_objects_price',
            color: 'bg-purple-100 text-purple-600'
        },
        {
            icon: MapPin,
            titleKey: 'srv_streetview_title',
            descKey: 'srv_streetview_desc',
            priceKey: 'srv_streetview_price',
            color: 'bg-orange-100 text-orange-600'
        }
    ];
    
    return (
        <div className="flex-grow fade-in">
            {/* Hero Section */}
            <section className="relative overflow-hidden border-b border-slate-200/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
                    <div className="text-center max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-cyan-200 text-cyan-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-6 shadow-sm">
                            <Award className="w-4 h-4" /> <span>{t.hero_badge}</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">{t.hero_headline}</h1>
                        <p className="text-lg sm:text-xl text-slate-600 mb-10 leading-relaxed">{t.hero_subtext}</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={() => onNavigate('contact')} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                                <span>{t.btn_get_quote}</span> <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                            </button>
                            <button onClick={() => onNavigate('about')} className="bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold text-lg hover:border-cyan-500 hover:text-cyan-700 transition-all"><span>{t.btn_explore_services}</span></button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services Section */}
            <section className="py-16 bg-gradient-to-b from-white via-cyan-50/30 to-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">{t.services_title}</h2>
                        <div className="h-1.5 w-24 bg-gradient-to-r from-cyan-400 to-blue-500 mx-auto rounded-full mt-4"></div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                        {services.map((service, index) => {
                            const Icon = service.icon;
                            return (
                                <div key={index} className="bg-white/90 backdrop-blur-md rounded-2xl p-8 shadow-lg shadow-slate-200/40 border border-slate-100 hover:shadow-xl transition-all hover:-translate-y-2 group">
                                    <div className={`w-16 h-16 ${service.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                        <Icon className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-3">{t[service.titleKey]}</h3>
                                    <p className="text-slate-600 leading-relaxed mb-4">{t[service.descKey]}</p>
                                    <div className="inline-block bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm">
                                        {t[service.priceKey]}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
            
            {/* Features Grid */}
            <section className="py-16 border-t border-slate-100/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mb-6"><Camera className="w-7 h-7" /></div>
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