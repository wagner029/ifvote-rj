import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  iniciarEleicao,
  cadastrarEleitor,
  importarEleitoresCSV,
  excluirEleitor,
  excluirEleitoresEmMassa,
  criarUrnaRemota,
  alterarStatusUrnaRemota,
  excluirUrnaRemota,
  subscribeChapas,
  salvarChapa,
  excluirChapa,
  subscribePleitos,
  criarPleito,
  ativarPleito,
  subscribeLogsSistema,
  Chapa,
  Pleito,
  Eleitor,
  EstadoEleicao,
  UrnaRemota,
  LogSistema,
  VotoRegistrado,
  alterarSenhaMembro,
} from '../services/electionService';
import type { AuthState } from '../services/authService';
import { logout, SUPER_ADMIN_EMAIL } from '../services/authService';
import { removerFundoImagem } from '../utils/backgroundRemoval';
import { ErrorModal, ModalConfig } from './ErrorModal';
import { ApuracaoGraficos } from './dashboard/ApuracaoGraficos';
import { GerenciarAdminsModal } from './auth/GerenciarAdminsModal';
import { IfVoteLogo } from './common/IfVoteLogo';
import {
  ArrowLeft,
  Printer,
  QrCode,
  Copy,
  Check,
  Plus,
  Trash2,
  Radio,
  Search,
  Users,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  Vote,
  Layers,
  FileText,
  Upload,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sparkles,
  BarChart3,
  Calendar,
  AlertTriangle,
  FileCheck,
  Sun,
  Moon,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';

interface PainelViewProps {
  estadoEleicao: EstadoEleicao;
  eleitores: Eleitor[];
  urnasRemotas: UrnaRemota[];
  votos: VotoRegistrado[];
  authState: AuthState;
  onVoltar: () => void;
  onIrUrna: () => void;
  onIrMaster: () => void;
}

type TabKey = 'pleito' | 'chapas' | 'eleitores' | 'urnas' | 'apuracao' | 'documentos';

export const PainelView: React.FC<PainelViewProps> = ({
  estadoEleicao,
  eleitores,
  urnasRemotas,
  votos,
  authState,
  onVoltar,
  onIrUrna,
  onIrMaster,
}) => {
  // Aba ativa do painel
  const [abaAtiva, setAbaAtiva] = useState<TabKey>('pleito');

  // Estados em tempo real
  const [chapas, setChapas] = useState<Chapa[]>([]);
  const [pleitos, setPleitos] = useState<Pleito[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>('Painel sincronizado com Firebase.');
  const [minutos, setMinutos] = useState<number>(30);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>(new Date().toLocaleTimeString('pt-BR'));

  // Modais
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [modalAdminsAberto, setModalAdminsAberto] = useState(false);

  // Modal para Zerésima, Boletim e Ata com Marca d'Água
  const [modalDocumento, setModalDocumento] = useState<{
    tipo: 'zeresima' | 'boletim' | 'ata';
    titulo: string;
    conteudo: string;
  } | null>(null);

  // Modal QR Code Urna Remota
  const [urnaQrModal, setUrnaQrModal] = useState<UrnaRemota | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // ==========================================
  // TEMA CLARO / ESCURO (PERSISTÊNCIA LOCALSTORAGE)
  // ==========================================
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

  // ==========================================
  // ALTERAR SENHA DA COMISSÃO
  // ==========================================
  const [mostrarModalSenhaMembro, setMostrarModalSenhaMembro] = useState(false);
  const [senhaMembroAtual, setSenhaMembroAtual] = useState('');
  const [novaSenhaMembro, setNovaSenhaMembro] = useState('');
  const [confirmarSenhaMembro, setConfirmarSenhaMembro] = useState('');
  const [mostrarSenhaMembro, setMostrarSenhaMembro] = useState(false);
  const [alterandoSenhaMembro, setAlterandoSenhaMembro] = useState(false);
  const [erroSenhaMembro, setErroSenhaMembro] = useState<string | null>(null);

  const handleAlterarSenhaMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSenhaMembro(null);

    if (novaSenhaMembro.length < 8) {
      setErroSenhaMembro('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (novaSenhaMembro !== confirmarSenhaMembro) {
      setErroSenhaMembro('A confirmação da nova senha não confere.');
      return;
    }

    setAlterandoSenhaMembro(true);
    try {
      const email = authState.user?.email || '';
      const res = await alterarSenhaMembro(email, senhaMembroAtual, novaSenhaMembro);
      if (res.ok) {
        setMostrarModalSenhaMembro(false);
        setSenhaMembroAtual('');
        setNovaSenhaMembro('');
        setConfirmarSenhaMembro('');
        setModalConfig({
          isOpen: true,
          type: 'success',
          title: 'Senha Atualizada',
          message: 'Sua senha foi alterada com sucesso! Você será desconectado para realizar um novo login seguro.',
          onConfirm: () => {
            handleLogout();
          },
        });
      } else {
        setErroSenhaMembro(res.erro || 'Falha ao alterar senha.');
      }
    } catch (err: any) {
      setErroSenhaMembro(err.message || 'Erro inesperado.');
    } finally {
      setAlterandoSenhaMembro(false);
    }
  };

  // ==========================================
  // TAB 1: PLEITO (Cadastro & Seleção)
  // ==========================================
  const [novoPleitoNome, setNovoPleitoNome] = useState('');
  const [novoPleitoId, setNovoPleitoId] = useState('');
  const [novoPleitoAbertura, setNovoPleitoAbertura] = useState('');
  const [novoPleitoEncerramento, setNovoPleitoEncerramento] = useState('');
  const [mostrarModalNovoPleito, setMostrarModalNovoPleito] = useState(false);

  // ==========================================
  // TAB 2: GESTÃO DE CHAPAS COM REMOÇÃO DE FUNDO
  // ==========================================
  const [chapaEmEdicao, setChapaEmEdicao] = useState<Chapa | null>(null);
  const [modalChapaAberto, setModalChapaAberto] = useState(false);
  const [chapaNumero, setChapaNumero] = useState('');
  const [chapaNome, setChapaNome] = useState('');
  const [chapaPresidente, setChapaPresidente] = useState('');
  const [chapaVice, setChapaVice] = useState('');
  const [chapaLogo, setChapaLogo] = useState<string>('');
  const [processandoLogo, setProcessandoLogo] = useState(false);

  // ==========================================
  // TAB 3: GESTÃO DE ELEITORES & REMOÇÃO EM MASSA
  // ==========================================
  const [novaMatricula, setNovaMatricula] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaTurma, setNovaTurma] = useState('INFO-3A');
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatusEleitor, setFiltroStatusEleitor] = useState<'TODOS' | 'VOTARAM' | 'NAO_VOTARAM'>('TODOS');
  const [paginaEleitores, setPaginaEleitores] = useState(1);
  const [eleitoresSelecionados, setEleitoresSelecionados] = useState<Set<string>>(new Set());
  const itensPorPagina = 10;

  // Subscrições do Firestore
  useEffect(() => {
    const unsubChapas = subscribeChapas(setChapas);
    const unsubPleitos = subscribePleitos(setPleitos);
    return () => {
      unsubChapas();
      unsubPleitos();
    };
  }, []);

  useEffect(() => {
    setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR'));
  }, [votos, eleitores, estadoEleicao, urnasRemotas, chapas]);

  // Gera o QR Code quando a urna selecionada abre
  useEffect(() => {
    if (urnaQrModal && qrCanvasRef.current) {
      const url = `${window.location.origin}${window.location.pathname}?urna=${urnaQrModal.id}`;
      QRCode.toCanvas(qrCanvasRef.current, url, {
        width: 250,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    }
  }, [urnaQrModal]);

  const logStatus = (msg: string) => {
    setStatusMsg(msg);
  };

  const pleitoAtivoId = estadoEleicao.pleitoIdentificador || 'ifvote-rj';
  const pleitoAtivoNome = estadoEleicao.pleitoNome || estadoEleicao.titulo || 'Consulta Eleitoral do Grêmio Estudantil';
  const ehSuperAdmin = authState.user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  // ==========================================
  // FUNÇÕES TAB 1: PLEITOS
  // ==========================================
  const handleCriarNovoPleito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPleitoNome.trim() || !novoPleitoId.trim()) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Dados Incompletos',
        message: 'Informe o nome e o identificador do pleito (ex: ifvote-braganca).',
      });
      return;
    }

    try {
      const criado = await criarPleito({
        id: novoPleitoId.trim(),
        nome: novoPleitoNome.trim(),
        identificador: novoPleitoId.trim(),
        dataAbertura: novoPleitoAbertura || new Date().toISOString(),
        dataEncerramento: novoPleitoEncerramento || new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'EM_ANDAMENTO',
      });

      await ativarPleito(criado);
      setMostrarModalNovoPleito(false);
      setNovoPleitoNome('');
      setNovoPleitoId('');
      setNovoPleitoAbertura('');
      setNovoPleitoEncerramento('');

      setModalConfig({
        isOpen: true,
        type: 'success',
        title: 'Pleito Criado com Sucesso',
        message: `O pleito "${criado.nome}" (${criado.identificador}) agora está ativo no sistema!`,
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

  const handleTrocarPleitoAtivo = async (p: Pleito) => {
    try {
      await ativarPleito(p);
      setModalConfig({
        isOpen: true,
        type: 'success',
        title: 'Pleito Selecionado',
        message: `O pleito "${p.nome}" (${p.identificador}) foi definido como ativo.`,
      });
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: err.message,
      });
    }
  };

  // Iniciar / Ativar Urnas por X minutos
  const handleIniciarEleicao = async () => {
    try {
      logStatus('Liberando urnas e iniciando contagem...');
      const encerramento = await iniciarEleicao(Number(minutos));
      const hora = encerramento ? new Date(encerramento).toLocaleTimeString('pt-BR') : 'Indeterminado';
      logStatus(`Eleição em andamento. Urnas liberadas até ${hora}.`);
      setModalConfig({
        isOpen: true,
        type: 'success',
        title: 'Urnas Digitais Ativadas',
        message: `As urnas foram liberadas com sucesso!\n\nPrevisão de encerramento regulamentar: ${hora}.`,
      });
    } catch {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro de Comunicação',
        message: 'Falha ao conectar com o banco de dados para liberar as urnas.',
      });
    }
  };

  // ==========================================
  // FUNÇÕES TAB 2: GESTÃO DE CHAPAS (SIMPLIFICADA)
  // - Logo da chapa (imagem)
  // - Nome da chapa
  // - Nome do(a) candidato(a) a Presidente
  // - Nome do(a) candidato(a) a Vice
  // - Número da chapa (necessário para a votação)
  // ==========================================
  const abrirModalChapa = (chapa?: Chapa) => {
    if (chapa) {
      setChapaEmEdicao(chapa);
      setChapaNumero(chapa.numero);
      setChapaNome(chapa.nome);
      setChapaPresidente(chapa.nomePresidente || '');
      setChapaVice(chapa.nomeVice || '');
      setChapaLogo(chapa.logo || chapa.fotoPresidente || '');
    } else {
      setChapaEmEdicao(null);
      setChapaNumero('');
      setChapaNome('');
      setChapaPresidente('');
      setChapaVice('');
      setChapaLogo('');
    }
    setModalChapaAberto(true);
  };

  // Upload de Logo com Remoção Automática de Fundo
  const handleUploadLogoChapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessandoLogo(true);
    try {
      const recortada = await removerFundoImagem(file, { tolerance: 35 });
      setChapaLogo(recortada);
      logStatus('Logo da chapa recortada com fundo transparente!');
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setChapaLogo(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setProcessandoLogo(false);
      e.target.value = '';
    }
  };

  const handleSalvarChapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapaNumero.trim() || !chapaNome.trim() || !chapaPresidente.trim() || !chapaVice.trim()) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Dados Incompletos',
        message: 'Preencha todos os campos obrigatórios da chapa: Número, Nome, Presidente e Vice.',
      });
      return;
    }

    try {
      await salvarChapa({
        id: chapaNumero.trim(),
        numero: chapaNumero.trim(),
        nome: chapaNome.trim(),
        nomePresidente: chapaPresidente.trim(),
        nomeVice: chapaVice.trim(),
        logo: chapaLogo || undefined,
        fotoPresidente: chapaLogo || undefined,
        pleitoId: pleitoAtivoId,
      });

      setModalChapaAberto(false);
      setModalConfig({
        isOpen: true,
        type: 'success',
        title: 'Chapa Salva com Sucesso',
        message: `A Chapa ${chapaNumero} (${chapaNome}) foi cadastrada e está pronta para receber votos na urna!`,
      });
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar Chapa',
        message: err.message || 'Falha ao salvar chapa.',
      });
    }
  };

  const handleExcluirChapa = (chapaId: string, nome: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Excluir Chapa Concorrente',
      message: `Tem certeza que deseja excluir a "${nome}" (Chapa ${chapaId})?`,
      confirmLabel: 'Excluir Chapa',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          await excluirChapa(chapaId);
          logStatus(`Chapa ${chapaId} excluída.`);
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: err.message,
          });
        }
      },
    });
  };

  // ==========================================
  // FUNÇÕES TAB 3: GESTÃO & REMOÇÃO DE ELEITORES
  // ==========================================
  const handleCadastrarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await cadastrarEleitor(novaMatricula, novoNome, novaTurma);
    if (res.ok) {
      setNovaMatricula('');
      setNovoNome('');
      setModalConfig({
        isOpen: true,
        type: 'success',
        title: 'Eleitor Cadastrado',
        message: `O eleitor ${novoNome} foi credenciado com sucesso no sistema!`,
      });
    } else {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro no Cadastro',
        message: res.erro || 'Falha ao cadastrar eleitor.',
      });
    }
  };

  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const dados: { matricula: string; nome: string; turma: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (i === 0 && (line.toLowerCase().includes('matricula') || line.toLowerCase().includes('nome'))) {
          continue;
        }

        const parts = line.split(/[;,]/);
        if (parts.length >= 2) {
          dados.push({
            matricula: parts[0]?.trim(),
            nome: parts[1]?.trim(),
            turma: parts[2]?.trim() || 'GERAL',
          });
        }
      }

      if (dados.length > 0) {
        const res = await importarEleitoresCSV(dados);
        if (res.ok) {
          setModalConfig({
            isOpen: true,
            type: 'success',
            title: 'Importação Concluída',
            message: `${res.importados} eleitores foram cadastrados com sucesso via arquivo CSV!`,
          });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Remoção Individual de Eleitor
  const handleExcluirEleitorIndividual = (eleitor: Eleitor) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Remover Eleitor',
      message: `Deseja remover o eleitor ${eleitor.nome} (Matrícula: ${eleitor.matricula}) do cadastro de votantes?`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          await excluirEleitor(eleitor.matricula);
          setEleitoresSelecionados((prev) => {
            const next = new Set(prev);
            next.delete(eleitor.matricula);
            return next;
          });
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: err.message,
          });
        }
      },
    });
  };

  // Remoção em Massa de Eleitores
  const handleExcluirEmMassa = () => {
    const total = eleitoresSelecionados.size;
    if (total === 0) return;

    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Exclusão em Massa de Eleitores',
      message: `ATENÇÃO: Você está prestes a excluir ${total} eleitores selecionados do cadastro eleitoral.\n\nEsta ação removerá permanentemente os registros da base de dados. Deseja continuar?`,
      confirmLabel: `Sim, Excluir ${total} Eleitores`,
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          const listaMats = Array.from(eleitoresSelecionados);
          await excluirEleitoresEmMassa(listaMats);
          setEleitoresSelecionados(new Set());
          setModalConfig({
            isOpen: true,
            type: 'success',
            title: 'Exclusão Concluída',
            message: `${total} eleitores foram removidos do cadastro com sucesso.`,
          });
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro na Exclusão',
            message: err.message,
          });
        }
      },
    });
  };

  // Seleção e Filtros de Eleitores
  const eleitoresFiltrados = useMemo(() => {
    return eleitores.filter((e) => {
      const matchBusca =
        e.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
        e.matricula.includes(termoBusca) ||
        e.turma.toLowerCase().includes(termoBusca.toLowerCase());

      if (!matchBusca) return false;

      if (filtroStatusEleitor === 'VOTARAM') return e.votou;
      if (filtroStatusEleitor === 'NAO_VOTARAM') return !e.votou;
      return true;
    });
  }, [eleitores, termoBusca, filtroStatusEleitor]);

  const totalPaginasEleitores = Math.ceil(eleitoresFiltrados.length / itensPorPagina) || 1;
  const eleitoresPaginados = useMemo(() => {
    const inicio = (paginaEleitores - 1) * itensPorPagina;
    return eleitoresFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [eleitoresFiltrados, paginaEleitores]);

  const toggleSelecionarTodosNaPagina = () => {
    const todosSelecionados = eleitoresPaginados.every((e) => eleitoresSelecionados.has(e.matricula));
    setEleitoresSelecionados((prev) => {
      const next = new Set(prev);
      if (todosSelecionados) {
        eleitoresPaginados.forEach((e) => next.delete(e.matricula));
      } else {
        eleitoresPaginados.forEach((e) => next.add(e.matricula));
      }
      return next;
    });
  };

  const toggleSelecionarTodosNoPleito = () => {
    if (eleitoresSelecionados.size === eleitoresFiltrados.length) {
      setEleitoresSelecionados(new Set());
    } else {
      setEleitoresSelecionados(new Set(eleitoresFiltrados.map((e) => e.matricula)));
    }
  };

  // ==========================================
  // FUNÇÕES TAB 4: URNAS REMOTAS
  // ==========================================
  const handleCriarNovaUrna = async () => {
    try {
      const nova = await criarUrnaRemota();
      setUrnaQrModal(nova);
    } catch {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Criar Urna',
        message: 'Não foi possível autorizar novo terminal de urna no banco de dados.',
      });
    }
  };

  const handleAlternarStatusUrna = (urna: UrnaRemota) => {
    const novoStatus = urna.status === 'REVOGADA' ? 'ONLINE' : 'REVOGADA';
    const msgAcao = novoStatus === 'REVOGADA' ? 'Revogar e Bloquear' : 'Reativar';

    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: `${msgAcao} Urna Nº ${String(urna.numero).padStart(2, '0')}`,
      message:
        novoStatus === 'REVOGADA'
          ? `Deseja realmente REVOGAR o acesso da Urna Nº ${String(urna.numero).padStart(2, '0')} (${urna.identificador})?\n\nO dispositivo conectado a esta cabine será imediatamente travado com tela de bloqueio e não poderá computar votos.`
          : `Deseja REATIVAR a Urna Nº ${String(urna.numero).padStart(2, '0')} (${urna.identificador}) para que volte a receber votos?`,
      confirmLabel: msgAcao,
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          await alterarStatusUrnaRemota(urna.id, novoStatus);
        } catch {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: 'Falha ao atualizar status da urna.',
          });
        }
      },
    });
  };

  const handleExcluirUrna = (urna: UrnaRemota) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: `Excluir Urna Nº ${String(urna.numero).padStart(2, '0')}`,
      message: `Tem certeza que deseja remover definitivamente a ${urna.identificador} da lista de terminais autorizados?`,
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          await excluirUrnaRemota(urna.id);
        } catch {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: 'Falha ao excluir urna.',
          });
        }
      },
    });
  };

  const copiarLinkUrna = (urna: UrnaRemota) => {
    const url = `${window.location.origin}${window.location.pathname}?urna=${urna.id}`;
    navigator.clipboard.writeText(url);
    setCopiadoId(urna.id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  // ==========================================
  // FUNÇÕES TAB 6: DOCUMENTOS COM MARCA D'ÁGUA
  // ==========================================
  const emitirZerésima = () => {
    const agora = new Date().toLocaleString('pt-BR');
    const conteudo = `======================================================
           IFVOTE — ZERÉSIMA OFICIAL DO PLEITO
======================================================
IDENTIFICADOR: ${pleitoAtivoId}
PLEITO: ${pleitoAtivoNome}
DATA/HORA DE EMISSÃO: ${agora}
HASH DE AUDITORIA: ${estadoEleicao.hashAnterior || '0000000000000000000000000000000000000000'}

CHAPAS CADASTRADAS:
${chapas.map((c) => `[CHAPA ${c.numero}] ${c.nome} - Pres: ${c.nomePresidente || '—'}`).join('\n')}

ESTADO DOS VOTOS:
- Total de Votos Registrados: 0 (ZERO)
- Votos Válidos: 0
- Votos em Branco: 0
- Votos Nulos: 0

CERTIFICAÇÃO DA COMISSÃO ELEITORAL:
Certificamos para os devidos fins que a presente urna digital
encontra-se zerada e pronta para o início regular dos trabalhos.

_______________________________________________
Presidente da Comissão Eleitoral
IFPA Campus Bragança • IFVote Estudantil
======================================================`;

    setModalDocumento({
      tipo: 'zeresima',
      titulo: 'Zerésima Oficial da Eleição',
      conteudo,
    });
  };

  const emitirBoletimUrna = () => {
    const agora = new Date().toLocaleString('pt-BR');
    const conteudo = `======================================================
       IFVOTE — BOLETIM DE URNA OFICIAL (BU)
======================================================
IDENTIFICADOR: ${pleitoAtivoId}
PLEITO: ${pleitoAtivoNome}
DATA/HORA DE EMISSÃO: ${agora}
STATUS DO PLEITO: ${estadoEleicao.eleicaoAtiva ? 'EM ANDAMENTO' : 'ENCERRADO'}
TOTAL DE VOTOS COMPUTADOS: ${votos.length}
HASH CRIPTOGRÁFICO: ${estadoEleicao.hashAnterior}

DISTRIBUIÇÃO POR TERMINAL DE VOTAÇÃO:
${urnasRemotas.map((u) => `- Urna Nº ${String(u.numero).padStart(2, '0')} (${u.identificador}): ${u.totalVotosColetados || 0} votos`).join('\n')}

CERTIDÃO DE ENCERRAMENTO E AUDITORIA:
Boletim gerado a partir do livro-razão imutável SHA-256 do IFVote.

_______________________________________________
Comissão Eleitoral Estudantil
IFPA Campus Bragança • Wagner Rocha
======================================================`;

    setModalDocumento({
      tipo: 'boletim',
      titulo: 'Boletim de Urna (BU)',
      conteudo,
    });
  };

  const emitirAtaEleitoral = () => {
    const agora = new Date().toLocaleString('pt-BR');
    const conteudo = `======================================================
            IFVOTE — ATA GERAL DA ELEIÇÃO
======================================================
IDENTIFICADOR DO PLEITO: ${pleitoAtivoId}
TÍTULO: ${pleitoAtivoNome}
DATA/HORA: ${agora}

Aos ${new Date().toLocaleDateString('pt-BR')}, reuniu-se a Comissão Eleitoral
para lavratura da ata de realização da consulta estudantil.

1. DA REGULARIDADE DO PROCESSO:
O sistema IFVote operou com autenticação segura, criptografia ponta a ponta
e registro anônimo de todas as cédulas eletrônicas.

2. DAS URNAS UTILIZADAS:
Foram autorizadas e operaram ${urnasRemotas.length} terminais de urna remota.

3. DO ENCERRAMENTO:
Nada mais havendo a constar, encerra-se a presente ata.

_______________________________________________
Representante do Grêmio Estudantil

_______________________________________________
Wagner Rocha • Desenvolvedor IFVote
======================================================`;

    setModalDocumento({
      tipo: 'ata',
      titulo: 'Ata Geral da Eleição Estudantil',
      conteudo,
    });
  };

  const handleLogout = () => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Sair da Sessão',
      message: 'Deseja encerrar sua sessão autenticada com Google na comissão eleitoral?',
      confirmLabel: 'Sair',
      cancelLabel: 'Permanecer',
      onConfirm: async () => {
        await logout();
        onVoltar();
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] p-4 md:p-8 font-sans selection:bg-blue-600 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* BARRA SUPERIOR: NAVEGAÇÃO, LOGO & PERFIL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#30363d] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onVoltar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg font-bold transition-colors cursor-pointer border border-[#30363d]"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span>Início</span>
            </button>

            {ehSuperAdmin && (
              <button
                type="button"
                onClick={onIrMaster}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors cursor-pointer shadow-sm text-xs"
                title="Acesso exclusivo ao Controle Geral (Atalho: Ctrl + M)"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Controle Geral</span>
                <span className="text-[10px] bg-red-800 px-1 py-0.5 rounded font-mono">Ctrl+M</span>
              </button>
            )}
          </div>

          {/* Usuário e Membros */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#161b22] border border-[#30363d] rounded-lg">
              <div className="w-6 h-6 rounded-full bg-[#1f6feb] text-white flex items-center justify-center font-bold text-[10px]">
                {authState.user?.displayName ? authState.user.displayName[0].toUpperCase() : 'A'}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-white font-bold text-[11px] leading-tight">
                  {authState.user?.displayName || 'Administrador'}
                </div>
                <div className="text-[#8b949e] text-[10px] truncate max-w-[150px]">
                  {authState.user?.email}
                </div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-[#1f6feb]/20 text-[#58a6ff]">
                {authState.papel || 'ADMIN'}
              </span>
            </div>

            {/* Alternador de Tema Claro / Escuro */}
            <button
              type="button"
              onClick={alternarTema}
              className={`p-1.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                tema === 'dark'
                  ? 'bg-[#21262d] border-[#30363d] text-amber-400 hover:bg-[#30363d]'
                  : 'bg-slate-200 border-slate-300 text-blue-700 hover:bg-slate-300'
              }`}
              title={tema === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {tema === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Alterar Senha da Comissão */}
            <button
              type="button"
              onClick={() => {
                setMostrarModalSenhaMembro(true);
                setErroSenhaMembro(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-slate-200 rounded text-[11px] font-bold cursor-pointer border border-[#30363d]"
              title="Alterar minha senha de acesso"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Senha</span>
            </button>

            {ehSuperAdmin && (
              <button
                type="button"
                onClick={() => setModalAdminsAberto(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-white rounded text-[11px] font-bold cursor-pointer border border-[#30363d]"
                title="Gerenciar membros da comissão"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Membros</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#21262d] hover:bg-[#da3633]/20 hover:text-[#f85149] text-[#8b949e] rounded text-[11px] font-bold cursor-pointer transition-colors border border-[#30363d]"
              title="Encerrar sessão administrativa"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* CABEÇALHO DO PAINEL COM IDENTIFICAÇÃO DO PLEITO EM DESTAQUE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#30363d] pb-4">
          <div className="flex items-center gap-4">
            <IfVoteLogo size="md" theme={tema} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  Painel de Gestão Eleitoral
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold tracking-wider">
                  {pleitoAtivoId}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {pleitoAtivoNome} • <span className="text-emerald-400">Bragança - Pará</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0e1d14] border border-[#238636]/60 rounded-lg text-[11px] text-[#3fb950] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
              <span>Conectado em Tempo Real</span>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO EM GUIAS / ABAS ADMINISTRATIVAS SOLICITADAS */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-1.5 flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAtiva('pleito')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'pleito'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Pleito & Horários</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('chapas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'chapas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <Vote className="w-4 h-4" />
            <span>Chapas ({chapas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('eleitores')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'eleitores'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Eleitores ({eleitores.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('urnas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'urnas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Urnas e Links ({urnasRemotas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('apuracao')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'apuracao'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Apuração em Colunas</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('documentos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'documentos'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documentos & Atas</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* ABA 1: PLEITO (IDENTIFICAÇÃO, CRIAÇÃO E CONTROLE) */}
        {/* ========================================================= */}
        {abaAtiva === 'pleito' && (
          <div className="space-y-6">
            {/* Card do Pleito Ativo em Destaque */}
            <div className="bg-[#161b22] border border-[#30363d] border-l-4 border-l-blue-500 rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                    Pleito Oficial em Andamento
                  </div>
                  <h2 className="text-2xl font-black text-white">{pleitoAtivoNome}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400">
                      ID: {pleitoAtivoId}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold ${
                        estadoEleicao.eleicaoAtiva
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      {estadoEleicao.eleicaoAtiva ? '🟢 Votação Ativa' : '🔴 Votação Bloqueada'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarModalNovoPleito(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Novo Pleito</span>
                </button>
              </div>

              {/* Controle de Abertura / Tempo Regulamentar */}
              <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                <div>
                  <div className="text-xs font-bold text-white mb-0.5">Tempo Regulamentar da Votação</div>
                  <div className="text-xs text-slate-400">
                    Defina a duração em minutos para liberação das urnas digitais.
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={minutos}
                    onChange={(e) => setMinutos(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-white font-mono text-center text-sm font-bold"
                  />
                  <span className="text-xs text-slate-400">min</span>

                  <button
                    type="button"
                    onClick={handleIniciarEleicao}
                    className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
                  >
                    Ativar Urnas Agora
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Pleitos Cadastrados */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Histórico de Pleitos Cadastrados ({pleitos.length})</span>
              </h3>

              <div className="space-y-3">
                {pleitos.map((p) => {
                  const ehAtivo = p.identificador === pleitoAtivoId;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        ehAtivo
                          ? 'bg-blue-950/30 border-blue-500/50'
                          : 'bg-[#0d1117] border-[#30363d] hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{p.nome}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-emerald-400">
                            {p.identificador}
                          </span>
                          {ehAtivo && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                              ATIVO
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Cadastrado em: {new Date(p.criadoEm).toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      {!ehAtivo && (
                        <button
                          type="button"
                          onClick={() => handleTrocarPleitoAtivo(p)}
                          className="px-3 py-1.5 bg-[#21262d] hover:bg-blue-600 hover:text-white text-slate-300 rounded text-xs font-bold transition-colors cursor-pointer border border-[#30363d]"
                        >
                          Definir como Pleito Ativo
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 2: GESTÃO DE CHAPAS COM REMOÇÃO DE FUNDO */}
        {/* ========================================================= */}
        {abaAtiva === 'chapas' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Vote className="w-5 h-5 text-blue-400" />
                  <span>Chapas Concorrentes ({chapas.length})</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Cadastre candidatos com fotos recortadas sem fundo. Na urna, ao digitar o número da chapa, as fotos e nomes são exibidos automaticamente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => abrirModalChapa()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Chapa Concorrente</span>
              </button>
            </div>

            {/* Grid de Chapas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chapas.map((chapa) => {
                const logoSrc = chapa.logo || chapa.fotoPresidente;
                return (
                  <div
                    key={chapa.id}
                    className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Logo da Chapa com Fallback para Número Estilizado */}
                        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={chapa.nome}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-black text-2xl text-white">
                              {chapa.numero}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-blue-950 text-blue-400 border border-blue-800">
                              CHAPA {chapa.numero}
                            </span>
                          </div>
                          <h3 className="text-base font-extrabold text-white mt-0.5">{chapa.nome}</h3>
                          <div className="text-xs text-slate-400">
                            Pleito: <span className="font-mono text-emerald-400">{chapa.pleitoId || pleitoAtivoId}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirModalChapa(chapa)}
                          className="px-2.5 py-1 bg-[#21262d] hover:bg-[#30363d] text-slate-300 rounded text-xs font-bold transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluirChapa(chapa.id, chapa.nome)}
                          className="p-1.5 hover:bg-red-950/60 text-slate-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                          title="Excluir Chapa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Candidatos a Presidente e Vice */}
                    <div className="grid grid-cols-2 gap-3 bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
                      <div>
                        <div className="text-[10px] text-blue-400 font-bold uppercase">Presidente</div>
                        <div className="text-xs font-bold text-white truncate mt-0.5">
                          {chapa.nomePresidente || 'Não informado'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-blue-400 font-bold uppercase">Vice</div>
                        <div className="text-xs font-bold text-white truncate mt-0.5">
                          {chapa.nomeVice || 'Não informado'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 3: GESTÃO & REMOÇÃO EM MASSA DE ELEITORES */}
        {/* ========================================================= */}
        {abaAtiva === 'eleitores' && (
          <div className="space-y-6">
            {/* Topo da Gestão de Eleitores */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span>Cadastro de Eleitores Aptos ({eleitores.length})</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Gerencie o colégio eleitoral com suporte a remoção individual, seleção múltipla e exclusão em massa.
                </p>
              </div>

              {/* Botão de Exclusão em Massa */}
              {eleitoresSelecionados.size > 0 && (
                <button
                  type="button"
                  onClick={handleExcluirEmMassa}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer animate-pulse"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir {eleitoresSelecionados.size} Selecionados</span>
                </button>
              )}
            </div>

            {/* Cadastro Manual e Importação CSV */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <form
                onSubmit={handleCadastrarManual}
                className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-col sm:flex-row items-center gap-2"
              >
                <input
                  type="text"
                  required
                  placeholder="Matrícula (ex: 20231014040001)"
                  value={novaMatricula}
                  onChange={(e) => setNovaMatricula(e.target.value)}
                  className="w-full sm:w-1/3 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Nome do Eleitor"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full sm:w-1/3 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Turma (ex: INFO-3A)"
                  value={novaTurma}
                  onChange={(e) => setNovaTurma(e.target.value)}
                  className="w-full sm:w-1/6 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-white"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0"
                >
                  Adicionar
                </button>
              </form>

              {/* Botão Importar CSV */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Importar Lote (CSV)</div>
                  <div className="text-[11px] text-slate-400">matricula,nome,turma</div>
                </div>
                <label className="px-3 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors border border-[#30363d] flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Subir CSV</span>
                  <input type="file" accept=".csv" onChange={handleUploadCSV} className="hidden" />
                </label>
              </div>
            </div>

            {/* Tabela de Eleitores com Filtros e Seleção Múltipla */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#30363d] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                {/* Barra de Busca */}
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    placeholder="Buscar por nome, matrícula ou turma..."
                    value={termoBusca}
                    onChange={(e) => {
                      setTermoBusca(e.target.value);
                      setPaginaEleitores(1);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-white"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>

                {/* Filtro Status e Botão Selecionar Todos */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <button
                    type="button"
                    onClick={toggleSelecionarTodosNoPleito}
                    className="px-2.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-slate-300 rounded text-xs font-semibold cursor-pointer border border-[#30363d]"
                  >
                    {eleitoresSelecionados.size === eleitoresFiltrados.length
                      ? 'Desmarcar Todos'
                      : 'Selecionar Todos'}
                  </button>

                  <select
                    value={filtroStatusEleitor}
                    onChange={(e) => {
                      setFiltroStatusEleitor(e.target.value as any);
                      setPaginaEleitores(1);
                    }}
                    className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-slate-300 cursor-pointer"
                  >
                    <option value="TODOS">Todos os Eleitores</option>
                    <option value="VOTARAM">Já Votaram</option>
                    <option value="NAO_VOTARAM">Ainda Não Votaram</option>
                  </select>
                </div>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0d1117] text-slate-400 uppercase font-semibold border-b border-[#30363d]">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={
                            eleitoresPaginados.length > 0 &&
                            eleitoresPaginados.every((e) => eleitoresSelecionados.has(e.matricula))
                          }
                          onChange={toggleSelecionarTodosNaPagina}
                          className="rounded cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3">Matrícula</th>
                      <th className="px-4 py-3">Nome Completo</th>
                      <th className="px-4 py-3">Turma</th>
                      <th className="px-4 py-3">Comparecimento</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d] text-slate-300">
                    {eleitoresPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Nenhum eleitor encontrado para este filtro.
                        </td>
                      </tr>
                    ) : (
                      eleitoresPaginados.map((e) => {
                        const isSelected = eleitoresSelecionados.has(e.matricula);
                        return (
                          <tr
                            key={e.matricula}
                            className={`hover:bg-[#21262d]/50 transition-colors ${
                              isSelected ? 'bg-blue-950/20' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setEleitoresSelecionados((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(e.matricula)) next.delete(e.matricula);
                                    else next.add(e.matricula);
                                    return next;
                                  });
                                }}
                                className="rounded cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-white">{e.matricula}</td>
                            <td className="px-4 py-3 font-semibold text-slate-200">{e.nome}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                                {e.turma}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {e.votou ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  <span>Votou</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  <span>Pendente</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleExcluirEleitorIndividual(e)}
                                className="p-1 hover:bg-red-950/60 text-slate-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                                title="Remover Eleitor"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="p-4 border-t border-[#30363d] flex items-center justify-between text-xs text-slate-400">
                <div>
                  Página <strong>{paginaEleitores}</strong> de <strong>{totalPaginasEleitores}</strong> (
                  {eleitoresFiltrados.length} eleitores)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paginaEleitores <= 1}
                    onClick={() => setPaginaEleitores((p) => Math.max(1, p - 1))}
                    className="p-1.5 bg-[#21262d] rounded disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={paginaEleitores >= totalPaginasEleitores}
                    onClick={() => setPaginaEleitores((p) => Math.min(totalPaginasEleitores, p + 1))}
                    className="p-1.5 bg-[#21262d] rounded disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 4: URNAS REMOTAS E LINKS DE VOTAÇÃO */}
        {/* ========================================================= */}
        {abaAtiva === 'urnas' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-blue-400" />
                  <span>Urnas Remotas & Links Autorizados ({urnasRemotas.length})</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Gere links e QR Codes exclusivos para cada cabine ou dispositivo de votação.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCriarNovaUrna}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Gerar Novo Link de Urna</span>
              </button>
            </div>

            {/* Grid de Urnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {urnasRemotas.map((urna) => {
                const isOnline = urna.status === 'ONLINE';
                const isRevogada = urna.status === 'REVOGADA';
                const linkCompleto = `${window.location.origin}${window.location.pathname}?urna=${urna.id}`;

                return (
                  <div
                    key={urna.id}
                    className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-sm">
                            {String(urna.numero).padStart(2, '0')}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-white">{urna.identificador}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Token: {urna.token}</div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isRevogada
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : isOnline
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {urna.status}
                        </span>
                      </div>

                      <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d] text-xs space-y-1.5 my-3">
                        <div className="flex justify-between text-slate-400">
                          <span>Votos Coletados:</span>
                          <strong className="text-white">{urna.totalVotosColetados || 0}</strong>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Criada em:</span>
                          <span>{new Date(urna.criadaEm).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#30363d]">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setUrnaQrModal(urna)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5 text-blue-400" />
                          <span>Ver QR Code</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copiarLinkUrna(urna)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          {copiadoId === urna.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleAlternarStatusUrna(urna)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            isRevogada
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900'
                              : 'bg-amber-950 text-amber-400 border border-amber-800 hover:bg-amber-900'
                          }`}
                        >
                          {isRevogada ? 'Reativar Urna' : 'Revogar Terminal'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExcluirUrna(urna)}
                          className="p-1.5 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg cursor-pointer"
                          title="Remover Urna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 5: APURAÇÃO EM COLUNAS */}
        {/* ========================================================= */}
        {abaAtiva === 'apuracao' && (
          <div className="space-y-6">
            <ApuracaoGraficos
              votos={votos}
              urnasRemotas={urnasRemotas}
              chapas={chapas}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 6: DOCUMENTOS, ATAS & ZERÉSIMA COM MARCA D'ÁGUA */}
        {/* ========================================================= */}
        {abaAtiva === 'documentos' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span>Documentação Oficial e Atas de Eleição</span>
              </h2>
              <p className="text-xs text-slate-400">
                Gere documentos oficiais com marca d'água de autenticidade contendo o identificador do pleito.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Zerésima Oficial</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Certidão obrigatória comprovando que a eleição iniciou com zero votos registrados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={emitirZerésima}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Visualizar e Imprimir
                </button>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Boletim de Urna (BU)</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Relatório consolidado com a apuração por terminal e hash de integridade criptográfica.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={emitirBoletimUrna}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Emitir Boletim (BU)
                </button>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Ata Geral da Eleição</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Documento formal para registro e assinatura pela comissão e representantes de chapas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={emitirAtaEleitoral}
                  className="w-full py-2.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Gerar Ata Oficial
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RODAPÉ INSTITUCIONAL LEVE */}
        <footer className="mt-8 pt-4 border-t border-[#30363d] text-center text-xs text-[#8b949e] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-300">IFVote — Urna Digital Estudantil</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">IFPA – Campus Bragança</span>
          </div>
          <div>
            Desenvolvido por <strong className="text-slate-200">Wagner Rocha</strong> • 1º Grêmio Estudantil
          </div>
        </footer>
      </div>

      {/* ========================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE CHAPA COM FOTOS SEM FUNDO */}
      {/* ========================================================= */}
      {modalChapaAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Vote className="w-5 h-5 text-blue-400" />
                <span>{chapaEmEdicao ? 'Editar Chapa' : 'Cadastrar Nova Chapa'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalChapaAberto(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarChapa} className="space-y-4 text-xs">
              {/* 1. Número da Chapa e 2. Nome da Chapa */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Número (2 dígitos)</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    placeholder="Ex: 10"
                    value={chapaNumero}
                    onChange={(e) => setChapaNumero(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white font-mono text-center text-lg font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">Nome da Chapa</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Chapa 10 - Renovação Estudantil"
                    value={chapaNome}
                    onChange={(e) => setChapaNome(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white"
                  />
                </div>
              </div>

              {/* 3. Logo da Chapa (Imagem) com Remoção Automática de Fundo */}
              <div className="p-3 bg-[#0d1117] rounded-xl border border-[#30363d] space-y-2">
                <label className="block text-slate-300 font-bold">Logo da Chapa (Imagem)</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {processandoLogo ? (
                      <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : chapaLogo ? (
                      <img src={chapaLogo} alt="Logo da Chapa" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-white rounded text-[11px] font-bold cursor-pointer transition-colors border border-[#30363d]">
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>{chapaLogo ? 'Trocar Logo' : 'Enviar Logo da Chapa'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadLogoChapa}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-500">
                      O fundo da imagem será recortado automaticamente para transparência.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Candidato(a) a Presidente */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Nome do(a) Candidato(a) a Presidente
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo do candidato a Presidente"
                  value={chapaPresidente}
                  onChange={(e) => setChapaPresidente(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white"
                />
              </div>

              {/* 5. Candidato(a) a Vice */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Nome do(a) Candidato(a) a Vice
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo do candidato a Vice"
                  value={chapaVice}
                  onChange={(e) => setChapaVice(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setModalChapaAberto(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                >
                  Salvar Chapa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CADASTRO DE NOVO PLEITO */}
      {/* ========================================================= */}
      {mostrarModalNovoPleito && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Novo Pleito / Eleição</h3>
            <p className="text-xs text-slate-400">
              Cadastre um novo processo eleitoral no padrão <code>ifvote-[sigla]</code>.
            </p>

            <form onSubmit={handleCriarNovoPleito} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Nome do Pleito</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Consulta Eleitoral Grêmio 2026"
                  value={novoPleitoNome}
                  onChange={(e) => setNovoPleitoNome(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Identificador (padrão: ifvote-[sigla])
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: ifvote-braganca ou ifvote-rj"
                  value={novoPleitoId}
                  onChange={(e) => setNovoPleitoId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Data Abertura</label>
                  <input
                    type="date"
                    value={novoPleitoAbertura}
                    onChange={(e) => setNovoPleitoAbertura(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Data Encerramento</label>
                  <input
                    type="date"
                    value={novoPleitoEncerramento}
                    onChange={(e) => setNovoPleitoEncerramento(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setMostrarModalNovoPleito(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                >
                  Criar Pleito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL QR CODE DA URNA REMOTA */}
      {/* ========================================================= */}
      {urnaQrModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <h3 className="text-base font-bold text-white">
              {urnaQrModal.identificador}
            </h3>
            <p className="text-xs text-slate-400">
              Escaneie este QR Code em um celular, tablet ou computador para abrir a cabine oficial desta urna.
            </p>

            <div className="bg-white p-4 rounded-xl inline-block mx-auto shadow-inner">
              <canvas ref={qrCanvasRef} />
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => copiarLinkUrna(urnaQrModal)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Link</span>
              </button>

              <button
                type="button"
                onClick={() => setUrnaQrModal(null)}
                className="px-3 py-2 bg-[#21262d] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#30363d]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE IMPRESSÃO DE DOCUMENTOS COM MARCA D'ÁGUA DIAGONAL */}
      {/* ========================================================= */}
      {modalDocumento && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 max-w-2xl w-full text-left space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <h3 className="text-base font-bold text-white uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>{modalDocumento.titulo}</span>
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                {pleitoAtivoId}
              </span>
            </div>

            {/* Painel do Documento com Marca d'Água Repetida Solicitada */}
            <div className="relative bg-[#010409] p-6 rounded-xl border border-slate-800 overflow-hidden min-h-[300px]">
              {/* Marca d'Água Repetida ao longo de todo o documento */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.05] flex flex-wrap content-around justify-around select-none overflow-hidden rotate-[-22deg] scale-125 z-0">
                {Array.from({ length: 30 }).map((_, i) => (
                  <span key={i} className="text-xl font-mono font-black tracking-widest text-white uppercase p-6">
                    IFVOTE • {pleitoAtivoId}
                  </span>
                ))}
              </div>

              {/* Texto do Documento */}
              <pre className="relative z-10 text-xs text-[#7ee787] font-mono whitespace-pre-wrap leading-relaxed select-text">
                {modalDocumento.conteudo}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir com Marca d'Água</span>
              </button>
              <button
                type="button"
                onClick={() => setModalDocumento(null)}
                className="bg-[#21262d] hover:bg-[#30363d] text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALTERAR SENHA DA COMISSÃO */}
      {mostrarModalSenhaMembro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Alterar Minha Senha</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Conta: <strong className="text-white font-mono">{authState.user?.email}</strong>
            </p>

            <form onSubmit={handleAlterarSenhaMembro} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Senha Atual</label>
                <div className="relative">
                  <input
                    type={mostrarSenhaMembro ? 'text' : 'password'}
                    value={senhaMembroAtual}
                    onChange={(e) => setSenhaMembroAtual(e.target.value)}
                    placeholder="Digite sua senha atual..."
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white font-mono pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaMembro(!mostrarSenhaMembro)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    {mostrarSenhaMembro ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nova Senha <span className="text-slate-500 font-normal">(mínimo 8 caracteres)</span>
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenhaMembro ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={novaSenhaMembro}
                    onChange={(e) => setNovaSenhaMembro(e.target.value)}
                    placeholder="Digite a nova senha segura..."
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white font-mono pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaMembro(!mostrarSenhaMembro)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    {mostrarSenhaMembro ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Confirmar Nova Senha</label>
                <input
                  type={mostrarSenhaMembro ? 'text' : 'password'}
                  required
                  value={confirmarSenhaMembro}
                  onChange={(e) => setConfirmarSenhaMembro(e.target.value)}
                  placeholder="Repita a nova senha..."
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white font-mono"
                />
              </div>

              {erroSenhaMembro && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-lg text-xs">
                  {erroSenhaMembro}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setMostrarModalSenhaMembro(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={alterandoSenhaMembro}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow disabled:opacity-50"
                >
                  {alterandoSenhaMembro ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAIS COMPLEMENTARES */}
      <GerenciarAdminsModal
        isOpen={modalAdminsAberto}
        onClose={() => setModalAdminsAberto(false)}
      />
      <ErrorModal config={modalConfig} onClose={() => setModalConfig(null)} />
    </div>
  );
};
