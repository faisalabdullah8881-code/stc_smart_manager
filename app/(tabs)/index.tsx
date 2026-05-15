import { ScrollView, Text, View, TouchableOpacity, Pressable, ActivityIndicator, Alert } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Tesseract from "tesseract.js";

import { ScreenContainer } from "@/components/screen-container";

interface Order {
  id: string;
  date: string;
  status: "موصل" | "ملغي";
  amount: number;
}

type FilterType = "all" | "delivered" | "cancelled";

export default function HomeScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [goal] = useState(500);
  const COMMISSION = 28;

  // Load orders from AsyncStorage on mount
  useEffect(() => {
    const loadOrders = async () => {
      try {
        const saved = await AsyncStorage.getItem("stc_orders");
        if (saved) {
          setOrders(JSON.parse(saved));
        }
      } catch (err) {
        console.error("Error loading orders:", err);
      }
    };
    loadOrders();
  }, []);

  // Save orders to AsyncStorage whenever they change
  useEffect(() => {
    const saveOrders = async () => {
      try {
        await AsyncStorage.setItem("stc_orders", JSON.stringify(orders));
      } catch (err) {
        console.error("Error saving orders:", err);
      }
    };
    saveOrders();
  }, [orders]);

  // تحسين دقة القراءة
  const extractOrderData = (text: string): Order[] => {
    const ids = text.match(/\d{8}/g) || [];
    const today = new Date().toISOString().split("T")[0];
    const lines = text.split("\n");

    return ids.map(id => {
      // البحث عن السطر الذي يحتوي على الرقم
      const relatedLine = lines.find(l => l.includes(id)) || "";
      // تحسين كشف حالة التوصيل
      const isDelivered =
        text.includes("تم التوصيل") ||
        text.includes("توصيل") ||
        text.includes("delivered") ||
        relatedLine.includes("تم");

      return {
        id,
        date: today,
        status: isDelivered ? "موصل" : "ملغي",
        amount: isDelivered ? COMMISSION : 0,
      };
    });
  };

  const handleCapture = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setLoading(true);
        const uri = result.assets[0].uri;

        try {
          const { data: { text } } = await Tesseract.recognize(uri, "ara+eng");
          const newOrdersData = extractOrderData(text);
          const existingIds = new Set(orders.map(o => o.id));

          const newEntries = newOrdersData.filter(o => !existingIds.has(o.id));

          if (newEntries.length > 0) {
            setOrders(prev => [...prev, ...newEntries]);
            Alert.alert("نجح", `تم إضافة ${newEntries.length} طلب جديد`);
          } else {
            Alert.alert("معلومة", "لم يتم العثور على طلبات جديدة");
          }
        } catch (err) {
          console.error("OCR Error:", err);
          Alert.alert("خطأ", "حدث خطأ في قراءة الصورة. حاول مرة أخرى.");
        } finally {
          setLoading(false);
        }
      }
    } catch (err) {
      console.error("Image picker error:", err);
      Alert.alert("خطأ", "حدث خطأ في اختيار الصورة");
      setLoading(false);
    }
  };

  // تصدير البيانات إلى CSV
  const exportToCSV = async () => {
    try {
      const header = "رقم الطلب,الحالة,العمولة,التاريخ\n";
      const csvContent = displayOrders
        .map(o => `${o.id},${o.status},${o.amount},${o.date}`)
        .join("\n");

      const csvData = "\ufeff" + header + csvContent; // BOM for Excel
      const fileName = `تقرير_عمولات_${new Date().toLocaleDateString("ar-SA")}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(filePath, {
        mimeType: "text/csv",
        dialogTitle: "مشاركة التقرير",
      });
    } catch (err) {
      console.error("Export error:", err);
      Alert.alert("خطأ", "حدث خطأ في تصدير البيانات");
    }
  };

  const handleClear = () => {
    Alert.alert("تأكيد", "هل تريد حذف جميع الطلبات؟", [
      { text: "إلغاء", onPress: () => {} },
      {
        text: "حذف",
        onPress: () => {
          setOrders([]);
        },
      },
    ]);
  };

  // تطبيق الفلترة
  const displayOrders = orders.filter(o => {
    if (filter === "delivered") return o.status === "موصل";
    if (filter === "cancelled") return o.status === "ملغي";
    return true;
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const todayEarnings = displayOrders
    .filter(o => o.date === todayStr)
    .reduce((sum, o) => sum + o.amount, 0);
  const totalEarnings = displayOrders.reduce((sum, o) => sum + o.amount, 0);
  const deliveredCount = displayOrders.filter(o => o.amount > 0).length;
  const progressPercent = Math.min((todayEarnings / goal) * 100, 100);

  return (
    <ScreenContainer className="p-4 bg-slate-50">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          {/* Daily Goal Card */}
          <View
            className="rounded-3xl p-5 overflow-hidden"
            style={{
              backgroundColor: "#4f2d7f",
            }}
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white text-base">🎯 هدف اليوم</Text>
              <Text className="text-white font-bold text-lg">
                {todayEarnings} / {goal} ريال
              </Text>
            </View>
            {/* Progress Bar */}
            <View
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: "#00e676",
                  width: `${progressPercent}%`,
                }}
              />
            </View>
          </View>

          {/* Filter Section */}
          <View className="bg-white rounded-2xl p-4 gap-3">
            <Text className="text-foreground font-semibold text-sm">🔍 الفلترة</Text>
            <View className="flex-row gap-2">
              {[
                { label: "الكل", value: "all" },
                { label: "موصلة", value: "delivered" },
                { label: "ملغاة", value: "cancelled" },
              ].map(option => (
                <Pressable
                  key={option.value}
                  onPress={() => setFilter(option.value as FilterType)}
                  className="flex-1"
                  style={({ pressed }) => [
                    {
                      backgroundColor: filter === option.value ? "#4f2d7f" : "#f0f0f0",
                      borderRadius: 8,
                      paddingVertical: 10,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    className={`text-center font-semibold text-sm ${
                      filter === option.value ? "text-white" : "text-foreground"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Summary Card */}
          <View className="bg-white rounded-3xl p-5 flex-row justify-around">
            <View className="items-center">
              <Text className="text-gray-600 text-xs mb-1">إجمالي الأرباح</Text>
              <Text className="text-foreground font-bold text-lg">{totalEarnings} ر.س</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="items-center">
              <Text className="text-gray-600 text-xs mb-1">الموصلة</Text>
              <Text className="text-foreground font-bold text-lg">{deliveredCount}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleCapture}
              disabled={loading}
              className="flex-1"
              style={({ pressed }) => [
                {
                  backgroundColor: "#4f2d7f",
                  borderRadius: 12,
                  paddingVertical: 15,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View className="items-center justify-center flex-row gap-2">
                {loading ? (
                  <>
                    <ActivityIndicator color="white" size="small" />
                    <Text className="text-white font-bold text-center">جاري...</Text>
                  </>
                ) : (
                  <Text className="text-white font-bold text-center">📸 رفع</Text>
                )}
              </View>
            </Pressable>

            <Pressable
              onPress={exportToCSV}
              disabled={displayOrders.length === 0}
              className="flex-none px-4"
              style={({ pressed }) => [
                {
                  backgroundColor: displayOrders.length === 0 ? "#ccc" : "#00c853",
                  borderRadius: 12,
                  paddingVertical: 15,
                  justifyContent: "center",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text className="text-white font-bold text-center">📥</Text>
            </Pressable>

            <Pressable
              onPress={handleClear}
              className="flex-none px-4"
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: "#ff5252",
                  borderRadius: 12,
                  paddingVertical: 15,
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text className="text-red-500 font-bold text-center">🗑️</Text>
            </Pressable>
          </View>

          {/* Recent Orders */}
          <View className="bg-white rounded-3xl p-5">
            <Text className="text-base font-bold text-purple-700 mb-4">
              📝 السجل ({displayOrders.length})
            </Text>
            {displayOrders.length === 0 ? (
              <Text className="text-gray-500 text-center py-4">لا توجد طلبات في هذا التصفية</Text>
            ) : (
              displayOrders
                .slice(-10)
                .reverse()
                .map((order, index) => (
                  <View
                    key={index}
                    className="flex-row justify-between items-center py-3 border-b border-gray-200"
                  >
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold">#{order.id}</Text>
                      <Text className="text-gray-400 text-xs">{order.date}</Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`font-semibold ${
                          order.amount > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {order.status}
                      </Text>
                      <Text className="text-gray-600 text-xs">{order.amount} ر.س</Text>
                    </View>
                  </View>
                ))
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
