import React from 'react';
import type { EstadoEleicao } from '../services/electionService';
import { IfVoteLogo } from './common/IfVoteLogo';
import {
  Link2,
  ShieldCheck,
  QrCode,
  Lock,
  ArrowRight,
  Mail,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  Smartphone,
  Vote,
} from 'lucide-react';

interface IndexViewProps {
  estadoEleicao: EstadoEleicao;
  onIrPainel: () => void;
}

export const IndexView: React.FC<IndexViewProps> = ({
  estadoEleicao,
  onIrPainel,
}) => {
  const pleitoId = estadoEleicao.pleitoIdentificador || 'ifvote-rj';
  const pleitoTitulo = estadoEleicao.pleitoNome || estadoEleicao.titulo || 'Consulta Eleitoral do Grêmio Estudantil';

  // Configurações fáceis de editar no rodapé profissional
  const CONTATO_EMAIL = 'wagnerrocha029@gmail.com';
  const VERSAO_SISTEMA = 'v2.5.0';
  const DATA_ATUALIZACAO = '06 de Novembro de 2026';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-[#07090e] text-slate-100 font-sans flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Topo Institucional Leve & Estudantil */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur px-6 py-3.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Vote className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200">IFVote</span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline">Urna Digital Estudantil</span>
        </div>

        {/* Pleito em Destaque */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 hidden md:inline">Pleito Ativo:</span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {pleitoId}
          </span>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto my-6">
        <div className="w-full max-w-2xl text-center flex flex-col items-center">
          {/* Logo Oficial IFVote com recorte limpo */}
          <div className="mb-5 transform hover:scale-105 transition-transform duration-300">
            <IfVoteLogo size="xl" theme="dark" showSubtitle={false} />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Plataforma Oficial de Eleições Estudantis</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-2">
            {pleitoTitulo}
          </h1>

          {/* Badge em Destaque do Pleito */}
          <div className="flex items-center gap-2 mb-6">
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs font-mono font-bold text-emerald-400">
              ID: {pleitoId}
            </span>
            <span
              className={`px-3 py-1 rounded-md text-xs font-bold ${
                estadoEleicao.eleicaoAtiva
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-red-950 text-red-400 border border-red-800'
              }`}
            >
              {estadoEleicao.eleicaoAtiva ? 'Votação em Andamento' : 'Pleito Encerrado'}
            </span>
          </div>

          <p className="text-sm text-slate-400 max-w-lg leading-relaxed mb-8">
            As cabines de votação do IFVote funcionam através de <strong className="text-slate-200">links remotos autorizados</strong> e QR Codes gerados pela comissão eleitoral, garantindo total controle de abertura e encerramento.
          </p>

          {/* BLOCO DIFERENCIAL: COMO FUNCIONA A URNA REMOTA POR LINK */}
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 mb-8 text-left shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Diferencial: Urna Remota Autorizada (Votação por Link)</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Mais controle, integridade e praticidade para as eleições do Grêmio
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
                <div className="w-7 h-7 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center text-xs font-bold mb-2">
                  1
                </div>
                <div className="text-xs font-bold text-white mb-1">Geração de Link</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A comissão gera links ou QR Codes exclusivos para cada dispositivo ou cabine oficial.
                </p>
              </div>

              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center text-xs font-bold mb-2">
                  2
                </div>
                <div className="text-xs font-bold text-white mb-1">Cabine Blindada</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  O link abre a urna digital isolada, sem acesso a dados administrativos, pronta para os eleitores.
                </p>
              </div>

              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
                <div className="w-7 h-7 rounded-lg bg-red-950 text-red-400 flex items-center justify-center text-xs font-bold mb-2">
                  3
                </div>
                <div className="text-xs font-bold text-white mb-1">Encerramento Remoto</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A qualquer momento, o administrador revoga ou encerra os terminais com efeito instantâneo.
                </p>
              </div>
            </div>

            {/* Aviso Amigável para o Eleitor */}
            <div className="mt-4 p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-xs text-emerald-300">
              <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                <strong>Eleitor:</strong> Para votar, acesse o link enviado pela comissão ou escaneie o QR Code na cabine de votação da sua turma.
              </span>
            </div>
          </div>

          {/* Botão de Acesso Administrativo (Gestão, Chapas e Urnas) */}
          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={onIrPainel}
              className="w-full group flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-950/50 border border-blue-400/30 transition-all duration-200 active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-base font-bold text-white tracking-wide">
                    Painel da Comissão Eleitoral
                  </div>
                  <div className="text-xs text-blue-100 font-normal">
                    Gerar links de urnas, gerenciar chapas e acompanhar apuração
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>

      {/* RODAPÉ PADRÃO DE APLICAÇÕES PROFISSIONAIS */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/90 backdrop-blur px-6 py-6 text-xs text-slate-400">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Informações do Criador e Localização */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <div>
              <span className="text-slate-300 font-bold">IFVote</span> • Criado para o 1º Grêmio Estudantil
            </div>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <div className="flex items-center gap-1 text-slate-300">
              <span>Desenvolvido por:</span>
              <strong className="text-white">Wagner Rocha</strong>
            </div>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <div className="flex items-center gap-1 text-emerald-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>IFPA – Campus Bragança</span>
            </div>
          </div>

          {/* Contato, Versão e Direitos */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-right">
            <a
              href={`mailto:${CONTATO_EMAIL}`}
              className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
              title="Entrar em contato com o desenvolvedor"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="font-mono">{CONTATO_EMAIL}</span>
            </a>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{VERSAO_SISTEMA} • {DATA_ATUALIZACAO}</span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-4 pt-4 border-t border-slate-800/60 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} IFVote. Todos os direitos reservados. Sistema estudantil para consultas e eleições democráticas.
        </div>
      </footer>
    </div>
  );
};
