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

export type ContractPdfData = {
  applicationId: string;
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  birthDate: string;
  address: AddressData;
  animalId: string;
  animalName: string;
  species: string;
  approvedAt: Date;
  ongName: string;
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
  ongName: string;
};

// ── Layout constants ───────────────────────────────────────────────────────────

const PAGE_WIDTH = 595;   // A4 em pontos
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

function formatAddress(addr: AddressData): string {
  const base = `${addr.street}, ${addr.number} - ${addr.neighborhood}, ${addr.city}/${addr.state}`;
  return addr.complement ? `${base} (${addr.complement})` : base;
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
 * Contrato de Adoção — gerado quando uma candidatura aprovada é arquivada
 * após 30 dias. Registra o compromisso formal de adoção.
 */
export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  const { doc, font, boldFont, page } = await createBase();
  const generatedAt = formatDateTime(new Date());

  const ctx: PageContext = { page, font, boldFont, y: 0 };

  drawHeader(
    ctx,
    "Contrato de Adoção",
    `Candidatura #${data.applicationId} — aprovada em ${formatDate(data.approvedAt)}`,
    data.ongName
  );

  drawSection(ctx, "Dados do Adotante");
  drawField(ctx, "Nome completo", data.fullName);
  drawField(ctx, "CPF", data.cpf);
  drawField(ctx, "Telefone", data.phone);
  drawField(ctx, "E-mail", data.email);
  drawField(ctx, "Data de nascimento", data.birthDate);
  drawField(ctx, "Endereço", formatAddress(data.address));

  ctx.y -= SECTION_GAP;
  drawSection(ctx, "Animal Adotado");
  drawField(ctx, "Nome", data.animalName);
  drawField(ctx, "Espécie", speciesLabel(data.species));
  drawField(ctx, "ID no sistema", data.animalId);

  ctx.y -= SECTION_GAP;
  drawSection(ctx, "Registro");
  drawField(ctx, "Data de aprovação", formatDate(data.approvedAt));
  drawField(ctx, "Gerado em", generatedAt);

  drawFooter(page, font, generatedAt, data.applicationId);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Registro de Rejeição Definitiva — gerado quando uma candidatura com status
 * `rejected` é arquivada. Alimenta também a flag em `rejectionFlags`.
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
  drawField(ctx, "Data de arquivamento no sistema", formatDate(data.archivedAt));
  drawField(ctx, "Gerado em", generatedAt);

  drawFooter(page, font, generatedAt, data.animalId);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export type PdfTemplate = "contract" | "rejection" | "archivedAnimal";

type PdfDataMap = {
  contract: ContractPdfData;
  rejection: RejectionPdfData;
  archivedAnimal: ArchivedAnimalPdfData;
};

/**
 * Dispatcher reutilizável: escolhe o template correto pelo nome e retorna
 * o Buffer do PDF gerado em memória.
 */
export async function generatePdf<T extends PdfTemplate>(
  template: T,
  data: PdfDataMap[T]
): Promise<Buffer> {
  switch (template) {
    case "contract":
      return generateContractPdf(data as ContractPdfData);
    case "rejection":
      return generateRejectionPdf(data as RejectionPdfData);
    case "archivedAnimal":
      return generateArchivedAnimalPdf(data as ArchivedAnimalPdfData);
    default:
      throw new Error(`Template de PDF desconhecido: ${template}`);
  }
}
