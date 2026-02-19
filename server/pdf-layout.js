const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");

const WEBSITE_LOGO_PATH = path.join(
  __dirname,
  "..",
  "assets",
  "images",
  "logo.svg",
);
const AUTHORIZATION_TEXT =
  'By signing below, the Business and Owner(s) identified above (individually, an "Applicant") each represents, acknowledges, and agrees that: ' +
  "(1) all information and documents provided in connection with this application are true, accurate, and complete; " +
  '(2) Applicant will immediately notify No Limit Capital ("No Limit Capital") of any change in the Business financial condition; ' +
  '(3) Applicant understands that No Limit Capital may share this information with its representatives, successors, assigns, affiliates and partners as well as third-party lenders/funders and their servicers and financial institutions ("Recipients"); ' +
  "(4) Applicant authorizes No Limit Capital and Recipients to request and receive any investigative reports, consumer credit reports, trade references, statements from creditors or financial institutions, verifications of information, or any other information that No Limit Capital and/or Recipients deem necessary; " +
  "(5) Applicant waives and releases any claims against No Limit Capital, Recipients and any information-providers arising from any act or omission relating to the requesting, receiving, or release of information; " +
  "(6) each Owner of the Business represents that he or she is authorized to sign and submit this application on behalf of Business.";

const REQUIRED_FIELDS = new Set([
  "loan_amount",
  "funding_timeline",
  "first_name",
  "last_name",
  "contact_number",
  "email",
  "contact_agreement",
  "legal_business_name",
  "business_start_date",
  "business_dba",
  "industry",
  "business_address",
  "business_city",
  "business_state",
  "business_zip",
  "business_phone",
  "legal_entity",
  "business_tax_id",
  "credit_score",
  "gross_annual_sales",
  "avg_monthly_deposits",
  "avg_daily_balance",
  "state_of_incorporation",
  "has_other_financing",
  "has_judgements_liens",
  "has_open_bankruptcies",
  "seasonal_business",
  "owner_first_name",
  "owner_last_name",
  "owner_email",
  "owner_address",
  "owner_city",
  "owner_state",
  "owner_zip",
  "owner_contact",
  "owner_dob",
  "owner_ssn",
  "owner_ownership",
  "signature",
  "application_date",
  "application_agreement",
]);

let WEBSITE_LOGO_SVG = null;
try {
  WEBSITE_LOGO_SVG = fs.readFileSync(WEBSITE_LOGO_PATH, "utf8");
} catch (error) {
  WEBSITE_LOGO_SVG = null;
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(", ");
  }
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function toYesNo(value) {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) return "";
  if (["yes", "true", "1", "on"].includes(normalized)) return "YES";
  if (["no", "false", "0", "off"].includes(normalized)) return "NO";
  return normalizeValue(value);
}

function valueOrDash(value, showEmptyPlaceholder = true) {
  const normalized = normalizeValue(value);
  if (normalized) return normalized;
  return showEmptyPlaceholder ? "-" : "";
}

function truncateText(doc, value, maxWidth, emptyFallback = "-") {
  const safeValue = normalizeValue(value);
  if (!safeValue) return emptyFallback;
  if (maxWidth <= 8) return "";
  if (doc.widthOfString(safeValue) <= maxWidth) return safeValue;

  const ellipsis = "...";
  let text = safeValue;
  while (text.length > 0 && doc.widthOfString(text + ellipsis) > maxWidth) {
    text = text.slice(0, -1);
  }
  return text ? `${text}${ellipsis}` : ellipsis;
}

function markLabel(fieldKey, label, { forceRequired = false } = {}) {
  if (forceRequired || REQUIRED_FIELDS.has(fieldKey)) {
    return `${label} *`;
  }
  return label;
}

