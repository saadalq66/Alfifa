export type Language = 'en' | 'ar';

export type View = 'home' | 'about' | 'contact' | 'success' | 'services';

export interface TranslationData {
    [key: string]: {
        [key: string]: string;
    }
}

export interface SuccessData {
    name: string;
    email: string;
    serviceType: string;
    refId: string;
}