/**
 * Sample Photos and Media generator for immediate testing
 * Generates valid JPG/PNG/WebP image blobs and test media
 */

export interface SampleMediaItem {
  name: string;
  mimeType: string;
  category: 'photo' | 'video';
  width: number;
  height: number;
  dataUrl: string;
}

/**
 * Creates high resolution graphic canvas photos with camera metadata simulation
 */
export function generateSampleCanvasImage(
  title: string,
  category: string,
  colorA: string,
  colorB: string,
  width = 1280,
  height = 720
): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Rich gradient background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Geometric camera grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 3, 0);
    ctx.lineTo(width / 3, height);
    ctx.moveTo((width * 2) / 3, 0);
    ctx.lineTo((width * 2) / 3, height);
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.moveTo(0, (height * 2) / 3);
    ctx.lineTo(width, (height * 2) / 3);
    ctx.stroke();

    // Central circular aperture motif
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 120, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.stroke();

    // Text details
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, height / 2 - 10);

    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(category.toUpperCase() + ' · 4K ULTRA HDR · MOTO SECURE SVAULT', width / 2, height / 2 + 30);

    // Simulated EXIF stamp at bottom-left
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'left';
    ctx.fillText(`ISO 100 · 24mm f/1.8 · 1/500s · LAT 37.7749 LON -122.4194`, 40, height - 40);

    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then((buf) => {
        resolve(new Uint8Array(buf));
      });
    }, 'image/jpeg', 0.92);
  });
}

/**
 * Generates an animated test video using HTML5 Canvas + MediaRecorder
 */
export async function generateSampleVideo(
  title: string,
  durationSeconds = 4
): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;

    const stream = canvas.captureStream(30);
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    };

    recorder.start();

    let frame = 0;
    const totalFrames = durationSeconds * 30;

    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;

      // Dark cinematic background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Rotating animated beacon
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const angle = progress * Math.PI * 4;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Outer ring
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 1.5);
      ctx.stroke();

      ctx.restore();

      // Text HUD
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, cx, cy - 10);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '14px monospace';
      const sec = (progress * durationSeconds).toFixed(1);
      ctx.fillText(`REC [●] 00:0${sec} / 00:0${durationSeconds}.0 · 1080p60`, cx, cy + 24);

      if (frame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 1000 / 30);
  });
}