function drawLogoHeader(doc, options = {}) {
  const margin = doc.page.margins.left;
  const availableWidth = doc.page.width - margin * 2;
  const logoSvg = normalizeValue(options.logoSvg) || WEBSITE_LOGO_SVG;
  const logoScale = Number(options.headerScale || 0.75);

  if (logoSvg) {
    const baseLogoWidth = 250 * logoScale;
    const logoWidth = Math.min(baseLogoWidth, availableWidth - 10);
    const logoHeight = Math.round((logoWidth * 60) / 200);
    const logoX = Math.round((doc.page.width - logoWidth) / 2);
    const logoY = margin - 5;

    SVGtoPDF(doc, logoSvg, logoX, logoY, {
      width: logoWidth,
      height: logoHeight,
      preserveAspectRatio: "xMidYMid meet",
    });

    const dividerY = logoY + logoHeight + 5;
    doc.strokeColor("#1a56db").lineWidth(1.2);
    doc
      .moveTo(margin, dividerY)
      .lineTo(doc.page.width - margin, dividerY)
      .stroke();

    doc.fillColor("#000000");
    return dividerY + 7;
  }

  // Fallback: centered text-only header if logo cannot be loaded
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1e293b");
  doc.text(options.companyName || "No Limit Capital", margin, margin + 8, {
    width: availableWidth,
    align: "center",
    lineBreak: false,
  });

  const dividerY = margin + 30;
  doc.strokeColor("#1a56db").lineWidth(1.2);
  doc
    .moveTo(margin, dividerY)
    .lineTo(doc.page.width - margin, dividerY)
    .stroke();
  doc.fillColor("#000000");
  return dividerY + 6;
}

function drawLegend(doc, x, y, width, config) {
  doc.font("Helvetica").fontSize(config.legendFontSize).fillColor("#334155");
  doc.text("* Required    No * = Optional", x, y, {
    width,
    align: "right",
    lineBreak: false,
  });
  return y + config.legendHeight;
}

function drawSectionHeader(doc, x, y, width, title, config) {
  doc.fillColor("#1e3a8a");
  doc.rect(x, y, width, config.sectionHeaderHeight).fill();

  doc
    .font("Helvetica-Bold")
    .fontSize(config.sectionFontSize)
    .fillColor("#ffffff")
    .text(title, x + 7, y + 4, {
      width: width - 14,
      lineBreak: false,
    });

  doc.fillColor("#000000");
  return y + config.sectionHeaderHeight;
}

function drawFieldRow(doc, x, y, width, cells, config) {
  const totalSpan = cells.reduce((sum, cell) => sum + (cell.span || 1), 0);
  let currentX = x;

  cells.forEach((cell, index) => {
    const span = cell.span || 1;
    const remainingWidth = x + width - currentX;
    const cellWidth =
      index === cells.length - 1
        ? remainingWidth
        : Math.round((width * span) / totalSpan);

    doc
      .rect(currentX, y, cellWidth, config.rowHeight)
      .strokeColor("#94a3b8")
      .lineWidth(0.55)
      .stroke();

    const inset = 5;
    const textWidth = Math.max(10, cellWidth - inset * 2);

    doc
      .font("Helvetica-Bold")
      .fontSize(config.labelFontSize)
      .fillColor("#475569");
    doc.text(
      truncateText(doc, cell.label || "", textWidth),
      currentX + inset,
      y + 3,
      {
        width: textWidth,
        lineBreak: false,
      },
    );

    doc.font("Helvetica").fontSize(config.valueFontSize).fillColor("#0f172a");
    const emptyFallback = config.showEmptyPlaceholder ? "-" : "";
    doc.text(
      truncateText(
        doc,
        valueOrDash(cell.value, config.showEmptyPlaceholder),
        textWidth,
        emptyFallback,
      ),
      currentX + inset,
      y + config.valueOffsetY,
      {
        width: textWidth,
        lineBreak: false,
      },
    );

    currentX += cellWidth;
  });

  doc.fillColor("#000000");
  return y + config.rowHeight;
}

