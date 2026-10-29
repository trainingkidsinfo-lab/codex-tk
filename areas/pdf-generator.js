const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const IMAGE_WIDTH = 1191;
const IMAGE_HEIGHT = 1684;
const CONTRACT_PAGES = [1, 2, 3, 4, 5, 6];
const PAGE_ASSET = "./assets/documents/contract-activity/page-";

export const parqQuestions = [
  "¿Alguna vez su medico le ha indicado que usted tiene un problema cardiovascular, que solamente puede llevar a cabo ejercicios o actividad fisica si lo refiere un medico?",
  "¿Sufre de dolores frecuentes en el pecho cuando realiza algun tipo de actividad fisica?",
  "¿En el ultimo mes, le ha dolido el pecho cuando no estaba haciendo actividad fisica?",
  "¿Con frecuencia pierde el equilibrio debido a mareos, o alguna vez ha perdido el conocimiento?",
  "¿Tiene problemas en los huesos o articulaciones (por ejemplo, en la espalda, rodillas o cadera) que pudiera agravarse al aumentar la actividad fisica?",
  "¿Tiene problemas en los huesos o articulaciones (por ejemplo, en la espalda, rodillas o cadera) que pudiera agravarse al aumentar la actividad fisica?",
  "¿Existe alguna otra razon por la cual no deberia participar en un programa de actividad fisica alguna otra razon?",
];

export async function generateContractActivityPdf({ document, state, centers, groups, trainingKidsPlans, signatureDrawing = "", signed = false }) {
  const data = contractData({ document, state, centers, groups, trainingKidsPlans });
  const jpgs = await Promise.all(CONTRACT_PAGES.map((page) => fetchBinary(`${PAGE_ASSET}${page}.jpg`)));
  const signatureJpg = signed && signatureDrawing ? await pngDataUrlToJpegBinary(signatureDrawing) : null;
  /** @type {Array<{ image?: string, customPage?: boolean, overlays: object[] }>} */
  const pages = CONTRACT_PAGES.map((pageNumber, index) => ({
    image: jpgs[index],
    overlays: overlaysForPage(pageNumber, data, { signatureJpg, signed }),
  }));
  if (data.medicalAdditional || data.emergencySummary || data.hasParqAlert) {
    pages.push({
      customPage: true,
      overlays: extraAnnexOverlays(data),
    });
  }
  const bytes = buildPdf(pages, signatureJpg);
  const hash = await sha256(bytes);
  const dataUrl = `data:application/pdf;base64,${binaryToBase64(bytes)}`;
  return { dataUrl, hash, data };
}

export function contractData({ document, state, centers, groups, trainingKidsPlans }) {
  const child = state.family.children.find((item) => item.id === document.childId) || state.family.children[0];
  const enrollment = state.enrollments.find((item) => item.id === document.enrollmentId);
  const tutor = state.family.tutors.find((item) => item.canSign) || state.family.tutors[0];
  const plan = trainingKidsPlans.find((item) => item.id === enrollment?.planId);
  const center = centers.find((item) => item.id === enrollment?.centerId);
  const group = groups.find((item) => item.id === enrollment?.groupId);
  const draft = document.formDraft || {};
  const today = new Date();
  const parq = Object.fromEntries(parqQuestions.map((_, index) => {
    const key = `parq${index + 1}`;
    return [key, draft[key]?.value || "no"];
  }));
  return {
    place: fieldValue(draft, "place", "Madrid"),
    day: fieldValue(draft, "day", String(today.getDate()).padStart(2, "0")),
    month: fieldValue(draft, "month", today.toLocaleDateString("es-ES", { month: "long" })),
    year: fieldValue(draft, "year", String(today.getFullYear()).slice(-2)),
    tutorName: fieldValue(draft, "tutorName", tutor?.name || ""),
    childName: fieldValue(draft, "childName", child?.name || ""),
    tutorDocument: fieldValue(draft, "tutorDocument", ""),
    phone: fieldValue(draft, "phone", state.family.phone || tutor?.phone || ""),
    email: fieldValue(draft, "email", state.family.email || tutor?.email || ""),
    service: "Training Kids",
    center: center ? `${center.name} - ${center.city}` : "Pendiente de centro",
    group: group ? `${group.name} - ${group.day} ${group.time}` : "Pendiente de grupo",
    plan: plan ? `${plan.name} - ${plan.period}` : "Pendiente de tarifa",
    amount: plan ? `${plan.amount} EUR` : "Pendiente",
    period: plan?.period || "Pendiente",
    medicalAdditional: fieldValue(draft, "medicalAdditional", child?.medical || ""),
    emergencySummary: fieldValue(draft, "emergencySummary", child?.emergencyName && child?.emergencyPhone ? `${child.emergencyName} - ${child.emergencyPhone}` : ""),
    parq,
    hasParqAlert: Object.values(parq).includes("si"),
  };
}

