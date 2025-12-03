import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './views/Home';
import About from './views/About';
import Quote from './views/Quote';
import Success from './views/Success';
import { Language, View, SuccessData } from './types';
import { TRANSLATIONS } from './constants';

const App: React.FC = () => {
    // Initial state from localStorage or default 'en'
    const [currentLang, setCurrentLang] = useState<Language>(() => {
        const saved = localStorage.getItem('alfifa_lang');
        return (saved === 'en' || saved === 'ar') ? saved : 'en';
    });
    const [currentView, setCurrentView] = useState<View>('home');
    const [successData, setSuccessData] = useState<SuccessData | null>(null);

    // Effect to update document attributes for styling/direction
    useEffect(() => {
        const t = TRANSLATIONS[currentLang];
        document.documentElement.setAttribute('dir', t.dir);
        document.documentElement.setAttribute('lang', currentLang);
        // Using direct DOM manipulation for body font as per original script logic
        document.body.style.fontFamily = t.font;
        localStorage.setItem('alfifa_lang', currentLang);
    }, [currentLang]);

    const handleToggleLang = () => {
        setCurrentLang(prev => prev === 'en' ? 'ar' : 'en');
    };

    const handleNavigate = (view: View) => {
        setCurrentView(view);
        window.scrollTo(0, 0);
    };

    const handleSuccess = (data: SuccessData) => {
        setSuccessData(data);
        handleNavigate('success');
    };

    const handleReset = () => {
        setSuccessData(null);
        handleNavigate('quote');
    };

    // Background decoration elements matching original design
    const BackgroundElements = () => (
        <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-slate-50">
            <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-brand-50/40"></div>
            <div className="absolute -top-[10%] -right-[5%] w-[40rem] h-[40rem] bg-brand-100/40 rounded-full blur-[120px] opacity-70"></div>
            <div className="absolute top-[30%] -left-[10%] w-[35rem] h-[35rem] bg-brand-200/20 rounded-full blur-[100px] opacity-60"></div>
            <div className="absolute bottom-0 right-[10%] w-[30rem] h-[30rem] bg-slate-200/60 rounded-full blur-[80px]"></div>
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#b0353e 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        </div>
    );

    return (
        <>
            <BackgroundElements />
            
            <Header 
                currentLang={currentLang} 
                currentView={currentView} 
                onNavigate={handleNavigate} 
                onToggleLang={handleToggleLang} 
            />

            <main className="flex-grow flex flex-col">
                {currentView === 'home' && <Home currentLang={currentLang} onNavigate={handleNavigate} />}
                {currentView === 'about' && <About currentLang={currentLang} />}
                {currentView === 'quote' && <Quote currentLang={currentLang} onSuccess={handleSuccess} />}
                {currentView === 'success' && successData && <Success currentLang={currentLang} data={successData} onReset={handleReset} />}
            </main>

            <Footer currentLang={currentLang} />
        </>
    );
};

export default App;