import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ModalType = 'error' | 'warning' | 'info' | 'success' | 'confirm';

export interface ModalConfig {
  isOpen: boolean;
  type?: ModalType;
  title: string;
  message: string;
  detalhe?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose?: () => void;
}

interface ErrorModalProps {
  config: ModalConfig | null;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ config, onClose }) => {
  if (!config || !config.isOpen) return null;

  const type = config.type || 'error';

  const getTheme = () => {
    switch (type) {
      case 'error':
        return {
          icon: <AlertCircle className="w-8 h-8 text-[#f85149]" />,
          iconBg: 'bg-[#da3633]/20 border border-[#da3633]/40',
          titleColor: 'text-[#f85149]',
          btnColor: 'bg-[#da3633] hover:bg-[#b62324] text-white',
        };
      case 'warning':
      case 'confirm':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-[#e3b341]" />,
          iconBg: 'bg-[#e3b341]/20 border border-[#e3b341]/40',
          titleColor: 'text-[#e3b341]',
          btnColor: 'bg-[#e3b341] hover:bg-[#d29922] text-black font-bold',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-[#3fb950]" />,
          iconBg: 'bg-[#238636]/20 border border-[#238636]/40',
          titleColor: 'text-[#3fb950]',
          btnColor: 'bg-[#238636] hover:bg-[#2ea043] text-white',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-8 h-8 text-[#58a6ff]" />,
          iconBg: 'bg-[#388bfd]/20 border border-[#388bfd]/40',
          titleColor: 'text-[#58a6ff]',
          btnColor: 'bg-[#1f6feb] hover:bg-[#388bfd] text-white',
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left font-sans">
        
        {/* Header com Ícone e Fechar */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${theme.iconBg} shrink-0`}>
              {theme.icon}
            </div>
            <div>
              <h3 id="modal-title" className={`text-base font-bold ${theme.titleColor}`}>
                {config.title}
              </h3>
              <span className="text-[10px] text-[#8b949e] uppercase font-mono tracking-wider">
                Sistema IFVote RJ
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (config.onClose) config.onClose();
              onClose();
            }}
            className="text-[#8b949e] hover:text-white p-1 rounded hover:bg-[#21262d] cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem principal */}
        <div className="text-sm text-[#c9d1d9] leading-relaxed whitespace-pre-wrap">
          {config.message}
        </div>

        {/* Detalhe adicional se houver */}
        {config.detalhe && (
          <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-md text-xs font-mono text-[#8b949e] break-all">
            {config.detalhe}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
          {type === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (config.onClose) config.onClose();
                  onClose();
                }}
                className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs font-semibold rounded cursor-pointer transition-colors"
              >
                {config.cancelLabel || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (config.onConfirm) config.onConfirm();
                  onClose();
                }}
                className={`px-4 py-2 text-xs font-bold rounded cursor-pointer transition-colors ${theme.btnColor}`}
              >
                {config.confirmLabel || 'Confirmar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (config.onClose) config.onClose();
                onClose();
              }}
              className={`px-5 py-2 text-xs font-bold rounded cursor-pointer transition-colors ${theme.btnColor}`}
            >
              {config.confirmLabel || 'OK, Entendido'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
