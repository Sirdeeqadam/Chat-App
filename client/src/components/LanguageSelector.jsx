import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const LanguageSelector = () => {
  const {
    language,
    changeLanguage,
    loading,
  } = useLanguage();

  const [open, setOpen] = useState(false);

  const languages = [
    {
      name: "English",
      code: "en",
    },
    {
      name: "Hausa",
      code: "ha",
    },
    {
      name: "French",
      code: "fr",
    },
    {
      name: "Arabic",
      code: "ar",
    },
  ];

  const handleLanguageChange = async (newLanguage) => {
    try {
      await changeLanguage(newLanguage);
      setOpen(false);
    } catch (error) {
      console.error("Failed to change language:", error);
    }
  };

  return (
    <div className="language-selector-wrapper">
      <button
        type="button"
        className="translator-button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        title={`Language: ${language}`}
      >
        <svg
          className="translator-icon"
          viewBox="0 0 24 24"
          role="img"
          aria-label="Language selector"
          focusable="false"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" />
          <path d="M7 7.5h3.5M8.75 6v3" />
        </svg>
      </button>

      {open && (
        <div className="language-menu">
          <div className="language-menu-title">
            Language
          </div>

          {languages.map((item) => (
            <button
              key={item.name}
              type="button"
              className={
                language === item.name
                  ? "language-option active"
                  : "language-option"
              }
              onClick={() =>
                handleLanguageChange(item.name)
              }
            >
              <span>{item.name}</span>

              {language === item.name && (
                <span className="check">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;