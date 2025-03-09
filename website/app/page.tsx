"use client";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { useState, useEffect } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const subscribedEmail = localStorage.getItem("arcticai-subscribed");
    if (subscribedEmail) {
      setIsSubscribed(true);
      setEmail(subscribedEmail);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email && isValidEmail(email)) {
      localStorage.setItem("arcticai-subscribed", email);
      setIsSubscribed(true);
    }
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center space-y-16">
          <header className="space-y-8">
            <h1 className="text-4xl md:text-5xl font-extralight tracking-wider text-white">
              Arctic AI
            </h1>
            <div className="space-y-4">
              <p className="text-lg font-light text-slate-300">Coming Soon</p>
              <p className="text-sm text-slate-500">Multi-agent AI framework</p>
            </div>
          </header>

          {isSubscribed ? (
            <div className="py-8">
              <p className="text-sm text-slate-400">
                Thank you for your interest.
                <br />
                We&apos;ll notify you when we launch.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-12">
              <div>
                <input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-b border-slate-800 rounded-none py-2 px-0 text-center text-white placeholder-slate-600 focus:border-slate-600 focus:ring-0"
                  required
                />
              </div>
              <div>
                <Button type="submit" variant="link">
                  Notify Me
                </Button>
              </div>
            </form>
          )}

          <footer className="space-y-4">
            <a
              href="https://github.com/Sma1lboy/ArcticAI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Github size={18} className="mr-2" />
              <span className="text-sm">GitHub</span>
            </a>
            <p className="text-xs text-slate-600">© 2025 Arctic AI</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
