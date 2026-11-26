"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";

export function TicketQr({
  value,
  size = 200,
}: {
  value: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;

    if (!canvas || !value) return;

    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then(() => {
        if (!cancelled) setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!value || failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-2xl bg-gray-100 text-gray-400"
      >
        <QrCode className="h-10 w-10" />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      role="img"
      aria-label="Ticket QR code"
      className="rounded-2xl"
    />
  );
}
