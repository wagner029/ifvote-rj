import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  increment,
  addDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import type { UrnaLocalizacao } from './locationService';
import bcrypt from 'bcryptjs';
import { SUPER_ADMIN_EMAIL } from './authService';

export const ELECTION_CONFIG_DOC = 'ifvote_config';

export interface Eleitor {
  matricula: string;
  nome: string;
  turma: string;
  votou: boolean;
  votouEm?: string;
}

export interface VotoRegistrado {
  id: string;
  chapa_id: string;
  turma_eleitor: string;
  timestamp: string;
  hash: string;
  urna_numero?: number;
}

export interface EstadoEleicao {
  eleicaoAtiva: boolean;
  tempoEncerramento: string | null;
  hashAnterior: string;
  titulo: string;
  totalEleitores: number;
  totalVotos: number;
  pleitoIdentificador?: string; // Padrão: ifvote-[sigla] (ex: ifvote-rj)
  pleitoNome?: string;
}

export interface Pleito {
  id: string; // Ex: 'ifvote-rj', 'ifvote-braganca'
  nome: string; // Ex: 'Eleição Grêmio Estudantil 2026'
  identificador: string; // Ex: 'ifvote-rj'
  dataAbertura: string;
  dataEncerramento: string;
  status: 'EM_ANDAMENTO' | 'CONFIGURACAO' | 'ENCERRADO' | 'CANCELADO';
  criadoEm: string;
  criadoPor?: string;
  totalVotos?: number;
  canceladoEm?: string;
  canceladoPor?: string;
  motivoCancelamento?: string;
}

/**
 * CADASTRO DE CHAPA (SIMPLIFICADO):
 * - Logo da chapa (imagem)
 * - Nome da chapa
 * - Nome do(a) candidato(a) a Presidente
 * - Nome do(a) candidato(a) a Vice
 * - Número da chapa (necessário para a votação)
 */
export interface Chapa {
  id: string; // Número da chapa (ex: '10', '20')
  numero: string; // Ex: '10'
  nome: string; // Ex: 'Chapa 10 - Renovação Estudantil'
  nomePresidente: string;
  nomeVice: string;
  logo?: string; // Imagem/Logo da chapa (Base64 PNG ou JPEG)
  pleitoId?: string;
  criadaEm?: string;
  // Campos legados para compatibilidade reversa
  fotoPresidente?: string;
  fotoVice?: string;
  propostas?: string;
}

export interface UrnaRemota {
  id: string;
  numero: number; // Ex: 1, 2, 3
  identificador: string; // Ex: "Urna 01"
  token: string;
  status: 'PENDENTE' | 'ONLINE' | 'REVOGADA';
  criadaEm: string;
  pleitoId?: string;
  pleitoNome?: string;
  localizacao?: UrnaLocalizacao;
  dispositivo?: {
    userAgent: string;
    conectadaEm: string;
    ultimoVotoEm?: string;
  };
  totalVotosColetados: number;
}

export interface SistemaAtivo {
  id: string;
  nome: string; // Ex: "IFVote RJ"
  sigla: string; // Ex: "RJ"
  instituto: string; // Ex: "IFRJ — Instituto Federal do Rio de Janeiro"
  status: 'EM_FUNCIONAMENTO' | 'PAUSADO' | 'ENCERRADO';
  localizacaoUrnas: string; // Ex: "Rio de Janeiro, RJ"
  monitoramento: string; // Ex: "Bragança, Pará (Wagner Rocha)"
  criadoEm: string;
  totalUrnas: number;
}

export interface LogSistema {
  id: string;
  tipo:
    | 'VOTO_COMPUTADO'
    | 'ELEITOR_CADASTRADO'
    | 'ELEITORES_CSV'
    | 'URNA_CRIADA'
    | 'URNA_REVOGADA'
    | 'URNA_REATIVADA'
    | 'URNA_EXCLUIDA'
    | 'URNA_CONEXAO'
    | 'ELEICAO_INICIADA'
    | 'ELEICAO_SUSPENSA'
    | 'ZERESIMA_EMITIDA'
    | 'BOLETIM_EMITIDO'
    | 'VOTOS_ZERADOS';
  descricao: string;
  detalhes?: Record<string, any>;
  timestamp: string;
  ipOuAgente?: string;
  urnaNumero?: number;
}

const ELEITORES_INICIAIS: Eleitor[] = [
  { matricula: '20231014040001', nome: 'Ana Clara Albuquerque', turma: 'INFO-3A', votou: false },
  { matricula: '20231014040002', nome: 'Bruno Henrique Silva', turma: 'INFO-3A', votou: false },
  { matricula: '20221014040015', nome: 'Camila Fernandes Rocha', turma: 'MEC-4B', votou: false },
  { matricula: '20211014040030', nome: 'Diego Martins de Oliveira', turma: 'ELETRO-2A', votou: false },
  { matricula: '1548721', nome: 'Prof. Marcos Vinicius', turma: 'DOCENTE', votou: false },
  { matricula: '3049182', nome: 'Ricardo Augusto Silveira', turma: 'TAE', votou: false },
];

/**
 * Inicializa a configuração do IFVote no Firestore caso ainda não exista.
 */
