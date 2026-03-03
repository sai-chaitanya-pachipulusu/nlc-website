/**
 * create-empty-template.js
 *
 * Strategy:
 *  1. Generate the original pdfkit-based visual layout (empty fields, no dashes)
 *     via generateApplicationPdfBuffer — preserves the exact branded look.
 *  2. Replicate the same layout coordinate math to figure out where every
 *     field value area sits on the page (pdfkit top-left coordinates).
 *  3. Load the pdfkit output with pdf-lib and overlay transparent AcroForm
 *     text fields at those exact positions, converting to pdf-lib bottom-left.
 *
 * Usage: node create-empty-template.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { PDFDocument: PdfLib, StandardFonts, PDFName, PDFArray } = require('pdf-lib');

const OUTPUT_PATH = path.join(__dirname, 'pdf-templates', 'nolimitcap-empty-application.pdf');

// --------------------------------------------------------------------------
// Layout constants — MUST stay in sync with pdf-layout.js createLayoutConfig
// --------------------------------------------------------------------------
function createLayoutConfig(scale = 1) {
  return {
    rowHeight:                       Math.max(20, Math.floor(34 * scale)),
    sectionHeaderHeight:             Math.max(11, Math.floor(15 * scale)),
    sectionGap:                      Math.max(3,  Math.floor(6  * scale)),
    labelFontSize:                   Math.max(5.5, 7.0 * scale),
    valueFontSize:                   Math.max(7.5, 10.0 * scale),
    sectionFontSize:                 Math.max(7.2, 8.7 * scale),
    valueOffsetY:                    Math.max(12, Math.floor(18 * scale)),
    legendFontSize:                  Math.max(5.4, 6.6 * scale),
    legendHeight:                    Math.max(7,  Math.floor(10 * scale)),
    authorizationLabelFontSize:      Math.max(5.8, 6.9 * scale),
    authorizationLabelGap:           Math.max(8,  Math.floor(10 * scale)),
    authorizationTextHeight:         Math.max(56, Math.floor(80 * scale)),
    authorizationFontSize:           Math.max(6.5, 7.4 * scale),
    authorizationMinFontSize:        Math.max(6.0, 6.5 * scale),
    authorizationAfterTermsGap:      Math.max(3,  Math.floor(5  * scale)),
    authorizationLineLabelFontSize:  Math.max(6.0, 7.0 * scale),
    authorizationLineValueFontSize:  Math.max(6.2, 7.1 * scale),
    authorizationLineGap:            Math.max(13, Math.floor(18 * scale)),
    authorizationLineBaselineOffset: Math.max(8,  Math.floor(11 * scale)),
    authorizationOwnerGap:           Math.max(2,  Math.floor(4  * scale)),
    authorizationColumnGap:          Math.max(8,  Math.floor(12 * scale)),
  };
}

function estimateBodyHeight(sections, config) {
  let rowsHeight = 0;
  sections.forEach((s) => s.rows.forEach(() => { rowsHeight += config.rowHeight; }));
  const authorizationHeight =
    config.sectionHeaderHeight +
    config.authorizationLabelGap +
    config.authorizationTextHeight +
    config.authorizationAfterTermsGap +
    config.authorizationLineGap * 4 +
    config.authorizationOwnerGap * 2;
  return (
    sections.length * config.sectionHeaderHeight +
    rowsHeight +
    Math.max(0, sections.length - 1) * config.sectionGap +
    config.sectionGap +
    authorizationHeight +
    config.legendHeight +
    16
  );
}

/**
 * Sections with field names — MUST mirror buildSections() in pdf-layout.js exactly.
 * Same rows, same span values, same order.
 */
