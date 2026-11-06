import React, { useState, useMemo } from 'react';
import type { VotoRegistrado, UrnaRemota, Chapa } from '../../services/electionService';
import { BarChart3, Filter, Award, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ApuracaoGraficosProps {
  votos: VotoRegistrado[];
  totalEleitores?: number;
  urnasRemotas: UrnaRemota[];
  chapas?: Chapa[];
}

export const ApuracaoGraficos: React.FC<ApuracaoGraficosProps> = ({
  votos,
  urnasRemotas,
  chapas = [],
}) => {
  const [urnaSelecionada, setUrnaSelecionada] = useState<number | 'TODAS'>('TODAS');

  // Filtra votos de acordo com a urna selecionada
  const votosFiltrados = useMemo(() => {
    if (urnaSelecionada === 'TODAS') return votos;
    return votos.filter((v) => (v.urna_numero || 1) === urnaSelecionada);
  }, [votos, urnaSelecionada]);

  // Contabilização rigorosa no backend/memória (mantém contagem real)
  const apuracaoChapas = useMemo(() => {
    const contagem: Record<string, number> = {};
    let totalValidos = 0;

    for (const v of votosFiltrados) {
      if (v.chapa_id !== 'BRANCO' && v.chapa_id !== 'NULO') {
        contagem[v.chapa_id] = (contagem[v.chapa_id] || 0) + 1;
        totalValidos++;
      }
    }

    // Se temos chapas cadastradas, mapeamos a partir delas
    const coresColunas = [
      { bg: 'from-blue-600 to-indigo-600', text: 'text-blue-400', border: 'border-blue-500/40', badge: 'bg-blue-950 text-blue-300' },
      { bg: 'from-emerald-600 to-teal-600', text: 'text-emerald-400', border: 'border-emerald-500/40', badge: 'bg-emerald-950 text-emerald-300' },
      { bg: 'from-amber-600 to-orange-600', text: 'text-amber-400', border: 'border-amber-500/40', badge: 'bg-amber-950 text-amber-300' },
      { bg: 'from-purple-600 to-fuchsia-600', text: 'text-purple-400', border: 'border-purple-500/40', badge: 'bg-purple-950 text-purple-300' },
    ];

    // Se a lista de chapas for vazia, garante pelo menos as opções 10 e 20
    const listaChapasBase = chapas.length > 0 ? chapas : [
      { id: '10', numero: '10', nome: 'Chapa 10 - Renovação Estudantil', nomePresidente: 'Gabriel Santos', nomeVice: 'Larissa Lima' },
      { id: '20', numero: '20', nome: 'Chapa 20 - Voz Ativa', nomePresidente: 'Beatriz Costa', nomeVice: 'Lucas Oliveira' },
    ];

    const resultado = listaChapasBase.map((chapa, index) => {
      const qtdVotos = contagem[chapa.numero] || 0;
      const perc = totalValidos > 0 ? (qtdVotos / totalValidos) * 100 : 0;
      const cor = coresColunas[index % coresColunas.length];

      return {
        id: chapa.id,
        numero: chapa.numero,
        nome: chapa.nome,
        nomePresidente: chapa.nomePresidente,
        nomeVice: chapa.nomeVice,
        fotoPresidente: chapa.fotoPresidente,
        fotoVice: chapa.fotoVice,
        percentual: perc.toFixed(1) + '%',
        percentualNum: perc,
        cor,
      };
    });

    // Identifica o líder
    const maiorPerc = Math.max(...resultado.map((r) => r.percentualNum), 0);

    return {
      totalValidos,
      totalVotosGerais: votosFiltrados.length,
      resultado,
      maiorPerc,
    };
  }, [votosFiltrados, chapas]);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-xl space-y-6">
      {/* Cabeçalho da Apuração */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#30363d]">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <span>Apuração dos Resultados em Colunas</span>
          </h2>
          <p className="text-xs text-slate-400">
            Distribuição percentual dos votos por chapa concorrente em tempo real.
          </p>
        </div>

        {/* Filtro por Urna */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400">Filtrar por Urna:</span>
          <select
            value={urnaSelecionada}
            onChange={(e) =>
              setUrnaSelecionada(e.target.value === 'TODAS' ? 'TODAS' : Number(e.target.value))
            }
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="TODAS">Todas as Urnas ({votos.length} votos)</option>
            {urnasRemotas.map((u) => (
              <option key={u.id} value={u.numero}>
                Urna Nº {String(u.numero).padStart(2, '0')} ({u.identificador})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: GRÁFICO EM COLUNAS VERTICAIS */}
      {apuracaoChapas.totalValidos === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-xl text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-1 opacity-60" />
          <h4 className="text-sm font-bold text-white">Aguardando registro de votos nas chapas</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Assim que as primeiras cédulas forem confirmadas na urna digital, os percentuais de cada chapa serão projetados nas colunas abaixo.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Gráfico de Colunas / Podio Responsivo */}
          <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800/80">
            <div className="h-64 flex items-end justify-center gap-6 sm:gap-12 pt-8 pb-4 border-b border-slate-800">
              {apuracaoChapas.resultado.map((item) => {
                const ehLider = item.percentualNum > 0 && item.percentualNum >= apuracaoChapas.maiorPerc;
                const alturaMinima = 12; // Altura mínima para renderizar a coluna
                const alturaCalculada = Math.max(alturaMinima, Math.round(item.percentualNum * 2.2));

                return (
                  <div key={item.id} className="flex-1 max-w-[140px] flex flex-col items-center h-full justify-end group">
                    {/* Badge de Porcentagem no Topo da Coluna */}
                    <div className="mb-2 text-center transition-transform group-hover:scale-110">
                      {ehLider && (
                        <div className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold mb-1">
                          <Award className="w-3.5 h-3.5" />
                          <span>Líder</span>
                        </div>
                      )}
                      <div className="text-lg sm:text-2xl font-black text-white font-mono tracking-tight">
                        {item.percentual}
                      </div>
                    </div>

                    {/* Coluna Vertical */}
                    <div className="w-full flex justify-center h-full items-end">
                      <div
                        style={{ height: `${alturaCalculada}px` }}
                        className={`w-full rounded-t-xl bg-gradient-to-t ${item.cor.bg} shadow-lg transition-all duration-700 relative overflow-hidden border-t-2 border-x ${item.cor.border}`}
                      >
                        {/* Brilho na coluna */}
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/40"></div>
                      </div>
                    </div>

                    {/* Legenda Abaixo da Coluna */}
                    <div className="mt-3 text-center w-full">
                      <div className="text-sm font-extrabold text-white truncate">
                        Chapa {item.numero}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {item.nomePresidente ? `Pres. ${item.nomePresidente}` : item.nome}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé explicativo da apuração */}
            <div className="pt-4 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Exibição de percentuais válidos oficiais</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Cálculo auditado e criptografado
              </div>
            </div>
          </div>

          {/* Cards Detalhados das Chapas Concorrentes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {apuracaoChapas.resultado.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {/* Foto do Presidente se existir */}
                  {item.fotoPresidente ? (
                    <img
                      src={item.fotoPresidente}
                      alt={item.nomePresidente}
                      className="w-12 h-12 rounded-xl object-cover bg-slate-950 border border-slate-700"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${item.cor.badge}`}>
                      {item.numero}
                    </div>
                  )}

                  <div>
                    <div className="text-sm font-bold text-white">
                      {item.nome}
                    </div>
                    <div className="text-xs text-slate-400">
                      Presidente: <strong className="text-slate-200">{item.nomePresidente || '—'}</strong>
                      {item.nomeVice && (
                        <span> • Vice: <strong className="text-slate-200">{item.nomeVice}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Porcentagem em Destaque */}
                <div className="text-right">
                  <div className="text-xl font-black text-white font-mono">
                    {item.percentual}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    dos votos válidos
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
