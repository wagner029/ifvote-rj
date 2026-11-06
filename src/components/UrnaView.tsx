import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { tocarSomTecla, tocarSomConfirma } from '../utils/sound';
import {
  votarNaUrna,
  validarEleitorParaVotar,
  subscribeUrnaRemotaDoc,
  subscribeChapas,
} from '../services/electionService';
import type { EstadoEleicao, UrnaRemota, Eleitor, Chapa } from '../services/electionService';
import { ErrorModal, ModalConfig } from './ErrorModal';
import { IfVoteLogo } from './common/IfVoteLogo';
import { ArrowLeft, ExternalLink, ShieldCheck, Lock, UserCheck, HelpCircle } from 'lucide-react';

interface UrnaViewProps {
  estadoEleicao: EstadoEleicao;
  urnaRemota?: UrnaRemota | null;
  onVoltar?: () => void;
  onIrPainel?: () => void;
}

export const UrnaView: React.FC<UrnaViewProps> = ({
  estadoEleicao,
  urnaRemota: initialUrnaRemota,
  onVoltar,
  onIrPainel,
}) => {
  const [urnaRemota, setUrnaRemota] = useState<UrnaRemota | null>(initialUrnaRemota || null);
  const [chapas, setChapas] = useState<Chapa[]>([]);
  const [etapa, setEtapa] = useState<'MATRICULA' | 'CHAPA'>('MATRICULA');
  const [matriculaDigitada, setMatriculaDigitada] = useState<string>('');
  const [chapaDigitada, setChapaDigitada] = useState<string>('');
  const [eleitorAtual, setEleitorAtual] = useState<Eleitor | null>(null);
  const [mostrarFim, setMostrarFim] = useState<boolean>(false);
  const [bloqueada, setBloqueada] = useState<boolean>(false);
  const [bloqueioMensagem, setBloqueioMensagem] = useState<string>('');
  const [processando, setProcessando] = useState<boolean>(false);

  // Modal padronizado de erro e alerta
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  // Modal com lista de eleitores para auxílio na demonstração
  const [mostrarAjudaEleitores, setMostrarAjudaEleitores] = useState(false);

  // Escuta chapas cadastradas em tempo real
  useEffect(() => {
    const unsub = subscribeChapas((lista) => {
      setChapas(lista);
    });
    return () => unsub();
  }, []);

  // Escuta se a urna remota foi revogada pela comissão em tempo real
  useEffect(() => {
    if (initialUrnaRemota?.id) {
      const unsub = subscribeUrnaRemotaDoc(initialUrnaRemota.id, (u) => {
        if (!u || u.status === 'REVOGADA') {
          setBloqueada(true);
          setBloqueioMensagem('ESTA URNA FOI REVOGADA OU REMOVIDA PELA COMISSÃO ELEITORAL.');
        } else {
          setUrnaRemota(u);
        }
      });
      return () => unsub();
    }
  }, [initialUrnaRemota?.id]);

  useEffect(() => {
    if (!estadoEleicao.eleicaoAtiva) {
      setBloqueada(true);
      setBloqueioMensagem('O tempo regulamentar expirou ou a eleição foi suspensa pela Comissão Eleitoral.');
    } else if (urnaRemota && urnaRemota.status === 'REVOGADA') {
      setBloqueada(true);
      setBloqueioMensagem('ESTA URNA FOI REVOGADA OU REMOVIDA PELA COMISSÃO ELEITORAL.');
    } else {
      setBloqueada(false);
    }
  }, [estadoEleicao.eleicaoAtiva, urnaRemota]);

  // Digitar número no teclado físico ou virtual
  const digitar = useCallback((numero: string) => {
    if (bloqueada || mostrarFim || processando) return;
    tocarSomTecla();

    if (etapa === 'MATRICULA') {
      if (matriculaDigitada.length < 15) {
        setMatriculaDigitada((prev) => prev + numero);
      }
    } else if (etapa === 'CHAPA' && chapaDigitada !== 'BRANCO') {
      if (chapaDigitada.length < 2) {
        setChapaDigitada((prev) => prev + numero);
      }
    }
  }, [bloqueada, mostrarFim, processando, etapa, matriculaDigitada, chapaDigitada]);

  // Corrigir entrada
  const corrigir = useCallback(() => {
    if (bloqueada || mostrarFim || processando) return;
    tocarSomTecla();

    if (etapa === 'MATRICULA') {
      setMatriculaDigitada('');
    } else if (etapa === 'CHAPA') {
      setChapaDigitada('');
    }
  }, [bloqueada, mostrarFim, processando, etapa]);

  // Voto em branco
  const votoBranco = useCallback(() => {
    if (bloqueada || mostrarFim || processando) return;

    if (etapa === 'MATRICULA') {
      tocarSomTecla();
      setModalConfig({
        isOpen: true,
        type: 'info',
        title: 'Opção Voto em Branco',
        message: 'O voto em Branco é uma opção para escolha da Chapa na cédula de votação.\n\nPara iniciar seu voto, digite sua matrícula e pressione a tecla VERDE (CONFIRMA).',
        confirmLabel: 'Entendido',
      });
      return;
    }

    if (etapa === 'CHAPA') {
      tocarSomTecla();
      setChapaDigitada('BRANCO');
    }
  }, [bloqueada, mostrarFim, processando, etapa]);

  // Confirmar ação
  const confirmar = useCallback(async () => {
    if (bloqueada || mostrarFim || processando) return;

    if (etapa === 'MATRICULA') {
      if (!matriculaDigitada.trim()) {
        tocarSomTecla();
        setModalConfig({
          isOpen: true,
          type: 'warning',
          title: 'Matrícula Não Digitada',
          message: 'Por favor, digite o número da sua matrícula estudantil ou funcional no teclado numérico antes de confirmar.',
          confirmLabel: 'OK, Digitar',
        });
        return;
      }

      setProcessando(true);
      const resVal = await validarEleitorParaVotar(matriculaDigitada);
      setProcessando(false);

      if (!resVal.valido) {
        tocarSomTecla();
        setModalConfig({
          isOpen: true,
          type: 'error',
          title: 'Identificação Não Autorizada',
          message: resVal.erro || 'Eleitor não encontrado ou não autorizado a votar.',
          confirmLabel: 'Corrigir Matrícula',
          onConfirm: () => {
            setMatriculaDigitada('');
          },
        });
        return;
      }

      // Eleitor apto e com direito a voto!
      tocarSomTecla();
      setEleitorAtual(resVal.eleitor || null);
      setEtapa('CHAPA');
    } else if (etapa === 'CHAPA') {
      if (!chapaDigitada) {
        tocarSomTecla();
        setModalConfig({
          isOpen: true,
          type: 'warning',
          title: 'Nenhum Voto Selecionado',
          message: 'Digite o número de 2 dígitos da chapa (ex: 10 ou 20) ou pressione BRANCO para votar em branco antes de confirmar.',
          confirmLabel: 'Voltar e Escolher',
        });
        return;
      }

      if (chapaDigitada !== 'BRANCO' && chapaDigitada.length < 2) {
        tocarSomTecla();
        setModalConfig({
          isOpen: true,
          type: 'warning',
          title: 'Número Incompleto',
          message: 'O número da chapa requer 2 dígitos. Complete o número ou pressione a tecla LARANJA (CORRIGE).',
          confirmLabel: 'OK',
        });
        return;
      }

      setProcessando(true);
      const infoUrna = urnaRemota ? { id: urnaRemota.id, numero: urnaRemota.numero } : undefined;
      const res = await votarNaUrna(matriculaDigitada, chapaDigitada, infoUrna);
      setProcessando(false);

      if (res.ok) {
        // VOTO GRAVADO COM SUCESSO!
        tocarSomConfirma();
        setMostrarFim(true);

        // Reseta a urna para o próximo eleitor após 4 segundos
        setTimeout(() => {
          setEtapa('MATRICULA');
          setMatriculaDigitada('');
          setChapaDigitada('');
          setEleitorAtual(null);
          setMostrarFim(false);
        }, 4000);
      } else {
        tocarSomTecla();
        if (res.erro && res.erro.includes('encerrada')) {
          setBloqueada(true);
          setBloqueioMensagem('A votação foi encerrada.');
        } else {
          setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Gravar Voto',
            message: res.erro || 'Falha ao registrar o voto no banco de dados.',
            confirmLabel: 'Corrigir',
            onConfirm: () => {
              setChapaDigitada('');
            },
          });
        }
      }
    }
  }, [
    bloqueada,
    mostrarFim,
    processando,
    etapa,
    matriculaDigitada,
    chapaDigitada,
    urnaRemota,
  ]);

  // Teclado físico do computador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se algum modal estiver aberto
      if (modalConfig?.isOpen || mostrarAjudaEleitores) return;

      if (/^[0-9]$/.test(e.key)) {
        digitar(e.key);
      } else if (e.key === 'Enter') {
        confirmar();
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        corrigir();
      } else if (e.key.toLowerCase() === 'b') {
        votoBranco();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [digitar, confirmar, corrigir, votoBranco, modalConfig, mostrarAjudaEleitores]);

  // Busca dinâmica da chapa digitada
  const chapaEncontrada = useMemo(() => {
    if (etapa === 'CHAPA' && chapaDigitada.length === 2) {
      return (
        chapas.find((c) => c.numero === chapaDigitada) ||
        (chapaDigitada === '10'
          ? { id: '10', numero: '10', nome: 'CHAPA 10 - RENOVAÇÃO ESTUDANTIL', nomePresidente: 'Gabriel Santos', nomeVice: 'Larissa Lima' }
          : chapaDigitada === '20'
          ? { id: '20', numero: '20', nome: 'CHAPA 20 - VOZ ATIVA', nomePresidente: 'Beatriz Costa', nomeVice: 'Lucas Oliveira' }
          : null)
      );
    }
    return null;
  }, [etapa, chapaDigitada, chapas]);

  const isUrnaRemota = !!urnaRemota;

  return (
    <div className="relative min-h-screen bg-[#0b0e14] text-white flex flex-col items-center justify-center p-4 font-sans select-none overflow-x-auto">
      
      {/* Barra de Identificação Superior */}
      <div className="absolute top-4 left-4 right-4 max-w-[950px] mx-auto flex items-center justify-between text-xs z-20">
        {/* Se for urna remota dedicada: SEM ACESSO À GESTÃO */}
        {isUrnaRemota ? (
          <div className="flex items-center gap-3">
            <IfVoteLogo size="sm" theme="dark" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border border-[#30363d] rounded-md text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>TERMINAL AUTORIZADO — URNA Nº {String(urnaRemota.numero).padStart(2, '0')}</span>
            </div>
          </div>
        ) : (
          /* Se for urna acessada pelo menu geral */
          <div className="flex items-center gap-3">
            <IfVoteLogo size="sm" theme="dark" />
            {onVoltar && (
              <button
                type="button"
                onClick={onVoltar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-400" />
                <span>Menu Principal</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Botão de ajuda com matrículas de teste */}
          <button
            type="button"
            onClick={() => setMostrarAjudaEleitores(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#161b22] hover:bg-[#21262d] text-slate-400 hover:text-slate-200 border border-[#30363d] rounded text-[11px] cursor-pointer"
            title="Ver matrículas aptas para teste rápido"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Matrículas Aptas</span>
          </button>

          {isUrnaRemota ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cabine Lacrada</span>
            </div>
          ) : (
            onIrPainel && (
              <button
                type="button"
                onClick={onIrPainel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors cursor-pointer"
              >
                <span>Painel da Comissão</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Tela de Bloqueio Vermelha quando encerrada ou revogada */}
      {bloqueada && (
        <div className="fixed inset-0 bg-[#b91c1c] text-white flex flex-col justify-center items-center z-50 font-sans p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-wider mb-2">
            VOTAÇÃO ENCERRADA
          </h2>
          <p className="text-base text-red-100 max-w-lg mb-6 leading-relaxed">
            {bloqueioMensagem || 'O tempo regulamentar expirou ou a urna foi revogada pela comissão.'}
          </p>
          {!isUrnaRemota && onIrPainel && (
            <button
              type="button"
              onClick={onIrPainel}
              className="px-6 py-2.5 bg-black hover:bg-slate-900 text-white font-bold rounded-lg shadow-lg cursor-pointer"
            >
              Acessar Painel da Comissão
            </button>
          )}
        </div>
      )}

      {/* ESTRUTURA PRINCIPAL DA URNA FÍSICA (Fiel ao repositório ifvote-rio) */}
      <div
        className="w-[950px] h-[500px] rounded-[10px] p-[30px] flex gap-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_5px_15px_rgba(255,255,255,0.5)]"
        style={{ backgroundColor: '#dcdcd2' }}
      >
        
        {/* TELA LCD DA URNA */}
        {!mostrarFim ? (
          <div
            className="flex-[1.2] bg-white rounded-[5px] p-[20px] flex flex-col justify-between shadow-[inset_0_0_10px_rgba(0,0,0,0.1)] text-black"
            style={{ border: '3px solid #b0b0b0' }}
          >
            {/* Topo da Tela */}
            <div className="flex items-center justify-between text-[1.1rem] font-bold uppercase mb-[5px] border-b pb-1">
              <span>{etapa === 'MATRICULA' ? 'Identificação do Eleitor' : 'Seu voto para'}</span>
              {urnaRemota && (
                <span className="text-[0.75rem] text-slate-500 font-mono">
                  Urna Nº {String(urnaRemota.numero).padStart(2, '0')}
                </span>
              )}
            </div>

            {/* Subtítulo ou Nome do Cargo / Eleitor Identificado */}
            <div className="text-[0.95rem] font-bold text-slate-700 min-h-[22px]">
              {etapa === 'MATRICULA' ? (
                <span>DIGITE SUA MATRÍCULA:</span>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>CARGO: GRÊMIO ESTUDANTIL</span>
                  {eleitorAtual && (
                    <span className="flex items-center gap-1 text-emerald-800 font-semibold truncate max-w-[200px]">
                      <UserCheck className="w-3.5 h-3.5" />
                      {eleitorAtual.nome}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Corpo Central da Tela: Matrícula ou Cédula com Fotos */}
            {etapa === 'MATRICULA' ? (
              <div className="flex flex-col items-center justify-center my-auto space-y-3">
                <div className="text-[1.8rem] font-bold text-black border-b-[2px] border-black min-w-[280px] text-center tracking-[6px] py-1 bg-slate-50/50">
                  {matriculaDigitada || '\u00A0'}
                </div>
                <div className="text-[0.85rem] text-slate-500 font-normal">
                  Insira os números e aperte <b className="text-emerald-800">CONFIRMA</b> para prosseguir
                </div>
              </div>
            ) : chapaDigitada === 'BRANCO' ? (
              <div className="flex items-center justify-center my-auto">
                <span className="text-[2.2rem] font-black tracking-[4px] text-black">VOTO EM BRANCO</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 my-auto">
                {/* Lado Esquerdo: Caixas e Nomes dos Candidatos */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Número:</span>
                    <div className="flex gap-1.5">
                      <div
                        className={`w-[42px] h-[50px] border-[2px] text-[2rem] font-bold flex items-center justify-center text-black shadow-inner transition-all ${
                          etapa === 'CHAPA' && chapaDigitada !== 'BRANCO' && chapaDigitada.length === 0
                            ? 'border-emerald-600 bg-emerald-50/70 animate-pulse ring-2 ring-emerald-400/50'
                            : 'border-black bg-white'
                        }`}
                      >
                        {chapaDigitada[0] || ''}
                      </div>
                      <div
                        className={`w-[42px] h-[50px] border-[2px] text-[2rem] font-bold flex items-center justify-center text-black shadow-inner transition-all ${
                          etapa === 'CHAPA' && chapaDigitada !== 'BRANCO' && chapaDigitada.length === 1
                            ? 'border-emerald-600 bg-emerald-50/70 animate-pulse ring-2 ring-emerald-400/50'
                            : 'border-black bg-white'
                        }`}
                      >
                        {chapaDigitada[1] || ''}
                      </div>
                    </div>
                  </div>

                  {chapaDigitada.length === 2 && (
                    <div className="pt-1 text-left">
                      {chapaEncontrada ? (
                        <div className="space-y-1">
                          <div className="text-sm font-extrabold text-black uppercase leading-tight">
                            {chapaEncontrada.nome}
                          </div>
                          <div className="text-xs text-slate-700">
                            Presidente: <strong className="text-black">{chapaEncontrada.nomePresidente || '—'}</strong>
                          </div>
                          {chapaEncontrada.nomeVice && (
                            <div className="text-xs text-slate-700">
                              Vice: <strong className="text-black">{chapaEncontrada.nomeVice}</strong>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-600 font-bold text-xs uppercase leading-tight">
                          NÚMERO ERRADO<br />
                          <span className="text-sm font-black">VOTO NULO</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Lado Direito: Logo Oficial da Chapa e Conferência */}
                {chapaEncontrada && (
                  <div className="flex flex-col items-center justify-center border-l border-slate-300 pl-4 shrink-0">
                    <div className="w-24 h-24 border border-black bg-white flex items-center justify-center overflow-hidden shadow-sm p-1">
                      {chapaEncontrada.logo || chapaEncontrada.fotoPresidente ? (
                        <img
                          src={chapaEncontrada.logo || chapaEncontrada.fotoPresidente}
                          alt="Logo da Chapa"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-800 font-black">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">CHAPA</span>
                          <span className="text-2xl">{chapaEncontrada.numero}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-bold uppercase mt-1 text-slate-800 tracking-wider">
                      LOGO DA CHAPA
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Rodapé de Instruções Dinâmicas e Neutras da Tela LCD */}
            <div className="border-t-[2px] border-black pt-[8px] text-[0.82rem] leading-[1.35] text-black">
              {etapa === 'MATRICULA' ? (
                <>
                  <div className="font-semibold text-slate-800 mb-0.5">Digite o número de sua matrícula</div>
                  <div>Pressione <b>CONFIRMA</b> (Verde) para prosseguir</div>
                  <div>Pressione <b>CORRIGE</b> (Laranja) para refazer</div>
                </>
              ) : chapaDigitada === 'BRANCO' || chapaDigitada.length === 2 ? (
                <>
                  <div className="font-semibold text-slate-800 mb-0.5">Confira os dados da chapa</div>
                  <div>Pressione <b>CONFIRMA</b> para votar</div>
                  <div>Pressione <b>CORRIGE</b> para refazer</div>
                </>
              ) : chapaDigitada.length === 1 ? (
                <>
                  <div className="font-semibold text-slate-800 mb-0.5">Digite o segundo número da chapa</div>
                  <div>Pressione <b>CORRIGE</b> para refazer</div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-slate-800 mb-0.5">Digite o número da chapa</div>
                  <div>Ou pressione <b>BRANCO</b> para votar em branco</div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* TELA DE FIM */
          <div
            className="flex-[1.2] bg-white rounded-[5px] p-[20px] flex items-center justify-center shadow-[inset_0_0_10px_rgba(0,0,0,0.1)] text-black font-bold text-[7rem] tracking-[5px]"
            style={{ border: '3px solid #b0b0b0' }}
          >
            FIM
          </div>
        )}

        {/* TECLADO FÍSICO DA URNA */}
        <div
          className="flex-[0.8] rounded-[5px] p-[25px] flex flex-col items-center justify-center shadow-[inset_0px_5px_10px_rgba(0,0,0,0.5)]"
          style={{ backgroundColor: '#2d2d2d' }}
        >
          {/* Grade Numérica */}
          <div className="grid grid-cols-3 gap-[15px] mb-[20px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => digitar(num)}
                disabled={processando}
                className="w-[70px] h-[50px] rounded-[5px] text-[1.5rem] font-bold cursor-pointer text-white flex items-center justify-center border-none shadow-[2px_5px_0px_#000] active:translate-y-[3px] active:shadow-[1px_2px_0px_#000] transition-transform disabled:opacity-50"
                style={{ backgroundColor: '#1a1a1a' }}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => digitar('0')}
              disabled={processando}
              className="w-[70px] h-[50px] rounded-[5px] text-[1.5rem] font-bold cursor-pointer text-white flex items-center justify-center border-none shadow-[2px_5px_0px_#000] active:translate-y-[3px] active:shadow-[1px_2px_0px_#000] col-start-2 transition-transform disabled:opacity-50"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              0
            </button>
          </div>

          {/* Botões de Ação: Branco, Corrige, Confirma */}
          <div className="flex gap-[10px] w-full justify-between items-end">
            <button
              type="button"
              onClick={votoBranco}
              disabled={processando}
              className="w-[30%] h-[50px] rounded-[4px] text-[0.8rem] font-bold uppercase cursor-pointer border-none shadow-[2px_4px_0px_rgba(0,0,0,0.5)] active:translate-y-[3px] active:shadow-[1px_2px_0px_rgba(0,0,0,0.5)] text-black disabled:opacity-50"
              style={{ backgroundColor: '#ffffff' }}
            >
              Branco
            </button>

            <button
              type="button"
              onClick={corrigir}
              disabled={processando}
              className="w-[30%] h-[50px] rounded-[4px] text-[0.8rem] font-bold uppercase cursor-pointer border-none shadow-[2px_4px_0px_rgba(0,0,0,0.5)] active:translate-y-[3px] active:shadow-[1px_2px_0px_rgba(0,0,0,0.5)] text-black disabled:opacity-50"
              style={{ backgroundColor: '#ff8c00' }}
            >
              Corrige
            </button>

            <button
              type="button"
              onClick={confirmar}
              disabled={processando}
              className="w-[30%] h-[60px] rounded-[4px] text-[0.9rem] font-bold uppercase cursor-pointer border-none shadow-[2px_4px_0px_rgba(0,0,0,0.5)] active:translate-y-[3px] active:shadow-[1px_2px_0px_rgba(0,0,0,0.5)] text-black disabled:opacity-50 flex items-center justify-center"
              style={{ backgroundColor: '#1b873f' }}
            >
              {processando ? (
                <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                'Confirma'
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Identificação Institucional da Urna Digital */}
      <div className="mt-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span className="font-semibold text-slate-400">IFVote — Urna Digital</span>
        <span>•</span>
        <span className="text-emerald-500/90 font-medium">IFPA — Campus Bragança, Pará</span>
        <span>•</span>
        <span>Desenvolvedor: Wagner Rocha</span>
      </div>

      {/* MODAL PADRÃO DE ERRO / AVISO */}
      <ErrorModal
        config={modalConfig}
        onClose={() => setModalConfig(null)}
      />

      {/* MODAL DE APOIO: MATRÍCULAS DE TESTE CADASTRADAS */}
      {mostrarAjudaEleitores && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 max-w-md w-full space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Matrículas Cadastradas (Pré-configuradas)
              </h3>
              <button
                type="button"
                onClick={() => setMostrarAjudaEleitores(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Clique em uma das matrículas abaixo para preencher automaticamente na urna ou consulte o número para digitar:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[
                { mat: '20231014040001', nome: 'Ana Clara Albuquerque', turma: 'INFO-3A' },
                { mat: '20231014040002', nome: 'Bruno Henrique Silva', turma: 'INFO-3A' },
                { mat: '20221014040015', nome: 'Camila Fernandes Rocha', turma: 'MEC-4B' },
                { mat: '20211014040030', nome: 'Diego Martins de Oliveira', turma: 'ELETRO-2A' },
                { mat: '1548721', nome: 'Prof. Marcos Vinicius', turma: 'DOCENTE' },
                { mat: '3049182', nome: 'Ricardo Augusto Silveira', turma: 'TAE' },
              ].map((item) => (
                <button
                  key={item.mat}
                  type="button"
                  onClick={() => {
                    setMatriculaDigitada(item.mat);
                    setMostrarAjudaEleitores(false);
                    tocarSomTecla();
                  }}
                  className="w-full text-left p-2.5 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded text-xs flex justify-between items-center transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-white">{item.nome}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Matrícula: {item.mat}</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold">
                    {item.turma}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setMostrarAjudaEleitores(false)}
                className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-bold rounded cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
