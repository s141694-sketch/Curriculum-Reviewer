"use client";

import { useEffect, useRef, useState } from "react";
import { CompassNeedle } from "./HarakLogo";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The hero compass: on load the needle swings and settles on north, then it
 * follows the pointer around the page and drifts back to north when the
 * pointer leaves. Static when the visitor prefers reduced motion.
 */
export function HeroCompass() {
  const dialRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const [angle, setAngle] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (reducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled(true);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 1700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!settled || reducedMotion()) return;

    function turnTo(target: number) {
      // take the short way round so the needle never whips a full turn
      let delta = ((target - angleRef.current + 540) % 360) - 180;
      if (Math.abs(delta) < 0.5) delta = 0;
      angleRef.current += delta;
      setAngle(angleRef.current);
    }

    function onMove(e: PointerEvent) {
      const dial = dialRef.current;
      if (!dial) return;
      const r = dial.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      turnTo((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    }
    function onLeave() {
      turnTo(0);
    }

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [settled]);

  return (
    <div
      ref={dialRef}
      className="relative hidden size-80 shrink-0 place-items-center md:grid lg:size-96"
      aria-hidden="true"
    >
      <svg viewBox="-230 -230 460 460" className="absolute inset-0 size-full">
        <circle r="222" fill="#FFFFFF" stroke="#E3D9C4" strokeWidth="2" />
        <circle r="196" fill="none" stroke="#1B1F4B" strokeOpacity="0.15" strokeDasharray="2 9" />
        <circle r="150" fill="none" stroke="#D4AD6A" strokeWidth="2" />
        <line x1="0" y1="-222" x2="0" y2="-200" stroke="#1B1F4B" strokeWidth="3" />
        <line x1="0" y1="200" x2="0" y2="222" stroke="#1B1F4B" strokeWidth="3" />
        <line x1="-222" y1="0" x2="-200" y2="0" stroke="#1B1F4B" strokeWidth="3" />
        <line x1="200" y1="0" x2="222" y2="0" stroke="#1B1F4B" strokeWidth="3" />
      </svg>
      <div
        className={settled ? "relative transition-transform duration-700 ease-out" : "relative harak-seek"}
        style={settled ? { transform: `rotate(${angle}deg)` } : undefined}
      >
        <CompassNeedle height={260} className="drop-shadow-[0_6px_10px_rgba(27,31,75,0.18)]" />
      </div>
    </div>
  );
}
