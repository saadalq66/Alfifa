import React, { useState } from 'react';
import { Menu, Globe, Camera } from 'lucide-react';
import { Language, View } from '../types';
import { TRANSLATIONS } from '../constants';

interface HeaderProps {
    currentLang: Language;
    currentView: View;
    onNavigate: (view: View) => void;
    onToggleLang: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentLang, currentView, onNavigate, onToggleLang }) => {
    const t = TRANSLATIONS[currentLang];
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoError, setLogoError] = useState(false);

    const handleNav = (view: View) => {
        onNavigate(view);
        setMobileMenuOpen(false);
    };

    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNav('home')}>
                        {!logoError ? (
                             <img 
                             src="logo.png" 
                             alt="360PixPedia Logo" 
                             className="h-10 w-auto object-contain transition-opacity duration-300"
                             onError={() => setLogoError(true)}
                        />
                        ) : (
                            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">360</div>
                        )}
                        
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">{t.brand_name}</h1>
                            <p className="text-[9px] md:text-[10px] text-cyan-600 font-bold tracking-[0.2em] uppercase">{t.brand_subtitle}</p>
                        </div>
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-2">
                        <button onClick={() => handleNav('home')} className={`nav-link px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'home' ? 'active' : 'text-slate-600 hover:text-cyan-700'}`}>{t.nav_home}</button>
                        <button onClick={() => handleNav('services')} className={`nav-link px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'services' ? 'active' : 'text-slate-600 hover:text-cyan-700'}`}>{t.nav_services}</button>
                        <button onClick={() => handleNav('about')} className={`nav-link px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'about' ? 'active' : 'text-slate-600 hover:text-cyan-700'}`}>{t.nav_about}</button>
                        <button onClick={() => handleNav('contact')} className={`nav-link px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'contact' ? 'active' : 'text-slate-600 hover:text-cyan-700'}`}>{t.nav_contact}</button>
                    </nav>

                    {/* Tools */}
                    <div className="flex items-center gap-4">
                        <button onClick={onToggleLang} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-cyan-500 hover:text-cyan-600 transition-colors text-sm font-medium bg-white/50">
                            <Globe className="w-4 h-4" /> <span>{currentLang === 'en' ? 'العربية' : 'English'}</span>
                        </button>
                        <button className="md:hidden p-2 text-slate-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-slate-100 mt-3 pt-2 space-y-1 bg-white/95 backdrop-blur-sm rounded-b-xl shadow-lg">
                        <button onClick={() => handleNav('home')} className="block w-full text-start px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">{t.nav_home}</button>
                        <button onClick={() => handleNav('services')} className="block w-full text-start px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">{t.nav_services}</button>
                        <button onClick={() => handleNav('about')} className="block w-full text-start px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">{t.nav_about}</button>
                        <button onClick={() => handleNav('contact')} className="block w-full text-start px-4 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-50">{t.nav_contact}</button>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;