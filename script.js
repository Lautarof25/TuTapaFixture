/* ===== CANVAS ===== */
const canvas = new fabric.Canvas('canvas', {
  selection: false,
  interactive: false,
  enableRetinaScaling: false,
  allowTouchScrolling: true
});
canvas.setBackgroundColor('white', canvas.renderAll.bind(canvas));

/* Cargar imagen por defecto ("tapa.webp") */
fabric.Image.fromURL('img/tapa.webp', function (img) {
  if (img) {
    const scale = Math.max(
      canvas.width / img.width,
      canvas.height / img.height
    );
    img.set({
      scaleX: scale,
      scaleY: scale,
      originX: 'center',
      originY: 'center',
      left: canvas.width / 2,
      top: canvas.height / 2,
      selectable: false,
      evented: false
    });
    canvas.add(img);
    canvas.sendToBack(img);
    canvas.renderAll();
    setTimeout(actualizarTapaPreview, 100);
  }
});

document.getElementById('upload').addEventListener('change', function (e) {
  if (!e.target.files.length) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    fabric.Image.fromURL(event.target.result, function (img) {
      const scale = Math.max(
        canvas.width / img.width,
        canvas.height / img.height
      );

      img.set({
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        left: canvas.width / 2,
        top: canvas.height / 2,
        selectable: false,
        evented: false
      });

      canvas.clear();
      canvas.setBackgroundColor('white', canvas.renderAll.bind(canvas));
      canvas.add(img);
      canvas.sendToBack(img);
      canvas.renderAll();

      // Reflejar la carga en la previsualización A4 automáticamente
      setTimeout(actualizarTapaPreview, 100);
    });
  };
  reader.readAsDataURL(e.target.files[0]);
});

/* ===== COLORES ===== */
const root = document.documentElement;

c1.oninput = e => root.style.setProperty('--color1', e.target.value);
c2.oninput = e => root.style.setProperty('--color2', e.target.value);
c3.oninput = e => root.style.setProperty('--color3', e.target.value);

/* ===== A4 ESCALA RESPONSIVA ===== */
function adjustA4Scale() {
  const scaler = document.getElementById('a4Scaler');
  const a4 = document.getElementById('printArea');
  if (!scaler || !a4) return;

  // Temporarily remove transform to measure actual pixel size
  a4.style.transform = "none";
  const a4Width = a4.offsetWidth;

  // We want to leave a small safe margin inside the scaler (e.g., 20px total)
  const containerWidth = scaler.clientWidth - 20;

  if (containerWidth > 0 && containerWidth < a4Width) {
    const scale = containerWidth / a4Width;
    a4.style.transformOrigin = "top center";
    a4.style.transform = `scale(${scale})`;

    // Adjust the container's height so it shrinks and doesn't leave huge empty space below
    scaler.style.height = (a4.offsetHeight * scale + 48) + "px"; // 48 is for top/bottom padding
  } else {
    a4.style.transform = "scale(1)";
    scaler.style.height = "auto";
  }
}

window.addEventListener('resize', adjustA4Scale, { passive: true });
window.addEventListener('load', adjustA4Scale, { passive: true });
setTimeout(adjustA4Scale, 100);

/* ===== PDF ===== */
async function descargarPDF(modo = 'plegable') {
  const btnId = modo === 'normal' ? 'btnDescargarNormal' : 'btnDescargarPlegable';
  const btn = document.getElementById(btnId);
  const textOriginal = btn.innerHTML;
  btn.innerHTML = `<svg class="spin" style="margin-right: 8px" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg> Generando...`;
  btn.style.opacity = '0.8';
  btn.style.pointerEvents = 'none';

  actualizarTapaPreview();
  prepararParaExport();

  const printArea = document.getElementById('printArea');
  const scaler = document.getElementById('a4Scaler');

  // Forzar visualización temporal para html2canvas en móviles
  scaler.style.setProperty('display', 'flex', 'important');

  const originalTransform = printArea.style.transform;

  // Si es modo normal, quitamos temporalmente la clase "rotated" de las hojas
  if (modo === 'normal') {
    printArea.querySelectorAll('.rotated').forEach(el => {
      el.classList.remove('rotated');
      el.setAttribute('data-was-rotated', 'true');
    });
  }

  // Quitamos cualquier factor de escala para que HTML2Canvas mida el plano nativo de 29.7cm
  printArea.style.transform = "none";

  // Forzar carga de imágenes invisibles en móviles debido a lazy loading
  const images = Array.from(printArea.querySelectorAll('img'));
  images.forEach(img => {
    img.removeAttribute('loading');
  });

  // Asegurarnos de que el DOM haya procesado los cambios visuales y repintado
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 300)));

  // Esperar activamente a que las imágenes estén completamente cargadas en memoria antes de capturar
  await Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(r => { img.onload = r; img.onerror = r; });
  }));

  const { jsPDF } = window.jspdf;

  const canvasImg = await html2canvas(printArea, {
    scale: 3,
    useCORS: true,
    windowWidth: 1200, // Evita redimensionamientos incorrectos en pantallas móviles
    windowHeight: 900
  });

  const imgData = canvasImg.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
  pdf.save(modo === 'normal' ? "fixture_normal.pdf" : "fixture_plegable.pdf");

  restaurarEstilo();

  // Restauramos el zoom detectado para el celular
  printArea.style.transform = originalTransform;

  // Restauramos la ocultación nativa en móviles
  scaler.style.removeProperty('display');

  // Restauramos las clases rotated si fueron quitadas
  if (modo === 'normal') {
    printArea.querySelectorAll('[data-was-rotated="true"]').forEach(el => {
      el.classList.add('rotated');
      el.removeAttribute('data-was-rotated');
    });
  }

  btn.innerHTML = textOriginal;
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'auto';

  // Disparador del Share Modal
  let shareTimeout = setTimeout(() => {
    openShareModal();
    window.removeEventListener('focus', handleFocusShare);
  }, 15000); // Popup forzado a los 15 segs

  const handleFocusShare = () => {
    clearTimeout(shareTimeout);
    setTimeout(openShareModal, 500); // Breve delay al volver
    window.removeEventListener('focus', handleFocusShare);
  };

  setTimeout(() => {
    window.addEventListener('focus', handleFocusShare);
  }, 1500);
}