function fieldValue(draft, key, fallback = "") {
  return draft[key]?.value ?? draft[key] ?? fallback ?? "";
}

function overlaysForPage(pageNumber, data, { signatureJpg, signed }) {
  if (pageNumber === 1) {
    return [
      text(data.day, 156, 614, 11, 44),
      text(data.month, 204, 614, 11, 80),
      text(data.year, 304, 614, 11, 20),
      text(data.tutorName, 103, 586, 11, 365),
      text(data.childName, 86, 569, 11, 385),
      text(data.tutorDocument, 471, 569, 11, 86),
      text(data.phone, 127, 553, 11, 116),
      text(data.email, 136, 538, 11, 190),
    ];
  }
  if (pageNumber === 2) {
    return [
      rect(periodX(data.period), 733, 58, 16),
      text(`Tarifa: ${data.plan} - ${data.amount}`, 86, 686, 9, 260),
    ];
  }
  if (pageNumber === 5) {
    return [
      text(data.tutorName, 247, 467, 10, 250),
      text(data.childName, 117, 453, 10, 335),
      ...(signed && signatureJpg ? [image("Sig", 115, 232, 160, 58)] : []),
    ];
  }
  if (pageNumber === 6) {
    return [
      ...parqMarks(data.parq),
      ...(signed && signatureJpg ? [image("Sig", 335, 36, 150, 52)] : []),
    ];
  }
  return [];
}

function extraAnnexOverlays(data) {
  const items = [
    text("ANEXO LOCAL DE DATOS ADICIONALES DEL PROTOTIPO", 58, 780, 16, 480, true),
    text("Este anexo no modifica las clausulas del contrato original. Solo recoge informacion sin espacio previsto en el PDF.", 58, 750, 10, 480),
    text(`Menor: ${data.childName}`, 58, 710, 12, 480, true),
    text(`Tutor/a: ${data.tutorName} - DNI/NIE: ${data.tutorDocument}`, 58, 688, 11, 480),
    text(`Centro: ${data.center}`, 58, 666, 11, 480),
    text(`Grupo: ${data.group}`, 58, 644, 11, 480),
    text(`Tarifa: ${data.plan} - ${data.amount}`, 58, 622, 11, 480),
    text(`Contacto de emergencia: ${data.emergencySummary || "Pendiente"}`, 58, 590, 11, 480),
    text("Informacion medica adicional:", 58, 558, 11, 480, true),
    text(data.medicalAdditional || "Sin informacion adicional indicada.", 58, 536, 10, 480),
  ];
  if (data.hasParqAlert) {
    items.push(text("Aviso PAR-Q: existe al menos una respuesta afirmativa. Requiere revision del equipo antes de activar definitivamente.", 58, 484, 11, 480, true));
  }
  return items;
}

function parqMarks(parq) {
  const y = [667, 588, 511, 418, 325, 233, 141];
  return y.map((rowY, index) => text("X", 304, parq[`parq${index + 1}`] === "si" ? rowY - 23 : rowY, 12, 10, true));
}

function periodX(period) {
  if (period === "Mensual") return 282;
  if (period === "Semestral") return 388;
  if (period === "Anual") return 484;
  return 333;
}

function text(value, x, y, size = 10, maxWidth = 220, bold = false) {
  return { type: "text", value: String(value || ""), x, y, size, maxWidth, bold };
}

function rect(x, y, width, height) {
  return { type: "rect", x, y, width, height };
}