function buildSectionsWithNames() {
  return [
    {
      title: 'BUSINESS INFORMATION',
      rows: [
        // Row 1
        [ { fieldName: 'legal_business_name', span: 9 }, { fieldName: 'business_dba', span: 7 } ],
        // Row 2
        [ { fieldName: 'legal_entity', span: 5 }, { fieldName: 'state_of_incorporation', span: 4 }, { fieldName: 'business_tax_id', span: 4 }, { fieldName: 'funding_company', span: 3 } ],
        // Row 3
        [ { fieldName: 'business_address', span: 16 } ],
        // Row 4
        [ { fieldName: 'business_city', span: 4 }, { fieldName: 'business_state', span: 3 }, { fieldName: 'business_zip', span: 3 }, { fieldName: 'business_phone', span: 6 } ],
        // Row 5
        [ { fieldName: 'preferred_contact_name', span: 6 }, { fieldName: 'contact_number', span: 5 }, { fieldName: 'email', span: 5 } ],
        // Row 6
        [ { fieldName: 'industry', span: 6 }, { fieldName: 'business_website', span: 5 }, { fieldName: 'business_start_date', span: 5 } ],
        // Row 7
        [ { fieldName: 'loan_amount', span: 6 }, { fieldName: 'funding_timeline', span: 5 }, { fieldName: 'credit_score', span: 5 } ],
        // Row 8
        [ { fieldName: 'gross_annual_sales', span: 5 }, { fieldName: 'avg_monthly_deposits', span: 5 }, { fieldName: 'avg_daily_balance', span: 6 } ],
        // Row 9
        [ { fieldName: 'loan_use', span: 8 }, { fieldName: 'credit_card_processor', span: 8 } ],
        // Row 10
        [ { fieldName: 'has_other_financing', span: 3 }, { fieldName: 'outstanding_balance', span: 3 }, { fieldName: 'seasonal_business', span: 2 }, { fieldName: 'peak_months', span: 3 }, { fieldName: 'has_open_bankruptcies', span: 2 }, { fieldName: 'has_judgements_liens', span: 3 } ],
      ],
    },
    {
      title: 'OWNERSHIP INFORMATION',
      rows: [
        // Owner #1 Row 1
        [ { fieldName: 'owner_first_name', span: 3 }, { fieldName: 'owner_last_name', span: 3 }, { fieldName: 'owner_ssn', span: 4 }, { fieldName: 'owner_dob', span: 3 }, { fieldName: 'owner_ownership', span: 3 } ],
        // Owner #1 Row 2
        [ { fieldName: 'owner_address', span: 5 }, { fieldName: 'owner_city', span: 2 }, { fieldName: 'owner_state', span: 2 }, { fieldName: 'owner_zip', span: 2 }, { fieldName: 'owner_contact', span: 2 }, { fieldName: 'owner_email', span: 3 } ],
        // Owner #2 Row 1
        [ { fieldName: 'additional_owner_first_name', span: 3 }, { fieldName: 'additional_owner_last_name', span: 3 }, { fieldName: 'additional_owner_ssn', span: 4 }, { fieldName: 'additional_owner_dob', span: 3 }, { fieldName: 'additional_owner_ownership', span: 3 } ],
        // Owner #2 Row 2
        [ { fieldName: 'additional_owner_address', span: 5 }, { fieldName: 'additional_owner_city', span: 2 }, { fieldName: 'additional_owner_state', span: 2 }, { fieldName: 'additional_owner_zip', span: 2 }, { fieldName: 'additional_owner_contact', span: 2 }, { fieldName: 'additional_owner_email', span: 3 } ],
      ],
    },
    {
      title: 'REFERENCES',
      rows: [
        [ { fieldName: 'landlord_name_mortgage_company', span: 8 }, { fieldName: 'landlord_contact_person', span: 4 }, { fieldName: 'landlord_phone', span: 4 } ],
        [ { fieldName: 'business_trade_reference_2', span: 8 }, { fieldName: 'business_trade_reference_2_contact_person', span: 4 }, { fieldName: 'business_trade_reference_2_phone', span: 4 } ],
        [ { fieldName: 'business_trade_reference_3', span: 8 }, { fieldName: 'business_trade_reference_3_contact_person', span: 4 }, { fieldName: 'business_trade_reference_3_phone', span: 4 } ],
      ],
    },
  ];
}

/**
 * Estimate the header height produced by drawLogoHeader in pdf-layout.js
 * (raster logo path, margin=24, logoScale=0.75).
 */
function estimateHeaderHeight(margin, logoScale) {
  const iconSize     = Math.max(30, Math.round(50 * logoScale));
  const textFontSize = Math.max(14, Math.round(19 * logoScale));
  const logoY        = margin - 3;
  const textY        = logoY + iconSize + 6;
  const dividerY     = textY + textFontSize + 6;
  return dividerY + 7;
}

/**
 * Compute bounding boxes for all fields using the same math as renderOnePageLayout().
 * Returns array of { fieldName, x, y, width, height } in pdfkit top-left coords.
 */
