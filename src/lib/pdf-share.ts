/** Shared helpers for PDFs made in the browser (payslips, statements). */
import type jsPDF from 'jspdf';

/** Loads the company logo as a data: URL for a PDF; returns null if it can't. */
export async function loadLogo(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(png|jpe?g)$/.test(blob.type)) return null; // jsPDF only embeds PNG/JPEG
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export const canShareFiles = () => typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

/**
 * Opens the phone's share sheet (WhatsApp, email, ...) with the PDF.
 * Returns 'downloaded' when the browser can't share files, 'cancelled' if the user closed it.
 */
export async function sharePdf(doc: jsPDF, fileName: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName, text });
      return 'shared';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
      throw e;
    }
  }
  doc.save(fileName);
  return 'downloaded';
}
