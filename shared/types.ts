export interface Order {
  id: string;
  date: string;
  status: 'تم التوصيل' | 'تم الإلغاء';
  amount: number;
  weekKey: string;
  monthKey: string;
}

export type FilterType = 'all' | 'delivered' | 'cancelled';
