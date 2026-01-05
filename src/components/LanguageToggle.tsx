import React from 'react';
import { useTranslation } from '../i18n';

export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useTranslation();

  const toggle = () => setLang(lang === 'en' ? 'bn' : 'en');

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 rounded-md border text-sm bg-white hover:bg-gray-50"
      title={lang === 'en' ? 'Switch to Bangla' : 'Switch to English'}
    >
      {lang === 'en' ? 'EN' : 'BN'}
    </button>
  );
};

export default LanguageToggle;
