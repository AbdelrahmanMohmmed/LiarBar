import React from "react";

export interface LanguageTransitionOverlayProps {
  show: boolean;
  phase: "entering" | "holding" | "leaving" | "idle";
  targetLang: "ar" | "en" | null;
}

export const LanguageTransitionOverlay: React.FC<LanguageTransitionOverlayProps> = ({
  show,
  phase,
  targetLang,
}) => {
  if (!show && phase === "idle") return null;

  const isGoingToAr = targetLang === "ar";
  const title = isGoingToAr ? "جارٍ التحويل إلى العربية..." : "Switching to English...";
  const sub = isGoingToAr ? "أهلاً بك في سفريات جيمز" : "Welcome to Safariyat Games";

  const isLeaving = phase === "leaving";

  return (
    <div
      dir={isGoingToAr ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(253, 246, 236, 0.94)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        pointerEvents: "all",
        userSelect: "none",
        opacity: isLeaving ? 0 : 1,
        transition: "opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        animation: !isLeaving ? "dc-overlay-in 0.2s ease forwards" : undefined,
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 24,
          border: "3px solid #2B2420",
          boxShadow: "6px 6px 0 #2B2420",
          padding: "30px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          maxWidth: 340,
          width: "100%",
          textAlign: "center",
          transform: isLeaving ? "scale(0.96) translateY(6px)" : "scale(1) translateY(0)",
          transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Domino spin logo */}
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 14,
            background: "#E8574A",
            border: "2.5px solid #2B2420",
            boxShadow: "3px 3px 0 #2B2420",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 6,
            boxSizing: "border-box",
            animation: "dc-domino-spin 1.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#FDF6EC",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              border: "1.5px solid #2B2420",
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                borderBottom: "1.5px solid #E8574A",
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#2B2420" }} />
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#2B2420" }} />
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#2B2420" }} />
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#2B2420" }} />
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#2B2420" }} />
            </div>
          </div>
        </div>

        {/* Text */}
        <div>
          <div
            style={{
              fontFamily: isGoingToAr ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif",
              fontWeight: 800,
              fontSize: 19,
              color: "#2B2420",
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: isGoingToAr ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              color: "#8A7F73",
              marginTop: 4,
            }}
          >
            {sub}
          </div>
        </div>

        {/* Playful progress pill */}
        <div
          style={{
            width: "80%",
            height: 8,
            background: "#F2EDE4",
            borderRadius: 999,
            border: "1.5px solid #2B2420",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "45%",
              background: "#3AA6A6",
              borderRadius: 999,
              animation: "dc-float-badge 1.2s ease-in-out infinite alternate",
            }}
          />
        </div>
      </div>
    </div>
  );
};
