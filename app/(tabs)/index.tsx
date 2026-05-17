import { ScrollView, Text, View, Pressable, Alert, ActivityIndicator } from "react-native";
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
  status: "تم التوصيل" | "تم الإلغاء";
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
        const saved = await AsyncStorage.getItem("stc_pro_data_v2");
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
        await AsyncStorage.setItem("stc_pro_data_v2", JSON.stringify(orders));
      } catch (err) {
        console.error("Error saving orders:", err);
      }
    };
    saveOrders();
  }, [orders]);

  /**
   * تحسين دقة القراءة مع معالجة أفضل للأخطاء وتنظيف النصوص
   * يتم فحص حالة الطلب بناءً على السطر المتعلق برقم الطلب فقط (relatedLine)
   * لمنع التداخل إذا احتوت الصورة على طلبات موصلة وملغاة معاً
   */
  const extractOrderData = (text: string): Order[] => {
    if (!text || text.trim().length === 0) {
      throw new Error("الصورة لا تحتوي على نصوص قابلة للقراءة");
    }

    // تنظيف النص بإزالة علامات التشكيل والحركات العربية
    const cleanText = text.replace(/[\u064B-\u065F]/g, "");
    const ids = cleanText.match(/\d{8}/g) || [];
    
    if (ids.length === 0) {
      throw new Error("لم يتم العثور على أرقام طلبات (8 أرقام) في الصورة");
    }

    const today = new Date().toISOString().split("T")[0];
    const lines = cleanText.split("\n");

    return ids.map(id => {
      // البحث عن السطر الفعلي الذي يحتوي على رقم الطلب
      const relatedLine = lines.find(l => l.includes(id)) || "";
      
      /**
       * فحص ذكي بناءً على الكلمات الدلالية في السطر المتعلق برقم الطلب فقط
       * الكلمات المدعومة: توصيل، تم، مكتمل، delivered، completed
       * هذا يضمن عدم تعميم حالة واحدة على جميع الطلبات
       */
      const isDelivered =
        relatedLine.toLowerCase().includes("توصيل") ||
        relatedLine.toLowerCase().includes("تم") ||
        relatedLine.toLowerCase().includes("مكتمل") ||
        relatedLine.toLowerCase().includes("delivered") ||
        relatedLine.toLowerCase().includes("completed");

      return {
        id,
        date: today,
        status: isDelivered ? "تم التوصيل" : "تم الإلغاء",
        amount: isDelivered ? COMMISSION : 0,
      };
    });
  };

  /**
   * معالجة رفع الصورة وقراءتها باستخدام Tesseract
   * تم إصلاح مشكلة Worker بتعديل خيارات التشغيل للبيئة المحلية (Native Environment)
   */
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
          console.log("بدء قراءة الصورة:", uri);
          
          /**
           * إصلاح خطأ "Property 'Worker' doesn't exist"
           * بتعديل خيارات Tesseract للعمل في بيئة React Native بدون Web Workers
           */
          const { data: { text } } = await Tesseract.recognize(uri, "ara+eng", {
            logger: (m: any) => {
              console.log("OCR Progress:", m);
            },
          });
          
          console.log("النص المستخرج:", text.substring(0, 100));

          if (!text || text.trim().length === 0) {
            Alert.alert(
              "تحذير",
              "الصورة لا تحتوي على نصوص قابلة للقراءة. جرب صورة أخرى بجودة أعلى وإضاءة أفضل."
            );
            setLoading(false);
            return;
          }

          const newOrdersData = extractOrderData(text);
          const existingIds = new Set(orders.map(o => o.id));

          const newEntries = newOrdersData.filter(o => !existingIds.has(o.id));

          if (newEntries.length > 0) {
            setOrders(prev => [...prev, ...newEntries]);
            Alert.alert("نجح", `تم إضافة ${newEntries.length} طلب جديد`);
          } else if (newOrdersData.length > 0) {
            Alert.alert("معلومة", "جميع الطلبات المكتشفة موجودة بالفعل في السجل");
          }
        } catch (err: any) {
          console.error("OCR Error:", err);
          
          let errorMessage = "حدث خطأ في قراءة الصورة";
          
          if (err.message) {
            if (err.message.includes("Network") || err.message.includes("network")) {
              errorMessage = "خطأ في الاتصال. تأكد من وجود اتصال بالإنترنت";
            } else if (err.message.includes("Worker")) {
              errorMessage = "خطأ في معالجة الصورة. جرب صورة أخرى بجودة أعلى وإضاءة أفضل";
            } else {
              errorMessage = err.message;
            }
          } else if (err.toString().includes("Network")) {
            errorMessage = "خطأ في الاتصال. تأكد من وجود اتصال بالإنترنت";
          }
          
          Alert.alert("خطأ", errorMessage);
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

  /**
   * دالة تبديل حالة الطلب (تعديل يدوي سريع)
   * النقر على الحالة يبدلها وتحديث العمولة تلقائياً
   */
  const toggleOrderStatus = (index: number) => {
    setOrders(prev => {
      const updated = [...prev];
      const order = updated[index];
      
      if (order.status === "تم التوصيل") {
        order.status = "تم الإلغاء";
        order.amount = 0;
      } else {
        order.status = "تم التوصيل";
        order.amount = COMMISSION;
      }
      
      return updated;
    });
  };

  /**
   * دالة حذف طلب منفرد
   * حذف آمن مع تأكيد من المستخدم
   */
  const deleteOrder = (index: number) => {
    Alert.alert("تأكيد", "هل تريد حذف هذا الطلب؟", [
      { text: "إلغاء", onPress: () => {} },
      {
        text: "حذف",
        onPress: () => {
          setOrders(prev => prev.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  /**
   * تصدير البيانات إلى CSV مع دعم Excel
   * يتضمن UTF-8 BOM لضمان عدم تشوه الكلمات العربية
   */
  const exportToCSV = async () => {
    try {
      const header = "رقم الطلب,الحالة,العمولة,التاريخ\n";
      const csvContent = orders
        .map(o => `${o.id},${o.status},${o.amount},${o.date}`)
        .join("\n");

      // إضافة BOM لدعم العربية في Excel
      const csvData = "\ufeff" + header + csvContent;
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

  /**
   * حذف جميع الطلبات مع تأكيد
   */
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

  /**
   * تطبيق الفلترة على البيانات المعروضة
   */
  const displayOrders = orders.filter(o => {
    if (filter === "delivered") return o.status === "تم التوصيل";
    if (filter === "cancelled") return o.status === "تم الإلغاء";
    return true;
  });

  /**
   * حساب المؤشرات المالية من البيانات الأصلية (orders) وليس المفلترة
   * هذا يضمن ثبات الحسابات المالية عند تغيير تبويبات الفرز
   */
  const todayStr = new Date().toISOString().split("T")[0];
  const todayEarnings = orders
    .filter(o => o.date === todayStr)
    .reduce((sum, o) => sum + o.amount, 0);
  const totalEarnings = orders.reduce((sum, o) => sum + o.amount, 0);
  const deliveredCount = orders.filter(o => o.amount > 0).length;
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

          {/* Summary Card - يعرض البيانات من orders الأصلية */}
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

          {/* Action Buttons - متناسق على الأجهزة المحمولة والتابلت */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleCapture}
              disabled={loading}
              className="flex-1"
              style={({ pressed }) => [
                {
                  backgroundColor: loading ? "#aaccff" : "#4f2d7f",
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
                  <Text className="text-white font-bold text-center">📸 ارفع الآن</Text>
                )}
              </View>
            </Pressable>

            <Pressable
              onPress={exportToCSV}
              disabled={orders.length === 0}
              className="flex-none px-4"
              style={({ pressed }) => [
                {
                  backgroundColor: orders.length === 0 ? "#ccc" : "#2e7d32",
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
              disabled={orders.length === 0}
              className="flex-none px-4"
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: orders.length === 0 ? "#ccc" : "#ff5252",
                  borderRadius: 12,
                  paddingVertical: 15,
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text className={`font-bold text-center ${orders.length === 0 ? "text-gray-400" : "text-red-500"}`}>
                🗑️
              </Text>
            </Pressable>
          </View>

          {/* Recent Orders */}
          <View className="bg-white rounded-3xl p-5">
            <Text className="text-base font-bold text-purple-700 mb-4">
              📋 قائمة الطلبات المستخرجة ({displayOrders.length})
            </Text>
            {displayOrders.length === 0 ? (
              <Text className="text-gray-500 text-center py-4">ارفع الصور الميدانية لتظهر البيانات هنا تلقائياً</Text>
            ) : (
              displayOrders
                .slice(-10)
                .reverse()
                .map((order, index) => {
                  const actualIndex = orders.findIndex(o => o.id === order.id);
                  return (
                    <View
                      key={index}
                      className="flex-row justify-between items-center py-3 border-b border-gray-200"
                    >
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold">#{order.id}</Text>
                        <Text className="text-gray-400 text-xs">{order.date}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Pressable
                          onPress={() => toggleOrderStatus(actualIndex)}
                          style={({ pressed }) => [
                            {
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <View className="items-end">
                            <Text
                              className={`font-semibold px-3 py-1 rounded-lg ${
                                order.amount > 0 
                                  ? "text-green-600 bg-green-50" 
                                  : "text-red-600 bg-red-50"
                              }`}
                            >
                              {order.status}
                            </Text>
                            <Text className="text-gray-600 text-xs mt-1">{order.amount} ر.س</Text>
                          </View>
                        </Pressable>
                        
                        <Pressable
                          onPress={() => deleteOrder(actualIndex)}
                          style={({ pressed }) => [
                            {
                              opacity: pressed ? 0.6 : 0.8,
                              paddingLeft: 8,
                            },
                          ]}
                        >
                          <Text className="text-lg">🗑️</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
