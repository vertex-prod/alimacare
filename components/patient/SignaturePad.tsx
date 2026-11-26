"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Eraser, PenLine } from "lucide-react";

export interface SignaturePadHandle {
  clear: () => void;
  toDataURL: () => string | null;
  isEmpty: () => boolean;
}

export const SignaturePad = forwardRef<SignaturePadHandle>(
  function SignaturePad(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const hasInkRef = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    const prepareContext = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return null;

      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";

      return ctx;
    }, []);

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const nextWidth = Math.round(rect.width * ratio);
      const nextHeight = Math.round(rect.height * ratio);

      if (canvas.width === nextWidth && canvas.height === nextHeight) return;

      const snapshot = hasInkRef.current
        ? canvas.toDataURL("image/png")
        : null;

      canvas.width = nextWidth;
      canvas.height = nextHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";

      if (snapshot) {
        const image = new Image();
        image.onload = () => {
          ctx.drawImage(image, 0, 0, rect.width, rect.height);
        };
        image.src = snapshot;
      }
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      resize();

      const observer = new ResizeObserver(resize);
      observer.observe(canvas);

      return () => observer.disconnect();
    }, [resize]);

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      hasInkRef.current = false;
      setHasInk(false);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        clear,
        toDataURL: () => {
          const canvas = canvasRef.current;
          if (!canvas || !hasInkRef.current) return null;
          return canvas.toDataURL("image/png");
        },
        isEmpty: () => !hasInkRef.current,
      }),
      [clear]
    );

    const markInk = () => {
      if (hasInkRef.current) return;
      hasInkRef.current = true;
      setHasInk(true);
    };

    const startStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const ctx = prepareContext();
      if (!canvas || !ctx) return;

      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      drawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y);
      ctx.stroke();
      markInk();
    };

    const continueStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;

      const canvas = canvasRef.current;
      const ctx = prepareContext();
      if (!canvas || !ctx) return;

      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
      ctx.stroke();
      markInk();
    };

    const endStroke = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
    };

    return (
      <div>
        <div className="relative overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Signature pad"
            className="h-40 w-full touch-none"
            onPointerDown={startStroke}
            onPointerMove={continueStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />

          {!hasInk && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400">
              <PenLine className="h-5 w-5" />
              <span className="text-xs">Sign inside this box</span>
            </div>
          )}

          {hasInk && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-gray-500 shadow-sm ring-1 ring-gray-200 transition hover:text-gray-800"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          Use your finger, stylus, or mouse.
        </p>
      </div>
    );
  }
);
