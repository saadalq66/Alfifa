export type Language = 'en' | 'ar';

export type View = 'home' | 'about' | 'quote' | 'success';

export interface TranslationData {
    [key: string]: {
        [key: string]: string;
    }
}

export interface QuoteFormData {
    fullName: string;
    mobile: string;
    email: string;
    translationType: string;
    otherNotes: string;
    needsAttestation: boolean;
    needsDelivery: boolean;
    deliveryAddress: string;
    file: File | null;
}

export interface SuccessData {
    name: string;
    email: string;
    serviceType: string;
    refId: string;
}