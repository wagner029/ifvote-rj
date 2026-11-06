import React, { useState, useEffect } from 'react';
import {
  listarAdministradores,
  autorizarAdministrador,
  revogarAdministrador,
  SUPER_ADMIN_EMAIL,
} from '../../services/authService';
import type { AdminUser } from '../../services/authService';
import { Users, UserPlus, Trash2, Shield, X, CheckCircle2 } from 'lucide-react';

interface GerenciarAdminsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GerenciarAdminsModal: React.FC<GerenciarAdminsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoPapel, setNovoPapel] = useState<'MESARIO' | 'AUDITOR'>('MESARIO');
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const carregar = async () => {
    setCarregando(true);
    const lista = await listarAdministradores();
    setAdmins(lista);
    setCarregando(false);
  };

  useEffect(() => {
    if (isOpen) {
      carregar();
    }
  }, [isOpen]);

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const res = await autorizarAdministrador(novoEmail, novoNome, novoPapel);
    if (res.ok) {
      setFeedbackMsg({ tipo: 'sucesso', texto: `Administrador ${novoEmail} autorizado com sucesso!` });
      setNovoEmail('');
      setNovoNome('');
      await carregar();
    } else {
      setFeedbackMsg({ tipo: 'erro', texto: res.erro || 'Falha ao autorizar administrador.' });
    }
  };

  const handleRemover = async (email: string) => {
    if (email === SUPER_ADMIN_EMAIL) return;
    const res = await revogarAdministrador(email);
    if (res.ok) {
      setFeedbackMsg({ tipo: 'sucesso', texto: `Acesso de ${email} revogado.` });
      await carregar();
    } else {
      setFeedbackMsg({ tipo: 'erro', texto: res.erro || 'Falha ao remover.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 max-w-lg w-full space-y-5 shadow-2xl text-left font-sans">
        
        {/* Topo do Modal */}
        <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Users className="w-5 h-5 text-[#58a6ff]" />
            <span>Membros da Comissão Eleitoral</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#21262d] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-3 rounded text-xs flex items-center gap-2 ${
              feedbackMsg.tipo === 'sucesso'
                ? 'bg-[#238636]/20 text-[#3fb950] border border-[#238636]'
                : 'bg-[#da3633]/20 text-[#f85149] border border-[#da3633]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.texto}</span>
          </div>
        )}

        {/* Formulário para Conceder Acesso a Nova Conta Google */}
        <form onSubmit={handleAdicionar} className="space-y-3 bg-[#0d1117] p-3.5 rounded-lg border border-[#30363d]">
          <span className="text-xs font-bold text-white block">Autorizar Nova Conta Google</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="email"
              required
              placeholder="email@gmail.com"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              className="text-xs p-2 bg-[#161b22] text-white border border-[#30363d] rounded outline-none"
            />
            <input
              type="text"
              required
              placeholder="Nome do Membro"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="text-xs p-2 bg-[#161b22] text-white border border-[#30363d] rounded outline-none"
            />
            <select
              value={novoPapel}
              onChange={(e) => setNovoPapel(e.target.value as any)}
              className="text-xs p-2 bg-[#161b22] text-white border border-[#30363d] rounded outline-none"
            >
              <option value="MESARIO">Mesário</option>
              <option value="AUDITOR">Auditor</option>
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold rounded cursor-pointer transition-colors shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Adicionar Administrador</span>
          </button>
        </form>

        {/* Lista de Administradores */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#8b949e] uppercase tracking-wider block">
            Administradores Ativos ({admins.length})
          </span>

          <div className="max-h-52 overflow-y-auto space-y-2">
            {admins.map((adm) => {
              const ehSuper = adm.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
              return (
                <div
                  key={adm.email}
                  className="flex items-center justify-between p-2.5 bg-[#0d1117] border border-[#30363d] rounded text-xs"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{adm.nome}</span>
                      {ehSuper && (
                        <span className="text-[10px] bg-[#1f6feb]/20 text-[#58a6ff] px-1.5 py-0.5 rounded font-mono border border-[#1f6feb]/30">
                          Super Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8b949e] font-mono">{adm.email}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 bg-[#21262d] px-2 py-0.5 rounded">
                      {adm.papel}
                    </span>
                    {!ehSuper && (
                      <button
                        type="button"
                        onClick={() => handleRemover(adm.email)}
                        className="p-1 text-[#8b949e] hover:text-[#f85149] hover:bg-[#21262d] rounded cursor-pointer transition-colors"
                        title="Remover autorização"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 text-right border-t border-[#30363d]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-bold rounded cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
