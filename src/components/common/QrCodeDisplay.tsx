import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode as QrIcon, X, ShieldAlert } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  network: string;
  assetName: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  address,
  network,
  assetName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current && address) {
      QRCode.toCanvas(canvasRef.current, address, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).catch((err) => {
        console.error('[QRCode] Failed to generate canvas:', err);
      });
    }
  }, [isOpen, address]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 mb-2">
            <QrIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Deposit QR Code</h3>
          <p className="text-xs text-slate-400">
            Scan with Trust Wallet, Binance, MetaMask, or any Web3 wallet
          </p>
        </div>

        {/* QR Canvas Box */}
        <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center shadow-inner mx-auto max-w-[260px]">
          <canvas ref={canvasRef} className="rounded-lg max-w-full" />
          <div className="text-[11px] font-mono font-semibold text-slate-800 mt-2 text-center break-all px-2">
            {address}
          </div>
        </div>

        {/* Network and Asset Badge */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-1 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span>Asset:</span>
            <span className="font-semibold text-white">{assetName}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Network:</span>
            <span className="font-semibold text-emerald-400">{network}</span>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-300 text-[11px] flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Send only BEP-20 tokens via <strong>BNB Smart Chain</strong> to this receiving address.
          </span>
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-98"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-slate-950" />
              <span>Address Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Receiving Address</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