function computeFieldCoords(pageWidth = 612, margin = 24, logoScale = 0.75) {
  const contentWidth = pageWidth - margin * 2;
  const sections     = buildSectionsWithNames();
  const pageHeight   = 792;
  const headerHeight = estimateHeaderHeight(margin, logoScale);
  let   config       = createLayoutConfig(1);
  const availableH   = pageHeight - 36 - headerHeight;
  const estimatedH   = estimateBodyHeight(sections, config);
  let   scale        = 1;
  if (estimatedH > availableH) {
    scale  = availableH / estimatedH;
    config = createLayoutConfig(scale);
  }

  const coords = [];
  let y = headerHeight + config.legendHeight;

  sections.forEach((section, sIdx) => {
    y += config.sectionHeaderHeight;

    section.rows.forEach((row) => {
      const totalSpan = row.reduce((s, c) => s + (c.span || 1), 0);
      let curX = margin;

      row.forEach((cell, i) => {
        const span   = cell.span || 1;
        const isLast = i === row.length - 1;
        const cellW  = isLast
          ? (margin + contentWidth - curX)
          : Math.round((contentWidth * span) / totalSpan);

        const labelH = Math.ceil(config.labelFontSize) + 4;
        const fieldY = y + labelH;
        const fieldH = Math.max(10, config.rowHeight - labelH - 2);

        coords.push({
          fieldName: cell.fieldName,
          x:         curX + 2,
          y:         fieldY,
          width:     Math.max(8, cellW - 4),
          height:    fieldH,
        });

        curX += cellW;
      });

      y += config.rowHeight;
    });

    if (sIdx < sections.length - 1) y += config.sectionGap;
  });

  // Authorization section
  y += config.sectionGap + config.sectionHeaderHeight;
  y += config.authorizationLabelGap + config.authorizationTextHeight + config.authorizationAfterTermsGap;

  const colGap = config.authorizationColumnGap;
  const colW   = Math.floor((contentWidth - colGap) / 2);
  const inset  = 5;
  const rowW   = Math.max(24, colW - inset * 2);
  const lineH  = config.authorizationLineGap;
  const fHeight = Math.max(10, lineH - 2);

  // Per-row label offsets (fraction of rowW) matching each label's actual width
  // at ~6pt Helvetica: "Owner #1 Name (Print) *:" ≈ 36%, "Owner #1 Signature *:" ≈ 30%, "Date *:" ≈ 11%
  const authRows = [
    { left: 'sig_owner1_name',  right: 'sig_owner2_name',            lf: 0.36, shift: 2 },
    { left: 'signature',        right: 'signature_additional',        lf: 0.30, shift: 2 },
    { left: 'application_date', right: 'application_date_additional', lf: 0.11, shift: 0 },
  ];

  authRows.forEach(({ left: leftName, right: rightName, lf, shift }) => {
    const fieldOffset = Math.round(rowW * lf);
    const fieldY = y + config.authorizationLineBaselineOffset - fHeight - 2 - shift;

    const leftX  = margin + inset + fieldOffset;
    const leftW  = (margin + colW)          - leftX  - 4; // 4pt right inset
    const rightX = margin + colW + colGap + inset + fieldOffset;
    const rightW = (margin + contentWidth)  - rightX - 4;

    coords.push({ fieldName: leftName,  x: leftX,  y: fieldY, width: Math.max(20, leftW),  height: fHeight });
    coords.push({ fieldName: rightName, x: rightX, y: fieldY, width: Math.max(20, rightW), height: fHeight });
    y += lineH;
  });

  return { coords, config, scale };
}

// --------------------------------------------------------------------------
// Step 1: Generate pdfkit visual PDF (original branded layout, blank values)
// --------------------------------------------------------------------------
async function generateVisualPdf(margin, logoScale) {
  const { generateApplicationPdfBuffer } = require('./pdf-layout');
  return generateApplicationPdfBuffer({}, {
    companyName:  'No Limit Capital',
    margin,
    logoPath:     path.join(__dirname, '..', 'assets', 'images', 'logo.png'),
    headerScale:  logoScale,
    emptyFields:  true,
  });
}

// --------------------------------------------------------------------------
// Step 2: Overlay AcroForm fields with pdf-lib
// --------------------------------------------------------------------------
async function overlayAcroFormFields(pdfBuffer, coords, pageHeight) {
  const pdfDoc    = await PdfLib.load(pdfBuffer);
  const form      = pdfDoc.getForm();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page      = pdfDoc.getPages()[0];

  for (const c of coords) {
    if (!c.fieldName) continue;
    const pdfLibY = pageHeight - c.y - c.height;

    try {
      const field = form.createTextField(c.fieldName);
      field.addToPage(page, {
        x:           c.x,
        y:           pdfLibY,
        width:       Math.max(8, c.width),
        height:      Math.max(8, c.height),
        borderWidth: 0,
      });
    } catch (err) {
      console.warn(`  [warn] Skipping "${c.fieldName}": ${err.message}`);
    }
  }

  form.updateFieldAppearances(helvetica);

  // MK/BG = [] (empty array) = transparent background per PDF spec
  form.getFields().forEach((f) => {
    f.acroField.getWidgets().forEach((w) => {
      try {
        const mk = w.getOrCreateMK();
        mk.set(PDFName.of('BG'), PDFArray.withContext(pdfDoc.context));
        mk.delete(PDFName.of('BC'));
      } catch (_) {}
    });
  });

  return Buffer.from(await pdfDoc.save());
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
  const MARGIN      = 24;
  const LOGO_SCALE  = 0.75;
  const PAGE_HEIGHT = 792;

  console.log('1/3  Generating visual PDF with pdfkit...');
  const visualBuffer = await generateVisualPdf(MARGIN, LOGO_SCALE);

  console.log('2/3  Computing field coordinates...');
  const { coords, scale } = computeFieldCoords(612, MARGIN, LOGO_SCALE);
  console.log(`     Layout scale: ${scale.toFixed(3)}  |  Fields: ${coords.length}`);

  console.log('3/3  Overlaying AcroForm fields with pdf-lib...');
  const finalBuffer = await overlayAcroFormFields(visualBuffer, coords, PAGE_HEIGHT);

  if (!fs.existsSync(path.dirname(OUTPUT_PATH))) {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, finalBuffer);

  console.log(`\n✓  Template saved: ${OUTPUT_PATH}`);
  console.log(`   Size: ${(finalBuffer.length / 1024).toFixed(1)} KB  |  Fields: ${coords.length}`);
}

main().catch((err) => {
  console.error('✗ Failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
