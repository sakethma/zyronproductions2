import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (data: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode('qr-reader');
    let isMounted = true;
    let isStarting = true;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15, // 15 fps gives better frame stability and less CPU-bound motion blur
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              // Dynamically adjust the scanning box based on view container size to prevent crashes on smaller viewports
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const boxSize = Math.floor(minEdge * 0.75);
              return { width: boxSize, height: boxSize };
            },
            aspectRatio: 1.0,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true, // Speeds up scanning dramatically on modern browsers
            },
          } as any,
          (decodedText) => {
            if (isMounted) {
              onScanRef.current(decodedText);
            }
          },
          () => {
            // silent failure on individual frames that don't have a QR code
          }
        );
        isStarting = false;
      } catch (err: any) {
        console.error('Failed to start scanner:', err);
        isStarting = false;
        if (isMounted) {
          setError('Could not start camera. Please ensure you have granted camera permissions.');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      const stopScanner = async () => {
        // Wait briefly if still starting to avoid race conditions with fast mount/unmount
        if (isStarting) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        if (html5QrCode.isScanning) {
          try {
            await html5QrCode.stop();
          } catch (e) {
            console.warn('Error stopping html5QrCode:', e);
          }
        }
      };
      stopScanner();
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-black flex flex-col items-center justify-center min-h-[300px]">
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black text-white p-4 text-center text-sm font-mono">
          {error}
        </div>
      )}
      <div id="qr-reader" ref={scannerRef} className="w-full h-full min-h-[300px]"></div>
    </div>
  );
}
