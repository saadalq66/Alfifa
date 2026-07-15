import React from 'react';
import { Camera, Target, Eye } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface AboutProps {
    currentLang: Language;
}

const About: React.FC<AboutProps> = ({ currentLang }) => {
    const t = TRANSLATIONS[currentLang];
    return (
        <div className="flex-grow fade-in bg-gradient-to-b from-white via-cyan-50/30 to-blue-50/30">
            <div className="bg-white/60 backdrop-blur-sm">
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                     <div className="max-w-3xl mx-auto text-center mb-12">
                         <h2 className="text-3xl font-extrabold text-slate-900 mb-4">{t.about_title}</h2>
                         <div className="h-1 w-20 bg-gradient-to-r from-cyan-400 to-blue-500 mx-auto rounded-full"></div>
                     </div>
                     <div className="prose prose-lg prose-slate mx-auto text-center max-w-4xl">
                         <p className="lead text-xl text-slate-600 leading-relaxed mb-6">{t.about_intro}</p>
                         <div className="grid md:grid-cols-2 gap-8 my-12 text-start">
                             <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                 <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mb-4">
                                     <Target className="w-6 h-6" />
                                 </div>
                                 <h3 className="text-xl font-bold text-slate-800 mb-3">{t.about_mission_title}</h3>
                                 <p className="text-slate-600">{t.about_mission_desc}</p>
                             </div>
                             <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                 <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                                     <Eye className="w-6 h-6" />
                                 </div>
                                 <h3 className="text-xl font-bold text-slate-800 mb-3">{t.about_vision_title}</h3>
                                 <p className="text-slate-600">{t.about_vision_desc}</p>
                             </div>
                         </div>
                         <p className="text-slate-600 mb-6 text-start">{t.about_text_1}</p>
                         <p className="text-slate-600 text-start">{t.about_text_2}</p>
                     </div>
                 </div>
            </div>
        </div>
    );
};

export default About;