let tapaDataURL = null;

function actualizarTapaPreview() {
  tapaDataURL = canvas.toDataURL("image/png");

  const container = document.getElementById('tapaPreview');
  container.innerHTML = "";

  const img = document.createElement('img');
  img.src = tapaDataURL;
  container.appendChild(img);
}

function prepararParaExport() {
  const color1 = getComputedStyle(document.documentElement).getPropertyValue('--color1').trim();
  const color2 = getComputedStyle(document.documentElement).getPropertyValue('--color2').trim();
  const color3 = getComputedStyle(document.documentElement).getPropertyValue('--color3').trim();

  document.querySelectorAll('.overlay').forEach(el => {
    el.style.mixBlendMode = 'normal';
    el.style.opacity = '0.5';

    el.style.background = `
  linear-gradient(135deg,
    ${color1}cc,
    ${color2}88,
    ${color3}cc
  )
`;
  });
}

function restaurarEstilo() {
  document.querySelectorAll('.overlay').forEach(el => {
    el.style.mixBlendMode = 'multiply';
    el.style.opacity = '0.6';

    // volver a usar variables
    el.style.background = '';
  });
}

/* ===== SHARE MODAL ===== */
function openShareModal() {
  const modal = document.getElementById('shareModal');
  const url = encodeURIComponent(window.location.href.split('?')[0]);
  const text = encodeURIComponent("¡Armá tu fixture de fútbol personalizado, gratis y en PDF alta calidad! 🏆⚽");

  document.getElementById('shareWa').href = `https://api.whatsapp.com/send?text=${text}%20${url}`;
  document.getElementById('shareTw').href = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
  document.getElementById('shareFb').href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;

  modal.classList.add('active');
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('active');
}

/* ===== AI PROMPT GENERATOR ===== */
const aiInputs = {
  pBusiness: 'outBusiness',
  pColors: 'outColors',
  pTitle: 'outTitle',
  pTheme: 'outTheme',
  pWhatsapp: 'outWhatsapp',
  pInstagram: 'outInstagram'
};

const defaultValues = {
  pBusiness: '[TU NEGOCIO]',
  pColors: '[TUS COLORES PREFERIDOS]',
  pTitle: '[TU TÍTULO PRINCIPAL]',
  pTheme: '[TU TEMÁTICA]',
  pWhatsapp: '[TU NÚMERO]',
  pInstagram: '[TU USUARIO]'
};

function updatePrompt() {
  let promptText = document.getElementById('promptBox').innerText;

  // Update UI spans
  for (const [inputId, outputId] of Object.entries(aiInputs)) {
    const val = document.getElementById(inputId).value.trim();
    document.getElementById(outputId).innerText = val || defaultValues[inputId];
  }

  // Generate URL for ChatGPT
  const fullPrompt = document.getElementById('promptBox').innerText;
  const encodedPrompt = encodeURIComponent(fullPrompt);
  const chatUrl = `https://chatgpt.com/?prompt=${encodedPrompt}`;

  document.getElementById('btnGoToChatgpt').href = chatUrl;
  document.getElementById('topChatLink').href = chatUrl;
}

// Add listeners to all inputs
Object.keys(aiInputs).forEach(id => {
  document.getElementById(id).addEventListener('input', updatePrompt);
});

// Copy button
document.getElementById('btnCopyPrompt').addEventListener('click', function () {
  const text = document.getElementById('promptBox').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = this.innerHTML;
    this.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg> ¡Copiado!`;
    setTimeout(() => {
      this.innerHTML = originalText;
    }, 2000);
  });
});

