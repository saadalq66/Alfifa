import React from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface FooterProps {
    currentLang: Language;
}

const Footer: React.FC<FooterProps> = ({ currentLang }) => {
    const t = TRANSLATIONS[currentLang];
    return (
        <footer className="bg-gradient-to-r from-slate-900 to-cyan-900 text-white py-10 mt-auto border-t border-slate-700">
            <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
                <p className="mb-2">&copy; {new Date().getFullYear()} {t.brand_name}. {t.footer_rights}</p>
                <p className="text-sm text-slate-300/80 pt-2">Professional 360° Photography & Virtual Tours</p>
            </div>
        </footer>
    );
};

export default Footer;