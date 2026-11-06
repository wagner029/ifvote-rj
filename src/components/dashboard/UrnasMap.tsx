import React, { useState, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import L from 'leaflet';
import type { UrnaRemota } from '../../services/electionService';
import { MapPin, Navigation, Signal, AlertTriangle, ShieldCheck } from 'lucide-react';

interface UrnasMapProps {
  urnas: UrnaRemota[];
  onEncerrarUrna?: (urnaId: string) => void;
}

// Coordenadas de referência para polos quando a urna utiliza localização por IP
const COORDENADAS_POLOS: Record<string, [number, number]> = {
  RJ: [-22.9068, -43.1729],
  'RIO DE JANEIRO': [-22.9068, -43.1729],
  PA: [-1.0536, -46.7656], // Bragança - PA
  BRAGANCA: [-1.0536, -46.7656],
  BELEM: [-1.4558, -48.5039],
  SP: [-23.5505, -46.6333],
  DF: [-15.7975, -47.8919],
  MG: [-19.9208, -43.9378],
  BA: [-12.9714, -38.5014],
};

function calcularCoordenadasUrna(urna: UrnaRemota): { lat: number; lng: number; isAproximada: boolean } {
  let lat = urna.localizacao?.latitude;
  let lng = urna.localizacao?.longitude;
  const isGps = urna.localizacao?.tipo === 'GPS' && lat !== undefined && lng !== undefined;

  if (lat === undefined || lng === undefined) {
    const estadoUpper = (urna.localizacao?.estado || '').toUpperCase();
    const cidadeUpper = (urna.localizacao?.cidade || '').toUpperCase();
    const polo = COORDENADAS_POLOS[estadoUpper] || COORDENADAS_POLOS[cidadeUpper];
    const jitter = ((urna.numero || 1) % 5) * 0.005;

    if (polo) {
      lat = polo[0] + jitter;
      lng = polo[1] + jitter;
    } else {
      // Default polo RJ (onde ocorrem as eleições remotas das urnas com monitoramento do PA)
      lat = -22.9068 + jitter;
      lng = -43.1729 + jitter;
    }
    return { lat, lng, isAproximada: true };
  }

  return { lat, lng, isAproximada: !isGps };
}

/**
 * Componente do Google Maps usando Maps JavaScript API oficial (@vis.gl/react-google-maps)
 */
const GoogleMapsView: React.FC<{
  apiKey: string;
  urnas: UrnaRemota[];
}> = ({ apiKey, urnas }) => {
  const [selectedUrna, setSelectedUrna] = useState<UrnaRemota | null>(null);

  // Calcula centro inicial médio com base nas urnas ou centro do Brasil
  const centroPadrao = { lat: -22.9068, lng: -43.1729 }; // Foco padrão RJ

  return (
    <APIProvider
      apiKey={apiKey}
      solutionChannel="GMP_mcp_codeassist_v1_aistudio"
    >
      <div className="w-full h-full relative">
        <Map
          defaultCenter={centroPadrao}
          defaultZoom={11}
          mapId="DEMO_MAP_ID"
          gestureHandling="greedy"
          disableDefaultUI={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full min-h-[420px]"
          style={{ width: '100%', height: '100%' }}
        >
          {urnas.map((urna) => {
            const { lat, lng, isAproximada } = calcularCoordenadasUrna(urna);
            const isOnline = urna.status === 'ONLINE';
            const isRevogada = urna.status === 'REVOGADA';
            const pinBg = isRevogada ? '#ef4444' : isOnline ? '#10b981' : '#f59e0b';

            return (
              <AdvancedMarker
                key={urna.id}
                position={{ lat, lng }}
                title={`${urna.identificador || `Urna ${urna.numero}`} - ${urna.status}`}
                onClick={() => setSelectedUrna(urna)}
              >
                <Pin
                  background={pinBg}
                  borderColor="#0f172a"
                  glyphColor="#ffffff"
                  scale={1.15}
                />
              </AdvancedMarker>
            );
          })}

          {selectedUrna && (
            <InfoWindow
              position={calcularCoordenadasUrna(selectedUrna)}
              onCloseClick={() => setSelectedUrna(null)}
            >
              <div className="font-sans text-xs text-slate-900 min-w-[210px] p-1">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200">
                  <span className="font-bold text-sm text-slate-950">
                    {selectedUrna.identificador || `Urna Nº ${selectedUrna.numero}`}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded ${
                      selectedUrna.status === 'ONLINE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedUrna.status === 'REVOGADA'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedUrna.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-slate-700 text-[11px]">
                  <p>
                    <strong className="text-slate-900">Pleito:</strong>{' '}
                    {selectedUrna.pleitoNome || selectedUrna.pleitoId || 'Geral'}
                  </p>
                  <p>
                    <strong className="text-slate-900">Localização:</strong>{' '}
                    {selectedUrna.localizacao?.cidade || 'Região'},{' '}
                    {selectedUrna.localizacao?.estado || 'BR'}
                  </p>
                  <div>
                    {selectedUrna.localizacao?.tipo === 'GPS' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-[10px]">
                        🛰️ GPS de Alta Precisão (Permitido)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200 text-[10px]">
                        🌐 Aproximada por IP (Permissão Negada)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                    Última atividade:{' '}
                    {selectedUrna.localizacao?.atualizadaEm
                      ? new Date(selectedUrna.localizacao.atualizadaEm).toLocaleTimeString('pt-BR')
                      : 'Hoje'}
                  </p>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  );
};

/**
 * Fallback Leaflet caso a chave do Google Maps não esteja configurada no ambiente
 */
const LeafletFallbackView: React.FC<{ urnas: UrnaRemota[] }> = ({ urnas }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-22.9068, -43.1729],
        zoom: 11,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      const markers = L.layerGroup().addTo(map);
      markersLayerRef.current = markers;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const bounds: [number, number][] = [];

    urnas.forEach((urna) => {
      const { lat, lng, isAproximada } = calcularCoordenadasUrna(urna);
      bounds.push([lat, lng]);

      const isOnline = urna.status === 'ONLINE';
      const isRevogada = urna.status === 'REVOGADA';
      const corFundo = isRevogada ? '#ef4444' : isOnline ? '#10b981' : '#f59e0b';
      const iconeTipo = isAproximada ? '🌐' : '🛰️';

      const customIcon = L.divIcon({
        className: 'custom-urna-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #0f172a;
            border: 2.5px solid ${corFundo};
            box-shadow: 0 4px 14px rgba(0,0,0,0.5);
            color: #ffffff;
            font-size: 14px;
            cursor: pointer;
          ">
            <span>${iconeTipo}</span>
            <div style="
              position: absolute;
              bottom: -4px;
              right: -4px;
              background: ${corFundo};
              color: white;
              font-size: 9px;
              font-weight: 800;
              border-radius: 6px;
              padding: 1px 4px;
              font-family: monospace;
              border: 1px solid #0f172a;
            ">
              ${String(urna.numero || 1).padStart(2, '0')}
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #1e293b; min-width: 200px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <strong style="font-size: 13px; color: #0f172a;">${urna.identificador || `Urna Nº ${urna.numero}`}</strong>
            <span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${
              isRevogada ? '#fee2e2; color: #dc2626' : isOnline ? '#dcfce7; color: #16a34a' : '#fef3c7; color: #d97706'
            };">
              ${urna.status}
            </span>
          </div>
          <div style="margin-bottom: 4px; color: #475569;">
            <strong>Pleito:</strong> ${urna.pleitoNome || urna.pleitoId || 'Geral'}
          </div>
          <div style="margin-bottom: 4px; color: #475569;">
            <strong>Local detectado:</strong> ${urna.localizacao?.cidade || 'Não informada'}, ${urna.localizacao?.estado || 'BR'}
          </div>
          <div style="margin-bottom: 4px; color: #475569;">
            <strong>Método:</strong> ${
              urna.localizacao?.tipo === 'GPS'
                ? '🛰️ GPS de Alta Precisão'
                : '🌐 Geolocalização Aproximada por IP'
            }
          </div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
            Última atividade: ${
              urna.localizacao?.atualizadaEm ? new Date(urna.localizacao.atualizadaEm).toLocaleTimeString('pt-BR') : 'Hoje'
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      markersLayer.addLayer(marker);
    });

    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    }
  }, [urnas]);

  return <div ref={mapContainerRef} className="w-full h-full z-0" />;
};

export const UrnasMap: React.FC<UrnasMapProps> = ({ urnas }) => {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  return (
    <div className="space-y-3">
      {/* Aviso de Quota do Google Maps se aplicável */}
      {quotaExceeded && (
        <div className="bg-amber-950/80 border border-amber-500/40 text-amber-200 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Google Maps Platform quota reached. Para liberar limites, acesse as configurações no console Google Cloud.
            </span>
          </div>
        </div>
      )}

      {/* Container do Mapa Principal */}
      <div className="relative w-full h-[400px] md:h-[460px] rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
        {mapsApiKey ? (
          <GoogleMapsView apiKey={mapsApiKey} urnas={urnas} />
        ) : (
          <LeafletFallbackView urnas={urnas} />
        )}

        {/* Legenda Flutuante em Tempo Real */}
        <div className="absolute top-3 right-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg p-2.5 text-[11px] text-slate-200 shadow-lg space-y-1.5 pointer-events-auto">
          <div className="font-bold text-white text-xs mb-1 flex items-center gap-1.5">
            <Signal className="w-3.5 h-3.5 text-emerald-400" />
            <span>{mapsApiKey ? 'Google Maps JavaScript API' : 'Monitoramento em Tempo Real'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>Online e Ativa ({urnas.filter((u) => u.status === 'ONLINE').length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>Pendente / IP ({urnas.filter((u) => u.status === 'PENDENTE').length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span>Encerrada/Revogada ({urnas.filter((u) => u.status === 'REVOGADA').length})</span>
          </div>
        </div>

        {/* Rodapé explicativo de privacidade rigorosa */}
        <div className="absolute bottom-2 left-3 right-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-md px-3 py-1.5 text-[10px] text-slate-300 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong>Sigilo Inviolável:</strong> A localização pertence estritamente à URNA/SESSÃO física. Nenhum dado do eleitor ou voto é rastreado ou associado.
            </span>
          </div>
          <span className="font-mono text-slate-400 font-bold shrink-0 ml-2">Bragança - PA ➔ RJ</span>
        </div>
      </div>
    </div>
  );
};
