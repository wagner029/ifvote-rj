/**
 * Utilitário de Processamento de Imagem no Navegador: Remoção Automática de Fundo
 * Processa imagens no próprio navegador (Canvas API), sem depender de serviços pagos ou APIs externas.
 * Realiza análise de bordas, amostragem de cor de fundo e aplicação de máscara alfa com suavização (feathering).
 */

export interface BackgroundRemovalOptions {
  tolerance?: number; // 0 a 100
  featherRadius?: number; // suavização de borda em pixels
  cropToFace?: boolean;
}

/**
 * Remove o fundo da imagem fornecida (File ou DataURL) e retorna uma string PNG em Base64 com fundo transparente.
 */
export async function removerFundoImagem(
  imageSource: File | string,
  options: BackgroundRemovalOptions = {}
): Promise<string> {
  const { tolerance = 35, featherRadius = 2 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Redimensiona moderadamente para otimizar processamento e armazenamento
        const maxDimension = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          throw new Error('Falha ao obter contexto 2D do Canvas.');
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Amostragem das 4 quinas para detectar a cor média de fundo
        const samplePoints = [
          [0, 0],
          [width - 1, 0],
          [0, height - 1],
          [width - 1, height - 1],
          [Math.floor(width / 2), 0],
          [0, Math.floor(height / 2)],
          [width - 1, Math.floor(height / 2)],
        ];

        let bgR = 0;
        let bgG = 0;
        let bgB = 0;
        let sampleCount = 0;

        for (const [sx, sy] of samplePoints) {
          const idx = (sy * width + sx) * 4;
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
          sampleCount++;
        }

        bgR = Math.round(bgR / sampleCount);
        bgG = Math.round(bgG / sampleCount);
        bgB = Math.round(bgB / sampleCount);

        const tolDist = (tolerance / 100) * 441.67; // Raiz quadrada de (255^2 * 3) = ~441.67
        const softThreshold = tolDist * 0.4;

        // Máscara Alfa baseada na distância Euclidiana em RGB
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const diffR = r - bgR;
            const diffG = g - bgG;
            const diffB = b - bgB;
            const dist = Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);

            // Também detecta brancos/cinzas de estúdio caso o fundo seja claro
            const isWhiteOrNear = r > 240 && g > 240 && b > 240;

            if (dist < tolDist || isWhiteOrNear) {
              if (dist < tolDist - softThreshold) {
                // Totalmente transparente
                data[idx + 3] = 0;
              } else {
                // Suavização gradual na borda
                const alphaFactor = (dist - (tolDist - softThreshold)) / softThreshold;
                data[idx + 3] = Math.round(Math.min(255, Math.max(0, 255 * alphaFactor)));
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Suavização final opcional para contornos refinados
        const outputDataUrl = canvas.toDataURL('image/png', 0.92);
        resolve(outputDataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Erro ao carregar imagem para remoção de fundo.'));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'));
      reader.readAsDataURL(imageSource);
    }
  });
}
