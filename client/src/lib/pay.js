import { money } from './format';
import { AGENCY_NAME } from './config';

// the bank accounts as plain text (for WhatsApp / copy)
export function bankText(banks) {
  if (!banks || !banks.length) return '';
  return banks.map((b, i) => `${i + 1}) ${b.bank_name}\nTitle: ${b.account_title}\nAccount: ${b.account_no}${b.iban ? `\nIBAN: ${b.iban}` : ''}${b.branch ? `\nBranch: ${b.branch}` : ''}${b.note ? `\n${b.note}` : ''}`).join('\n\n');
}

// payment reminder message for one agent: g = { name, items:[{ref,balance}], total }
export function reminderText(g, banks) {
  const lines = g.items.map(i => `• ${i.ref}: ${money(i.balance)}`).join('\n');
  const bt = bankText(banks);
  return `Assalam o Alaikum ${g.name},\nPayment reminder from ${AGENCY_NAME}.\n${lines}\nTotal due: ${money(g.total)}\n${bt ? `\nPlease pay to:\n${bt}\n` : '\n'}Please send the payment proof on WhatsApp after paying. Thank you.`;
}

export const waShare = text => `https://wa.me/?text=${encodeURIComponent(text)}`;