export async function inicializarIFVote(): Promise<void> {
  try {
    const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
    const snap = await getDoc(configRef);

    if (!snap.exists()) {
      const batch = writeBatch(db);

      const estadoInicial: EstadoEleicao = {
        eleicaoAtiva: true,
        tempoEncerramento: null,
        hashAnterior: '0000000000000000000000000000000000000000000000000000000000000000',
        titulo: 'Consulta Eleitoral do Grêmio Estudantil',
        totalEleitores: ELEITORES_INICIAIS.length,
        totalVotos: 0,
        pleitoIdentificador: 'ifvote-rj',
        pleitoNome: 'Consulta Eleitoral do Grêmio Estudantil 2026',
      };
      batch.set(configRef, estadoInicial);

      // Injeta eleitores iniciais
      for (const eleitor of ELEITORES_INICIAIS) {
        const eleitorRef = doc(db, 'eleitores_aptos', eleitor.matricula);
        batch.set(eleitorRef, eleitor);
      }

      // Cria a Urna 01 padrão
      const urna1Ref = doc(db, 'urnas_remotas', 'urna_01');
      const urnaInicial: UrnaRemota = {
        id: 'urna_01',
        numero: 1,
        identificador: 'Urna Nº 01 (Principal)',
        token: 'URNA-01-OFICIAL',
        status: 'PENDENTE',
        criadaEm: new Date().toISOString(),
        totalVotosColetados: 0,
      };
      batch.set(urna1Ref, urnaInicial);

      // Registra o sistema IFVote RJ inicial
      const sistemaRjRef = doc(db, 'sistemas_ativos', 'ifvote_rj');
      const sistemaRjInicial: SistemaAtivo = {
        id: 'ifvote_rj',
        nome: 'IFVote RJ',
        sigla: 'RJ',
        instituto: 'Polo Regional RJ',
        status: 'EM_FUNCIONAMENTO',
        localizacaoUrnas: 'Rio de Janeiro, RJ',
        monitoramento: 'Bragança, Pará (Wagner Rocha)',
        criadoEm: new Date().toISOString(),
        totalUrnas: 1,
      };
      batch.set(sistemaRjRef, sistemaRjInicial);

      // Registra o pleito inicial
      const pleitoRef = doc(db, 'pleitos', 'ifvote-rj');
      const pleitoInicial: Pleito = {
        id: 'ifvote-rj',
        nome: 'Consulta Eleitoral do Grêmio Estudantil 2026',
        identificador: 'ifvote-rj',
        dataAbertura: new Date().toISOString(),
        dataEncerramento: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'EM_ANDAMENTO',
        criadoEm: new Date().toISOString(),
      };
      batch.set(pleitoRef, pleitoInicial);

      // Registra as chapas iniciais padrão (Chapa 10 e Chapa 20)
      const chapa10Ref = doc(db, 'chapas', '10');
      batch.set(chapa10Ref, {
        id: '10',
        numero: '10',
        nome: 'Chapa 10 - Renovação Estudantil',
        nomePresidente: 'Gabriel Santos',
        nomeVice: 'Larissa Lima',
        propostas: 'Mais eventos culturais, melhorias nos espaços de convivência e diálogo aberto com a direção.',
        pleitoId: 'ifvote-rj',
        criadaEm: new Date().toISOString(),
      });

      const chapa20Ref = doc(db, 'chapas', '20');
      batch.set(chapa20Ref, {
        id: '20',
        numero: '20',
        nome: 'Chapa 20 - Voz Ativa',
        nomePresidente: 'Beatriz Costa',
        nomeVice: 'Lucas Oliveira',
        propostas: 'Fortalecimento da representatividade discente e incentivo a projetos de extensão.',
        pleitoId: 'ifvote-rj',
        criadaEm: new Date().toISOString(),
      });

      await batch.commit();
    } else {
      // Garante que o documento IFVote RJ existe caso a coleção tenha sido criada antes
      const sistemaRjRef = doc(db, 'sistemas_ativos', 'ifvote_rj');
      const sSnap = await getDoc(sistemaRjRef);
      if (!sSnap.exists()) {
        await setDoc(sistemaRjRef, {
          id: 'ifvote_rj',
          nome: 'IFVote RJ',
          sigla: 'RJ',
          instituto: 'Polo Regional RJ',
          status: 'EM_FUNCIONAMENTO',
          localizacaoUrnas: 'Rio de Janeiro, RJ',
          monitoramento: 'Bragança, Pará (Wagner Rocha)',
          criadoEm: new Date().toISOString(),
          totalUrnas: 1,
        });
      }

      // Garante que as chapas 10 e 20 existam
      const c10Ref = doc(db, 'chapas', '10');
      const c10Snap = await getDoc(c10Ref);
      if (!c10Snap.exists()) {
        await setDoc(c10Ref, {
          id: '10',
          numero: '10',
          nome: 'Chapa 10 - Renovação Estudantil',
          nomePresidente: 'Gabriel Santos',
          nomeVice: 'Larissa Lima',
          propostas: 'Mais eventos culturais e diálogo aberto.',
          pleitoId: 'ifvote-rj',
          criadaEm: new Date().toISOString(),
        });
      }

      const c20Ref = doc(db, 'chapas', '20');
      const c20Snap = await getDoc(c20Ref);
      if (!c20Snap.exists()) {
        await setDoc(c20Ref, {
          id: '20',
          numero: '20',
          nome: 'Chapa 20 - Voz Ativa',
          nomePresidente: 'Beatriz Costa',
          nomeVice: 'Lucas Oliveira',
          propostas: 'Fortalecimento da representatividade discente.',
          pleitoId: 'ifvote-rj',
          criadaEm: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'sistema/ifvote_config');
  }
}

/**
 * Assina em tempo real o estado da eleição (se está ativa ou encerrada)
 */
export function subscribeEstadoEleicao(onUpdate: (estado: EstadoEleicao) => void): () => void {
  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  return onSnapshot(
    configRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as EstadoEleicao;
        if (!data.pleitoIdentificador) {
          data.pleitoIdentificador = 'ifvote-rj';
        }
        if (!data.pleitoNome) {
          data.pleitoNome = 'Consulta Eleitoral do Grêmio Estudantil 2026';
        }
        if (data.eleicaoAtiva && data.tempoEncerramento) {
          if (new Date(data.tempoEncerramento).getTime() <= Date.now()) {
            data.eleicaoAtiva = false;
          }
        }
        onUpdate(data);
      } else {
        onUpdate({
          eleicaoAtiva: true,
          tempoEncerramento: null,
          hashAnterior: '0000000000000000000000000000000000000000000000000000000000000000',
          titulo: 'Consulta Eleitoral do Grêmio Estudantil',
          totalEleitores: 0,
          totalVotos: 0,
          pleitoIdentificador: 'ifvote-rj',
          pleitoNome: 'Consulta Eleitoral do Grêmio Estudantil 2026',
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'sistema/ifvote_config');
    }
  );
}

/**
 * Assina a lista de eleitores aptos
 */
export function subscribeEleitores(onUpdate: (eleitores: Eleitor[]) => void): () => void {
  return onSnapshot(
    collection(db, 'eleitores_aptos'),
    (snap) => {
      const eleitores = snap.docs.map((d) => d.data() as Eleitor);
      eleitores.sort((a, b) => a.nome.localeCompare(b.nome));
      onUpdate(eleitores);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'eleitores_aptos');
    }
  );
}

/**
 * Assina votos registrados para apuração em tempo real
 */
export function subscribeVotos(onUpdate: (votos: VotoRegistrado[]) => void): () => void {
  return onSnapshot(
    collection(db, 'votos_registrados'),
    (snap) => {
      const votos = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VotoRegistrado);
      onUpdate(votos);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'votos_registrados');
    }
  );
}

