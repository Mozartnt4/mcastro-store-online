import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "design/Cartao de visitas MCastro");
const catalogUrl = "https://mcastro-store-online.mozartnto20.workers.dev/?modo=catalogo";
const logoPath = path.join(root, "public/assets/mcastro-solutions-logo.jpg");
const qrLibrary = fs.readFileSync(path.join(root, "public/qrcode.min.js"), "utf8");
const logo = fs.readFileSync(logoPath).toString("base64");

function qrRects(text, size = 780) {
  const rectangles = [];
  const context2d = {
    fillStyle: "#fff",
    fillRect(x, y, width, height) {
      if (this.fillStyle === "#000") rectangles.push({ x, y, width, height });
    }
  };
  const canvas = { width: size, height: size, getContext: () => context2d };
  const element = { innerHTML: "", appendChild() {} };
  const browser = { document: { createElement: () => canvas } };
  vm.runInNewContext(qrLibrary, { window: browser, document: browser.document });
  new browser.QRCode(element, { text, width: size, height: size, correctLevel: browser.QRCode.CorrectLevel.H });
  return rectangles;
}

function qrGroup(x, y, size) {
  const scale = size / 780;
  return qrRects(catalogUrl).map(r =>
    `<rect x="${(x + r.x * scale).toFixed(2)}" y="${(y + r.y * scale).toFixed(2)}" width="${(r.width * scale).toFixed(2)}" height="${(r.height * scale).toFixed(2)}"/>`
  ).join("");
}

const shared = `
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5714"/><stop offset=".45" stop-color="#f0ca72"/><stop offset="1" stop-color="#9b6219"/>
    </linearGradient>
    <radialGradient id="glow" cx=".82" cy=".18" r=".75">
      <stop offset="0" stop-color="#614017" stop-opacity=".7"/><stop offset="1" stop-color="#050505" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>`;

const front = `<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="50mm" viewBox="0 0 1080 600">
${shared}
<rect width="1080" height="600" fill="#050505"/><rect width="1080" height="600" fill="url(#glow)"/>
<path d="M0 510 L1080 390 L1080 600 L0 600Z" fill="#0d0c0a"/>
<path d="M0 509 L1080 389" stroke="url(#gold)" stroke-width="3"/>
<image href="data:image/jpeg;base64,${logo}" x="55" y="-345" width="530" height="1178" preserveAspectRatio="xMidYMid slice" opacity=".96"/>
<rect x="610" y="125" width="3" height="270" fill="url(#gold)"/>
<text x="665" y="205" fill="#f5f1e8" font-family="Arial,Helvetica,sans-serif" font-size="52" font-weight="700" letter-spacing="3">MCASTRO</text>
<text x="668" y="252" fill="#d6a84d" font-family="Arial,Helvetica,sans-serif" font-size="23" letter-spacing="13">SOLUTIONS</text>
<text x="668" y="327" fill="#c8c2b8" font-family="Arial,Helvetica,sans-serif" font-size="23">Soluções, tecnologia e produtos</text>
<text x="668" y="365" fill="#8f887d" font-family="Arial,Helvetica,sans-serif" font-size="18">Qualidade que conecta você ao futuro.</text>
<text x="665" y="478" fill="#d6a84d" font-family="Arial,Helvetica,sans-serif" font-size="18" letter-spacing="2">MCASTRO SOLUTIONS</text>
</svg>`;

const back = `<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="50mm" viewBox="0 0 1080 600">
${shared}
<rect width="1080" height="600" fill="#050505"/><rect width="1080" height="600" fill="url(#glow)"/>
<circle cx="835" cy="295" r="205" fill="#0d0c0a" stroke="url(#gold)" stroke-width="3" filter="url(#shadow)"/>
<rect x="674" y="134" width="322" height="322" rx="18" fill="#fff"/>
<g fill="#090909">${qrGroup(690, 150, 290)}</g>
<text x="74" y="142" fill="#d6a84d" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" letter-spacing="5">NOSSA VITRINE</text>
<text x="70" y="220" fill="#f5f1e8" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="700">Conheça nossos</text>
<text x="70" y="280" fill="#f5f1e8" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="700">produtos.</text>
<text x="74" y="345" fill="#bdb6aa" font-family="Arial,Helvetica,sans-serif" font-size="23">Aponte a câmera para o QR Code</text>
<text x="74" y="380" fill="#bdb6aa" font-family="Arial,Helvetica,sans-serif" font-size="23">e acesse o catálogo online.</text>
<path d="M74 433 H560" stroke="url(#gold)" stroke-width="3"/>
<text x="74" y="479" fill="#d6a84d" font-family="Arial,Helvetica,sans-serif" font-size="16">mcastro-store-online.mozartnto20.workers.dev</text>
</svg>`;

const qr = `<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="50mm" viewBox="0 0 900 900">
<rect width="900" height="900" fill="#fff"/><g fill="#050505">${qrGroup(60, 60, 780)}</g>
</svg>`;

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "cartao-frente.svg"), front);
fs.writeFileSync(path.join(output, "cartao-verso-qr.svg"), back);
fs.writeFileSync(path.join(output, "qr-vitrine.svg"), qr);
console.log(`Cartões criados em: ${output}`);