function drawAuthorizationTerms(doc, x, y, width, text, config) {
  const inset = 5;
  const textX = x + inset;
  const textWidth = Math.max(20, width - inset * 2);

  doc
    .font("Helvetica-Bold")
    .fontSize(config.authorizationLabelFontSize)
    .fillColor("#334155");
  //doc.text('Authorization Terms *', textX, y, {
  //  width: textWidth,
  //  lineBreak: false,
  //});

  const textY = y + config.authorizationLabelGap;
  const maxHeight = config.authorizationTextHeight;
  let paragraphFontSize = config.authorizationFontSize;
  const textOptions = {
    width: textWidth,
    align: "left",
    lineGap: 0.55,
  };

  doc.font("Helvetica").fillColor("#0f172a");
  while (paragraphFontSize > config.authorizationMinFontSize) {
    doc.fontSize(paragraphFontSize);
    const requiredHeight = doc.heightOfString(text, textOptions);
    if (requiredHeight <= maxHeight) {
      break;
    }
    paragraphFontSize -= 0.2;
  }

  doc.fontSize(paragraphFontSize);
  const requiredHeight = doc.heightOfString(text, textOptions);
  doc.text(text, textX, textY, {
    ...textOptions,
    height: maxHeight,
    ellipsis: requiredHeight > maxHeight,
  });

  doc.fillColor("#000000");
  return (
    textY +
    Math.min(requiredHeight, maxHeight) +
    config.authorizationAfterTermsGap
  );
}

function drawAuthorizationLine(
  doc,
  x,
  y,
  width,
  label,
  value,
  config,
  required = false,
) {
  const inset = 5;
  const rowX = x + inset;
  const rowWidth = Math.max(24, width - inset * 2);
  const labelText = `${required ? `${label} *` : label}:`;

  doc
    .font("Helvetica")
    .fontSize(config.authorizationLineLabelFontSize)
    .fillColor("#111827");
  doc.text(labelText, rowX, y, { lineBreak: false });

  const labelWidth = Math.min(rowWidth - 40, doc.widthOfString(labelText) + 6);
  const lineX = rowX + labelWidth;
  const lineY = y + config.authorizationLineBaselineOffset;

  doc.strokeColor("#334155").lineWidth(0.7);
  doc
    .moveTo(lineX, lineY)
    .lineTo(rowX + rowWidth, lineY)
    .stroke();

  const safeValue = normalizeValue(value);
  if (safeValue) {
    doc
      .font("Helvetica")
      .fontSize(config.authorizationLineValueFontSize)
      .fillColor("#0f172a");
    doc.text(
      truncateText(doc, safeValue, Math.max(24, rowWidth - labelWidth - 4)),
      lineX + 2,
      y - 1,
      {
        width: Math.max(24, rowWidth - labelWidth - 4),
        lineBreak: false,
      },
    );
  }

  doc.fillColor("#000000");
  return y + config.authorizationLineGap;
}

function drawAuthorizationDoubleLine(doc, x, y, width, left, right, config) {
  const columnGap = config.authorizationColumnGap;
  const columnWidth = Math.floor((width - columnGap) / 2);
  const nextY = drawAuthorizationLine(
    doc,
    x,
    y,
    columnWidth,
    left.label,
    left.value,
    config,
    Boolean(left.required),
  );
  drawAuthorizationLine(
    doc,
    x + columnWidth + columnGap,
    y,
    columnWidth,
    right.label,
    right.value,
    config,
    Boolean(right.required),
  );
  return nextY;
}

function drawAuthorizationSection(doc, x, y, width, record, config) {
  const owner1Name =
    `${record.owner_first_name || ""} ${record.owner_last_name || ""}`.trim();
  const owner2Name =
    `${record.additional_owner_first_name || ""} ${record.additional_owner_last_name || ""}`.trim();

  let currentY = drawSectionHeader(doc, x, y, width, "AUTHORIZATION", config);
  currentY = drawAuthorizationTerms(
    doc,
    x,
    currentY,
    width,
    AUTHORIZATION_TEXT,
    config,
  );

  // ── Side-by-side: Owner #1 (left) | Owner #2 (right) ────────────────────
  currentY = drawAuthorizationDoubleLine(
    doc, x, currentY, width,
    { label: "Owner #1 Name (Print)", value: owner1Name,          required: true  },
    { label: "Owner #2 Name (Print)", value: owner2Name,          required: false },
    config,
  );
  currentY = drawAuthorizationDoubleLine(
    doc, x, currentY, width,
    { label: "Owner #1 Signature",    value: record.signature,    required: true  },
    { label: "Owner #2 Signature",    value: record.signature_additional, required: false },
    config,
  );
  currentY = drawAuthorizationDoubleLine(
    doc, x, currentY, width,
    { label: "Date",                  value: record.application_date,          required: true  },
    { label: "Date",                  value: record.application_date_additional, required: false },
    config,
  );

  currentY += config.authorizationOwnerGap;

  // ── Bottom row: EIN | Website ────────────────────────────────────────────
  currentY = drawAuthorizationDoubleLine(
    doc, x, currentY, width,
    { label: "EIN#",                  value: record.business_tax_id,  required: true  },
    { label: "Website (if applicable)", value: record.business_website, required: false },
    config,
  );

  return currentY;
}