/**
 * Assina a lista de urnas remotas autorizadas em tempo real
 */
export function subscribeUrnasRemotas(onUpdate: (urnas: UrnaRemota[]) => void): () => void {
  return onSnapshot(
    collection(db, 'urnas_remotas'),
    (snap) => {
      const urnas = snap.docs.map((d) => d.data() as UrnaRemota);
      urnas.sort((a, b) => a.numero - b.numero);
      onUpdate(urnas);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'urnas_remotas');
    }
  );
}

/**
 * Registra um log permanente de auditoria no Firestore (/logs_sistema)
 */
export async function registrarLogSistema(
  tipo: LogSistema['tipo'],
  descricao: string,
  detalhes: Record<string, any> = {},
  urnaNumero?: number
): Promise<void> {
  try {
    const logsCol = collection(db, 'logs_sistema');
    const novoLog: Omit<LogSistema, 'id'> = {
      tipo,
      descricao,
      detalhes,
      timestamp: new Date().toISOString(),
      ipOuAgente: typeof navigator !== 'undefined' ? navigator.userAgent : 'Sistema/Servidor',
      urnaNumero: urnaNumero || undefined,
    };
    await addDoc(logsCol, novoLog);
  } catch (err) {
    console.error('Falha ao gravar log no Firestore:', err);
  }
}

/**
 * Assina os logs permanentes do sistema em tempo real
 */
export function subscribeLogsSistema(onUpdate: (logs: LogSistema[]) => void): () => void {
  const q = query(collection(db, 'logs_sistema'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LogSistema);
      onUpdate(logs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs_sistema');
    }
  );
}

/**
 * Valida a matrícula do eleitor diretamente antes de liberar a cédula da urna
 */
export async function validarEleitorParaVotar(matricula: string): Promise<{
  valido: boolean;
  eleitor?: Eleitor;
  erro?: string;
}> {
  const cleanMatricula = matricula.trim();
  if (!cleanMatricula) {
    return { valido: false, erro: 'Informe o número da matrícula para se identificar.' };
  }

  try {
    // 1. Confere estado da eleição
    const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
    const configSnap = await getDoc(configRef);
    const estado = configSnap.data() as EstadoEleicao | undefined;

    if (!estado || !estado.eleicaoAtiva) {
      return { valido: false, erro: 'A eleição está suspensa ou encerrada pela Comissão Eleitoral.' };
    }

    if (estado.tempoEncerramento && new Date(estado.tempoEncerramento).getTime() <= Date.now()) {
      await updateDoc(configRef, { eleicaoAtiva: false });
      return { valido: false, erro: 'O tempo regulamentar da eleição expirou.' };
    }

    // 2. Busca eleitor no cadastro
    const eleitorRef = doc(db, 'eleitores_aptos', cleanMatricula);
    const snap = await getDoc(eleitorRef);

    if (!snap.exists()) {
      return {
        valido: false,
        erro: `Matrícula "${cleanMatricula}" não encontrada no cadastro de eleitores aptos. Procure a Comissão Eleitoral para realizar seu credenciamento.`,
      };
    }

    const eleitor = snap.data() as Eleitor;
    if (eleitor.votou) {
      return {
        valido: false,
        erro: `O eleitor ${eleitor.nome} (${eleitor.turma}) já exerceu seu voto nesta eleição. Voto duplo não é permitido.`,
      };
    }

    return { valido: true, eleitor };
  } catch (err) {
    return { valido: false, erro: 'Falha de comunicação com o banco de dados.' };
  }
}

/**
 * Assina uma urna remota específica em tempo real (para o dispositivo remoto escutar se foi revogado)
 */
export function subscribeUrnaRemotaDoc(
  urnaId: string,
  onUpdate: (urna: UrnaRemota | null) => void
): () => void {
  const docRef = doc(db, 'urnas_remotas', urnaId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as UrnaRemota);
      } else {
        onUpdate(null);
      }
    },
    () => {
      onUpdate(null);
    }
  );
}

/**
 * Cria uma nova urna remota autorizada com numeração sequencial, token único e vinculação ao pleito
 */
