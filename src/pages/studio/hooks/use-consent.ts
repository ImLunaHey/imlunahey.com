import { useEffect, useState } from 'react';

type Consent = 'accepted' | 'denied' | 'pending';

export const useConsent = (): Consent => {
  const [consent, setConsent] = useState<Consent>('pending');

  useEffect(() => {
    const consent = localStorage.getItem('consent');
    if (consent === 'accepted' || consent === 'denied') {
      setConsent(consent);
    }

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'consent' || e.key === null) {
        setConsent(e.newValue as Consent);
      }
    };
    window.addEventListener('storage', onStorageChange);
  }, []);

  return ['accepted', 'denied', 'pending'].includes(consent) ? consent : 'pending';
};
