import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { LangToggle } from "@/components/LangToggle";

const NotFound = () => {
  const location = useLocation();
  const { t, lang } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
    <Seo lang={lang === "ar" ? "ar" : "en"} title="Page not found" description="This page could not be found." path={location.pathname} noindex />
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a0a] via-[#2d1111] to-[#1a0a0a] flex flex-col items-center justify-center p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <LangToggle />
      </div>

      <div className="text-center relative z-10">
        <h1 className="mb-4 text-6xl font-bold text-amber-500">{t("404.title")}</h1>
        <p className="mb-6 text-xl text-amber-200/60">{t("404.message")}</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold shadow-lg shadow-amber-900/30 transition-all active:scale-95"
        >
          {t("404.back_home")}
        </a>
      </div>
    </div>
    </>
  );
};

export default NotFound;
