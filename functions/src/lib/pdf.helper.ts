import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AddressData = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement?: string;
};

export type RejectionPdfData = {
  applicationId: string;
  fullName: string;
  email: string;
  cpf: string;
  animalName?: string;
  species: string;
  rejectionReason: string;
  rejectionDetails: string;
  reviewerName: string;
  rejectedAt: Date;
  ongName: string;
};

export type ArchivedAnimalPdfData = {
  animalId: string;
  animalName: string;
  species: string;
  sex?: string;
  size?: string;
  archiveReason: string;
  archiveDetails: string;
  archiveDate: Date;
  archivedAt: Date;
  archivedBy?: string;
  ongName: string;
};

// ── Layout constants ───────────────────────────────────────────────────────────

const PAGE_WIDTH = 595; // A4 em pontos
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const LINE_HEIGHT = 16;
const SECTION_GAP = 10;

// ── Internal helpers ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function speciesLabel(species: string): string {
  return species === "dog" ? "Cão" : species === "cat" ? "Gato" : species;
}

function sexLabel(sex?: string): string {
  if (sex === "male") return "Macho";
  if (sex === "female") return "Fêmea";
  return "-";
}

function sizeLabel(size?: string): string {
  if (size === "small") return "Pequeno";
  if (size === "medium") return "Médio";
  if (size === "large") return "Grande";
  return "-";
}

type PageContext = {
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  y: number;
};