function field(fieldKey, label, value, span = 1, options = {}) {
  return {
    label: markLabel(fieldKey, label, options),
    value,
    span,
  };
}

function buildSections(record) {
  const owner1Name =
    `${record.owner_first_name || ""} ${record.owner_last_name || ""}`.trim();
  const owner2Name =
    `${record.additional_owner_first_name || ""} ${record.additional_owner_last_name || ""}`.trim();
  const preferredContact =
    `${record.first_name || ""} ${record.last_name || ""}`.trim();

  return [
    {
      title: "BUSINESS INFORMATION",
      rows: [
        [
          field(
            "legal_business_name",
            "Business Legal Name",
            record.legal_business_name,
            8,
          ),
          field("business_dba", "Business DBA Name", record.business_dba, 8),
        ],
        [
          field(
            "business_address",
            "Business Address",
            record.business_address,
            8,
          ),
          field("business_city", "City", record.business_city, 3),
          field("business_state", "State", record.business_state, 2),
          field("business_zip", "Zip", record.business_zip, 3),
        ],
        [
          field("business_phone", "Business Phone", record.business_phone, 4),
          field(
            "business_website",
            "Business Website",
            record.business_website,
            6,
          ),
          field("industry", "Industry", record.industry, 6),
        ],
        [
          field("first_name", "Preferred Contact", preferredContact, 4, {
            forceRequired: true,
          }),
          field("contact_number", "Contact Number", record.contact_number, 4),
          field("email", "Email", record.email, 8),
        ],
        [
          field("legal_entity", "Legal Entity", record.legal_entity, 3),
          field("business_tax_id", "Tax ID / EIN", record.business_tax_id, 3),
          field(
            "state_of_incorporation",
            "State of Incorporation",
            record.state_of_incorporation,
            4,
          ),
          field(
            "business_start_date",
            "Business Start Date",
            record.business_start_date,
            3,
          ),
          field("credit_score", "Credit Score", record.credit_score, 3),
        ],
        [
          field(
            "loan_amount",
            "Funding Amount Requesting",
            record.loan_amount,
            4,
          ),
          field(
            "funding_timeline",
            "Funding Timeline",
            record.funding_timeline,
            4,
          ),
          field("loan_use", "Use of Proceeds", record.loan_use, 8),
        ],
        [
          field(
            "gross_annual_sales",
            "Gross Annual Sales",
            record.gross_annual_sales,
            4,
          ),
          field(
            "avg_monthly_deposits",
            "Avg Monthly Deposits",
            record.avg_monthly_deposits,
            4,
          ),
          field(
            "avg_daily_balance",
            "Avg Daily Balance",
            record.avg_daily_balance,
            4,
          ),
          field(
            "credit_card_processor",
            "Card Processor",
            record.credit_card_processor,
            4,
          ),
        ],
        [
          field(
            "has_other_financing",
            "Other Financing",
            toYesNo(record.has_other_financing),
            3,
          ),
          field(
            "outstanding_balance",
            "Outstanding Balance",
            record.outstanding_balance,
            3,
          ),
          field(
            "funding_company",
            "Funding Company",
            record.funding_company,
            4,
          ),
          field(
            "has_open_bankruptcies",
            "Open Bankruptcies",
            toYesNo(record.has_open_bankruptcies),
            3,
          ),
          field(
            "has_judgements_liens",
            "Judgements/Liens",
            toYesNo(record.has_judgements_liens),
            3,
          ),
        ],
        [
          field(
            "seasonal_business",
            "Seasonal Business",
            toYesNo(record.seasonal_business),
            3,
          ),
          field("peak_months", "Peak Months", record.peak_months, 5),
          field(
            "application_agreement",
            "Application Agreement",
            toYesNo(record.application_agreement),
            4,
          ),
          field(
            "contact_agreement",
            "Contact Agreement",
            toYesNo(record.contact_agreement),
            4,
          ),
        ],
      ],
    },
    {
      title: "OWNERSHIP INFORMATION",
      rows: [
        [
          field("owner_first_name", "Owner #1 Name", owner1Name, 4, {
            forceRequired: true,
          }),
          field("owner_email", "Owner #1 Email", record.owner_email, 6),
          field("owner_ssn", "Owner #1 SSN", record.owner_ssn, 2),
          field("owner_dob", "Owner #1 DOB", record.owner_dob, 2),
          field("owner_ownership", "Ownership %", record.owner_ownership, 2),
        ],
        [
          field("owner_address", "Owner #1 Address", record.owner_address, 8),
          field("owner_city", "City", record.owner_city, 3),
          field("owner_state", "State", record.owner_state, 2),
          field("owner_zip", "Zip", record.owner_zip, 3),
        ],
        [
          field("additional_owner_first_name", "Owner #2 Name", owner2Name, 4, {
            forceRequired: false,
          }),
          field(
            "additional_owner_email",
            "Owner #2 Email",
            record.additional_owner_email,
            6,
          ),
          field(
            "additional_owner_ssn",
            "Owner #2 SSN",
            record.additional_owner_ssn,
            2,
          ),
          field(
            "additional_owner_dob",
            "Owner #2 DOB",
            record.additional_owner_dob,
            2,
          ),
          field(
            "additional_owner_ownership",
            "Owner #2 Own %",
            record.additional_owner_ownership,
            2,
          ),
        ],
        [
          field(
            "additional_owner_address",
            "Owner #2 Address",
            record.additional_owner_address,
            8,
          ),
          field(
            "additional_owner_city",
            "City",
            record.additional_owner_city,
            3,
          ),
          field(
            "additional_owner_state",
            "State",
            record.additional_owner_state,
            2,
          ),
          field("additional_owner_zip", "Zip", record.additional_owner_zip, 3),
        ],
        [
          field("owner_contact", "Owner #1 Phone", record.owner_contact, 4),
          field(
            "additional_owner_contact",
            "Owner #2 Phone",
            record.additional_owner_contact,
            4,
          ),
          field("id", "Application ID", record.id, 8, { forceRequired: true }),
        ],
      ],
    },
    {
      title: "REFERENCES",
      rows: [
        [
          field(
            "landlord_name_mortgage_company",
            "Landlord / Mortgage Company",
            record.landlord_name_mortgage_company,
            8,
          ),
          field(
            "landlord_contact_person",
            "Contact Person",
            record.landlord_contact_person,
            4,
          ),
          field("landlord_phone", "Phone", record.landlord_phone, 4),
        ],
        [
          field(
            "business_trade_reference_2",
            "Business Trade Reference #2",
            record.business_trade_reference_2,
            8,
          ),
          field(
            "business_trade_reference_2_contact_person",
            "Contact Person",
            record.business_trade_reference_2_contact_person,
            4,
          ),
          field(
            "business_trade_reference_2_phone",
            "Phone",
            record.business_trade_reference_2_phone,
            4,
          ),
        ],
        [
          field(
            "business_trade_reference_3",
            "Business Trade Reference #3",
            record.business_trade_reference_3,
            8,
          ),
          field(
            "business_trade_reference_3_contact_person",
            "Contact Person",
            record.business_trade_reference_3_contact_person,
            4,
          ),
          field(
            "business_trade_reference_3_phone",
            "Phone",
            record.business_trade_reference_3_phone,
            4,
          ),
        ],
      ],
    },
  ];
}