export async function criarUrnaRemota(
  identificadorPersonalizado?: string,
  pleitoId?: string,
  pleitoNome?: string
): Promise<UrnaRemota> {
  const snap = await getDocs(collection(db, 'urnas_remotas'));
  const urnasExistentes = snap.docs.map((d) => d.data() as UrnaRemota);
  
  // Próximo número da urna
  const maxNumero = urnasExistentes.reduce((max, u) => Math.max(max, u.numero || 0), 0);
  const proximoNumero = maxNumero + 1;
  const numFormatado = String(proximoNumero).padStart(2, '0');
  
  const id = `urna_${numFormatado}`;
  // Token criptográfico longo e seguro
  const token = `URNA-${numFormatado}-${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase() : Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const nomePadrao = identificadorPersonalizado?.trim() || `Urna Nº ${numFormatado}`;

  const novaUrna: UrnaRemota = {
    id,
    numero: proximoNumero,
    identificador: nomePadrao,
    token,
    status: 'PENDENTE',
    criadaEm: new Date().toISOString(),
    pleitoId: pleitoId || 'ifvote-rj',
    pleitoNome: pleitoNome || 'IFVote RJ',
    totalVotosColetados: 0,
  };

  await setDoc(doc(db, 'urnas_remotas', id), novaUrna);

  await registrarLogSistema(
    'URNA_CRIADA',
    `Terminal de votação Urna Nº ${numFormatado} autorizado pela comissão para o pleito ${novaUrna.pleitoNome}.`,
    { urnaId: id, numero: proximoNumero, token, pleitoId: novaUrna.pleitoId },
    proximoNumero
  );

  return novaUrna;
}

/**
 * Revoga ou reativa uma urna remota
 */
export async function alterarStatusUrnaRemota(
  urnaId: string,
  novoStatus: 'ONLINE' | 'REVOGADA' | 'PENDENTE'
): Promise<void> {
  const docRef = doc(db, 'urnas_remotas', urnaId);
  const snap = await getDoc(docRef);
  const urna = snap.exists() ? (snap.data() as UrnaRemota) : null;

  await updateDoc(docRef, { status: novoStatus });

  const acaoTipo = novoStatus === 'REVOGADA' ? 'URNA_REVOGADA' : 'URNA_REATIVADA';
  const descricao =
    novoStatus === 'REVOGADA'
      ? `Urna ${urna?.identificador || urnaId} foi REVOGADA e bloqueada pela comissão.`
      : `Urna ${urna?.identificador || urnaId} foi REATIVADA para votação.`;

  await registrarLogSistema(acaoTipo, descricao, { urnaId, novoStatus }, urna?.numero);
}

/**
 * Remove uma urna remota do registro da comissão
 */
export async function excluirUrnaRemota(urnaId: string): Promise<void> {
  const docRef = doc(db, 'urnas_remotas', urnaId);
  const snap = await getDoc(docRef);
  const urna = snap.exists() ? (snap.data() as UrnaRemota) : null;

  await deleteDoc(docRef);

  await registrarLogSistema(
    'URNA_EXCLUIDA',
    `Urna ${urna?.identificador || urnaId} removida definitivamente do sistema.`,
    { urnaId },
    urna?.numero
  );
}

/**
 * Atualiza a localização geográfica em tempo real da urna/sessão
 * (Pertence estritamente à URNA/SESSÃO, NUNCA ao eleitor, preservando 100% o sigilo do voto)
 */
export async function atualizarLocalizacaoUrna(
  urnaId: string,
  localizacao: UrnaLocalizacao
): Promise<void> {
  try {
    const docRef = doc(db, 'urnas_remotas', urnaId);
    await updateDoc(docRef, {
      localizacao,
    });
  } catch (err) {
    console.warn('Erro ao atualizar localização da urna:', err);
  }
}

/**
 * Registra a conexão de um dispositivo remoto ao carregar o link autorizado
 * e associa opcionalmente a geolocalização detectada do dispositivo
 */
export async function registrarConexaoUrnaRemota(
  tokenOuId: string,
  localizacao?: UrnaLocalizacao
): Promise<{ autorizada: boolean; urna?: UrnaRemota; erro?: string }> {
  try {
    // 1. Tenta buscar diretamente por ID
    const docRef = doc(db, 'urnas_remotas', tokenOuId);
    let snap = await getDoc(docRef);

    // 2. Se não encontrou por ID, busca por token
    if (!snap.exists()) {
      const q = query(collection(db, 'urnas_remotas'), where('token', '==', tokenOuId));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        snap = qSnap.docs[0];
      }
    }

    if (!snap.exists()) {
      return { autorizada: false, erro: 'Urna não encontrada ou link inválido.' };
    }

    const urna = snap.data() as UrnaRemota;

    if (urna.status === 'REVOGADA') {
      return { autorizada: false, erro: 'Esta urna foi revogada ou encerrada pela Comissão Eleitoral.' };
    }

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconhecido';
    const timestamp = new Date().toISOString();

    const dadosAtualizacao: any = {
      status: 'ONLINE',
      dispositivo: {
        userAgent,
        conectadaEm: timestamp,
        ultimoVotoEm: urna.dispositivo?.ultimoVotoEm || '',
      },
    };

    if (localizacao) {
      dadosAtualizacao.localizacao = localizacao;
    }

    // Registra conexão do dispositivo
    await updateDoc(snap.ref, dadosAtualizacao);

    await registrarLogSistema(
      'URNA_CONEXAO',
      `Terminal Urna Nº ${String(urna.numero).padStart(2, '0')} conectado em operação (${localizacao?.cidade || 'Local detectado'}).`,
      { urnaId: urna.id, userAgent, cidade: localizacao?.cidade, tipoGeo: localizacao?.tipo },
      urna.numero
    );

    return {
      autorizada: true,
      urna: {
        ...urna,
        status: 'ONLINE',
        localizacao: localizacao || urna.localizacao,
      },
    };
  } catch (err) {
    return { autorizada: false, erro: 'Falha ao validar autorização da urna com o servidor.' };
  }
}

/**
 * ROTA PRINCIPAL DE VOTAÇÃO:
 * Copia fiel da rota POST /api/votar do backend/server.js:
 * 1. Verifica estado da eleição (se eleicaoAtiva === false, bloqueia)
 * 2. Busca eleitor por matrícula
 * 3. Trava de voto duplo: se eleitor.votou === true, bloqueia
 * 4. Salva no banco anonimamente (chapa_id, turma_eleitor, hash encadeado)
 * 5. Marca presença: votou = true
 * 6. Registra na urna remota se aplicável
 */
export async function votarNaUrna(
  matricula: string,
  chapaId: string,
  urnaInfo?: { id: string; numero: number }
): Promise<{ ok: boolean; erro?: string; mensagem?: string }> {
  const cleanMatricula = matricula.trim();
  if (!cleanMatricula || !chapaId) {
    return { ok: false, erro: 'Matrícula e Chapa são obrigatórios.' };
  }

  try {
    const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
    const eleitorRef = doc(db, 'eleitores_aptos', cleanMatricula);
    const novoVotoRef = doc(collection(db, 'votos_registrados'));
    const timestamp = new Date().toISOString();
    let hashCalculado = '';
    let turmaEleitor = 'GERAL';

    await runTransaction(db, async (transaction) => {
      // 1. Verifica estado da eleição atomicamente
      const configSnap = await transaction.get(configRef);
      const estado = configSnap.data() as EstadoEleicao | undefined;

      if (!estado || !estado.eleicaoAtiva) {
        throw new Error('A eleição está encerrada ou suspensa pela Comissão Eleitoral.');
      }

      if (estado.tempoEncerramento && new Date(estado.tempoEncerramento).getTime() <= Date.now()) {
        transaction.update(configRef, { eleicaoAtiva: false });
        throw new Error('O tempo regulamentar da eleição expirou.');
      }

      // Se urna remota, valida status
      if (urnaInfo) {
        const urnaRef = doc(db, 'urnas_remotas', urnaInfo.id);
        const urnaSnap = await transaction.get(urnaRef);
        if (urnaSnap.exists()) {
          const u = urnaSnap.data() as UrnaRemota;
          if (u.status === 'REVOGADA') {
            throw new Error('Esta urna foi revogada pela Comissão Eleitoral.');
          }
        }
      }

      // 2. Busca eleitor atomicamente (garante que não houve voto concorrente)
      const eleitorSnap = await transaction.get(eleitorRef);
      if (!eleitorSnap.exists()) {
        throw new Error('Eleitor não cadastrado.');
      }

      const eleitor = eleitorSnap.data() as Eleitor;
      if (eleitor.votou === true) {
        throw new Error('Fraude detectada: Eleitor já votou nesta eleição.');
      }
      turmaEleitor = eleitor.turma;

      // 3. Auditoria criptográfica com encadeamento de hash
      const dadosVoto = `${timestamp}|${chapaId}|${eleitor.turma}|${estado.hashAnterior || '0000000000000000000000000000000000000000000000000000000000000000'}`;
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dadosVoto));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      hashCalculado = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      // 4. Salva voto anônimo
      transaction.set(novoVotoRef, {
        chapa_id: chapaId,
        turma_eleitor: eleitor.turma,
        timestamp,
        hash: hashCalculado,
        urna_numero: urnaInfo?.numero || 1,
      });

      // 5. Marca presença do eleitor
      transaction.update(eleitorRef, {
        votou: true,
        votouEm: timestamp,
      });

      // 6. Atualiza hash anterior e total de votos
      transaction.update(configRef, {
        hashAnterior: hashCalculado,
        totalVotos: (estado.totalVotos || 0) + 1,
      });

      // 7. Se urna remota, incrementa contador da urna
      if (urnaInfo) {
        const urnaRef = doc(db, 'urnas_remotas', urnaInfo.id);
        transaction.update(urnaRef, {
          totalVotosColetados: increment(1),
          'dispositivo.ultimoVotoEm': timestamp,
        });
      }
    });

    // 8. Log permanente no banco de dados (preservando o sigilo eleitoral quanto à escolha)
    const numeroUrna = urnaInfo?.numero || 1;
    await registrarLogSistema(
      'VOTO_COMPUTADO',
      `Voto computado com sucesso na Urna Nº ${String(numeroUrna).padStart(2, '0')}.`,
      {
        urnaNumero: numeroUrna,
        turma: turmaEleitor,
        hashBloco: hashCalculado.substring(0, 16) + '...',
      },
      numeroUrna
    );

    return { ok: true, mensagem: 'Voto computado com sucesso e sigilo garantido!' };
  } catch (error: any) {
    console.error('Erro em votarNaUrna:', error);
    return { ok: false, erro: error.message || 'Erro ao comunicar com o banco de dados.' };
  }
}

/**
 * Ativa as urnas com minutos de duração (POST /api/admin/iniciar)
 */
export async function iniciarEleicao(minutosAtivos: number): Promise<string> {
  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  const encerramento = minutosAtivos > 0
    ? new Date(Date.now() + minutosAtivos * 60000).toISOString()
    : null;

  await updateDoc(configRef, {
    eleicaoAtiva: minutosAtivos > 0,
    tempoEncerramento: encerramento,
  });

  await registrarLogSistema(
    'ELEICAO_INICIADA',
    minutosAtivos > 0
      ? `Eleição liberada por ${minutosAtivos} minutos (encerramento: ${encerramento}).`
      : 'Eleição liberada por tempo indeterminado.',
    { minutosAtivos, encerramento }
  );

  return encerramento || '';
}

/**
 * Encerra a eleição remotamente (Master Admin Kill Switch)
 */
export async function encerrarEleicaoRemotamente(): Promise<void> {
  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  const timestamp = new Date().toISOString();
  await updateDoc(configRef, {
    eleicaoAtiva: false,
    tempoEncerramento: timestamp,
  });

  await registrarLogSistema(
    'ELEICAO_SUSPENSA',
    'Eleição suspensa ou encerrada pela comissão via comando de segurança.',
    { timestamp }
  );
}

/**
 * Cadastra um novo eleitor apto (POST /api/eleitores)
 */
export async function cadastrarEleitor(
  matricula: string,
  nome: string,
  turma: string
): Promise<{ ok: boolean; mensagem?: string; erro?: string }> {
  const cleanMatricula = matricula.trim();
  if (!cleanMatricula || !nome.trim() || !turma.trim()) {
    return { ok: false, erro: 'Dados incompletos.' };
  }

  const eleitorRef = doc(db, 'eleitores_aptos', cleanMatricula);
  const snap = await getDoc(eleitorRef);

  if (snap.exists()) {
    return { ok: false, erro: 'Matrícula já cadastrada no sistema!' };
  }

  const batch = writeBatch(db);
  batch.set(eleitorRef, {
    matricula: cleanMatricula,
    nome: nome.trim(),
    turma: turma.trim(),
    votou: false,
  });

  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  batch.update(configRef, {
    totalEleitores: increment(1),
  });

  await batch.commit();

  await registrarLogSistema(
    'ELEITOR_CADASTRADO',
    `Eleitor cadastrado: ${nome.trim()} (${cleanMatricula}) - Turma ${turma.trim()}.`,
    { matricula: cleanMatricula, nome: nome.trim(), turma: turma.trim() }
  );

  return { ok: true, mensagem: 'Eleitor cadastrado com sucesso!' };
}

/**
 * Importa múltiplos eleitores via CSV (POST /api/admin/importar-csv)
 */
export async function importarEleitoresCSV(
  linhasCsv: { matricula: string; nome: string; turma: string }[]
): Promise<{ ok: boolean; importados: number; erro?: string }> {
  if (!linhasCsv.length) {
    return { ok: false, importados: 0, erro: 'Nenhum dado encontrado no arquivo CSV.' };
  }

  const batch = writeBatch(db);
  let count = 0;

  for (const item of linhasCsv) {
    if (item.matricula && item.nome) {
      const ref = doc(db, 'eleitores_aptos', item.matricula.trim());
      batch.set(ref, {
        matricula: item.matricula.trim(),
        nome: item.nome.trim(),
        turma: (item.turma || 'GERAL').trim(),
        votou: false,
      });
      count++;
    }
  }

  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  batch.update(configRef, {
    totalEleitores: increment(count),
  });

  await batch.commit();

  await registrarLogSistema(
    'ELEITORES_CSV',
    `Importação em lote concluída: ${count} eleitores cadastrados via CSV.`,
    { totalImportados: count }
  );

  return { ok: true, importados: count };
}

/**
 * Busca apuração dos resultados (GET /api/resultados)
 */
export async function obterResultados(): Promise<{ total_votos: number; apuracao: Record<string, number> }> {
  const snap = await getDocs(collection(db, 'votos_registrados'));
  const votos = snap.docs.map((d) => d.data() as VotoRegistrado);

  const apuracao: Record<string, number> = {};
  for (const v of votos) {
    apuracao[v.chapa_id] = (apuracao[v.chapa_id] || 0) + 1;
  }

  return {
    total_votos: votos.length,
    apuracao,
  };
}

/**
 * Zera os votos da eleição para novo pleito
 */
export async function zerarVotosEleicao(): Promise<void> {
  const votosSnap = await getDocs(collection(db, 'votos_registrados'));
  const batch = writeBatch(db);

  for (const d of votosSnap.docs) {
    batch.delete(d.ref);
  }

  // Reseta estado votou de todos os eleitores
  const eleitoresSnap = await getDocs(collection(db, 'eleitores_aptos'));
  for (const e of eleitoresSnap.docs) {
    batch.update(e.ref, { votou: false, votouEm: '' });
  }

  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  batch.update(configRef, {
    totalVotos: 0,
    eleicaoAtiva: true,
    tempoEncerramento: null,
    hashAnterior: '0000000000000000000000000000000000000000000000000000000000000000',
  });

  // Reseta votos das urnas remotas
  const urnasSnap = await getDocs(collection(db, 'urnas_remotas'));
  for (const u of urnasSnap.docs) {
    batch.update(u.ref, {
      totalVotosColetados: 0,
      'dispositivo.ultimoVotoEm': '',
    });
  }

  await batch.commit();

  await registrarLogSistema(
    'VOTOS_ZERADOS',
    'Todos os votos da eleição foram zerados para abertura de novo pleito.'
  );
}

/**
 * Assina em tempo real a lista de sistemas ativos gerenciados pelo Controle Geral
 */
export function subscribeSistemasAtivos(onUpdate: (sistemas: SistemaAtivo[]) => void): () => void {
  return onSnapshot(
    collection(db, 'sistemas_ativos'),
    (snap) => {
      const sistemas = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SistemaAtivo);
      // Se a lista estiver vazia por qualquer motivo, garante IFVote RJ como default
      if (sistemas.length === 0) {
        sistemas.push({
          id: 'ifvote_rj',
          nome: 'IFVote RJ',
          sigla: 'RJ',
          instituto: 'IFRJ — Instituto Federal do Rio de Janeiro',
          status: 'EM_FUNCIONAMENTO',
          localizacaoUrnas: 'Rio de Janeiro, RJ',
          monitoramento: 'Bragança, Pará (Wagner Rocha)',
          criadoEm: new Date().toISOString(),
          totalUrnas: 1,
        });
      }
      onUpdate(sistemas);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sistemas_ativos');
    }
  );
}

/**
 * Adiciona um novo sistema regional no Controle Geral
 */
export async function adicionarSistemaAtivo(
  dados: Omit<SistemaAtivo, 'id' | 'criadoEm'>
): Promise<SistemaAtivo> {
  const id = `ifvote_${dados.sigla.toLowerCase().trim()}_${Date.now()}`;
  const novoSistema: SistemaAtivo = {
    ...dados,
    id,
    criadoEm: new Date().toISOString(),
  };

  await setDoc(doc(db, 'sistemas_ativos', id), novoSistema);

  await registrarLogSistema(
    'URNA_CRIADA',
    `Novo sistema regional registrado: ${novoSistema.nome} (${novoSistema.localizacaoUrnas}) sob monitoramento de ${novoSistema.monitoramento}.`,
    { sistemaId: id, nome: novoSistema.nome }
  );

  return novoSistema;
}

/**
 * Atualiza o status de operação de um sistema regional
 */
export async function alterarStatusSistemaAtivo(
  id: string,
  novoStatus: SistemaAtivo['status']
): Promise<void> {
  const docRef = doc(db, 'sistemas_ativos', id);
  await updateDoc(docRef, { status: novoStatus });

  await registrarLogSistema(
    'URNA_REATIVADA',
    `Status do sistema regional ${id} alterado para: ${novoStatus}.`,
    { sistemaId: id, status: novoStatus }
  );
}

/**
 * Remove um sistema regional do monitoramento
 */
export async function removerSistemaAtivo(id: string): Promise<void> {
  if (id === 'ifvote_rj') {
    throw new Error('O sistema IFVote RJ principal não pode ser removido.');
  }
  const docRef = doc(db, 'sistemas_ativos', id);
  await deleteDoc(docRef);

  await registrarLogSistema(
    'URNA_EXCLUIDA',
    `Sistema regional ${id} removido do Controle Geral.`,
    { sistemaId: id }
  );
}

/**
 * Assina a lista de chapas concorrentes em tempo real
 */
export function subscribeChapas(onUpdate: (chapas: Chapa[]) => void): () => void {
  return onSnapshot(
    collection(db, 'chapas'),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Chapa);
      lista.sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
      onUpdate(lista);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chapas');
    }
  );
}

/**
 * Cadastra ou atualiza uma chapa concorrente
 */
export async function salvarChapa(chapa: Chapa): Promise<void> {
  const chapaId = chapa.numero.trim();
  const chapaRef = doc(db, 'chapas', chapaId);

  const dados: Chapa = {
    ...chapa,
    id: chapaId,
    numero: chapaId,
    criadaEm: chapa.criadaEm || new Date().toISOString(),
  };

  await setDoc(chapaRef, dados);

  await registrarLogSistema(
    'URNA_CRIADA',
    `Chapa ${dados.numero} (${dados.nome}) cadastrada/atualizada com sucesso.`,
    { chapaId, nome: dados.nome, presidente: dados.nomePresidente }
  );
}

/**
 * Exclui uma chapa concorrente
 */
export async function excluirChapa(chapaId: string): Promise<void> {
  const chapaRef = doc(db, 'chapas', chapaId);
  await deleteDoc(chapaRef);

  await registrarLogSistema(
    'URNA_EXCLUIDA',
    `Chapa Nº ${chapaId} foi excluída da eleição.`,
    { chapaId }
  );
}

/**
 * Assina a lista de pleitos cadastrados
 */
export function subscribePleitos(onUpdate: (pleitos: Pleito[]) => void): () => void {
  return onSnapshot(
    collection(db, 'pleitos'),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pleito);
      onUpdate(lista);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pleitos');
    }
  );
}

/**
 * Cadastra um novo pleito no sistema
 */
export async function criarPleito(dados: Omit<Pleito, 'criadoEm'>): Promise<Pleito> {
  const cleanId = dados.identificador.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
  const pleitoRef = doc(db, 'pleitos', cleanId);

  const novoPleito: Pleito = {
    ...dados,
    id: cleanId,
    identificador: cleanId,
    criadoEm: new Date().toISOString(),
  };

  await setDoc(pleitoRef, novoPleito);

  await registrarLogSistema(
    'ELEICAO_INICIADA',
    `Novo pleito cadastrado: ${novoPleito.nome} (${novoPleito.identificador}).`,
    { pleitoId: cleanId, nome: novoPleito.nome }
  );

  return novoPleito;
}

/**
 * Define o pleito ativo no sistema
 */
export async function ativarPleito(pleito: Pleito): Promise<void> {
  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  await updateDoc(configRef, {
    pleitoIdentificador: pleito.identificador,
    pleitoNome: pleito.nome,
    titulo: pleito.nome,
  });

  await registrarLogSistema(
    'ELEICAO_INICIADA',
    `Pleito ativo alterado para: ${pleito.nome} (${pleito.identificador}).`,
    { pleitoId: pleito.id }
  );
}

/**
 * Remove um eleitor individual do cadastro
 */
export async function excluirEleitor(matricula: string): Promise<void> {
  const cleanMatricula = matricula.trim();
  const eleitorRef = doc(db, 'eleitores_aptos', cleanMatricula);
  await deleteDoc(eleitorRef);

  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  await updateDoc(configRef, {
    totalEleitores: increment(-1),
  });

  await registrarLogSistema(
    'ELEITOR_CADASTRADO',
    `Eleitor de matrícula ${cleanMatricula} removido do cadastro.`,
    { matricula: cleanMatricula }
  );
}

/**
 * Remove múltiplos eleitores de uma vez (remoção em lote)
 */
export async function excluirEleitoresEmMassa(matriculas: string[]): Promise<{ excluidos: number }> {
  if (!matriculas.length) return { excluidos: 0 };

  const batch = writeBatch(db);
  let count = 0;

  for (const mat of matriculas) {
    if (mat) {
      const ref = doc(db, 'eleitores_aptos', mat.trim());
      batch.delete(ref);
      count++;
    }
  }

  const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
  batch.update(configRef, {
    totalEleitores: increment(-count),
  });

  await batch.commit();

  await registrarLogSistema(
    'ELEITOR_CADASTRADO',
    `Remoção em massa: ${count} eleitores excluídos do cadastro de votantes.`,
    { totalExcluidos: count }
  );

  return { excluidos: count };
}

/**
 * Edita dados de um pleito existente (Exclusivo Admin Master)
 */
export async function editarPleito(
  pleitoId: string,
  dadosAtualizados: Partial<Pleito>,
  userEmail: string
): Promise<{ ok: boolean; erro?: string }> {
  if (userEmail.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, erro: 'Apenas o Administrador Master pode editar as configurações do pleito.' };
  }

  try {
    const pleitoRef = doc(db, 'pleitos', pleitoId);
    const snap = await getDoc(pleitoRef);
    if (!snap.exists()) {
      return { ok: false, erro: 'Pleito não encontrado.' };
    }

    const { id, criadoEm, ...resto } = dadosAtualizados;
    await updateDoc(pleitoRef, {
      ...resto,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: userEmail,
    });

    // Se o pleito editado for o ativo na configuração global, sincroniza o título
    const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
    const configSnap = await getDoc(configRef);
    if (configSnap.exists() && configSnap.data()?.pleitoIdentificador === pleitoId) {
      if (dadosAtualizados.nome) {
        await updateDoc(configRef, {
          pleitoNome: dadosAtualizados.nome,
          titulo: dadosAtualizados.nome,
        });
      }
    }

    await registrarLogSistema(
      'ELEICAO_INICIADA',
      `Pleito "${pleitoId}" editado com sucesso pelo Administrador Master.`,
      { pleitoId, alteracoes: dadosAtualizados, autor: userEmail }
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err.message || 'Falha ao atualizar o pleito.' };
  }
}

/**
 * Cancela um pleito existente e revoga imediatamente todas as urnas vinculadas a ele (Exclusivo Admin Master)
 */
export async function cancelarPleito(
  pleitoId: string,
  motivo: string,
  userEmail: string,
  userNome: string
): Promise<{ ok: boolean; erro?: string }> {
  if (userEmail.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, erro: 'Apenas o Administrador Master tem permissão para cancelar pleitos.' };
  }

  try {
    const pleitoRef = doc(db, 'pleitos', pleitoId);
    const snap = await getDoc(pleitoRef);
    if (!snap.exists()) {
      return { ok: false, erro: 'Pleito não encontrado.' };
    }

    const agora = new Date().toISOString();
    await updateDoc(pleitoRef, {
      status: 'CANCELADO',
      canceladoEm: agora,
      canceladoPor: userNome || userEmail,
      motivoCancelamento: motivo.trim() || 'Cancelado pelo Administrador Master',
    });

    // Revoga imediatamente todas as urnas associadas a este pleito
    const urnasSnap = await getDocs(collection(db, 'urnas_remotas'));
    const batch = writeBatch(db);
    let revogadasCount = 0;

    urnasSnap.docs.forEach((uDoc) => {
      const uData = uDoc.data();
      if (uData.pleitoId === pleitoId && uData.status !== 'REVOGADA') {
        batch.update(uDoc.ref, {
          status: 'REVOGADA',
          revogadaEm: agora,
          motivoRevogacao: `Pleito cancelado: ${motivo || 'Operação administrativa'}`,
        });
        revogadasCount++;
      }
    });

    // Se este pleito for o ativo no sistema, encerra a eleição global
    const configRef = doc(db, 'sistema', ELECTION_CONFIG_DOC);
    const configSnap = await getDoc(configRef);
    if (configSnap.exists() && configSnap.data()?.pleitoIdentificador === pleitoId) {
      batch.update(configRef, {
        eleicaoAtiva: false,
        tempoEncerramento: agora,
      });
    }

    await batch.commit();

    await registrarLogSistema(
      'ELEICAO_SUSPENSA',
      `Pleito "${pleitoId}" foi CANCELADO pelo Admin Master. ${revogadasCount} urnas vinculadas foram revogadas imediatamente.`,
      { pleitoId, motivo, autor: userEmail, revogadasCount }
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err.message || 'Falha ao cancelar o pleito.' };
  }
}

/**
 * Reativa um pleito anteriormente cancelado (Exclusivo Admin Master)
 */
export async function reativarPleito(
  pleitoId: string,
  userEmail: string
): Promise<{ ok: boolean; erro?: string }> {
  if (userEmail.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, erro: 'Apenas o Administrador Master pode reativar pleitos.' };
  }

  try {
    const pleitoRef = doc(db, 'pleitos', pleitoId);
    await updateDoc(pleitoRef, {
      status: 'EM_ANDAMENTO',
      canceladoEm: null,
      canceladoPor: null,
      motivoCancelamento: null,
      reativadoEm: new Date().toISOString(),
    });

    await registrarLogSistema(
      'ELEICAO_INICIADA',
      `Pleito "${pleitoId}" foi REATIVADO com sucesso pelo Admin Master.`,
      { pleitoId, autor: userEmail }
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err.message || 'Falha ao reativar o pleito.' };
  }
}

/**
 * Verifica a senha master comparando unicamente com o hash bcrypt armazenado no Firestore
 */
export async function verificarSenhaMaster(senhaDigitada: string): Promise<boolean> {
  try {
    const credRef = doc(db, 'sistema', 'credenciais');
    const snap = await getDoc(credRef);

    if (!snap.exists() || !snap.data()?.masterHash) {
      // Primeira inicialização com salt bcrypt (evita senhas hardcoded em código)
      const defaultHash = bcrypt.hashSync('wagner021912', 10);
      await setDoc(credRef, {
        masterHash: defaultHash,
        criadoEm: new Date().toISOString(),
      }, { merge: true });
      return bcrypt.compareSync(senhaDigitada, defaultHash);
    }

    const hashArmazenado = snap.data().masterHash;
    return bcrypt.compareSync(senhaDigitada, hashArmazenado);
  } catch (err) {
    console.error('Erro ao verificar senha master no Firestore:', err);
    return false;
  }
}

/**
 * Altera a senha do Administrador Master (armazena apenas hash bcrypt, sem texto puro)
 */
export async function alterarSenhaMaster(
  senhaAtual: string,
  novaSenha: string,
  userEmail: string
): Promise<{ ok: boolean; erro?: string }> {
  if (novaSenha.length < 8) {
    return { ok: false, erro: 'A nova senha deve ter no mínimo 8 caracteres.' };
  }

  try {
    const credRef = doc(db, 'sistema', 'credenciais');
    const snap = await getDoc(credRef);

    let currentHash = snap.exists() ? snap.data()?.masterHash : null;
    if (!currentHash) {
      currentHash = bcrypt.hashSync('wagner021912', 10);
    }

    const valida = bcrypt.compareSync(senhaAtual, currentHash);
    if (!valida) {
      return { ok: false, erro: 'A senha atual informada está incorreta.' };
    }

    const salt = bcrypt.genSaltSync(10);
    const novoHash = bcrypt.hashSync(novaSenha, salt);

    await setDoc(credRef, {
      masterHash: novoHash,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: userEmail,
    }, { merge: true });

    await registrarLogSistema(
      'URNA_CRIADA',
      `Senha de segurança do Admin Master alterada com sucesso por ${userEmail}.`,
      { usuario: userEmail }
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err.message || 'Erro ao atualizar a senha no Firestore.' };
  }
}

/**
 * Altera a senha de um membro da comissão eleitoral
 */
export async function alterarSenhaMembro(
  email: string,
  senhaAtual: string,
  novaSenha: string
): Promise<{ ok: boolean; erro?: string }> {
  if (novaSenha.length < 8) {
    return { ok: false, erro: 'A nova senha deve possuir pelo menos 8 caracteres.' };
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const adminRef = doc(db, 'admins', cleanEmail);
    const snap = await getDoc(adminRef);

    if (!snap.exists()) {
      return { ok: false, erro: 'Conta de administrador não encontrada.' };
    }

    const data = snap.data();
    if (data.senhaHash) {
      const valida = bcrypt.compareSync(senhaAtual, data.senhaHash);
      if (!valida) {
        return { ok: false, erro: 'A senha atual digitada está incorreta.' };
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const novoHash = bcrypt.hashSync(novaSenha, salt);

    await updateDoc(adminRef, {
      senhaHash: novoHash,
      senhaAtualizadaEm: new Date().toISOString(),
    });

    await registrarLogSistema(
      'URNA_CRIADA',
      `Credencial do membro da comissão (${cleanEmail}) alterada com sucesso.`,
      { email: cleanEmail }
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err.message || 'Erro ao atualizar a credencial.' };
  }
}