function drawHeader(ctx: PageContext, title: string, subtitle: string, ongName: string): void {
  const { page, boldFont, font } = ctx;

  page.drawText(ongName, {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN,
    size: 11,
    font: boldFont,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 20,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.5),
  });

  page.drawText(subtitle, {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 38,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 48 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 48 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  ctx.y = PAGE_HEIGHT - MARGIN - 68;
}

function drawSection(ctx: PageContext, title: string): void {
  const { page, boldFont } = ctx;
  ctx.y -= SECTION_GAP;
  page.drawText(title.toUpperCase(), {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: boldFont,
    color: rgb(0.35, 0.35, 0.55),
  });
  ctx.y -= LINE_HEIGHT - 2;
}

function drawField(ctx: PageContext, label: string, value: string): void {
  const { page, font, boldFont } = ctx;
  const labelWidth = boldFont.widthOfTextAtSize(`${label}: `, 9);

  page.drawText(`${label}: `, {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Wrap value if too long
  const maxWidth = PAGE_WIDTH - MARGIN * 2 - labelWidth;
  const words = value.split(" ");
  let line = "";
  let firstLine = true;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(test, 9);

    if (testWidth > maxWidth && line) {
      const x = firstLine ? MARGIN + labelWidth : MARGIN + 10;
      page.drawText(line, { x, y: ctx.y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
      ctx.y -= LINE_HEIGHT;
      line = word;
      firstLine = false;
    } else {
      line = test;
    }
  }

  if (line) {
    const x = firstLine ? MARGIN + labelWidth : MARGIN + 10;
    page.drawText(line, { x, y: ctx.y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
  }

  ctx.y -= LINE_HEIGHT;
}

function drawFooter(page: PDFPage, font: PDFFont, generatedAt: string, docId: string): void {
  page.drawLine({
    start: { x: MARGIN, y: 40 },
    end: { x: PAGE_WIDTH - MARGIN, y: 40 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  page.drawText(`Gerado em: ${generatedAt}  |  Ref.: ${docId}`, {
    x: MARGIN,
    y: 26,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText("Documento gerado automaticamente - Upeva Adocoes", {
    x: MARGIN,
    y: 16,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

async function createBase(): Promise<{ doc: PDFDocument; font: PDFFont; boldFont: PDFFont; page: PDFPage }> {
  const doc = await PDFDocument.create();
  const [font, boldFont] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { doc, font, boldFont, page };
}

// ── PDF generators ────────────────────────────────────────────────────────────

/**
 * Registro de Rejeição Definitiva — gerado quando uma candidatura com status
 * `rejected` é arquivada. Alimenta também a flag em `rejectionFlags`.
 * @param {object} data - Dados da rejeição (solicitante, motivo, revisor).
 * @return {Promise<Buffer>} Buffer do PDF gerado em memória.
 */
export async function generateRejectionPdf(data: RejectionPdfData): Promise<Buffer> {
  const { doc, font, boldFont, page } = await createBase();
  const generatedAt = formatDateTime(new Date());

  const ctx: PageContext = { page, font, boldFont, y: 0 };

  drawHeader(
    ctx,
    "Registro de Rejeição Definitiva",
    `Candidatura #${data.applicationId} — rejeitada em ${formatDate(data.rejectedAt)}`,
    data.ongName
  );

  drawSection(ctx, "Dados do Solicitante");
  drawField(ctx, "Nome completo", data.fullName);
  drawField(ctx, "CPF", data.cpf);
  drawField(ctx, "E-mail", data.email);

  ctx.y -= SECTION_GAP;
  drawSection(ctx, "Animal Solicitado");
  drawField(ctx, "Nome", data.animalName ?? "Interesse geral (sem animal específico)");
  drawField(ctx, "Espécie", speciesLabel(data.species));

  ctx.y -= SECTION_GAP;
  drawSection(ctx, "Motivo da Rejeição");
  drawField(ctx, "Motivo principal", data.rejectionReason);
  drawField(ctx, "Detalhes", data.rejectionDetails);

  ctx.y -= SECTION_GAP;
  drawSection(ctx, "Registro");
  drawField(ctx, "Revisor responsável", data.reviewerName);
  drawField(ctx, "Data da rejeição", formatDate(data.rejectedAt));
  drawField(ctx, "Gerado em", generatedAt);

  drawFooter(page, font, generatedAt, data.applicationId);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Registro de Arquivamento de Animal — gerado quando um animal arquivado
 * é removido do Firestore após 30 dias. Preserva histórico do ocorrido.
 * @param {object} data - Dados do animal e motivo do arquivamento.
 * @return {Promise<Buffer>} Buffer do PDF gerado em memória.
 */
export async function generateArchivedAnimalPdf(data: ArchivedAnimalPdfData): Promise<Buffer> {
  const { doc, font, boldFont, page } = await createBase();
  const generatedAt = formatDateTime(new Date());

  const ctx: PageContext = { page, font, boldFont, y: 0 };

  drawHeader(
    ctx,
    "Registro de Arquivamento de Animal",
    `Animal #${data.animalId} — arquivado em ${formatDate(data.archiveDate)}`,
    data.ongName
  );

  drawSection(ctx, "Dados do Animal");
  drawField(ctx, "Nome", data.animalName);
  drawField(ctx, "Espécie", speciesLabel(data.species));
  drawField(ctx, "Sexo", sexLabel(data.sex));
  drawField(ctx, "Porte", sizeLabel(data.size));
  drawField(ctx, "ID no sistema", data.animalId);

  ctx.y -= SECTION_GAP;
  drawSection(ctx, "Motivo do Arquivamento");
  drawField(ctx, "Motivo", data.archiveReason);
  drawField(ctx, "Detalhes", data.archiveDetails);
  drawField(ctx, "Data do ocorrido", formatDate(data.archiveDate));

  ctx.y -= SECTION_GAP;
  drawSection(ctx, "Registro");
  if (data.archivedBy) {
    drawField(ctx, "Responsável pelo arquivamento", data.archivedBy);
  }
  drawField(ctx, "Data de arquivamento no sistema", formatDate(data.archivedAt));
  drawField(ctx, "Gerado em", generatedAt);

  drawFooter(page, font, generatedAt, data.animalId);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ── Official adoption contract (Termo de Adoção Responsável) ─────────────────

export type OfficialContractPdfData = {
  applicationId: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  phone: string;
  address: AddressData;
  animalName: string;
  species: string;
  breed: string;
  sex?: string;
  estimatedAge?: string;
  coatColor: string;
  size?: string;
  neutered?: boolean;
  approvedAt: Date;
  ongName: string;
};

function officialSizeLabel(size?: string): string {
  if (size === "small") return "P";
  if (size === "medium") return "M";
  if (size === "large") return "G";
  return "";
}

function officialSpeciesLabel(species: string): string {
  if (species === "dog") return "Canina";
  if (species === "cat") return "Felina";
  return species;
}

function formatApprovalDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function formatBrazilianDateString(value: string): string {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function drawUnderline(page: PDFPage, x: number, y: number, width: number): void {
  page.drawLine({
    start: { x, y: y - 2 },
    end: { x: x + width, y: y - 2 },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.3),
  });
}

function drawInlineText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number
): number {
  page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  return x + font.widthOfTextAtSize(text, size);
}

function drawUnderlinedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number
): number {
  page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  drawUnderline(page, x, y, width);
  return x + font.widthOfTextAtSize(text, size);
}

function drawFilledLine(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  lineWidth: number,
  fontSize = 10
): void {
  const labelW = boldFont.widthOfTextAtSize(label, fontSize);
  page.drawText(label, { x, y, size: fontSize, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(value, { x: x + labelW, y, size: fontSize, font, color: rgb(0, 0, 0) });
  drawUnderline(page, x + labelW, y, lineWidth - labelW);
}

// Wraps justified body text within a given width.
function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  lineH: number,
  indent = 0
): number {
  const words = text.split(" ");
  let line = "";
  let y = startY;
  let firstLineOfParagraph = true;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth - (firstLineOfParagraph ? indent : 0) && line) {
      page.drawText(line, {
        x: x + (firstLineOfParagraph ? indent : 0),
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineH;
      line = word;
      firstLineOfParagraph = false;
    } else {
      line = test;
    }
  }

  if (line) {
    page.drawText(line, {
      x: x + (firstLineOfParagraph ? indent : 0),
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineH;
  }

  return y;
}

function checkbox(checked: boolean): string {
  return checked ? "(X)" : "( )";
}

/**
 * Gera o Termo de Adoção Responsável oficial, seguindo o modelo físico da Upeva.
 * Reproduz título, bloco de dados do responsável, tabela de características do
 * animal, cláusulas de responsabilidade e linhas de assinatura.
 * @param {object} data - Dados do contrato (adotante, animal, aprovação).
 * @return {Promise<Buffer>} Buffer do PDF gerado em memória.
 */
export async function generateAdoptionContractPdfOfficial(
  data: OfficialContractPdfData
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const [font, boldFont] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const M = 60; // left/right margin
  const contentW = PAGE_WIDTH - M * 2;
  const bodyFontSize = 10;
  const lineH = 16;
  const smallSize = 9;

  let y = PAGE_HEIGHT - M;

  // ── Título ────────────────────────────────────────────────────────────────
  const title = "TERMO DE ADOÇÃO RESPONSÁVEL";
  const titleW = boldFont.widthOfTextAtSize(title, 13);
  page.drawText(title, {
    x: M + (contentW - titleW) / 2,
    y,
    size: 13,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 44;

  // ── Bloco do responsável ──────────────────────────────────────────────────
  const dateStr = formatApprovalDate(data.approvedAt);
  const [day, month, year] = dateStr.split("/");
  const finalCity = "Flores da Cunha";
  const birthDate = formatBrazilianDateString(data.birthDate);

  let x = M;
  x = drawInlineText(page, font, "Foi concedido a(o) Sr.(a) ", x, y, bodyFontSize);
  const nameWidth = contentW - (x - M) - 8;
  x = drawUnderlinedText(page, font, data.fullName, x, y, nameWidth, bodyFontSize);
  drawInlineText(page, font, ",", x, y, bodyFontSize);
  y -= lineH;

  x = M;
  x = drawInlineText(page, font, "portador(a) do CPF sob nº ", x, y, bodyFontSize);
  const cpfWidth = font.widthOfTextAtSize(data.cpf, bodyFontSize) + 8;
  x = drawUnderlinedText(page, font, data.cpf, x, y, cpfWidth, bodyFontSize);
  x = drawInlineText(page, font, ", nascido(a) em ", x + 6, y, bodyFontSize);
  const birthWidth = contentW - (x - M) - 8;
  x = drawUnderlinedText(page, font, birthDate, x, y, birthWidth, bodyFontSize);
  drawInlineText(page, font, ",", x, y, bodyFontSize);
  y -= lineH;

  x = M;
  x = drawInlineText(page, font, "residente à Rua ", x, y, bodyFontSize);
  const street = data.address.complement ?
    `${data.address.street}, ${data.address.complement}` :
    data.address.street;
  drawUnderlinedText(page, font, street, x, y, contentW - (x - M), bodyFontSize);
  y -= lineH;

  x = M;
  x = drawInlineText(page, font, "nº ", x, y, bodyFontSize);
  const numberWidth = 70;
  x = drawUnderlinedText(page, font, data.address.number, x, y, numberWidth, bodyFontSize);
  x = drawInlineText(page, font, ", bairro ", x + 6, y, bodyFontSize);
  drawUnderlinedText(page, font, data.address.neighborhood ?? "", x, y, contentW - (x - M), bodyFontSize);
  y -= lineH;

  x = M;
  x = drawInlineText(page, font, "cidade de ", x, y, bodyFontSize);
  const addressCity = data.address.city || finalCity;
  const cityWidth = 150;
  x = drawUnderlinedText(page, font, addressCity, x, y, cityWidth, bodyFontSize);
  x = drawInlineText(page, font, ", estado ", x + 6, y, bodyFontSize);
  const stateWidth = 42;
  x = drawUnderlinedText(page, font, data.address.state, x, y, stateWidth, bodyFontSize);
  x = drawInlineText(page, font, ", telefone ", x + 6, y, bodyFontSize);
  drawUnderlinedText(page, font, data.phone, x, y, contentW - (x - M), bodyFontSize);
  y -= lineH;

  page.drawText("a guarda responsável do animal com as seguintes características:", {
    x: M,
    y,
    size: bodyFontSize,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 28;

  // ── Tabela de características do animal ───────────────────────────────────
  const col1X = M;
  const col2X = M + contentW / 2;
  const charLineH = 22;

  // Row 1: Nome | Espécie
  drawFilledLine(page, font, boldFont, "Nome: ", data.animalName, col1X, y, contentW / 2 - 10, bodyFontSize);
  drawFilledLine(page, font, boldFont, "Espécie: ", officialSpeciesLabel(data.species), col2X, y, contentW / 2, bodyFontSize);
  y -= charLineH;

  // Row 2: Raça (checkbox SRD / Outra)
  const isSrd = data.breed === "Sem raça definida";
  const racaLabel = "Raça: ";
  const racaLabelW = boldFont.widthOfTextAtSize(racaLabel, bodyFontSize);
  page.drawText(racaLabel, { x: col1X, y, size: bodyFontSize, font: boldFont, color: rgb(0, 0, 0) });
  const srdBox = `${checkbox(isSrd)} Sem raça definida   ${checkbox(!isSrd)} Outra: `;
  page.drawText(srdBox, { x: col1X + racaLabelW, y, size: smallSize, font, color: rgb(0, 0, 0) });
  if (!isSrd) {
    const srdBoxW = font.widthOfTextAtSize(srdBox, smallSize);
    page.drawText(data.breed, { x: col1X + racaLabelW + srdBoxW, y, size: smallSize, font, color: rgb(0, 0, 0) });
    drawUnderline(page, col1X + racaLabelW + srdBoxW, y, contentW - racaLabelW - srdBoxW);
  }
  y -= charLineH;

  // Row 3: Sexo | Idade
  const sexLabel = "Sexo: ";
  const sexLabelW = boldFont.widthOfTextAtSize(sexLabel, bodyFontSize);
  page.drawText(sexLabel, { x: col1X, y, size: bodyFontSize, font: boldFont, color: rgb(0, 0, 0) });
  const sexF = data.sex === "female";
  const sexM = data.sex === "male";
  const sexStr = `${checkbox(sexF)} F   ${checkbox(sexM)} M`;
  page.drawText(sexStr, { x: col1X + sexLabelW, y, size: smallSize, font, color: rgb(0, 0, 0) });

  const idadeLabel = "Idade: ";
  const idadeLabelW = boldFont.widthOfTextAtSize(idadeLabel, bodyFontSize);
  page.drawText(idadeLabel, { x: col2X, y, size: bodyFontSize, font: boldFont, color: rgb(0, 0, 0) });
  const idadeVal = data.estimatedAge ?? "";
  page.drawText(idadeVal, { x: col2X + idadeLabelW, y, size: bodyFontSize, font, color: rgb(0, 0, 0) });
  drawUnderline(page, col2X + idadeLabelW, y, contentW / 2 - idadeLabelW);
  y -= charLineH;

  // Row 4: Pelagem e cor | Porte
  const pelagemLabel = "Pelagem e cor: ";
  const pelagemLabelW = boldFont.widthOfTextAtSize(pelagemLabel, bodyFontSize);
  page.drawText(pelagemLabel, { x: col1X, y, size: bodyFontSize, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(data.coatColor, { x: col1X + pelagemLabelW, y, size: bodyFontSize, font, color: rgb(0, 0, 0) });
  drawUnderline(page, col1X + pelagemLabelW, y, contentW / 2 - 10 - pelagemLabelW);

  const porteLabel = "Porte: ";
  const porteLabelW = boldFont.widthOfTextAtSize(porteLabel, bodyFontSize);
  page.drawText(porteLabel, { x: col2X, y, size: bodyFontSize, font: boldFont, color: rgb(0, 0, 0) });
  const sizeCode = officialSizeLabel(data.size);
  const porteStr = `${checkbox(sizeCode === "P")} P   ${checkbox(sizeCode === "M")} M   ${checkbox(sizeCode === "G")} G`;
  page.drawText(porteStr, { x: col2X + porteLabelW, y, size: smallSize, font, color: rgb(0, 0, 0) });
  y -= charLineH;

  // Row 5: Castrado(a)
  const castLabel = "Castrado(a): ";
  const castLabelW = boldFont.widthOfTextAtSize(castLabel, bodyFontSize);
  page.drawText(castLabel, { x: col1X, y, size: bodyFontSize, font: boldFont, color: rgb(0, 0, 0) });
  const isNeutered = data.neutered === true;
  const castStr = `${checkbox(isNeutered)} S   ${checkbox(!isNeutered)} N`;
  page.drawText(castStr, { x: col1X + castLabelW, y, size: smallSize, font, color: rgb(0, 0, 0) });
  y -= 32;

  // ── Cláusulas ─────────────────────────────────────────────────────────────
  const paragraphIndent = 18;

  const p1 = "O agora responsável pelo animal citado acima, compromete-se por este termo, a cuidar da saúde do animal, dando-lhe alimentação, abrigo e condições adequadas de sobrevivência, não sendo permitido ministrar-lhe ensino com maus-tratos, abandonar, doar, vender a outros ou maltratar o animal.";
  y = drawWrappedText(page, font, p1, M, y, contentW, bodyFontSize, lineH, paragraphIndent);
  y -= 6;

  const p2 = "Todo e qualquer destino que tenha ocorrido ao animal tais como mudança de endereço, desaparecimento ou morte deve ser comunicado à Upeva.";
  y = drawWrappedText(page, font, p2, M, y, contentW, bodyFontSize, lineH, paragraphIndent);
  y -= 6;

  const p3 = "A Upeva reserva-se no direito de efetuar visitas para verificar as condições em que se encontra o animal, assim como a retirada do mesmo, caso não se encontre em situações adequadas.";
  y = drawWrappedText(page, font, p3, M, y, contentW, bodyFontSize, lineH, paragraphIndent);
  y -= 6;

  const p4 = "A adoção de um animal é um compromisso para a vida inteira. Porém, por uma combinação de imprevistos, não sendo mais possível permanecer com o animal, a Upeva deve ser contatada para que junto ao atual tutor encontrem um novo lar para ele.";
  y = drawWrappedText(page, font, p4, M, y, contentW, bodyFontSize, lineH, paragraphIndent);
  y -= 34;

  // ── Assinaturas ───────────────────────────────────────────────────────────
  const sigLineW = 120;
  const midX = PAGE_WIDTH / 2;

  // Left signature: Upeva
  const upevaSigX = midX - sigLineW - 20;
  drawUnderline(page, upevaSigX, y, sigLineW);
  const upevaLabel = "Upeva";
  const upevaLabelW = font.widthOfTextAtSize(upevaLabel, bodyFontSize);
  page.drawText(upevaLabel, {
    x: upevaSigX + (sigLineW - upevaLabelW) / 2,
    y: y - 14,
    size: bodyFontSize,
    font,
    color: rgb(0, 0, 0),
  });

  // Right signature: Responsável pelo animal
  const respSigX = midX + 20;
  drawUnderline(page, respSigX, y, sigLineW);
  const respLabel = "Responsável pelo animal";
  const respLabelW = font.widthOfTextAtSize(respLabel, bodyFontSize);
  page.drawText(respLabel, {
    x: respSigX + (sigLineW - respLabelW) / 2,
    y: y - 14,
    size: bodyFontSize,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 42;

  // ── Local e data ──────────────────────────────────────────────────────────
  const localDateStr = `${finalCity}, ${day}/${month}/${year}`;
  const localDateW = font.widthOfTextAtSize(localDateStr, bodyFontSize);
  page.drawText(localDateStr, {
    x: PAGE_WIDTH - M - localDateW,
    y,
    size: bodyFontSize,
    font,
    color: rgb(0, 0, 0),
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export type PdfTemplate = "rejection" | "archivedAnimal" | "officialContract";

type PdfDataMap = {
  rejection: RejectionPdfData;
  archivedAnimal: ArchivedAnimalPdfData;
  officialContract: OfficialContractPdfData;
};

/**
 * Dispatcher reutilizável: escolhe o template correto pelo nome e retorna
 * o Buffer do PDF gerado em memória.
 * @param {string} template - Nome do template.
 * @param {object} data - Dados tipados conforme o template escolhido.
 * @return {Promise<Buffer>} Buffer do PDF gerado em memória.
 */
export async function generatePdf<T extends PdfTemplate>(
  template: T,
  data: PdfDataMap[T]
): Promise<Buffer> {
  switch (template) {
  case "rejection":
    return generateRejectionPdf(data as RejectionPdfData);
  case "archivedAnimal":
    return generateArchivedAnimalPdf(data as ArchivedAnimalPdfData);
  case "officialContract":
    return generateAdoptionContractPdfOfficial(data as OfficialContractPdfData);
  default:
    throw new Error(`Template de PDF desconhecido: ${template}`);
  }
}
