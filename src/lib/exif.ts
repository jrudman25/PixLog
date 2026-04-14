import exifr from 'exifr';

export interface ExifData {
  takenAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  width: number | null;
  height: number | null;
}

    function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

export async function extractExif(file: File): Promise<ExifData> {
  try {
    const exif = await exifr.parse(file, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef',
        'ImageWidth',
        'ImageHeight',
        'ExifImageWidth',
        'ExifImageHeight',
      ],
      gps: true,
    });

    if (!exif) {
      const dimensions = await getImageDimensions(file);
      return {
        takenAt: null,
        latitude: null,
        longitude: null,
        ...dimensions,
      };
    }

    const takenAt =
      exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate || null;

    const dimensions = {
      width: exif.ExifImageWidth || exif.ImageWidth || null,
      height: exif.ExifImageHeight || exif.ImageHeight || null,
    };

    // If dimensions not in EXIF, get from image element
    if (!dimensions.width || !dimensions.height) {
      const imgDimensions = await getImageDimensions(file);
      dimensions.width = imgDimensions.width;
      dimensions.height = imgDimensions.height;
    }

    return {
      takenAt: takenAt ? new Date(takenAt) : null,
      latitude: exif.latitude ?? null,
      longitude: exif.longitude ?? null,
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch {
    const dimensions = await getImageDimensions(file);
    return {
      takenAt: null,
      latitude: null,
      longitude: null,
      ...dimensions,
    };
  }
}

export async function generateThumbnail(
  file: File,
  maxWidth = 600
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.naturalWidth, 1);
      canvas.width = Math.round(img.naturalWidth * ratio);
      canvas.height = Math.round(img.naturalHeight * ratio);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {resolve(blob);}
          else {reject(new Error('Could not generate thumbnail'));}
        },
        'image/webp',
        0.8
      );

      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Could not load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}
