"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { User, KeyRound, Utensils, ArrowLeft, ShieldCheck, Share, PlusSquare, X, ShoppingCart } from "lucide-react";
import styles from "./page.module.css";

type LoginView = "roles" | "rider" | "kitchen" | "guest";

export default function LoginPage() {
  const [view, setView] = useState<LoginView>("roles");

  // Student/Kitchen login fields
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  // Guest login fields
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [tableName, setTableName] = useState("");
  const [numGuests, setNumGuests] = useState("1");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, guestLogin } = useAuth();

  const [hasCheckoutIntent, setHasCheckoutIntent] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setHasCheckoutIntent(!!localStorage.getItem('checkout_intent'));
  }, []);

  useEffect(() => {
    const isDismissed = localStorage.getItem("pwaPromptDismissed");
    const checkMobile = () => window.innerWidth <= 768;

    // Detect iOS and standalone mode (if it is already installed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

    // Show popup for iOS since it doesn't trigger 'beforeinstallprompt'
    if (isIOS && !isStandalone && checkMobile() && !isDismissed) {
      setShowInstallPrompt(true);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (checkMobile() && !isDismissed) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Browser doesn't support programmatic install (like iOS) or conditions aren't met
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        setShowIosInstructions(true);
      }
      setShowInstallPrompt(false);
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("pwaPromptDismissed", "true");
  };

  const handleRoleSelect = (role: LoginView) => {
    setView(role);
    setError("");
    // Reset fields
    setPhone("");
    setPin("");
    setGuestName("");
    setGuestPhone("");
    setTableName("");
    setNumGuests("1");
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login({
        phone,
        pin,
      });

      if (result.success) {
        const intent = localStorage.getItem('checkout_intent');
        if (intent) {
          localStorage.removeItem('checkout_intent');
          window.location.href = '/cart';
        } else {
          window.location.href = '/home';
        }
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKitchenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login({
        phone,
        pin,
      });

      if (result.success) {
        // User role will be KITCHEN or ADMIN, redirect appropriately
        const intent = localStorage.getItem('checkout_intent');
        if (intent) {
          localStorage.removeItem('checkout_intent');
          window.location.href = '/cart';
        } else {
          window.location.href = '/kitchen';
        }
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await guestLogin({
        name: guestName.trim(),
        phone: guestPhone,
        table_name: tableName.trim() || "Walk-in",
        num_guests: parseInt(numGuests),
      });

      if (result.success) {
        const intent = localStorage.getItem('checkout_intent');
        if (intent) {
          localStorage.removeItem('checkout_intent');
          window.location.href = '/cart';
        } else {
          window.location.href = '/home';
        }
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setView("roles");
    setError("");
  };

  return (
    <main className={styles.main}>
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={styles.bgVideo}
        style={{ backgroundColor: '#000' }}
      >
        <source src="/horse-cavalli.mp4" type="video/mp4" />
      </video>
      <div className={styles.overlay} />

      <div className={styles.contentWrapper}>
        {view === "roles" && (
          <div className={`${styles.container} animate-reveal`}>
            <header className={styles.header}>
              <span className={styles.overline}>Dal 1994</span>
              <h1 className={styles.brandTitle}>Ai Cavalli</h1>
              <p className={styles.brandSubtitle}>
                Exclusive Dining & Operations
              </p>
            </header>

            <div className={styles.roleGrid}>
              <button
                className={styles.premiumCard}
                onClick={() => handleRoleSelect("guest")}
              >
                <div className={styles.iconCircle}>
                  <Utensils size={24} />
                </div>
                <div className={styles.cardText}>
                  <h3>Guest Check-in</h3>
                  <p>Start your dining experience</p>
                </div>
              </button>

              <button
                className={styles.premiumCard}
                onClick={() => handleRoleSelect("rider")}
              >
                <div className={styles.iconCircle}>
                  <User size={24} />
                </div>
                <div className={styles.cardText}>
                  <h3>Rider Portal</h3>
                  <p>Access delivery & operations</p>
                </div>
              </button>
            </div>

            {hasCheckoutIntent && (
              <button
                className={styles.backToCartBtn}
                onClick={() => {
                  localStorage.removeItem('checkout_intent');
                  window.location.href = '/cart';
                }}
              >
                <ShoppingCart size={18} />
                <span>Back to Cart</span>
              </button>
            )}

            <footer className={styles.selectFooter}>
              <div className={styles.divider}>
                <span className={styles.dividerLine}></span>
                <span className={styles.dividerText}>Staff Access</span>
                <span className={styles.dividerLine}></span>
              </div>

              <button
                className={styles.staffProceedButton}
                onClick={() => handleRoleSelect("kitchen")}
              >
                <div className={styles.staffButtonContent}>
                  <ShieldCheck size={20} className={styles.staffIcon} />
                  <div className={styles.staffButtonText}>
                    <span>Kitchen & Staff Portal</span>
                    <small>Management Access Only</small>
                  </div>
                </div>
              </button>
            </footer>
          </div>
        )}

        {(view === "rider" || view === "kitchen") && (
          <div className={`${styles.authCard} animate-slide-up`}>
            <div className={styles.cardHeader}>
              <button onClick={handleBack} className={styles.backArrow}>
                <ArrowLeft size={20} />
              </button>
              <h2 className={styles.cardTitle}>
                {view === "kitchen" ? "Staff Login" : "Rider Login"}
              </h2>
              <p className={styles.cardSubtitle}>Enter your PIN credentials</p>
            </div>

            <form
              className={styles.premiumForm}
              onSubmit={
                view === "kitchen" ? handleKitchenLogin : handleStudentLogin
              }
            >
              <div className={styles.inputGroup}>
                <label>PHONE NUMBER</label>
                <input
                  type="tel"
                  placeholder="0123456789"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  required
                  autoFocus
                />
              </div>
              <div className={styles.inputGroup}>
                <label>ACCESS PIN</label>
                <input
                  type="password"
                  placeholder="000000"
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  maxLength={6}
                />
              </div>

              {error && <div className={styles.errorBanner}>{error}</div>}

              <Button
                type="submit"
                className={styles.actionButton}
                isLoading={loading}
                disabled={phone.length < 10 || pin.length < 6}
              >
                <KeyRound size={18} style={{ marginRight: "8px" }} />
                LOGIN
              </Button>
            </form>
          </div>
        )}

        {view === "guest" && (
          <div className={`${styles.authCard} animate-slide-up`}>
            <div className={styles.cardHeader}>
              <button onClick={handleBack} className={styles.backArrow}>
                <ArrowLeft size={20} />
              </button>
              <h2 className={styles.cardTitle}>Guest Check-in</h2>
              <p className={styles.cardSubtitle}>
                Enter your details to start dining
              </p>
            </div>

            <form className={styles.premiumForm} onSubmit={handleGuestLogin}>
              <div className={styles.inputGroup}>
                <label>YOUR NAME</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={guestName}
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/[^A-Za-z\s]/g, "") // allow letters + spaces only
                      .slice(0, 20);
                    setGuestName(value);
                  }}
                  maxLength={20}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.inputGroup}>
                <label>PHONE NUMBER</label>
                <input
                  type="tel"
                  placeholder="0123456789"
                  value={guestPhone}
                  onChange={(e) =>
                    setGuestPhone(
                      e.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label>GUESTS</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={numGuests}
                  onChange={(e) => setNumGuests(e.target.value)}
                  required
                />
              </div>

              {error && <div className={styles.errorBanner}>{error}</div>}

              <Button
                type="submit"
                className={styles.actionButton}
                isLoading={loading}
                disabled={!guestName.trim() || guestPhone.length < 10}
              >
                <Utensils size={18} style={{ marginRight: "8px" }} />
                START DINING
              </Button>
            </form>
          </div>
        )}
      </div>
      <div className={styles.loginFooter}>
        Powered by LookAround
      </div>

      {showInstallPrompt && (
        <div className={styles.installPopup}>
          <h3 className={styles.installTitle}>Install WebApp</h3>
          <div className={styles.installActions}>
            <button className={styles.installBtn} onClick={handleInstallClick}>
              Add to Home Screen
            </button>
            <button className={styles.dismissBtn} onClick={handleDismissInstall}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showIosInstructions && (
        <div className={styles.installPopup}>
          <div className={styles.iosInstructionHeader}>
            <h3 className={styles.installTitle}>Install on iOS</h3>
            <button className={styles.closeBtn} onClick={() => setShowIosInstructions(false)}>
              <X size={20} />
            </button>
          </div>
          <div className={styles.iosSteps}>
            <p>
              1. Tap the <Share size={16} className={styles.inlineIcon} /> <strong>Share</strong> button.
            </p>
            <p>
              2. Tap <strong>Add to Home Screen</strong> <PlusSquare size={16} className={styles.inlineIcon} />.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