function createLayoutConfig(scale = 1, options = {}) {
  return {
    rowHeight: Math.max(14, Math.floor(23 * scale)),
    sectionHeaderHeight: Math.max(11, Math.floor(15 * scale)),
    sectionGap: Math.max(3, Math.floor(6 * scale)),
    labelFontSize: Math.max(5.2, 6.4 * scale),
    valueFontSize: Math.max(6.9, 8.4 * scale),
    sectionFontSize: Math.max(7.2, 8.7 * scale),
    valueOffsetY: Math.max(9, Math.floor(13 * scale)),
    legendFontSize: Math.max(5.4, 6.6 * scale),
    legendHeight: Math.max(7, Math.floor(10 * scale)),

    authorizationLabelFontSize: Math.max(5.8, 6.9 * scale),
    authorizationLabelGap: Math.max(8, Math.floor(10 * scale)),
    authorizationTextHeight: Math.max(56, Math.floor(80 * scale)),
    authorizationFontSize: Math.max(6.5, 7.4 * scale),
    authorizationMinFontSize: Math.max(6.0, 6.5 * scale),
    authorizationAfterTermsGap: Math.max(3, Math.floor(5 * scale)),
    authorizationLineLabelFontSize: Math.max(6.0, 7.0 * scale),
    authorizationLineValueFontSize: Math.max(6.2, 7.1 * scale),
    authorizationLineGap: Math.max(12, Math.floor(16 * scale)),
    authorizationLineBaselineOffset: Math.max(8, Math.floor(10 * scale)),
    authorizationOwnerGap: Math.max(2, Math.floor(3 * scale)),
    authorizationColumnGap: Math.max(8, Math.floor(12 * scale)),

    showEmptyPlaceholder: options.showEmptyPlaceholder !== false,
  };
}

