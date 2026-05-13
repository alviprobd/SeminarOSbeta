import { BoundingBox, Template } from '../types';

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 848;

export function fitText(ctx: CanvasRenderingContext2D, text: string, box: BoundingBox, maxFontSize: number) {
  let fontSize = maxFontSize;
  const padding = 20; // Internal padding
  const maxWidth = box.width - (padding * 2);
  const fontFamily = box.fontFamily || 'Poppins';
  
  do {
    ctx.font = `${box.fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
    fontSize--;
  } while (ctx.measureText(text).width > maxWidth && fontSize > 10);

  return ctx.font;
}

export async function renderCertificateToCanvas(
  canvas: HTMLCanvasElement,
  template: Template,
  data: { studentName: string; seminarTitle: string; verificationCode?: string },
  options: { showDebug?: boolean } = {}
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = template.backgroundImage;
    
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Render Student Name
      if (template.elements.studentName.visible !== false) {
        renderBoxText(ctx, data.studentName, template.elements.studentName, options.showDebug);
      }
      
      // Render Seminar Title
      if (template.elements.seminarTitle.visible !== false) {
        renderBoxText(ctx, data.seminarTitle, template.elements.seminarTitle, options.showDebug);
      }

      // Render Verification Code (if provided)
      if (data.verificationCode && template.elements.verificationCode && template.elements.verificationCode.visible !== false) {
        renderBoxText(ctx, data.verificationCode, template.elements.verificationCode, options.showDebug);
      }
      
      resolve();
    };
    
    img.onerror = reject;
  });
}

function renderBoxText(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: BoundingBox,
  showDebug?: boolean
) {
  if (showDebug) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.setLineDash([]);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = box.color;
  
  // Auto scale font
  ctx.font = fitText(ctx, text, box, box.maxFontSize);
  
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  
  ctx.fillText(text, centerX, centerY);
}
