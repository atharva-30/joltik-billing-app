export interface BillItem {
  id: string;
  description: string;
  qty: number;
  perUnit: number;
  amount: number;
}

export interface Bill {
  id: string;
  billNo: string;
  date: string;
  to: string;
  items: BillItem[];
  total: number;
  advance: number;
  balanceDue: number;
  createdAt: number;
}
