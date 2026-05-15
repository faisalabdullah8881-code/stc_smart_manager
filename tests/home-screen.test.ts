import { describe, it, expect, beforeEach, vi } from "vitest";

describe("STC Smart Manager - Home Screen Logic", () => {
  describe("Order Management", () => {
    it("should calculate today's earnings correctly", () => {
      const today = new Date().toISOString().split("T")[0];
      const orders = [
        { id: "12345678", date: today, status: "موصل" as const, amount: 28 },
        { id: "87654321", date: today, status: "موصل" as const, amount: 28 },
        { id: "11111111", date: "2026-05-14", status: "موصل" as const, amount: 28 },
      ];

      const todayEarnings = orders
        .filter(o => o.date === today)
        .reduce((sum, o) => sum + o.amount, 0);

      expect(todayEarnings).toBe(56);
    });

    it("should calculate total earnings correctly", () => {
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "11111111", date: "2026-05-14", status: "موصل" as const, amount: 28 },
        { id: "22222222", date: "2026-05-14", status: "ملغي" as const, amount: 0 },
      ];

      const totalEarnings = orders.reduce((sum, o) => sum + o.amount, 0);

      expect(totalEarnings).toBe(84);
    });

    it("should count delivered orders correctly", () => {
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "11111111", date: "2026-05-14", status: "ملغي" as const, amount: 0 },
      ];

      const deliveredCount = orders.filter(o => o.amount > 0).length;

      expect(deliveredCount).toBe(2);
    });

    it("should prevent duplicate order IDs", () => {
      const existingOrders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
      ];

      const newIds = ["12345678", "87654321", "11111111"];
      const existingIds = existingOrders.map(o => o.id);
      const uniqueNewIds = newIds.filter(id => !existingIds.includes(id));

      expect(uniqueNewIds).toEqual(["87654321", "11111111"]);
      expect(uniqueNewIds).not.toContain("12345678");
    });
  });

  describe("Progress Calculation", () => {
    it("should calculate progress percentage correctly", () => {
      const goal = 500;
      const todayEarnings = 250;
      const progressPercent = Math.min((todayEarnings / goal) * 100, 100);

      expect(progressPercent).toBe(50);
    });

    it("should cap progress at 100%", () => {
      const goal = 500;
      const todayEarnings = 600;
      const progressPercent = Math.min((todayEarnings / goal) * 100, 100);

      expect(progressPercent).toBe(100);
    });

    it("should show 0% when no earnings", () => {
      const goal = 500;
      const todayEarnings = 0;
      const progressPercent = Math.min((todayEarnings / goal) * 100, 100);

      expect(progressPercent).toBe(0);
    });
  });

  describe("Order Status Detection", () => {
    it("should detect delivered status from text", () => {
      const text = "تم التوصيل بنجاح";
      const isDelivered = text.includes("تم التوصيل");

      expect(isDelivered).toBe(true);
    });

    it("should detect cancelled status when no delivery text", () => {
      const text = "الطلب ملغي";
      const isDelivered = text.includes("تم التوصيل");

      expect(isDelivered).toBe(false);
    });

    it("should assign correct commission for delivered orders", () => {
      const COMMISSION = 28;
      const isDelivered = true;
      const amount = isDelivered ? COMMISSION : 0;

      expect(amount).toBe(28);
    });

    it("should assign zero commission for cancelled orders", () => {
      const COMMISSION = 28;
      const isDelivered = false;
      const amount = isDelivered ? COMMISSION : 0;

      expect(amount).toBe(0);
    });
  });

  describe("Order ID Extraction", () => {
    it("should extract 8-digit order IDs from text", () => {
      const text = "الطلب 12345678 تم التوصيل والطلب 87654321 ملغي";
      const ids = text.match(/\d{8}/g) || [];

      expect(ids).toEqual(["12345678", "87654321"]);
    });

    it("should return empty array if no 8-digit IDs found", () => {
      const text = "لا توجد أرقام طلبات";
      const ids = text.match(/\d{8}/g) || [];

      expect(ids).toEqual([]);
    });

    it("should not extract IDs with less than 8 digits", () => {
      const text = "الطلب 1234567 والطلب 123456789";
      const ids = text.match(/\d{8}/g) || [];

      expect(ids).toEqual(["12345678"]);
    });
  });

  describe("Date Handling", () => {
    it("should get today's date in correct format", () => {
      const today = new Date().toISOString().split("T")[0];
      const parts = today.split("-");

      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^\d{4}$/);
      expect(parts[1]).toMatch(/^\d{2}$/);
      expect(parts[2]).toMatch(/^\d{2}$/);
    });

    it("should filter orders by date correctly", () => {
      const today = "2026-05-15";
      const orders = [
        { id: "12345678", date: "2026-05-15", status: "موصل" as const, amount: 28 },
        { id: "87654321", date: "2026-05-14", status: "موصل" as const, amount: 28 },
        { id: "11111111", date: "2026-05-15", status: "ملغي" as const, amount: 0 },
      ];

      const todayOrders = orders.filter(o => o.date === today);

      expect(todayOrders).toHaveLength(2);
      expect(todayOrders.every(o => o.date === today)).toBe(true);
    });
  });
});
