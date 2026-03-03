const { generateApplicationPdfFromTemplate } = require('./pdf-template-fill');
const path = require('path'), fs = require('fs/promises');

const rec = {
  first_name:'Jane', last_name:'Smith', email:'jane@smithretail.com', contact_number:'(347) 555-0101',
  legal_business_name:'Smith Retail LLC', business_dba:'Smith Retail',
  business_address:'789 Oak Blvd', business_city:'Orlando', business_state:'FL',
  business_zip:'32801', business_phone:'(407) 555-0200', business_website:'https://smithretail.com',
  industry:'Retail Stores', legal_entity:'LLC', business_tax_id:'82-1234567',
  state_of_incorporation:'FL', business_start_date:'2019-03-15', credit_score:'720',
  loan_amount:'$75,000', funding_timeline:'Within 2 weeks', loan_use:'Equipment and working capital',
  gross_annual_sales:'$850,000', avg_monthly_deposits:'$70,000', avg_daily_balance:'$12,000',
  credit_card_processor:'Square', has_other_financing:'No', has_open_bankruptcies:'No',
  has_judgements_liens:'No', seasonal_business:'No', application_agreement:'Yes',
  owner_first_name:'Jane', owner_last_name:'Smith', owner_email:'jane@smithretail.com',
  owner_ssn:'123-45-6789', owner_dob:'1985-07-20', owner_ownership:'100',
  owner_address:'123 Maple Ave', owner_city:'Orlando', owner_state:'FL',
  owner_zip:'32802', owner_contact:'(407) 555-0300',
  landlord_name_mortgage_company:'Sunshine Properties', landlord_contact_person:'Tom Brown',
  landlord_phone:'(407) 555-0400',
  business_trade_reference_2:'Acme Supplies', business_trade_reference_2_contact_person:'Mike Lee',
  business_trade_reference_2_phone:'(407) 555-0500',
  signature: 'Jane Smith',   // plain text, no image
  application_date:'03/03/2026'
};

const tpl = path.join(__dirname,'pdf-templates','nolimitcap-empty-application.pdf');
generateApplicationPdfFromTemplate(rec, { templatePath: tpl, flatten: false })
  .then(async buf => {
    const out = path.join(__dirname, 'generated-pdfs', 'Smith_Retail_filled.pdf');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buf);
    console.log('Saved:', out, ' Size:', (buf.length/1024).toFixed(1) + 'KB');
  })
  .catch(e => { console.error('FAIL:', e.message); process.exit(1); });
