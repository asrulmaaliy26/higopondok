/**
 * Utility functions for handling file uploads, extensions, image compression, and proof displays
 */

export const getFileType = (urlOrName = '') => {
  if (!urlOrName) return 'unknown';

  // Google Drive proxy stream atau direct drive link adalah gambar/foto bukti
  if (urlOrName.includes('/api/media/drive-stream') || urlOrName.includes('drive.google.com')) {
    return 'image';
  }

  const clean = urlOrName.split('?')[0].toLowerCase();
  
  if (clean.match(/\.(jpeg|jpg|png|webp|gif|svg|bmp|ico)$/)) {
    return 'image';
  }
  if (clean.match(/\.(heic|heif)$/)) {
    return 'heif';
  }
  if (clean.endsWith('.pdf')) {
    return 'pdf';
  }
  if (clean.match(/\.(doc|docx|odt|rtf|txt)$/)) {
    return 'document';
  }
  if (clean.match(/\.(xls|xlsx|csv)$/)) {
    return 'spreadsheet';
  }
  if (clean.match(/\.(zip|rar|7z|tar|gz)$/)) {
    return 'archive';
  }
  return 'file';
};

export const isImageFile = (file) => {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  const name = file.name || '';
  return !!name.match(/\.(jpeg|jpg|png|webp|gif|svg|bmp|ico|heic|heif)$/i);
};

export const isHeifFile = (file) => {
  if (!file) return false;
  if (file.type && (file.type.includes('heic') || file.type.includes('heif'))) return true;
  const name = file.name || '';
  return !!name.match(/\.(heic|heif)$/i);
};

export const isPdfFile = (file) => {
  if (!file) return false;
  if (file.type === 'application/pdf') return true;
  const name = file.name || '';
  return name.toLowerCase().endsWith('.pdf');
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const getFileNameFromPath = (path = '') => {
  if (!path) return 'Berkas Bukti';
  if (path.includes('drive.google.com') || path.includes('/api/media/drive-stream')) {
    return 'Foto Bukti (Google Drive)';
  }
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
};

/**
 * Superfast Image Compression using URL.createObjectURL and Canvas.
 * Downscales multi-megapixel phone photos (5-15MB) down to ~70-160KB in milliseconds.
 * Avoids heavy base64 strings (readAsDataURL) to prevent memory crashes on low-end mobile phones.
 *
 * @param {File} rawFile
 * @param {Object} options - { maxWidth: 1080, maxHeight: 1080, quality: 0.75, outputType: 'image/jpeg' }
 * @returns {Promise<File>}
 */
export const compressImageFile = async (rawFile, options = {}) => {
  if (!rawFile) return rawFile;

  let file = rawFile;

  // 1. Auto-Convert Apple iPhone HEIC/HEIF to standard JPEG (Dynamic import)
  if (isHeifFile(file)) {
    try {
      const heic2anyModule = await import('heic2any');
      const heic2any = heic2anyModule.default || heic2anyModule;
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: options.quality !== undefined ? options.quality : 0.75,
      });

      const blobResult = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const baseName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '');
      file = new File([blobResult], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      file.originalSize = rawFile.size;
    } catch (heicErr) {
      console.warn('HEIC to JPEG conversion warning:', heicErr);
    }
  }

  if (!isImageFile(file)) {
    return file;
  }

  // 1080px is ideal for mobile proof / receipts: sharp text, tiny file size (< 150KB)
  const maxWidth = options.maxWidth || 1080;
  const maxHeight = options.maxHeight || 1080;
  const quality = options.quality !== undefined ? options.quality : 0.75;
  const preferredType = options.outputType || 'image/jpeg';

  return new Promise((resolve) => {
    let objectUrl = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      objectUrl = null;
    }

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
        objectUrl = null;
      }
    };

    const finishWithFallback = () => {
      cleanup();
      resolve(file);
    };

    const processImage = (img) => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height || width < 10 || height < 10) {
          finishWithFallback();
          return;
        }

        // Calculate proportional dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium'; // Hardware accelerated fast scaling
          if (preferredType !== 'image/png' && !options.keepTransparency) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);
        } else {
          finishWithFallback();
          return;
        }

        const handleBlob = (blob) => {
          if (!blob) {
            finishWithFallback();
            return;
          }

          // Safety check: Jika blob hasil kompresi berukuran mencurigakan sangat kecil (< 3 KB) 
          // padahal resolusi gambar besar (> 400px), ini indikasi kuat canvas putih kosong/gagal render.
          // Kembalikan file asli agar bukti bayar santri tidak rusak/putih polos.
          if (blob.size < 3000 && (width > 400 || height > 400) && rawFile.size > 8000) {
            console.warn('Canvas compression resulted in suspiciously tiny / blank image, falling back to original file.');
            finishWithFallback();
            return;
          }

          const isWebp = blob.type === 'image/webp';
          const ext = isWebp ? '.webp' : (blob.type === 'image/png' ? '.png' : '.jpg');
          const originalName = file.name || 'photo.jpg';
          const baseName = originalName.replace(/\.[^/.]+$/, "");
          const newFileName = `${baseName}${ext}`;

          const compressedFile = new File([blob], newFileName, {
            type: blob.type,
            lastModified: Date.now(),
          });

          compressedFile.originalSize = rawFile.size || file.size;
          compressedFile.isCompressed = true;
          cleanup();
          resolve(compressedFile);
        };

        canvas.toBlob(
          (blob) => {
            if (blob) {
              handleBlob(blob);
            } else {
              // Fallback to jpeg if other format unsupported
              canvas.toBlob((fallbackBlob) => {
                if (fallbackBlob) {
                  handleBlob(fallbackBlob);
                } else {
                  finishWithFallback();
                }
              }, 'image/jpeg', quality);
            }
          },
          preferredType,
          quality
        );
      } catch (canvasErr) {
        console.warn('Canvas compression error:', canvasErr);
        finishWithFallback();
      }
    };

    if (objectUrl) {
      const image = new Image();
      image.onload = async () => {
        try {
          if ('decode' in image) {
            await image.decode();
          }
        } catch {
          // Abaikan decode error dan lanjutkan render
        }
        processImage(image);
      };
      image.onerror = () => {
        finishWithFallback();
      };
      image.src = objectUrl;
    } else {
      // Fallback to FileReader if createObjectURL is unavailable
      try {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const image = new Image();
          image.onload = async () => {
            try {
              if ('decode' in image) {
                await image.decode();
              }
            } catch {}
            processImage(image);
          };
          image.onerror = () => finishWithFallback();
          image.src = readerEvent.target.result;
        };
        reader.onerror = () => finishWithFallback();
        reader.readAsDataURL(file);
      } catch (err) {
        console.warn('FileReader error in compressImageFile:', err);
        finishWithFallback();
      }
    }
  });
};