function estimateBodyHeight(sections, config) {
  let rowsHeight = 0;
  sections.forEach((section) => {
    section.rows.forEach((row) => {
      rowsHeight += config.rowHeight;
    });
  });

  const sectionCount = sections.length;
  const authorizationHeight =
    config.sectionHeaderHeight +
    config.authorizationLabelGap +
    config.authorizationTextHeight +
    config.authorizationAfterTermsGap +
    config.authorizationLineGap * 7 +
    config.authorizationOwnerGap * 2;

  return (
    sectionCount * config.sectionHeaderHeight +
    rowsHeight +
    Math.max(0, sectionCount - 1) * config.sectionGap +
    config.sectionGap +
    authorizationHeight +
    config.legendHeight +
    16
  ); // footer and breathing room
}

function renderOnePageLayout(doc, record, options = {}) {
  const pageMargin = doc.page.margins.left;
  const contentX = pageMargin;
  const contentWidth = doc.page.width - pageMargin * 2;

  let y = drawLogoHeader(doc, options);
  const sections = buildSections(record);
  const showEmptyPlaceholder = options.emptyFields !== true;
  let config = createLayoutConfig(1, { showEmptyPlaceholder });
  const availableHeight = doc.page.height - doc.page.margins.bottom - y;
  const estimatedHeight = estimateBodyHeight(sections, config);
  if (estimatedHeight > availableHeight) {
    const scale = availableHeight / estimatedHeight;
    config = createLayoutConfig(scale, { showEmptyPlaceholder });
  }
  y = drawLegend(doc, contentX, y, contentWidth, config);

  sections.forEach((section, sectionIndex) => {
    y = drawSectionHeader(
      doc,
      contentX,
      y,
      contentWidth,
      section.title,
      config,
    );
    section.rows.forEach((row) => {
      y = drawFieldRow(doc, contentX, y, contentWidth, row, config);
    });
    if (sectionIndex < sections.length - 1) {
      y += config.sectionGap;
    }
  });

  y += config.sectionGap;
  y = drawAuthorizationSection(doc, contentX, y, contentWidth, record, config);

  const footerY = doc.page.height - doc.page.margins.bottom - 12;
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#64748b")
    .text("No Limit Capital", contentX, footerY, {
      width: contentWidth,
      align: "center",
      lineBreak: false,
    });
}

async function generateApplicationPdfBuffer(record, options = {}) {
  let logoSvg = WEBSITE_LOGO_SVG;
  if (options.logoPath) {
    try {
      logoSvg = fs.readFileSync(options.logoPath, "utf8");
    } catch (error) {
      logoSvg = WEBSITE_LOGO_SVG;
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: options.margin || 24,
      info: {
        Title: "Business Funding Application",
        Author: options.companyName || "No Limit Capital",
        Subject: `Application - ${normalizeValue(record.legal_business_name) || "Business"}`,
      },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    renderOnePageLayout(doc, record, {
      ...options,
      logoSvg,
    });
    doc.end();
  });
}

module.exports = {
  generateApplicationPdfBuffer,
};
