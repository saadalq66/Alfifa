import React from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface FooterProps {
    currentLang: Language;
}

const Footer: React.FC<FooterProps> = ({ currentLang }) => {
    const t = TRANSLATIONS[currentLang];
    return (
        <footer className="bg-brand-900 text-brand-100 py-10 mt-auto border-t border-brand-800">
            <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
                <p className="mb-2">&copy; {new Date().getFullYear()} {t.brand_name} {t.brand_subtitle}.</p>
                <div className="text-xs text-brand-200/60 flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
                    <span>{t.footer_cr}: 2050018443</span>
                    <span className="hidden sm:inline text-brand-200/40">|</span>
                    <span>{t.footer_license}: 203005000232</span>
                </div>
                <p className="text-sm text-brand-200/60 pt-2">Dammam, Saudi Arabia</p>
            </div>
        </footer>
    );
};

export default Footer;