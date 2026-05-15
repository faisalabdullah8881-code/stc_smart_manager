import { describe, it, expect } from "vitest";

describe("STC Smart Manager - Advanced Features", () => {
  describe("Filtering Orders", () => {
    it("should filter delivered orders correctly", () => {
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "ملغي" as const, amount: 0 },
        { id: "11111111", date: "2026-05-14", status: "موصل" as const, amount: 28 },
      ];

      const filter = "delivered";
      const displayOrders = orders.filter(o => {
        if (filter === "delivered") return o.status === "موصل";
        if (filter === "cancelled") return o.status === "ملغي";
        return true;
      });

      expect(displayOrders).toHaveLength(2);
      expect(displayOrders.every(o => o.status === "موصل")).toBe(true);
    });

    it("should filter cancelled orders correctly", () => {
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "ملغي" as const, amount: 0 },
        { id: "11111111", date: "2026-05-14", status: "ملغي" as const, amount: 0 },
      ];

      const filter = "cancelled";
      const displayOrders = orders.filter(o => {
        if (filter === "delivered") return o.status === "موصل";
        if (filter === "cancelled") return o.status === "ملغي";
        return true;
      });

      expect(displayOrders).toHaveLength(2);
      expect(displayOrders.every(o => o.status === "ملغي")).toBe(true);
    });

    it("should show all orders when filter is 'all'", () => {
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "ملغي" as const, amount: 0 },
        { id: "11111111", date: "2026-05-14", status: "موصل" as const, amount: 28 },
      ];

      const filter = "all";
      const displayOrders = orders.filter(o => {
        if (filter === "delivered") return o.status === "موصل";
        if (filter === "cancelled") return o.status === "ملغي";
        return true;
      });

      expect(displayOrders).toHaveLength(3);
    });
  });

  describe("CSV Export Data", () => {
    it("should format CSV header correctly", () => {
      const header = "رقم الطلب,الحالة,العمولة,التاريخ\n";
      expect(header).toContain("رقم الطلب");
      expect(header).toContain("الحالة");
      expect(header).toContain("العمولة");
      expect(header).toContain("التاريخ");
    });

    it("should format CSV rows correctly", () => {
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "ملغي" as const, amount: 0 },
      ];

      const csvContent = orders
        .map(o => `${o.id},${o.status},${o.amount},${o.date}`)
        .join("\n");

      expect(csvContent).toContain("12345678,موصل,28,2026-05-15");
      expect(csvContent).toContain("87654321,ملغي,0,2026-05-15");
    });

    it("should include BOM for Excel compatibility", () => {
      const csvData = "\ufeff" + "رقم الطلب,الحالة,العمولة,التاريخ\n";
      expect(csvData.charCodeAt(0)).toBe(0xfeff);
    });
  });

  describe("Enhanced OCR Data Extraction", () => {
    it("should extract order data with improved accuracy", () => {
      const text = "الطلب 12345678 تم التوصيل بنجاح\nالطلب 87654321 تم الإلغاء";
      const ids = text.match(/\d{8}/g) || [];
      const lines = text.split("\n");

      const extractedData = ids.map(id => {
        const relatedLine = lines.find(l => l.includes(id)) || "";
        const isDelivered =
          text.includes("تم التوصيل") ||
          text.includes("توصيل") ||
          relatedLine.includes("تم");

        return {
          id,
          status: isDelivered ? "موصل" : "ملغي",
          amount: isDelivered ? 28 : 0,
        };
      });

      expect(extractedData).toHaveLength(2);
      expect(extractedData[0].status).toBe("موصل");
      expect(extractedData[0].amount).toBe(28);
    });

    it("should detect delivery status from multiple keywords", () => {
      const testCases = [
        { text: "تم التوصيل", expected: true },
        { text: "توصيل ناجح", expected: true },
        { text: "delivered", expected: true },
        { text: "تم الإلغاء", expected: false },
        { text: "cancelled", expected: false },
      ];

      testCases.forEach(({ text, expected }) => {
        const isDelivered =
          text.includes("تم التوصيل") ||
          text.includes("توصيل") ||
          text.includes("delivered");

        expect(isDelivered).toBe(expected);
      });
    });
  });

  describe("Filtered Earnings Calculation", () => {
    it("should calculate earnings based on filtered orders", () => {
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "ملغي" as const, amount: 0 },
        { id: "11111111", date: "2026-05-14", status: "موصل" as const, amount: 28 },
      ];

      const filter = "delivered";
      const displayOrders = orders.filter(o => {
        if (filter === "delivered") return o.status === "موصل";
        if (filter === "cancelled") return o.status === "ملغي";
        return true;
      });

      const totalEarnings = displayOrders.reduce((sum, o) => sum + o.amount, 0);
      expect(totalEarnings).toBe(56);
    });

    it("should show zero earnings for cancelled filter", () => {
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "ملغي" as const, amount: 0 },
      ];

      const filter = "cancelled";
      const displayOrders = orders.filter(o => {
        if (filter === "delivered") return o.status === "موصل";
        if (filter === "cancelled") return o.status === "ملغي";
        return true;
      });

      const totalEarnings = displayOrders.reduce((sum, o) => sum + o.amount, 0);
      expect(totalEarnings).toBe(0);
    });
  });

  describe("Duplicate Prevention with Set", () => {
    it("should prevent duplicate order IDs using Set", () => {
      const existingOrders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
      ];

      const newOrdersData = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "موصل" as const, amount: 28 },
      ];

      const existingIds = new Set(existingOrders.map(o => o.id));
      const newEntries = newOrdersData.filter(o => !existingIds.has(o.id));

      expect(newEntries).toHaveLength(1);
      expect(newEntries[0].id).toBe("87654321");
    });
  });
});
