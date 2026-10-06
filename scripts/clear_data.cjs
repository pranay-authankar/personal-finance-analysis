const fs = require('fs');
const path = require('path');

const tables = {
  'family_members.csv': 'member_id,member_name\n',
  'assets.csv': 'a_id,member_id,asset_type,asset_name,asset_status\n',
  'fds.csv': 'fd_id,a_id,bank_name,acc_number,principal,interest_rate,start_date,maturity_date,actual_end_date\n',
  'post_office.csv': 'po_id,a_id,scheme_name,account_number,principal,interest_rate,start_date,maturity_date,actual_end_date,scheme_status\n',
  'bullions.csv': 'b_id,a_id,b_type,purchase_value,purchase_date,b_status\n',
  'properties.csv': 'p_id,a_id,p_type,name,location,purchase_price,party_name,party_contact,purchase_date,p_notes\n',
  'rents.csv': 'r_id,p_id,tenant_name,tenant_contact,rent_amount,rent_start_date,rent_end_date,next_rent_due,r_notes\n',
  'asset_sales.csv': 'sale_id,a_id,buyer_name,buyer_contact,sale_price,sale_date,payment_due_date,sale_notes\n',
  'payments.csv': 'payment_id,a_id,payment_type,amount,payment_date,due_date,status,notes\n',
  'documents.csv': 'd_id,a_id,r_id,d_category,d_name,d_link\n',
  'contributions.csv': 'contribution_id,a_id,contribution_type,amount,frequency,due_date,payment_date,status,notes\n'
};

const dirs = [
  path.resolve(__dirname, '..', 'data'),
  path.resolve(__dirname, '..', 'public', 'data')
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const [file, header] of Object.entries(tables)) {
    const fullPath = path.join(dir, file);
    fs.writeFileSync(fullPath, header, 'utf8');
    console.log(`Cleared ${fullPath}`);
  }
}

console.log('Zero-data state successfully initialized for all 11 CSV files across data/ and public/data/.');