/**
 * Compress an array of files concurrently.
 */
export const compressImageFiles = async (files, options = {}) => {
  if (!Array.isArray(files) || files.length === 0) return [];
  return Promise.all(files.map((file) => compressImageFile(file, options)));
};

/**
 * Buka media/bukti dalam resolusi penuh di tab baru secara aman
 * tanpa terintersep atau terblokir oleh Single Page Application (SPA) Router / PWA Service Worker.
 */
export const openFullResolutionMedia = (url, title = 'Bukti Transaksi') => {
  if (!url) return;
  const fileType = getFileType(url);
  const win = window.open('', '_blank');
  if (win) {
    try {
      win.document.write(`
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
            <title>${title} - Resolusi Penuh</title>
            <style>
              * { box-sizing: border-box; }
              body {
                margin: 0;
                padding: 12px;
                background-color: #0b0f19;
                color: #f3f4f6;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .toolbar {
                position: fixed;
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(17, 24, 39, 0.9);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 6px 14px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 1000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
              }
              .toolbar a, .toolbar button {
                color: #10b981;
                text-decoration: none;
                font-size: 12px;
                font-weight: bold;
                background: none;
                border: none;
                cursor: pointer;
              }
              .media-container {
                display: flex;
                align-items: center;
                justify-content: center;
                max-width: 100%;
                margin-top: 36px;
              }
              img {
                max-width: 100%;
                max-height: 90vh;
                object-fit: contain;
                border: 1px solid #1f2937;
                background: #000;
                cursor: zoom-in;
              }
              iframe {
                width: 95vw;
                height: 90vh;
                border: 1px solid #1f2937;
                background: #fff;
              }
            </style>
          </head>
          <body>
            <div class="toolbar">
              <span style="font-size: 11px; color: #9ca3af;">${title}</span>
              <a href="${url}" download>⬇️ Unduh Berkas</a>
              <button onclick="window.close()">✖ Tutup</button>
            </div>
            <div class="media-container">
              ${
                fileType === 'pdf'
                  ? `<iframe src="${url}" title="${title}"></iframe>`
                  : `<img src="${url}" alt="${title}" onclick="this.requestFullscreen ? this.requestFullscreen() : null" />`
              }
            </div>
          </body>
        </html>
      `);
      win.document.close();
      return;
    } catch (e) {
      // Fallback direct open
    }
  }
  // Fallback normal window.open
  window.open(url, '_blank', 'noopener,noreferrer');
};
