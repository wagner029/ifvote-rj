import React, { useState } from 'react';
import { loginComGoogle, logout, SUPER_ADMIN_EMAIL } from '../../services/authService';
import type { AuthState } from '../../services/authService';
import { ShieldCheck, ShieldAlert, ArrowLeft, LogOut, CheckCircle2 } from 'lucide-react';

interface AdminLoginViewProps {
  authState: AuthState;
  onVoltar: () => void;
  onSucesso: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  authState,
  onVoltar,
  onSucesso,
}) => {
  const [tentandoLogin, setTentandoLogin] = useState(false);
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  const handleLogin = async () => {
    setTentandoLogin(true);
    setErroLogin(null);
    const res = await loginComGoogle();
    setTentandoLogin(false);

    if (res.ok) {
      onSucesso();
    } else {
      setErroLogin(res.erro || 'Falha na autenticação.');
    }
  };

  const handleTrocarConta = async () => {
    await logout();
    setErroLogin(null);
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col justify-center items-center p-4 font-sans relative">
      
      {/* Botão de retorno */}
      <div className="absolute top-6 left-6">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#161b22] hover:bg-[#21262d] text-slate-300 rounded-md font-bold text-xs transition-colors cursor-pointer border border-[#30363d]"
        >
          <ArrowLeft className="w-4 h-4 text-[#58a6ff]" />
          <span>Voltar ao Portal Principal</span>
        </button>
      </div>

      {/* Caixa Central de Autenticação */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
        
        {/* Ícone Institucional */}
        <div className="w-16 h-16 rounded-full bg-[#1f6feb]/20 border border-[#1f6feb]/40 flex items-center justify-center mx-auto text-[#58a6ff]">
          <ShieldCheck className="w-9 h-9" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-white mb-1">
            IFVote — Comissão Eleitoral
          </h1>
          <p className="text-xs text-[#8b949e] leading-relaxed">
            Área de acesso restrito e autenticado. Exclusiva para membros credenciados da comissão eleitoral, mesários e auditores do pleito.
          </p>
        </div>

        {/* Mensagem de Erro de Acesso / Conta Não Autorizada */}
        {(erroLogin || authState.erroAuth) && (
          <div className="p-4 bg-[#1c1214] border border-[#da3633]/60 rounded-lg text-left text-xs space-y-2">
            <div className="flex items-center gap-2 text-[#f85149] font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Acesso Não Autorizado</span>
            </div>
            <p className="text-[#c9d1d9] leading-relaxed">
              {erroLogin || authState.erroAuth}
            </p>
            {authState.user && (
              <div className="pt-2 border-t border-[#da3633]/30 flex justify-between items-center text-[11px]">
                <span className="text-[#8b949e] truncate max-w-[200px]">
                  Conectado como: {authState.user.email}
                </span>
                <button
                  type="button"
                  onClick={handleTrocarConta}
                  className="inline-flex items-center gap-1 text-[#58a6ff] hover:underline font-bold cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Trocar Conta</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Usuário já autenticado e aguardando permissão */}
        {authState.user && authState.isAdmin ? (
          <div className="space-y-4">
            <div className="p-4 bg-[#0e1d14] border border-[#238636]/60 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-[#3fb950] font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Autenticado com Sucesso</span>
              </div>
              <div className="text-white font-medium">{authState.user.displayName || authState.user.email}</div>
              <div className="text-[11px] text-[#8b949e]">Papel: {authState.papel}</div>
            </div>

            <button
              type="button"
              onClick={onSucesso}
              className="w-full py-3 px-4 bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-sm rounded-lg shadow-lg cursor-pointer transition-all"
            >
              Acessar Painel da Comissão
            </button>
          </div>
        ) : (
          /* Botão de Login com Google OAuth */
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleLogin}
              disabled={tentandoLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-lg shadow-lg cursor-pointer transition-all disabled:opacity-50"
            >
              {tentandoLogin ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Entrar com Conta Google</span>
                </>
              )}
            </button>

            <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-md text-[11px] text-[#8b949e]">
              Administrador Titular autorizado: <strong className="text-white">{SUPER_ADMIN_EMAIL}</strong>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
