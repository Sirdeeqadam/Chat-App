import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";
import translations from "../i18n/translations";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      if (user.language) {
        setLanguage(user.language);
        console.log("[LANGUAGE] Loaded:", user.language);
      }
    } catch (error) {
      console.error("[LANGUAGE] Failed to load user:", error);
    }
  }, []);

  useEffect(() => {
    const sendLanguage = () => {
      if (!socket.connected) {
        return;
      }

      socket.emit("set_language", language);

      console.log("[LANGUAGE] Sent to socket:", language);
    };

    if (socket.connected) {
      sendLanguage();
    }

    socket.on("connect", sendLanguage);

    return () => {
      socket.off("connect", sendLanguage);
    };
  }, [language]);

  const changeLanguage = async (newLanguage) => {
    try {
      setLoading(true);

      console.log("[LANGUAGE] Changing to:", newLanguage);

      const response = await api.put("/auth/language", {
        language: newLanguage,
      });

      const updatedUser = response.data.user;

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      setLanguage(newLanguage);

      if (socket.connected) {
        socket.emit("set_language", newLanguage);

        console.log(
          "[LANGUAGE] Socket updated:",
          newLanguage
        );
      }
    } catch (error) {
      console.error(
        "[LANGUAGE] Language update failed:",
        error
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  const t =
    translations[language] ||
    translations.English;

  return (
    <LanguageContext.Provider
      value={{
        language,
        changeLanguage,
        t,
        loading,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
};