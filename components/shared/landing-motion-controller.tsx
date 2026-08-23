"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = "[data-landing-reveal]";

export function LandingMotionController() {
  useEffect(() => {
    const root = document.documentElement;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
    let frame = 0;

    const isVisible = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0;
    };

    const revealVisibleElements = () => {
      frame = 0;
      elements.forEach((element) => {
        if (element.dataset.landingVisible !== "true" && isVisible(element)) {
          element.dataset.landingVisible = "true";
        }
      });
    };

    const requestRevealCheck = () => {
      if (!frame) frame = window.requestAnimationFrame(revealVisibleElements);
    };

    revealVisibleElements();
    root.dataset.landingRevealReady = "true";

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.dataset.landingVisible = "true";
      });
      return () => {
        window.cancelAnimationFrame(frame);
        delete root.dataset.landingRevealReady;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          element.dataset.landingVisible = "true";
          observer.unobserve(element);
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 },
    );

    elements.forEach((element) => {
      if (element.dataset.landingVisible !== "true") observer.observe(element);
    });

    window.addEventListener("scroll", requestRevealCheck, { passive: true });
    window.addEventListener("resize", requestRevealCheck);
    window.addEventListener("hashchange", requestRevealCheck);
    const delayedCheck = window.setTimeout(revealVisibleElements, 240);

    return () => {
      observer.disconnect();
      window.clearTimeout(delayedCheck);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestRevealCheck);
      window.removeEventListener("resize", requestRevealCheck);
      window.removeEventListener("hashchange", requestRevealCheck);
      delete root.dataset.landingRevealReady;
    };
  }, []);

  return null;
}
