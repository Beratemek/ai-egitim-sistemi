"use client";

import { useEffect, useState } from "react";

const WORDS = ["görünür", "ölçülebilir", "izlenebilir"] as const;
const HOLD_TIME = 1350;
const DELETE_TIME = 52;
const TYPE_TIME = 78;
const WORD_GAP = 180;

type TypewriterPhase = "holding" | "deleting" | "waiting" | "typing";

export function LandingRotatingMotto() {
  const [displayedWord, setDisplayedWord] = useState<string>(WORDS[0]);
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<TypewriterPhase>("holding");

  useEffect(() => {
    const targetWord = WORDS[wordIndex] ?? WORDS[0];
    let delay = TYPE_TIME;

    if (phase === "holding") delay = HOLD_TIME;
    if (phase === "deleting") delay = DELETE_TIME;
    if (phase === "waiting") delay = WORD_GAP;

    const timer = window.setTimeout(() => {
      if (phase === "holding") {
        setPhase("deleting");
        return;
      }

      if (phase === "deleting") {
        if (displayedWord.length > 0) {
          setDisplayedWord((word) => word.slice(0, -1));
          return;
        }

        setWordIndex((index) => (index + 1) % WORDS.length);
        setPhase("waiting");
        return;
      }

      if (phase === "waiting") {
        setPhase("typing");
        return;
      }

      if (displayedWord.length < targetWord.length) {
        setDisplayedWord(targetWord.slice(0, displayedWord.length + 1));
        return;
      }

      setPhase("holding");
    }, delay);

    return () => window.clearTimeout(timer);
  }, [displayedWord, phase, wordIndex]);

  return (
    <span className="landing-motto-line">
      <span aria-hidden="true" className="landing-motto-word" data-motto-word={displayedWord}>
        <span className="landing-motto-typed">
          {displayedWord}
          <span className="landing-motto-caret" />
        </span>
      </span>
      <span aria-hidden="true" className="landing-motto-suffix">kıl.</span>
      <span className="sr-only">görünür, ölçülebilir ve izlenebilir kıl.</span>
    </span>
  );
}
