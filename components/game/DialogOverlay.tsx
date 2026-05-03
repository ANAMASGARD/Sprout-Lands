"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { gameBus } from "@/lib/game/eventBus";

type Dialog = { speaker: string; lines: string[] };

type TypingHandle = { skip: () => void };

export default function DialogOverlay() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [done, setDone] = useState(false);
  const typingRef = useRef<TypingHandle | null>(null);

  useEffect(() => {
    const off = gameBus.on("dialog:show", (payload) => {
      setDialog(payload);
      setLineIndex(0);
      setDone(false);
    });
    return () => off();
  }, []);

  const handleDone = useCallback(() => setDone(true), []);

  const advance = useCallback(() => {
    if (!dialog) return;
    if (!done) {
      typingRef.current?.skip();
      return;
    }
    if (lineIndex < dialog.lines.length - 1) {
      setLineIndex(lineIndex + 1);
      setDone(false);
    } else {
      setDialog(null);
    }
  }, [dialog, lineIndex, done]);

  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  useEffect(() => {
    function handler(ev: KeyboardEvent) {
      if (ev.code === "Space" || ev.code === "Enter" || ev.code === "KeyE") {
        advanceRef.current();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!dialog) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-4">
      <button
        type="button"
        onClick={() => advance()}
        className="pointer-events-auto pixel-panel relative flex w-full max-w-2xl flex-col gap-2 px-5 py-4 text-left font-pixel text-[#4a3528]"
      >
        <div className="absolute -top-3 left-4 bg-[#9c7c54] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#fbeec1]">
          {dialog.speaker}
        </div>
        <p className="min-h-[3rem] whitespace-pre-wrap text-sm leading-relaxed">
          <TypingLine
            ref={typingRef}
            key={`${dialog.speaker}-${lineIndex}`}
            text={dialog.lines[lineIndex] ?? ""}
            onDone={handleDone}
          />
        </p>
        <div className="flex justify-end text-[10px] uppercase tracking-wider">
          {lineIndex < dialog.lines.length - 1
            ? "▶ space / e for next"
            : "▶ space / e to close"}
        </div>
      </button>
    </div>
  );
}

const TypingLine = forwardRef<
  TypingHandle,
  { text: string; onDone: () => void }
>(function TypingLine({ text, onDone }, ref) {
  const [typed, setTyped] = useState("");
  const indexRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    indexRef.current = 0;
    doneRef.current = false;
    const id = window.setInterval(() => {
      indexRef.current += 1;
      setTyped(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        window.clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }
    }, 22);
    return () => window.clearInterval(id);
  }, [text, onDone]);

  useImperativeHandle(
    ref,
    () => ({
      skip: () => {
        indexRef.current = text.length;
        setTyped(text);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      },
    }),
    [text, onDone],
  );

  return (
    <>
      {typed}
      {typed.length < text.length && (
        <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-[#4a3528]" />
      )}
    </>
  );
});
