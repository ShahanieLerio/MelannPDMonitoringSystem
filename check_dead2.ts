import { store } from './services/dataStore.ts';
import { Branch } from './types.ts';

const allLoans = store.getLoans(Branch.ALL);
const deadLoans = allLoans.filter(loan => 
  loan.remarks.some(r => /\bdead\b/i.test(r.text.toLowerCase().trim()))
);

console.log("Total Dead Loans Found:", deadLoans.length);
deadLoans.forEach(l => {
  console.log(`- ${l.borrowerName} | Branch: ${l.branch} | Status: ${l.status} | Outstanding: ${l.outstandingBalance} | Running: ${l.runningBalance} | Remarks: ${l.remarks.map(r=>r.text).join(', ')}`);
});
