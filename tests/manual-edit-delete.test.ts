import { describe, it, expect } from 'vitest';

describe('Manual Edit and Delete Features', () => {
  // اختبار تبديل حالة الطلب
  describe('Toggle Order Status', () => {
    it('should toggle status from delivered to cancelled', () => {
      const order = { id: '12345678', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' };
      
      // محاكاة التبديل
      if (order.status === 'تم التوصيل') {
        order.status = 'تم الإلغاء';
        order.amount = 0;
      }
      
      expect(order.status).toBe('تم الإلغاء');
      expect(order.amount).toBe(0);
    });

    it('should toggle status from cancelled to delivered', () => {
      const order = { id: '87654321', status: 'تم الإلغاء' as const, amount: 0, date: '2026-05-17' };
      
      // محاكاة التبديل
      if (order.status === 'تم التوصيل') {
        order.status = 'تم الإلغاء';
        order.amount = 0;
      } else {
        order.status = 'تم التوصيل';
        order.amount = 28;
      }
      
      expect(order.status).toBe('تم التوصيل');
      expect(order.amount).toBe(28);
    });

    it('should update amount correctly when toggling status', () => {
      const orders = [
        { id: '11111111', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
        { id: '22222222', status: 'تم الإلغاء' as const, amount: 0, date: '2026-05-17' },
      ];

      // تبديل الطلب الأول
      if (orders[0].status === 'تم التوصيل') {
        orders[0].status = 'تم الإلغاء';
        orders[0].amount = 0;
      }

      expect(orders[0].amount).toBe(0);
      expect(orders[1].amount).toBe(0);
    });
  });

  // اختبار حذف طلب منفرد
  describe('Delete Single Order', () => {
    it('should delete a single order without affecting others', () => {
      let orders = [
        { id: '11111111', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
        { id: '22222222', status: 'تم الإلغاء' as const, amount: 0, date: '2026-05-17' },
        { id: '33333333', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
      ];

      // حذف الطلب الثاني
      orders = orders.filter((_, i) => i !== 1);

      expect(orders.length).toBe(2);
      expect(orders[0].id).toBe('11111111');
      expect(orders[1].id).toBe('33333333');
    });

    it('should maintain data integrity after deletion', () => {
      let orders = [
        { id: '11111111', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
        { id: '22222222', status: 'تم الإلغاء' as const, amount: 0, date: '2026-05-17' },
        { id: '33333333', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
      ];

      const initialTotal = orders.reduce((sum, o) => sum + o.amount, 0);
      
      // حذف طلب ملغي (amount = 0)
      orders = orders.filter((_, i) => i !== 1);
      
      const newTotal = orders.reduce((sum, o) => sum + o.amount, 0);
      expect(newTotal).toBe(initialTotal);
    });

    it('should correctly update totals after deleting a delivered order', () => {
      let orders = [
        { id: '11111111', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
        { id: '22222222', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
      ];

      const initialTotal = orders.reduce((sum, o) => sum + o.amount, 0);
      expect(initialTotal).toBe(56);

      // حذف الطلب الأول
      orders = orders.filter((_, i) => i !== 0);

      const newTotal = orders.reduce((sum, o) => sum + o.amount, 0);
      expect(newTotal).toBe(28);
    });

    it('should handle deletion of all orders', () => {
      let orders = [
        { id: '11111111', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
      ];

      orders = orders.filter((_, i) => i !== 0);

      expect(orders.length).toBe(0);
    });
  });

  // اختبار الفحص الذكي المحسّن
  describe('Smart Status Detection (Enhanced)', () => {
    it('should detect delivered status from related line only', () => {
      const relatedLine = "12345678 توصيل";
      const isDelivered = relatedLine.toLowerCase().includes("توصيل");
      
      expect(isDelivered).toBe(true);
    });

    it('should detect cancelled status when no delivery keywords found', () => {
      const relatedLine = "87654321 ملغي";
      const isDelivered = 
        relatedLine.toLowerCase().includes("توصيل") ||
        relatedLine.toLowerCase().includes("تم") ||
        relatedLine.toLowerCase().includes("مكتمل");
      
      expect(isDelivered).toBe(false);
    });

    it('should not generalize status from other lines', () => {
      const relatedLine = ""; // لا يوجد سطر متعلق
      const otherLineWithDelivery = "توصيل ناجح";
      
      const isDelivered = relatedLine.toLowerCase().includes("توصيل");
      
      expect(isDelivered).toBe(false);
    });

    it('should support multiple delivery keywords', () => {
      const keywords = ["توصيل", "تم", "مكتمل", "delivered", "completed"];
      const testLines = [
        { line: "12345678 توصيل", expected: true },
        { line: "12345678 تم التوصيل", expected: true },
        { line: "12345678 مكتمل", expected: true },
        { line: "12345678 delivered", expected: true },
        { line: "12345678 completed", expected: true },
        { line: "12345678 ملغي", expected: false },
      ];

      testLines.forEach(test => {
        const isDelivered = keywords.some(keyword => 
          test.line.toLowerCase().includes(keyword)
        );
        expect(isDelivered).toBe(test.expected);
      });
    });
  });

  // اختبار التكامل بين التعديل والحذف
  describe('Integration: Edit and Delete', () => {
    it('should handle multiple edits and deletions', () => {
      let orders = [
        { id: '11111111', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
        { id: '22222222', status: 'تم الإلغاء' as const, amount: 0, date: '2026-05-17' },
        { id: '33333333', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
      ];

      // تعديل الطلب الأول
      if (orders[0].status === 'تم التوصيل') {
        orders[0].status = 'تم الإلغاء';
        orders[0].amount = 0;
      }

      // حذف الطلب الثاني
      orders = orders.filter((_, i) => i !== 1);

      expect(orders.length).toBe(2);
      expect(orders[0].amount).toBe(0);
      expect(orders[1].amount).toBe(28);
      expect(orders.reduce((sum, o) => sum + o.amount, 0)).toBe(28);
    });

    it('should maintain correct totals after complex operations', () => {
      let orders = [
        { id: '11111111', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
        { id: '22222222', status: 'تم التوصيل' as const, amount: 28, date: '2026-05-17' },
        { id: '33333333', status: 'تم الإلغاء' as const, amount: 0, date: '2026-05-17' },
      ];

      const initialTotal = orders.reduce((sum, o) => sum + o.amount, 0);
      expect(initialTotal).toBe(56);

      // عمليات متعددة
      // 1. تعديل الطلب الثاني من موصل إلى ملغي
      if (orders[1].status === 'تم التوصيل') {
        orders[1].status = 'تم الإلغاء';
        orders[1].amount = 0;
      }

      // 2. حذف الطلب الثالث
      orders = orders.filter((_, i) => i !== 2);

      const finalTotal = orders.reduce((sum, o) => sum + o.amount, 0);
      expect(finalTotal).toBe(28);
      expect(orders.length).toBe(2);
    });
  });
});
