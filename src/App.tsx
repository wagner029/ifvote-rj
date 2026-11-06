import React, { useState, useEffect } from 'react';
import {
  inicializarIFVote,
  subscribeEstadoEleicao,
  subscribeEleitores,
  subscribeVotos,
  subscribeUrnasRemotas,
  registrarConexaoUrnaRemota,
} from './services/electionService';
import type { EstadoEleicao, Eleitor, VotoRegistrado, UrnaRemota } from './services/electionService';
import { subscribeAuth, SUPER_ADMIN_EMAIL } from './services/authService';
import type { AuthState } from './services/authService';
import { detectarLocalizacaoAutomatica } from './services/locationService';

import { IndexView } from './components/IndexView';
import { UrnaView } from './components/UrnaView';
import { PainelView } from './components/PainelView';
import { MasterView } from './components/MasterView';
import { AdminLoginView } from './components/auth/AdminLoginView';
import { ShieldAlert } from 'lucide-react';

type ViewMode = 'INDEX' | 'URNA' | 'PAINEL' | 'MASTER' | 'ADMIN_LOGIN';

export default function App() {
  const [view, setView] = useState<ViewMode>('INDEX');
  const [targetAfterAuth, setTargetAfterAuth] = useState<'PAINEL' | 'MASTER'>('PAINEL');
  const [carregando, setCarregando] = useState(true);

  // Autenticação administrativa com Firebase Auth & Google OAuth
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    papel: null,
    pleitoDesignado: null,
    carregando: true,
    erroAuth: null,
  });

  const [estadoEleicao, setEstadoEleicao] = useState<EstadoEleicao>({
    eleicaoAtiva: true,
    tempoEncerramento: null,
    hashAnterior: '0000000000000000000000000000000000000000000000000000000000000000',
    titulo: 'IFVote RJ',
    totalEleitores: 0,
    totalVotos: 0,
  });

  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [votos, setVotos] = useState<VotoRegistrado[]>([]);
  const [urnasRemotas, setUrnasRemotas] = useState<UrnaRemota[]>([]);

  // Estado específico para quando o app é aberto como Terminal Remoto de Votação
  const [isModoRemoto, setIsModoRemoto] = useState(false);
  const [urnaRemotaAtiva, setUrnaRemotaAtiva] = useState<UrnaRemota | null>(null);
  const [erroTerminalRemoto, setErroTerminalRemoto] = useState<string | null>(null);

  // ATIVAÇÃO POR COMANDO GLOBAL: Ctrl + M (ou Cmd + M)
  // Abre o Controle Geral exclusivamente para o administrador principal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();

        // Se usuário já estiver logado
        if (authState.user) {
          if (authState.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
            setView('MASTER');
          } else {
            console.warn('Acesso ao Controle Geral restrito ao Administrador Principal.');
          }
        } else {
          setTargetAfterAuth('MASTER');
          setView('ADMIN_LOGIN');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authState]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    async function init() {
      try {
        await inicializarIFVote();

        const urlParams = new URLSearchParams(window.location.search);
        const urnaParam = urlParams.get('urna');
        const adminParam = urlParams.get('admin');

        // 1. Verifica se foi acessado com parâmetro de Urna Remota (?urna=...)
        if (urnaParam) {
          setIsModoRemoto(true);
          // Detecta automaticamente a localização da urna/sessão em tempo real
          const loc = await detectarLocalizacaoAutomatica();
          const registro = await registrarConexaoUrnaRemota(urnaParam, loc);
          if (registro.autorizada && registro.urna) {
            setUrnaRemotaAtiva(registro.urna);
            setView('URNA');
          } else {
            setErroTerminalRemoto(
              registro.erro || 'Este terminal de votação não está autorizado ou foi revogado pela comissão eleitoral.'
            );
          }
        } else if (adminParam === 'comissao') {
          // Link específico de acesso da comissão eleitoral
          setTargetAfterAuth('PAINEL');
          setView('ADMIN_LOGIN');
        }

        // Subscrições do Firestore em tempo real
        unsubs.push(
          subscribeAuth((auth) => {
            setAuthState(auth);
          })
        );

        unsubs.push(
          subscribeEstadoEleicao((estado) => {
            setEstadoEleicao(estado);
            setCarregando(false);
          })
        );

        unsubs.push(
          subscribeEleitores((lista) => {
            setEleitores(lista);
          })
        );

        unsubs.push(
          subscribeVotos((lista) => {
            setVotos(lista);
          })
        );

        unsubs.push(
          subscribeUrnasRemotas((urnas) => {
            setUrnasRemotas(urnas);
            // Se estiver em modo remoto, atualiza dados da própria urna caso mude
            if (urnaParam) {
              const atual = urnas.find((u) => u.id === urnaParam || u.token === urnaParam);
              if (atual) {
                if (atual.status === 'REVOGADA') {
                  setErroTerminalRemoto('Esta urna remota foi REVOGADA pela Comissão Eleitoral.');
                } else {
                  setUrnaRemotaAtiva(atual);
                }
              }
            }
          })
        );
      } catch (err) {
        console.error('Erro na inicialização:', err);
        setCarregando(false);
      }
    }

    init();

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col justify-center items-center font-sans">
        <h2 className="text-xl font-bold mb-2">IFVote — Urna Digital</h2>
        <p className="text-xs text-slate-400">Carregando dados da eleição com Firebase...</p>
      </div>
    );
  }

  // Se o dispositivo foi aberto com ?urna=... e foi negado/revogado
  if (isModoRemoto && erroTerminalRemoto) {
    return (
      <div className="min-h-screen bg-[#111318] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-20 h-20 rounded-full bg-red-950/60 border border-red-800 flex items-center justify-center mb-5 text-red-400 shadow-xl">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-wide text-red-400 mb-2">
          Terminal Remoto Não Autorizado
        </h1>
        <p className="text-sm md:text-base text-slate-300 max-w-md leading-relaxed mb-6">
          {erroTerminalRemoto}
        </p>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 max-w-sm">
          Este dispositivo não possui permissão ativa para operar como cabine de votação. Entre em contato com a Comissão Eleitoral para solicitar ou reativar o credenciamento deste terminal.
        </div>
      </div>
    );
  }

  // Se estiver em MODO REMOTO AUTORIZADO:
  // Fica estritamente travado na cabine da Urna. Sem botão de voltar e sem links de gestão.
  if (isModoRemoto && urnaRemotaAtiva) {
    return (
      <UrnaView
        estadoEleicao={estadoEleicao}
        urnaRemota={urnaRemotaAtiva}
        onVoltar={undefined}
        onIrPainel={undefined}
      />
    );
  }

  // Roteador para Autenticação Administrativa
  const navegarParaAdmin = (destino: 'PAINEL' | 'MASTER') => {
    if (authState.isAdmin) {
      if (destino === 'MASTER' && authState.user?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        // Não é super admin, fica no Painel
        setView('PAINEL');
        return;
      }
      setView(destino);
    } else {
      setTargetAfterAuth(destino);
      setView('ADMIN_LOGIN');
    }
  };

  // Tela de Login Administrativo
  if (view === 'ADMIN_LOGIN') {
    return (
      <AdminLoginView
        authState={authState}
        onVoltar={() => setView('INDEX')}
        onSucesso={() => setView(targetAfterAuth)}
      />
    );
  }

  // 1. TELA INICIAL (PAINEL INICIAR)
  if (view === 'INDEX') {
    return (
      <IndexView
        estadoEleicao={estadoEleicao}
        onIrPainel={() => navegarParaAdmin('PAINEL')}
      />
    );
  }

  // 2. URNA DIGITAL LOCAL
  if (view === 'URNA') {
    return (
      <UrnaView
        estadoEleicao={estadoEleicao}
        onVoltar={() => setView('INDEX')}
        onIrPainel={() => navegarParaAdmin('PAINEL')}
      />
    );
  }

  // 3. PAINEL DA COMISSÃO ELEITORAL
  if (view === 'PAINEL') {
    if (!authState.isAdmin) {
      return (
        <AdminLoginView
          authState={authState}
          onVoltar={() => setView('INDEX')}
          onSucesso={() => setView('PAINEL')}
        />
      );
    }

    return (
      <PainelView
        estadoEleicao={estadoEleicao}
        eleitores={eleitores}
        urnasRemotas={urnasRemotas}
        votos={votos}
        authState={authState}
        onVoltar={() => setView('INDEX')}
        onIrUrna={() => setView('URNA')}
        onIrMaster={() => navegarParaAdmin('MASTER')}
      />
    );
  }

  // 4. CONTROLE GERAL (ACESSO EXCLUSIVO DO ADMINISTRADOR PRINCIPAL)
  if (view === 'MASTER') {
    if (
      !authState.isAdmin ||
      authState.user?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      return (
        <AdminLoginView
          authState={authState}
          onVoltar={() => setView('INDEX')}
          onSucesso={() => setView('MASTER')}
        />
      );
    }

    return (
      <MasterView
        estadoEleicao={estadoEleicao}
        onVoltar={() => setView('INDEX')}
        onIrPainel={() => setView('PAINEL')}
      />
    );
  }

  return null;
}
