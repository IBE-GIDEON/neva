'use client';

import { showToast } from '../store';

/**
 * Read an image file and downscale it to a compact JPEG data URL. Keeps localStorage (≈5 MB) usable
 * until uploads go to Supabase Storage.
 */
export function compressImage(file: File, maxSide = 1280, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Opens the system photo picker. The input is attached to the page because Safari ignores detached file inputs. */
export async function pickImages(multiple = false): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = multiple;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      const out: string[] = [];
      for (const f of files) {
        try {
          out.push(await compressImage(f));
        } catch {
          /* skip unreadable files (e.g. HEIC outside Safari) */
        }
      }
      input.remove();
      if (files.length && !out.length) showToast('That photo format isn’t supported — try a JPG or PNG');
      resolve(out);
    };
    input.addEventListener('cancel', () => {
      input.remove();
      resolve([]);
    });
    input.click();
  });
}
