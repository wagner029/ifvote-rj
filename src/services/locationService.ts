export interface UrnaLocalizacao {
  tipo: 'GPS' | 'IP' | 'DESCONHECIDO';
  latitude?: number;
  longitude?: number;
  cidade?: string;
  estado?: string;
  pais?: string;
  ip?: string;
  acuraciaMetros?: number;
  atualizadaEm: string;
}

/**
 * Detecta a localização automática da urna em tempo real:
 * 1. Tenta geolocalização do navegador (GPS / Wi-Fi) com permissão
 * 2. Se negada ou com timeout, faz fallback automático para IP (cidade/estado)
 */
export async function detectarLocalizacaoAutomatica(): Promise<UrnaLocalizacao> {
  const timestamp = new Date().toISOString();

  // 1. Tenta geolocalização nativa do navegador
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 60000,
        });
      });

      const lat = Number(pos.coords.latitude.toFixed(5));
      const lon = Number(pos.coords.longitude.toFixed(5));

      // Tenta resolver cidade/estado via reverse geocoding rápido
      let cidade = '';
      let estado = '';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
          {
            signal: controller.signal,
            headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
          }
        );
        clearTimeout(timeoutId);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          cidade =
            geoData.address?.city ||
            geoData.address?.town ||
            geoData.address?.municipality ||
            geoData.address?.village ||
            '';
          estado = geoData.address?.state || '';
        }
      } catch {
        // Fallback silencioso se nominatim estiver lento
      }

      return {
        tipo: 'GPS',
        latitude: lat,
        longitude: lon,
        cidade: cidade || 'Coordenadas GPS',
        estado: estado || 'Brasil',
        pais: 'Brasil',
        acuraciaMetros: Math.round(pos.coords.accuracy),
        atualizadaEm: timestamp,
      };
    } catch (geoError) {
      // Permissão negada ou indisponível: prossegue para IP
    }
  }

  // 2. Fallback: Geolocalização aproximada por IP
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // Tentativa 1: ipapi.co
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        tipo: 'IP',
        latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
        longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
        cidade: data.city || 'Desconhecida',
        estado: data.region_code || data.region || 'BR',
        pais: data.country_name || 'Brasil',
        ip: data.ip ? `${data.ip.substring(0, 7)}...` : undefined,
        atualizadaEm: timestamp,
      };
    }
  } catch {
    // Tenta serviço alternativo se o primeiro falhar
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 3500);
      const res2 = await fetch('https://freeipapi.com/api/json', { signal: controller2.signal });
      clearTimeout(timeoutId2);
      if (res2.ok) {
        const data2 = await res2.json();
        return {
          tipo: 'IP',
          latitude: typeof data2.latitude === 'number' ? data2.latitude : undefined,
          longitude: typeof data2.longitude === 'number' ? data2.longitude : undefined,
          cidade: data2.cityName || 'Desconhecida',
          estado: data2.regionName || 'BR',
          pais: data2.countryName || 'Brasil',
          atualizadaEm: timestamp,
        };
      }
    } catch {
      // Ignora erro
    }
  }

  // 3. Fallback genérico caso sem internet externa
  return {
    tipo: 'DESCONHECIDO',
    cidade: 'Localização Automática Pendente',
    estado: 'BR',
    pais: 'Brasil',
    atualizadaEm: timestamp,
  };
}
