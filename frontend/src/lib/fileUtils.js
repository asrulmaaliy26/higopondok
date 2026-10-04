/**
 * Utility functions for handling file uploads, extensions, image compression, and proof displays
 */

export const getFileType = (urlOrName = '') => {
  if (!urlOrName) return 'unknown';
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
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
};

/**
 * Compress an image file using browser Canvas and convert HEIC/HEIF to JPEG automatically.
 * Reduces large photos (e.g. 5-15MB from phone camera) down to ~150-350KB
 * without noticeable quality loss for receipts/proofs/photos.
 *
 * @param {File} file
 * @param {Object} options - { maxWidth: 1400, maxHeight: 1400, quality: 0.75, outputType: 'image/jpeg' }
 * @returns {Promise<File>}
 */
export const compressImageFile = async (rawFile, options = {}) => {
  if (!rawFile) return rawFile;

  let file = rawFile;

  // 1. Auto-Convert Apple iPhone HEIC/HEIF to standard JPEG (Dynamic import for tiny initial bundle)
  if (isHeifFile(file)) {
    try {
      const heic2anyModule = await import('heic2any');
      const heic2any = heic2anyModule.default || heic2anyModule;
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: options.quality !== undefined ? options.quality : 0.8,
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

  const maxWidth = options.maxWidth || 1400;
  const maxHeight = options.maxHeight || 1400;
  const quality = options.quality !== undefined ? options.quality : 0.75;
  const outputType = options.outputType || 'image/jpeg';

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const image = new Image();
        image.onload = () => {
          try {
            let width = image.width;
            let height = image.height;

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

            const ctx = canvas.getContext('2d', { alpha: false });
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(image, 0, 0, width, height);
            }

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  resolve(file);
                  return;
                }

                const originalName = file.name || 'proof.jpg';
                const baseName = originalName.replace(/\.[^/.]+$/, "");
                const newFileName = `${baseName}.jpg`;

                const compressedFile = new File([blob], newFileName, {
                  type: outputType,
                  lastModified: Date.now(),
                });

                // Attach size metadata
                compressedFile.originalSize = file.size;
                compressedFile.isCompressed = true;

                resolve(compressedFile);
              },
              outputType,
              quality
            );
          } catch (canvasErr) {
            console.warn('Canvas compression error:', canvasErr);
            resolve(file);
          }
        };

        image.onerror = () => {
          resolve(file);
        };

        image.src = readerEvent.target.result;
      };

      reader.onerror = () => {
        resolve(file);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('File reading error in compressImageFile:', err);
      resolve(file);
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
