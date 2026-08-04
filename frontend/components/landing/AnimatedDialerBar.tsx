"use client";

import { useState, useEffect } from "react";
import { Phone } from "lucide-react";

const dialSequences = [
  { name: "Sarah Chen", company: "Acme Corp" },
  { name: "Mike Johnson", company: "TechStart" },
  { name: "Lisa Park", company: "GrowthCo" },
  { name: "David Kim", company: "ScaleUp" },
  { name: "Jennifer Wu", company: "NextGen" },
  { name: "James Miller", company: "CloudBase" },
];

export default function AnimatedDialerBar() {
  const [currentContact, setCurrentContact] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const contact = dialSequences[currentContact];
    const fullText = `Calling ${contact.name} at ${contact.company}...`;
    let charIndex = 0;
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      // Typing effect
      const typeChar = () => {
        if (charIndex <= fullText.length) {
          setDisplayText(fullText.slice(0, charIndex));
          charIndex++;
          timeout = setTimeout(typeChar, 35 + Math.random() * 15);
        } else {
          // Show connecting state briefly
          setIsConnecting(true);
          timeout = setTimeout(() => {
            setIsConnecting(false);
            setIsTyping(false);
          }, 1500);
        }
      };
      typeChar();
    } else {
      // Pause then move to next contact
      timeout = setTimeout(() => {
        setDisplayText("");
        setCurrentContact((prev) => (prev + 1) % dialSequences.length);
        setIsTyping(true);
      }, 500);
    }

    return () => clearTimeout(timeout);
  }, [currentContact, isTyping]);

  return (
    <div className="max-w-xl mx-auto">
      <div className="relative group">
        {/* Main dialer bar */}
        <div className={`w-full px-6 py-5 pr-20 bg-[#111111] border rounded-2xl shadow-lg shadow-black/20 transition-all duration-300 ${
          isConnecting ? "border-green-500/50 shadow-green-500/10" : "border-white/10"
        }`}>
          <div className="flex items-center gap-2 min-h-[28px]">
            <span className="text-base text-white/90">{displayText}</span>
            {/* Blinking cursor */}
            {isTyping && !isConnecting && (
              <span className="w-0.5 h-6 bg-blue-500 animate-pulse" />
            )}
            {/* Connecting indicator */}
            {isConnecting && (
              <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium ml-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Connected
              </span>
            )}
          </div>
        </div>

        {/* Dial button */}
        <button className={`absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isConnecting
            ? "bg-green-500 text-white scale-110"
            : "bg-white text-black hover:bg-white/90 hover:scale-105"
        }`}>
          <Phone className={`w-5 h-5 ${isConnecting ? "animate-pulse" : ""}`} />
        </button>

        {/* Subtle glow effect when connecting */}
        {isConnecting && (
          <div className="absolute inset-0 rounded-2xl bg-green-500/5 pointer-events-none" />
        )}
      </div>

      {/* Contact preview cards below */}
      <div className="flex justify-center gap-2 mt-4 opacity-50">
        {dialSequences.slice(0, 4).map((contact, i) => (
          <div
            key={i}
            className={`px-3 py-1.5 rounded-full text-xs transition-all duration-300 ${
              i === currentContact
                ? "bg-white/10 text-white"
                : "bg-white/5 text-white/40"
            }`}
          >
            {contact.name.split(" ")[0]}
          </div>
        ))}
        <div className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-white/40">
          +{dialSequences.length - 4} more
        </div>
      </div>
    </div>
  );
}
