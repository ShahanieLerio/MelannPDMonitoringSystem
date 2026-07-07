import { store } from './services/dataStore.ts';
console.log(store.getLoans().filter(l => l.borrowerName.toLowerCase().includes('asuncion')).map(l => ({
  id: l.id,
  name: l.borrowerName,
  status: l.status,
  remarks: l.remarks
})));