function image(name, x, y, width, height) {
  return { type: "image", name, x, y, width, height };
}

async function fetchBinary(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
  return arrayBufferToBinary(await response.arrayBuffer());
}

async function pngDataUrlToJpegBinary(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const jpegUrl = canvas.toDataURL("image/jpeg", 0.86);
  return atob(jpegUrl.split(",")[1]);
}

function buildPdf(pages, signatureJpg) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageRefs = [];
  pages.forEach((page, index) => {
    const xobjects = {};
    if (page.image) {
      const imageRef = addStream(`<< /Type /XObject /Subtype /Image /Width ${IMAGE_WIDTH} /Height ${IMAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.image.length} >>`, page.image);
      xobjects[`Im${index + 1}`] = imageRef;
    }
    if (signatureJpg) {
      const sigRef = addStream(`<< /Type /XObject /Subtype /Image /Width 640 /Height 220 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${signatureJpg.length} >>`, signatureJpg);
      xobjects.Sig = sigRef;
    }
    const content = page.customPage
      ? customPageContent(page.overlays)
      : pageContent(index + 1, page.overlays);
    const contentRef = addStream(`<< /Length ${content.length} >>`, content);
    const xobjectDict = Object.entries(xobjects).map(([name, ref]) => `/${name} ${ref} 0 R`).join(" ");
    const resources = `<< /Font << /F1 ${font} 0 R /F2 ${boldFont} 0 R >> ${xobjectDict ? `/XObject << ${xobjectDict} >>` : ""} >>`;
    const pageRef = add(`<< /Type /Page /Parent PAGES_REF 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents ${contentRef} 0 R >>`);
    pageRefs.push(pageRef);
  });
  const pagesRef = add(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`);
  const catalogRef = add(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);
  const patched = objects.map((body) => body.replaceAll("PAGES_REF", String(pagesRef)));
  return serializePdf(patched, catalogRef);

  function addStream(dict, stream) {
    return add(`${dict}\nstream\n${stream}\nendstream`);
  }
}

function pageContent(imageNumber, overlays) {
  return [
    `q ${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm /Im${imageNumber} Do Q`,
    ...overlayContent(overlays),
  ].join("\n");
}

function customPageContent(overlays) {
  return [
    "1 1 1 rg 0 0 595 842 re f",
    "0.1 0.14 0.23 rg",
    ...overlayContent(overlays),
  ].join("\n");
}

function overlayContent(overlays) {
  return overlays.flatMap((overlay) => {
    if (overlay.type === "rect") return [`q 0 0.72 0.72 RG 1.6 w ${overlay.x} ${overlay.y} ${overlay.width} ${overlay.height} re S Q`];
    if (overlay.type === "image") return [`q ${overlay.width} 0 0 ${overlay.height} ${overlay.x} ${overlay.y} cm /${overlay.name} Do Q`];
    return wrappedText(overlay);
  });
}

function wrappedText(overlay) {
  const maxChars = Math.max(10, Math.floor(overlay.maxWidth / (overlay.size * 0.48)));
  const lines = wrapText(overlay.value, maxChars).slice(0, 4);
  return lines.map((line, index) => `BT /${overlay.bold ? "F2" : "F1"} ${overlay.size} Tf 0 0 0 rg ${overlay.x} ${overlay.y - (index * (overlay.size + 3))} Td ${pdfString(line)} Tj ET`);
}

function wrapText(value, maxChars) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function pdfString(value) {
  const normalized = String(value || "")
    .replace(/€/g, "EUR")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-");
  let out = "(";
  [...normalized].forEach((char) => {
    const byte = char.charCodeAt(0);
    if (byte === 40 || byte === 41 || byte === 92) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 255) out += "?";
    else if (byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  });
  return `${out})`;
}

function serializePdf(objects, catalogRef) {
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

async function sha256(binary) {
  if (!crypto?.subtle) return `SIM-${Date.now()}`;
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function arrayBufferToBinary(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return binary;
}

function binaryToBase64(binary) {
  const chunk = 0x7ffe;
  let result = "";
  for (let i = 0; i < binary.length; i += chunk) {
    result += btoa(binary.slice(i, i + chunk));
  }
  return result;
}
