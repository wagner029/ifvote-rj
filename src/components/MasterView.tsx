import React, { useState, useEffect } from 'react';
import {
  encerrarEleicaoRemotamente,
  iniciarEleicao,
  subscribeSistemasAtivos,
  adicionarSistemaAtivo,
  alterarStatusSistemaAtivo,
  removerSistemaAtivo,
  SistemaAtivo,
  EstadoEleicao,
  subscribeLogsSistema,
  LogSistema,
  subscribeUrnasRemotas,
  UrnaRemota,
  alterarStatusUrnaRemota,
  subscribePleitos,
  criarPleito,
  ativarPleito,
  editarPleito,
  cancelarPleito,
  reativarPleito,
  verificarSenhaMaster,
  alterarSenhaMaster,
  Pleito,
} from '../services/electionService';
import {
  listarAdministradores,
  autorizarAdministrador,
  revogarAdministrador,
  AdminUser,
  SUPER_ADMIN_EMAIL,
} from '../services/authService';
import { IfVoteLogo } from './common/IfVoteLogo';
import { ErrorModal, ModalConfig } from './ErrorModal';
import { UrnasMap } from './dashboard/UrnasMap';
import {
  ShieldAlert,
  ShieldCheck,
  Server,
  Users,
  Activity,
  Plus,
  Trash2,
  Lock,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  Clock,
  Radio,
  MapPin,
  Compass,
  Navigation,
  Copy,
  Check,
  Mail,
  Calendar,
  Layers,
  Power,
  ExternalLink,
  Shield,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Edit3,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface MasterViewProps {
  estadoEleicao: EstadoEleicao;
  onVoltar: () => void;
  onIrPainel: () => void;
}

export const MasterView: React.FC<MasterViewProps> = ({
  estadoEleicao,
  onVoltar,
  onIrPainel,
}) => {
  // Autenticação de Senha Master
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [validandoSenha, setValidandoSenha] = useState(false);
  const [isDesbloqueado, setIsDesbloqueado] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  // Tema Claro / Escuro
  const [tema, setTema] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ifvote-theme') as 'dark' | 'light') || 'dark';
  });

  const alternarTema = () => {
    const novo = tema === 'dark' ? 'light' : 'dark';
    setTema(novo);
    localStorage.setItem('ifvote-theme', novo);
    document.documentElement.classList.toggle('dark', novo === 'dark');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
  }, [tema]);

  // Alterar Senha Master
  const [mostrarModalAlterarSenha, setMostrarModalAlterarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [erroAlterarSenha, setErroAlterarSenha] = useState<string | null>(null);

  // Edição e Cancelamento de Pleitos (Exclusivo Master)
  const [pleitoEmEdicao, setPleitoEmEdicao] = useState<Pleito | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editAbertura, setEditAbertura] = useState('');
  const [editEncerramento, setEditEncerramento] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const [pleitoEmCancelamento, setPleitoEmCancelamento] = useState<Pleito | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelandoPleito, setCancelandoPleito] = useState(false);

  // Estados dos Sistemas, Urnas e Membros
  const [abaAtiva, setAbaAtiva] = useState<
    'localizacao' | 'pleitos' | 'acessos' | 'sistemas' | 'seguranca' | 'logs'
  >('localizacao');

  const [urnas, setUrnas] = useState<UrnaRemota[]>([]);
  const [pleitos, setPleitos] = useState<Pleito[]>([]);
  const [sistemas, setSistemas] = useState<SistemaAtivo[]>([]);
  const [membros, setMembros] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Novo Pleito Modal
  const [mostrarNovoPleito, setMostrarNovoPleito] = useState(false);
  const [novoPleitoNome, setNovoPleitoNome] = useState('');
  const [novoPleitoSigla, setNovoPleitoSigla] = useState('');
  const [novoPleitoAbertura, setNovoPleitoAbertura] = useState('');
  const [novoPleitoEncerramento, setNovoPleitoEncerramento] = useState('');

  // Novo Sistema Modal
  const [mostrarNovoSistema, setMostrarNovoSistema] = useState(false);
  const [novoNomeSistema, setNovoNomeSistema] = useState('');
  const [novaSiglaSistema, setNovaSiglaSistema] = useState('');
  const [novoInstituto, setNovoInstituto] = useState('');
  const [novaLocalizacao, setNovaLocalizacao] = useState('');

  // Novo Membro Modal
  const [mostrarNovoMembro, setMostrarNovoMembro] = useState(false);
  const [novoEmailMembro, setNovoEmailMembro] = useState('');
  const [novoNomeMembro, setNovoNomeMembro] = useState('');
  const [novoPapelMembro, setNovoPapelMembro] = useState<'COMISSAO_ELEITORAL' | 'MESARIO' | 'AUDITOR'>('COMISSAO_ELEITORAL');
  const [novoPleitoDesignado, setNovoPleitoDesignado] = useState('ifvote-rj');

  // Kill Switch Feedback
  const [statusMsg, setStatusMsg] = useState('');
  const [statusTipo, setStatusTipo] = useState<'ativo' | 'bloqueado' | ''>('');

  useEffect(() => {
    let unsubUrnas = subscribeUrnasRemotas((lista) => {
      setUrnas(lista);
    });

    let unsubPleitos = subscribePleitos((lista) => {
      setPleitos(lista);
      if (lista.length > 0 && !novoPleitoDesignado) {
        setNovoPleitoDesignado(lista[0].identificador);
      }
    });

    let unsubSistemas = subscribeSistemasAtivos((lista) => {
      setSistemas(lista);
    });

    let unsubLogs = subscribeLogsSistema((l) => {
      setLogs(l.slice(0, 30));
    });

    carregarMembros();

    return () => {
      unsubUrnas();
      unsubPleitos();
      unsubSistemas();
      unsubLogs();
    };
  }, []);

  const carregarMembros = async () => {
    const lista = await listarAdministradores();
    setMembros(lista);
  };

  const handleValidarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaDigitada.trim()) {
      setErroSenha('Digite a senha master para desbloquear.');
      return;
    }
    setValidandoSenha(true);
    setErroSenha(null);
    try {
      const valida = await verificarSenhaMaster(senhaDigitada.trim());
      if (valida) {
        setIsDesbloqueado(true);
        setErroSenha(null);
      } else {
        setErroSenha('Senha de segurança incorreta. Acesso restrito ao Desenvolvedor / Administrador Principal.');
      }
    } catch {
      setErroSenha('Erro ao validar credenciais no banco de dados.');
    } finally {
      setValidandoSenha(false);
    }
  };

  const handleAlterarSenhaMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroAlterarSenha(null);

    if (novaSenha.length < 8) {
      setErroAlterarSenha('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setErroAlterarSenha('A confirmação da nova senha não confere.');
      return;
    }

    setAlterandoSenha(true);
    try {
      const res = await alterarSenhaMaster(senhaAtual, novaSenha, SUPER_ADMIN_EMAIL);
      if (res.ok) {
        setMostrarModalAlterarSenha(false);
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmarNovaSenha('');
        setIsDesbloqueado(false);
        setSenhaDigitada('');
        setModalConfig({
          isOpen: true,
          type: 'success',
          title: 'Senha Master Alterada',
          message: 'A senha do Administrador Master foi alterada com sucesso via hash seguro bcrypt. Por segurança, digite a nova senha para acessar o painel.',
        });
      } else {
        setErroAlterarSenha(res.erro || 'Falha ao alterar senha.');
      }
    } catch (err: any) {
      setErroAlterarSenha(err.message || 'Erro inesperado.');
    } finally {
      setAlterandoSenha(false);
    }
  };

  const abrirEdicaoPleito = (p: Pleito) => {
    setPleitoEmEdicao(p);
    setEditNome(p.nome);
    setEditAbertura(p.dataAbertura ? p.dataAbertura.slice(0, 16) : '');
    setEditEncerramento(p.dataEncerramento ? p.dataEncerramento.slice(0, 16) : '');
  };

  const handleSalvarEdicaoPleito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pleitoEmEdicao) return;
    setSalvandoEdicao(true);
    try {
      const res = await editarPleito(
        pleitoEmEdicao.id,
        {
          nome: editNome.trim(),
          dataAbertura: editAbertura ? new Date(editAbertura).toISOString() : pleitoEmEdicao.dataAbertura,
          dataEncerramento: editEncerramento ? new Date(editEncerramento).toISOString() : pleitoEmEdicao.dataEncerramento,
        },
        SUPER_ADMIN_EMAIL
      );
      if (res.ok) {
        setPleitoEmEdicao(null);
        setModalConfig({
          isOpen: true,
          type: 'success',
          title: 'Pleito Atualizado',
          message: `O pleito "${editNome}" foi editado com sucesso pelo Administrador Master.`,
        });
      } else {
        setModalConfig({
          isOpen: true,
          type: 'error',
          title: 'Erro na Edição',
          message: res.erro || 'Falha ao atualizar o pleito.',
        });
      }
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const abrirConfirmacaoCancelamento = (p: Pleito) => {
    setPleitoEmCancelamento(p);
    setMotivoCancelamento('');
  };

  const handleConfirmarCancelamentoPleito = async () => {
    if (!pleitoEmCancelamento) return;
    setCancelandoPleito(true);
    try {
      const res = await cancelarPleito(
        pleitoEmCancelamento.id,
        motivoCancelamento,
        SUPER_ADMIN_EMAIL,
        'Wagner Rocha'
      );
      if (res.ok) {
        setPleitoEmCancelamento(null);
        setModalConfig({
          isOpen: true,
          type: 'success',
          title: 'Pleito Cancelado',
          message: `O pleito "${pleitoEmCancelamento.nome}" foi cancelado. Todas as urnas conectadas a ele foram revogadas imediatamente.`,
        });
      } else {
        setModalConfig({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Cancelar',
          message: res.erro || 'Falha ao cancelar pleito.',
        });
      }
    } finally {
      setCancelandoPleito(false);
    }
  };

  const handleReativarPleito = async (p: Pleito) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Reativar Pleito Eleitoral',
      message: `Deseja restabelecer o pleito "${p.nome}" como ativo?`,
      confirmLabel: 'Reativar Pleito',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        const res = await reativarPleito(p.id, SUPER_ADMIN_EMAIL);
        if (res.ok) {
          setModalConfig({
            isOpen: true,
            type: 'success',
            title: 'Pleito Reativado',
            message: `O pleito "${p.nome}" foi restabelecido com sucesso.`,
          });
        }
      },
    });
  };

  const copiarTexto = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  // Gerenciamento de Urnas (Encerrar / Revogar individualmente)
  const handleAlterarStatusUrna = async (urna: UrnaRemota, novoStatus: 'ONLINE' | 'REVOGADA') => {
    const acaoLabel = novoStatus === 'REVOGADA' ? 'Encerrar e Bloquear' : 'Reativar';
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: `${acaoLabel} ${urna.identificador}`,
      message:
        novoStatus === 'REVOGADA'
          ? `Deseja encerrar e revogar a ${urna.identificador}? O dispositivo remoto será travado instantaneamente.`
          : `Deseja reativar a ${urna.identificador} para votação?`,
      confirmLabel: acaoLabel,
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          await alterarStatusUrnaRemota(urna.id, novoStatus);
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: err.message || 'Falha ao alterar status da urna.',
          });
        }
      },
    });
  };

  // Cadastro de Novo Pleito (exclusivo do Admin Master)
  const handleCriarPleito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPleitoNome.trim()) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Nome Obrigatório',
        message: 'Informe o nome oficial do pleito/eleição.',
      });
      return;
    }

    const cleanSigla = (novoPleitoSigla.trim() || 'geral')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const identificador = `ifvote-${cleanSigla}`;

    try {
      await criarPleito({
        id: identificador,
        nome: novoPleitoNome.trim(),
        identificador,
        dataAbertura: novoPleitoAbertura || new Date().toISOString(),
        dataEncerramento:
          novoPleitoEncerramento || new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'EM_ANDAMENTO',
      });

      setMostrarNovoPleito(false);
      setNovoPleitoNome('');
      setNovoPleitoSigla('');
      setNovoPleitoAbertura('');
      setNovoPleitoEncerramento('');

      setModalConfig({
        isOpen: true,
        type: 'success',
        title: 'Pleito Cadastrado com Sucesso!',
        message: `O pleito "${novoPleitoNome}" foi registrado com identificador oficial ${identificador}.`,
      });
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Criar Pleito',
        message: err.message || 'Falha ao salvar pleito no Firestore.',
      });
    }
  };

  // Ativação de Pleito
  const handleAtivarPleito = async (pleito: Pleito) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Ativar Pleito Corrente',
      message: `Deseja definir "${pleito.nome}" (${pleito.identificador}) como o pleito ativo do sistema?`,
      confirmLabel: 'Ativar Pleito',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          await ativarPleito(pleito);
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: err.message || 'Não foi possível ativar o pleito.',
          });
        }
      },
    });
  };

  // Enviar link do pleito por e-mail para comissão
  const handleEnviarLinkEmail = (pleito: Pleito, emailDestino?: string) => {
    const link = `${window.location.origin}${window.location.pathname}?admin=comissao&pleito=${pleito.identificador}`;
    const subject = encodeURIComponent(`[IFVote] Credenciamento de Acesso — Pleito ${pleito.nome}`);
    const body = encodeURIComponent(
      `Olá membro da Comissão Eleitoral,\n\nVocê foi credenciado para administrar a eleição "${pleito.nome}" (${pleito.identificador}) no IFVote — Urna Digital Estudantil.\n\nAcesse o Painel da Comissão pelo link seguro abaixo utilizando sua conta Google credenciada:\n${link}\n\nNo painel você poderá:\n1. Cadastrar chapas (com logo, nomes e número)\n2. Cadastrar eleitores aptos\n3. Gerar links e QR Codes de urnas digitais\n4. Acompanhar a apuração percentual e emitir Zerésima, Boletim de Urna e Ata da Eleição.\n\nAtenciosamente,\nWagner Rocha — Desenvolvedor e Admin Master\nIFPA Campus Bragança, Pará`
    );
    window.location.href = `mailto:${emailDestino || ''}?subject=${subject}&body=${body}`;
  };

  // Kill Switch de Emergência
  const handleEncerrar = () => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Forçar Encerramento Imediato (Kill Switch)',
      message:
        'ATENÇÃO: Você está prestes a acionar o Kill Switch Global do IFVote.\n\nTodas as urnas em execução no Rio de Janeiro e demais sistemas serão travadas instantaneamente no servidor e nenhum eleitor poderá mais votar.',
      confirmLabel: '🛑 Encerrar Eleição Agora',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        setStatusMsg('Enviando sinal de bloqueio imediato...');
        setStatusTipo('');
        try {
          await encerrarEleicaoRemotamente();
          setStatusTipo('bloqueado');
          setStatusMsg('ELEIÇÃO ENCERRADA COM SUCESSO! Todas as urnas estão bloqueadas no servidor.');
        } catch {
          setStatusTipo('bloqueado');
          setStatusMsg('Erro de conexão ao enviar ordem de bloqueio.');
        }
      },
    });
  };

  const handleReativar = async () => {
    try {
      await iniciarEleicao(60);
      setStatusTipo('ativo');
      setStatusMsg('Urnas reativadas com sucesso por 60 minutos!');
    } catch {
      setStatusMsg('Erro ao reativar eleição.');
    }
  };

  // Gerenciamento de Sistemas
  const handleCriarSistema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNomeSistema.trim() || !novaSiglaSistema.trim()) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Dados Incompletos',
        message: 'Preencha o nome e a sigla do sistema regional.',
      });
      return;
    }

    try {
      await adicionarSistemaAtivo({
        nome: novoNomeSistema.trim(),
        sigla: novaSiglaSistema.trim().toUpperCase(),
        instituto: novoInstituto.trim() || `Instituto Federal (${novaSiglaSistema.trim().toUpperCase()})`,
        status: 'EM_FUNCIONAMENTO',
        localizacaoUrnas: novaLocalizacao.trim() || `${novaSiglaSistema.trim().toUpperCase()}`,
        monitoramento: 'Bragança, Pará (Wagner Rocha)',
        totalUrnas: 0,
      });

      setMostrarNovoSistema(false);
      setNovoNomeSistema('');
      setNovaSiglaSistema('');
      setNovoInstituto('');
      setNovaLocalizacao('');

      setModalConfig({
        isOpen: true,
        type: 'success',
        title: 'Sistema Cadastrado',
        message: 'Novo sistema regional adicionado com sucesso ao monitoramento.',
      });
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Falha ao Cadastrar Sistema',
        message: err.message || 'Erro ao registrar sistema no Firestore.',
      });
    }
  };

  const handleAlterarStatusSistema = async (id: string, novoStatus: SistemaAtivo['status']) => {
    try {
      await alterarStatusSistemaAtivo(id, novoStatus);
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Atualizar',
        message: err.message || 'Falha ao atualizar status.',
      });
    }
  };

  const handleRemoverSistema = (id: string, nome: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Remover Sistema',
      message: `Tem certeza que deseja remover o sistema "${nome}" do monitoramento?`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          await removerSistemaAtivo(id);
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Não é Possível Remover',
            message: err.message || 'Erro ao remover sistema.',
          });
        }
      },
    });
  };

  // Gerenciamento de Membros da Comissão
  const handleAdicionarMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoEmailMembro.trim() || !novoEmailMembro.includes('@')) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Email Inválido',
        message: 'Informe um endereço de email válido do Google.',
      });
      return;
    }

    try {
      const res = await autorizarAdministrador(
        novoEmailMembro,
        novoNomeMembro,
        novoPapelMembro,
        novoPleitoDesignado
      );
      if (res.ok) {
        setMostrarNovoMembro(false);
        setNovoEmailMembro('');
        setNovoNomeMembro('');
        await carregarMembros();
        setModalConfig({
          isOpen: true,
          type: 'success',
          title: 'Membro Credenciado!',
          message: `A conta ${novoEmailMembro} foi autorizada para o pleito "${novoPleitoDesignado}". Você pode agora copiar o link de acesso e enviar para o usuário.`,
        });
      } else {
        setModalConfig({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Autorizar',
          message: res.erro || 'Falha ao registrar membro.',
        });
      }
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Falha na Operação',
        message: err.message || 'Erro ao salvar no banco de dados.',
      });
    }
  };

  const handleRevogarMembro = (email: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Revogar Acesso',
      message: `Tem certeza que deseja revogar o acesso administrativo da conta ${email}? O usuário será imediatamente desconectado.`,
      confirmLabel: 'Revogar Acesso',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          const res = await revogarAdministrador(email);
          if (res.ok) {
            await carregarMembros();
          } else {
            setModalConfig({
              isOpen: true,
              type: 'error',
              title: 'Erro',
              message: res.erro || 'Não foi possível revogar o membro.',
            });
          }
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Falha',
            message: err.message,
          });
        }
      },
    });
  };

  // Tela de Bloqueio por Senha Master
  if (!isDesbloqueado) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-blue-600"></div>

          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-800/80 flex items-center justify-center mx-auto mb-4 text-red-500 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Controle Geral</h1>
            <p className="text-xs text-slate-400 mt-1">
              Acesso Exclusivo do Desenvolvedor e Administrador Principal
            </p>
            <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-slate-800 text-[11px] text-slate-300 font-mono">
              <span>{SUPER_ADMIN_EMAIL}</span>
            </div>
          </div>

          <form onSubmit={handleValidarSenha} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Chave de Acesso Master</span>
                <span className="text-[10px] text-slate-500 font-mono">Monitoramento Bragança - PA</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={senhaDigitada}
                  onChange={(e) => setSenhaDigitada(e.target.value)}
                  placeholder="Digite a senha master..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {erroSenha && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
                {erroSenha}
              </div>
            )}

            <button
              type="submit"
              disabled={validandoSenha}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-950/50 transition-all cursor-pointer disabled:opacity-50"
            >
              {validandoSenha ? 'Validando Credenciais...' : 'Autenticar e Abrir Painel'}
            </button>

            <button
              type="button"
              onClick={onVoltar}
              className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Voltar ao Início
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
            IFVote • IFPA Campus Bragança, Pará • Desenvolvedor: Wagner Rocha
          </div>
        </div>
      </div>
    );
  }

  // Painel Desbloqueado do Controle Geral
  return (
    <div className={`min-h-screen ${tema === 'dark' ? 'bg-[#07090e] text-slate-100' : 'bg-slate-100 text-slate-900'} flex flex-col font-sans selection:bg-red-500 selection:text-white transition-colors duration-200`}>
      {/* Header do Controle Geral */}
      <header className={`border-b ${tema === 'dark' ? 'border-slate-800 bg-slate-950/90' : 'border-slate-300 bg-white/90'} backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className={`p-2 rounded-lg ${tema === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'} transition-colors cursor-pointer`}
            title="Voltar ao Início"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <IfVoteLogo size="sm" theme={tema} />
          <div className={`h-5 w-px ${tema === 'dark' ? 'bg-slate-800' : 'bg-slate-300'}`}></div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-extrabold ${tema === 'dark' ? 'text-white' : 'text-slate-900'} tracking-wide`}>CONTROLE GERAL</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                ADMIN MASTER
              </span>
            </div>
            <div className={`text-[10px] ${tema === 'dark' ? 'text-slate-400' : 'text-slate-600'} font-mono`}>
              Monitoramento Remoto: Bragança - Pará ➔ Eleições RJ & Regionais
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Alternador de Tema Claro / Escuro */}
          <button
            type="button"
            onClick={alternarTema}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              tema === 'dark'
                ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                : 'bg-slate-200 border-slate-300 text-blue-700 hover:bg-slate-300'
            }`}
            title={tema === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          >
            {tema === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Alterar Senha Master */}
          <button
            type="button"
            onClick={() => {
              setMostrarModalAlterarSenha(true);
              setErroAlterarSenha(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              tema === 'dark'
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-sm'
            }`}
            title="Alterar Senha do Admin Master"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Alterar Senha</span>
          </button>

          <button
            type="button"
            onClick={onIrPainel}
            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Painel da Comissão
          </button>
          <button
            type="button"
            onClick={() => setIsDesbloqueado(false)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              tema === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Bloquear Painel"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Navegação por Abas */}
      <div className="bg-slate-900 border-b border-slate-800 px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2">
          <button
            type="button"
            onClick={() => setAbaAtiva('localizacao')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              abaAtiva === 'localizacao'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            <span>Localização das Urnas ({urnas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('pleitos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              abaAtiva === 'pleitos'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Gestão de Pleitos ({pleitos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('acessos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              abaAtiva === 'acessos'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Membros da Comissão ({membros.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('sistemas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              abaAtiva === 'sistemas'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Sistemas em Funcionamento ({sistemas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('seguranca')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              abaAtiva === 'seguranca'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Kill Switch</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              abaAtiva === 'logs'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Auditoria ({logs.length})</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* ABA 1: LOCALIZAÇÃO EM TEMPO REAL DAS URNAS */}
        {abaAtiva === 'localizacao' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-red-500" />
                  <span>Localização das Urnas em Tempo Real</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Detecção automática de onde cada terminal está operando (GPS ou IP). Atualização contínua.
                </p>
              </div>

              {/* Tag de Sigilo e Privacidade */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Sigilo do Voto Preservado • Rastreio restrito à URNA</span>
              </div>
            </div>

            {/* Banner de Privacidade e Isolamento */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">
                  Isolamento Rigoroso e Sigilo Eleitoral:
                </strong>
                A localização pertence unicamente ao hardware/sessão do terminal de votação da URNA. Não há qualquer associação de geolocalização ou horário com a cédula do eleitor. Esta tela é confidencial e visível exclusivamente pelo Administrador Master.
              </div>
            </div>

            {/* Mapa Interativo das Urnas */}
            <UrnasMap
              urnas={urnas}
              onEncerrarUrna={(id) => {
                const u = urnas.find((item) => item.id === id);
                if (u) handleAlterarStatusUrna(u, 'REVOGADA');
              }}
            />

            {/* Lista Detalhada das Urnas */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>Terminais Registrados e Status Geográfico</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Total de Urnas: {urnas.length}
                </span>
              </div>

              <div className="divide-y divide-slate-800 text-xs">
                {urnas.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Nenhuma urna remota autorizada no momento.
                  </div>
                ) : (
                  urnas.map((u) => {
                    const isOnline = u.status === 'ONLINE';
                    const isRevogada = u.status === 'REVOGADA';
                    const loc = u.localizacao;
                    return (
                      <div
                        key={u.id}
                        className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {u.identificador || `Urna Nº ${u.numero}`}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isRevogada
                                  ? 'bg-red-950 text-red-400 border border-red-800'
                                  : isOnline
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {u.status}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                              Pleito: {u.pleitoNome || u.pleitoId || 'ifvote-rj'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-slate-400 text-[11px]">
                            <span className="flex items-center gap-1 text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-red-400" />
                              <strong>
                                {loc?.cidade || 'Localização em detecção'}, {loc?.estado || 'BR'}
                              </strong>
                            </span>

                            {loc?.latitude !== undefined && loc?.longitude !== undefined && (
                              <span className="font-mono text-slate-400">
                                ({loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)})
                              </span>
                            )}

                            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-[10px] font-mono text-slate-400 border border-slate-800">
                              {loc?.tipo === 'GPS' ? '🛰️ Sinal GPS' : '🌐 Geolocalização por IP'}
                            </span>

                            <span className="flex items-center gap-1 text-slate-500">
                              <Clock className="w-3 h-3" />
                              Atualizado:{' '}
                              {loc?.atualizadaEm
                                ? new Date(loc.atualizadaEm).toLocaleTimeString('pt-BR')
                                : 'Recentemente'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isRevogada ? (
                            <button
                              type="button"
                              onClick={() => handleAlterarStatusUrna(u, 'ONLINE')}
                              className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Reativar Urna</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAlterarStatusUrna(u, 'REVOGADA')}
                              className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>Encerrar / Revogar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: GESTÃO DE PLEITOS (ADMIN MASTER) */}
        {abaAtiva === 'pleitos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-red-500" />
                  <span>Gestão de Pleitos & Eleições</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Crie novos pleitos e envie os links seguros de credenciamento aos usuários da Comissão Eleitoral.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarNovoPleito(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Pleito</span>
              </button>
            </div>

            {/* Grid de Pleitos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pleitos.map((pleito) => {
                const isAtivo = estadoEleicao.pleitoIdentificador === pleito.identificador;
                const linkComissao = `${window.location.origin}${window.location.pathname}?admin=comissao&pleito=${pleito.identificador}`;

                return (
                  <div
                    key={pleito.id}
                    className={`bg-slate-900 border rounded-xl p-5 shadow-lg flex flex-col justify-between ${
                      isAtivo ? 'border-red-600/80 ring-1 ring-red-600/40' : 'border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white">{pleito.nome}</span>
                            {isAtivo && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                                ATIVO
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono text-slate-400">
                            Identificador: {pleito.identificador}
                          </span>
                        </div>

                        <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800">
                          {pleito.status}
                        </span>
                      </div>

                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-xs text-slate-300 space-y-2 my-3">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" /> Abertura:
                          </span>
                          <span className="font-mono text-slate-300">
                            {new Date(pleito.dataAbertura).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" /> Encerramento:
                          </span>
                          <span className="font-mono text-slate-300">
                            {new Date(pleito.dataEncerramento).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      {/* Caixa de Compartilhamento do Link do Pleito para a Comissão */}
                      <div className="mt-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Link Oficial da Comissão Eleitoral
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={linkComissao}
                            className="flex-1 bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 rounded px-2 py-1 select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copiarTexto(linkComissao, pleito.id)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors cursor-pointer"
                            title="Copiar Link"
                          >
                            {copiadoId === pleito.id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnviarLinkEmail(pleito)}
                            className="p-1.5 bg-blue-900/60 hover:bg-blue-800 text-blue-300 rounded transition-colors cursor-pointer"
                            title="Enviar por E-mail"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Detalhes de Cancelamento se houver */}
                    {pleito.status === 'CANCELADO' && (
                      <div className="mt-2.5 p-2 rounded bg-red-950/70 border border-red-800 text-[11px] text-red-200">
                        <strong>Pleito Cancelado:</strong> {pleito.motivoCancelamento || 'Cancelado pelo Administrador Master'}
                        {pleito.canceladoEm && (
                          <span className="block text-[10px] text-red-400 mt-0.5">
                            Em: {new Date(pleito.canceladoEm).toLocaleString('pt-BR')} por {pleito.canceladoPor || 'Admin Master'}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 mt-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isAtivo && pleito.status !== 'CANCELADO' && (
                          <button
                            type="button"
                            onClick={() => handleAtivarPleito(pleito)}
                            className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 rounded text-xs font-bold transition-colors cursor-pointer"
                          >
                            Ativar
                          </button>
                        )}

                        {/* Botão Editar Pleito */}
                        <button
                          type="button"
                          onClick={() => abrirEdicaoPleito(pleito)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                          title="Editar Nome e Prazos do Pleito"
                        >
                          <Edit3 className="w-3 h-3 text-amber-400" />
                          <span>Editar</span>
                        </button>

                        {/* Botão Cancelar ou Reativar */}
                        {pleito.status === 'CANCELADO' ? (
                          <button
                            type="button"
                            onClick={() => handleReativarPleito(pleito)}
                            className="px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Reativar Pleito</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => abrirConfirmacaoCancelamento(pleito)}
                            className="px-2.5 py-1 bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Cancelar Pleito e Revogar Todas as Urnas"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Cancelar</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={onIrPainel}
                        className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>Abrir Painel</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA 3: GERENCIAMENTO DE MEMBROS DA COMISSÃO */}
        {abaAtiva === 'acessos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-red-500" />
                  <span>Membros da Comissão Eleitoral</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Pré-cadastro de membros com vinculação a pleitos específicos e geração de links de primeiro acesso.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarNovoMembro(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Pré-Cadastrar Membro</span>
              </button>
            </div>

            {/* Tabela de Membros Autorizados */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Membro</th>
                    <th className="px-6 py-3">Email Google</th>
                    <th className="px-6 py-3">Pleito Designado</th>
                    <th className="px-6 py-3">Papel</th>
                    <th className="px-6 py-3 text-right">Ações / Envio de Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {membros.map((m) => {
                    const isSuper = m.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                    const pleitoAlvo = m.pleitoDesignado || 'ifvote-rj';
                    const linkMembro = `${window.location.origin}${window.location.pathname}?admin=comissao&pleito=${pleitoAlvo}`;

                    return (
                      <tr key={m.email} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                          {isSuper ? (
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-blue-400" />
                          )}
                          <span>{m.nome}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-300">{m.email}</td>
                        <td className="px-6 py-4 font-mono text-slate-400">
                          {isSuper ? 'Todos os Pleitos' : pleitoAlvo}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                              isSuper
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : 'bg-blue-950 text-blue-400 border border-blue-800'
                            }`}
                          >
                            {isSuper ? 'ADMIN MASTER' : 'COMISSÃO ELEITORAL'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isSuper ? (
                            <span className="text-[10px] text-slate-500 uppercase font-mono">
                              Protegido
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => copiarTexto(linkMembro, `membro-${m.email}`)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors cursor-pointer flex items-center gap-1"
                                title="Copiar Link do Membro"
                              >
                                {copiadoId === `membro-${m.email}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>Link</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const p = pleitos.find((item) => item.identificador === pleitoAlvo) || {
                                    id: pleitoAlvo,
                                    nome: pleitoAlvo,
                                    identificador: pleitoAlvo,
                                    dataAbertura: '',
                                    dataEncerramento: '',
                                    status: 'EM_ANDAMENTO',
                                    criadoEm: '',
                                  };
                                  handleEnviarLinkEmail(p, m.email);
                                }}
                                className="px-2.5 py-1 bg-blue-950/60 hover:bg-blue-900 text-blue-300 border border-blue-800 rounded text-xs transition-colors cursor-pointer flex items-center gap-1"
                                title="Enviar por E-mail"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>E-mail</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRevogarMembro(m.email)}
                                className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800 rounded text-xs transition-colors cursor-pointer"
                              >
                                Revogar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 4: SISTEMAS EM FUNCIONAMENTO */}
        {abaAtiva === 'sistemas' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-red-500" />
                  <span>Sistemas em Funcionamento</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Gerenciamento dos polos regionais de votação ativos nas eleições estudantis.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarNovoSistema(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Novo Sistema</span>
              </button>
            </div>

            {/* Grid dos Sistemas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sistemas.map((sis) => {
                const isOnline = sis.status === 'EM_FUNCIONAMENTO';
                return (
                  <div
                    key={sis.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-white">{sis.nome}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                            {sis.sigla}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{sis.instituto}</div>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                          }`}
                        />
                        <span
                          className={`text-[10px] font-bold ${
                            isOnline ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {sis.status === 'EM_FUNCIONAMENTO' ? 'Em Funcionamento' : sis.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-300 my-4 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-red-400" /> Local das Urnas:
                        </span>
                        <strong className="text-white">{sis.localizacaoUrnas}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Radio className="w-3.5 h-3.5 text-emerald-400" /> Monitoramento:
                        </span>
                        <strong className="text-emerald-400">{sis.monitoramento}</strong>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <select
                        value={sis.status}
                        onChange={(e) =>
                          handleAlterarStatusSistema(sis.id, e.target.value as SistemaAtivo['status'])
                        }
                        className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="EM_FUNCIONAMENTO">Em Funcionamento</option>
                        <option value="PAUSADO">Pausado</option>
                        <option value="ENCERRADO">Encerrado</option>
                      </select>

                      {sis.id !== 'ifvote_rj' && (
                        <button
                          type="button"
                          onClick={() => handleRemoverSistema(sis.id, sis.nome)}
                          className="p-1.5 hover:bg-red-950/60 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Remover Sistema"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA 5: KILL SWITCH & SEGURANÇA */}
        {abaAtiva === 'seguranca' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-red-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800 flex items-center justify-center text-red-500 shrink-0">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-red-400">Kill Switch Global de Emergência</h3>
                  <p className="text-xs text-slate-400">
                    Comando de segurança com efeito imediato em todas as urnas conectadas no Rio de Janeiro e demais sistemas.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status Atual da Eleição:</span>
                  <strong
                    className={
                      estadoEleicao.eleicaoAtiva ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {estadoEleicao.eleicaoAtiva ? '🟢 Votação Ativa' : '🔴 Votação Bloqueada'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Último Hash Criptográfico:</span>
                  <span className="font-mono text-slate-400 text-[10px]">
                    {estadoEleicao.hashAnterior
                      ? `${estadoEleicao.hashAnterior.substring(0, 24)}...`
                      : '0000...'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleEncerrar}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-black text-sm tracking-wide shadow-lg shadow-red-950 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-5 h-5" />
                  <span>ENCERRAR / TRAVAR TODAS AS URNAS AGORA</span>
                </button>

                {!estadoEleicao.eleicaoAtiva && (
                  <button
                    type="button"
                    onClick={handleReativar}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reativar Urnas por 60 Minutos</span>
                  </button>
                )}
              </div>

              {statusMsg && (
                <div
                  className={`mt-4 p-3 rounded-xl text-xs border font-medium ${
                    statusTipo === 'ativo'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                      : 'bg-red-950/60 text-red-300 border-red-800'
                  }`}
                >
                  {statusMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 6: AUDITORIA & LOGS */}
        {abaAtiva === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-500" />
                  <span>Logs Permanentes de Auditoria</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Trilha imutável gravada no banco de dados Firestore.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="divide-y divide-slate-800 text-xs">
                {logs.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">Nenhum log gravado até o momento.</div>
                ) : (
                  logs.map((lg) => (
                    <div key={lg.id} className="p-4 hover:bg-slate-800/40 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                            {lg.tipo}
                          </span>
                          {lg.urnaNumero && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Urna Nº {String(lg.urnaNumero).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-200">{lg.descricao}</div>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(lg.timestamp).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Criar Novo Pleito */}
      {mostrarNovoPleito && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Criar Novo Pleito</h3>
            <p className="text-xs text-slate-400 mb-4">
              Defina o nome oficial, o identificador do pleito e o período de votação.
            </p>

            <form onSubmit={handleCriarPleito} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome do Pleito</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Eleição Grêmio Estudantil 2026"
                  value={novoPleitoNome}
                  onChange={(e) => setNovoPleitoNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Sigla do Pleito (formará ifvote-[sigla])
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-slate-800 border border-r-0 border-slate-700 rounded-l-lg text-slate-400 font-mono">
                    ifvote-
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="rj, braganca, sp"
                    value={novoPleitoSigla}
                    onChange={(e) =>
                      setNovoPleitoSigla(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-r-lg text-white font-mono lowercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data Início</label>
                  <input
                    type="date"
                    value={novoPleitoAbertura}
                    onChange={(e) => setNovoPleitoAbertura(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data Término</label>
                  <input
                    type="date"
                    value={novoPleitoEncerramento}
                    onChange={(e) => setNovoPleitoEncerramento(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMostrarNovoPleito(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
                >
                  Salvar Pleito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Novo Sistema */}
      {mostrarNovoSistema && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Novo Sistema Regional</h3>
            <p className="text-xs text-slate-400 mb-4">
              Cadastre um novo polo de votação sob monitoramento do IFVote.
            </p>

            <form onSubmit={handleCriarSistema} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome do Sistema</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: IFVote SP"
                  value={novoNomeSistema}
                  onChange={(e) => setNovoNomeSistema(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Sigla do Estado</label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  placeholder="Ex: SP"
                  value={novaSiglaSistema}
                  onChange={(e) => setNovaSiglaSistema(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Instituto Federal</label>
                <input
                  type="text"
                  placeholder="Ex: IFSP — Instituto Federal de São Paulo"
                  value={novoInstituto}
                  onChange={(e) => setNovoInstituto(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Localização das Urnas</label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo, SP"
                  value={novaLocalizacao}
                  onChange={(e) => setNovaLocalizacao(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMostrarNovoSistema(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
                >
                  Salvar Sistema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Novo Membro */}
      {mostrarNovoMembro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Pré-Cadastrar Membro da Comissão</h3>
            <p className="text-xs text-slate-400 mb-4">
              Informe o email Google e selecione o pleito correspondente para vincular o acesso.
            </p>

            <form onSubmit={handleAdicionarMembro} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Google</label>
                <input
                  type="email"
                  required
                  placeholder="comissao.rj@ifrj.edu.br ou gmail.com"
                  value={novoEmailMembro}
                  onChange={(e) => setNovoEmailMembro(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prof. Carlos Eduardo"
                  value={novoNomeMembro}
                  onChange={(e) => setNovoNomeMembro(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Pleito Designado</label>
                <select
                  value={novoPleitoDesignado}
                  onChange={(e) => setNovoPleitoDesignado(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  {pleitos.map((p) => (
                    <option key={p.id} value={p.identificador}>
                      {p.nome} ({p.identificador})
                    </option>
                  ))}
                  {pleitos.length === 0 && (
                    <option value="ifvote-rj">IFVote RJ (ifvote-rj)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Papel</label>
                <select
                  value={novoPapelMembro}
                  onChange={(e) => setNovoPapelMembro(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  <option value="COMISSAO_ELEITORAL">Comissão Eleitoral (Gestão do Pleito)</option>
                  <option value="MESARIO">Mesário / Recepção de Votos</option>
                  <option value="AUDITOR">Auditor Independente</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMostrarNovoMembro(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
                >
                  Salvar e Credenciar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Alterar Senha Master */}
      {mostrarModalAlterarSenha && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Alterar Senha do Admin Master</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Defina sua nova senha de segurança. Ela será criptografada com <strong>bcrypt</strong> e substituirá o hash anterior no Firestore.
            </p>

            <form onSubmit={handleAlterarSenhaMaster} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Senha Atual</label>
                <div className="relative">
                  <input
                    type={mostrarSenhaAtual ? 'text' : 'password'}
                    required
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    placeholder="Digite sua senha atual..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    {mostrarSenhaAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nova Senha <span className="text-slate-500 font-normal">(mínimo 8 caracteres)</span>
                </label>
                <div className="relative">
                  <input
                    type={mostrarNovaSenha ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Digite a nova senha segura..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    {mostrarNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Confirmar Nova Senha</label>
                <input
                  type={mostrarNovaSenha ? 'text' : 'password'}
                  required
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  placeholder="Repita a nova senha..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              {erroAlterarSenha && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-lg text-xs">
                  {erroAlterarSenha}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMostrarModalAlterarSenha(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={alterandoSenha}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow disabled:opacity-50"
                >
                  {alterandoSenha ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Pleito */}
      {pleitoEmEdicao && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Edit3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Editar Pleito</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Identificador: <span className="font-mono text-emerald-400">{pleitoEmEdicao.identificador}</span>
            </p>

            <form onSubmit={handleSalvarEdicaoPleito} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome do Pleito</label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Data e Hora de Abertura</label>
                <input
                  type="datetime-local"
                  required
                  value={editAbertura}
                  onChange={(e) => setEditAbertura(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Data e Hora de Encerramento</label>
                <input
                  type="datetime-local"
                  required
                  value={editEncerramento}
                  onChange={(e) => setEditEncerramento(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPleitoEmEdicao(null)}
                  className="px-3 py-2 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow disabled:opacity-50"
                >
                  {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Cancelamento de Pleito */}
      {pleitoEmCancelamento && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-red-800/80 rounded-2xl p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2 mb-2 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Cancelar Pleito Eleitoral</h3>
            </div>

            <div className="bg-red-950/50 border border-red-800/60 p-3 rounded-lg text-xs text-red-200 mb-4 leading-relaxed">
              <strong>Atenção:</strong> Ao confirmar o cancelamento de <strong>{pleitoEmCancelamento.nome}</strong> ({pleitoEmCancelamento.identificador}), todas as urnas vinculadas serão <strong>revogadas e bloqueadas imediatamente</strong> e o evento será registrado na auditoria permanente.
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Motivo do Cancelamento (opcional)</label>
                <textarea
                  rows={3}
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Descreva o motivo administrativo ou técnico para o cancelamento..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPleitoEmCancelamento(null)}
                className="px-3 py-2 text-slate-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmarCancelamentoPleito}
                disabled={cancelandoPleito}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-950/50 disabled:opacity-50"
              >
                {cancelandoPleito ? 'Cancelando...' : 'Confirmar Cancelamento e Revogar Urnas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Padronizado */}
      <ErrorModal config={modalConfig} onClose={() => setModalConfig(null)} />
    </div>
  );
};
