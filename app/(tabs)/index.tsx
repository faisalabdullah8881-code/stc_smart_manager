'use client';

import { useState, useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { ScreenContainer } from '@/components/screen-container';

interface Order {
  id: string;
  date: string;
  status: 'تم التوصيل' | 'تم الإلغاء';
  amount: number;
}

type FilterType = 'all' | 'delivered' | 'cancelled';

/**
 * دالة معالجة OCR باستخدام API خارجي موثوق
 * هذا الحل يتجنب مشكلة Web Workers في بيئة React Native
 */
const processImageWithOCR = async (base64Image: string): Promise<string> => {
  try {
    // استخدام API خدمة OCR مجانية وموثوقة
    const response = await fetch('https://api.ocr.space/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: 'K87899142372222',
        base64Image: base64Image,
        language: 'ara+eng',
      }),
    });

    if (!response.ok) {
      throw new Error('خطأ في الاتصال. تأكد من وجود اتصال بالإنترنت');
    }

    const data = await response.json();

    if (data.IsErroredOnProcessing) {
      throw new Error(
        'الصورة لا تحتوي على نصوص قابلة للقراءة. جرب صورة أخرى بجودة أعلى وإضاءة أفضل'
      );
    }

    return data.ParsedText || '';
  } catch (error: any) {
    if (error.message.includes('خطأ في الاتصال')) {
      throw error;
    }
    throw new Error(
      'الصورة لا تحتوي على نصوص قابلة للقراءة. جرب صورة أخرى بجودة أعلى وإضاءة أفضل'
    );
  }
};

export default function HomeScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [goal] = useState(500);
  const COMMISSION = 28;

  // Load orders from AsyncStorage on mount
  useEffect(() => {
    const loadOrders = async () => {
      try {
        const saved = await AsyncStorage.getItem('stc_pro_data_v2');
        if (saved) {
          setOrders(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Error loading orders:', err);
      }
    };
    loadOrders();
  }, []);

  // Save orders to AsyncStorage whenever they change
  useEffect(() => {
    const saveOrders = async () => {
      try {
        await AsyncStorage.setItem('stc_pro_data_v2', JSON.stringify(orders));
      } catch (err) {
        console.error('Error saving orders:', err);
      }
    };
    saveOrders();
  }, [orders]);

  /**
   * استخراج بيانات الطلبات من النص المستخرج من الصورة
   * مع فحص ذكي لحالة كل طلب بناءً على السطر المتعلق به فقط (relatedLine)
   */
  const extractOrderData = (text: string): Order[] => {
    // التحقق من أن النص يحتوي على محتوى
    if (!text || text.trim().length === 0) {
      throw new Error('الصورة لا تحتوي على نصوص قابلة للقراءة');
    }

    // تنظيف النص بإزالة علامات التشكيل والحركات العربية
    const cleanText = text.replace(/[\u064B-\u065F]/g, '');

    // استخراج أرقام الطلبات (8 أرقام)
    const ids = cleanText.match(/\d{8}/g) || [];

    if (ids.length === 0) {
      throw new Error('لم يتم العثور على أرقام طلبات (8 أرقام) في الصورة');
    }

    const today = new Date().toISOString().split('T')[0];
    const lines = cleanText.split('\n');

    // معالجة كل رقم طلب
    return ids.map((id) => {
      // البحث عن السطر الفعلي الذي يحتوي على رقم الطلب
      const relatedLine = lines.find((l) => l.includes(id)) || '';

      /**
       * فحص ذكي بناءً على الكلمات الدلالية في السطر المتعلق برقم الطلب فقط
       * الكلمات المدعومة: توصيل، تم، مكتمل، delivered، completed
       */
      const isDelivered =
        relatedLine.toLowerCase().includes('توصيل') ||
        relatedLine.toLowerCase().includes('تم') ||
        relatedLine.toLowerCase().includes('مكتمل') ||
        relatedLine.toLowerCase().includes('delivered') ||
        relatedLine.toLowerCase().includes('completed');

      return {
        id,
        date: today,
        status: isDelivered ? 'تم التوصيل' : 'تم الإلغاء',
        amount: isDelivered ? COMMISSION : 0,
      };
    });
  };

  /**
   * معالجة رفع الصورة
   */
  const handleFileUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLoading(true);

        try {
          // معالجة الصورة باستخدام OCR API
          const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
          const extractedText = await processImageWithOCR(base64Image);

          // استخراج بيانات الطلبات
          const newOrders = extractOrderData(extractedText);

          // استخدام Set لمنع التكرار
          const existingIds = new Set(orders.map((o) => o.id));
          const uniqueNew = newOrders.filter((o) => !existingIds.has(o.id));

          if (uniqueNew.length === 0 && newOrders.length > 0) {
            Alert.alert(
              'تنبيه',
              'جميع الطلبات الموجودة في هذه الصورة مسجلة مسبقاً! 📑'
            );
          } else if (uniqueNew.length > 0) {
            setOrders((prev) => [...prev, ...uniqueNew]);
            Alert.alert(
              'نجاح',
              `تم إضافة ${uniqueNew.length} طلب جديد بنجاح! ✅`
            );
          }
        } catch (err: any) {
          Alert.alert('خطأ', err.message || 'حدث خطأ في معالجة الصورة');
        }
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('خطأ', 'حدث خطأ في اختيار الصورة');
    } finally {
      setLoading(false);
    }
  };

  /**
   * تصدير البيانات إلى CSV
   */
  const exportToCSV = async () => {
    try {
      const headers = 'رقم الطلب,التاريخ,الحالة,المبلغ\n';
      const rows = orders
        .map((o) => `${o.id},${o.date},${o.status},${o.amount}`)
        .join('\n');

      const csv = '\uFEFF' + headers + rows;
      const fileName = `STC_Orders_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(filePath);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      Alert.alert('خطأ', 'حدث خطأ في تصدير البيانات');
    }
  };

  /**
   * حذف طلب محدد
   */
  const deleteOrder = (id: string) => {
    Alert.alert('تأكيد', 'هل تريد حذف هذا الطلب؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        onPress: () => {
          setOrders((prev) => prev.filter((o) => o.id !== id));
        },
        style: 'destructive',
      },
    ]);
  };

  /**
   * تبديل حالة الطلب
   */
  const toggleOrderStatus = (id: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status:
                o.status === 'تم التوصيل' ? 'تم الإلغاء' : 'تم التوصيل',
              amount:
                o.status === 'تم التوصيل' ? 0 : COMMISSION,
            }
          : o
      )
    );
  };

  /**
   * مسح جميع الطلبات
   */
  const clearAllOrders = () => {
    Alert.alert('تأكيد', 'هل تريد مسح جميع الطلبات؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'مسح',
        onPress: () => {
          setOrders([]);
        },
        style: 'destructive',
      },
    ]);
  };

  // حساب الإحصائيات من مصفوفة البيانات الأصلية
  const todayEarnings = orders
    .filter((o) => o.date === new Date().toISOString().split('T')[0])
    .reduce((sum, o) => sum + o.amount, 0);

  const totalEarnings = orders.reduce((sum, o) => sum + o.amount, 0);
  const deliveredCount = orders.filter(
    (o) => o.status === 'تم التوصيل'
  ).length;

  // تطبيق الفلترة
  const displayOrders = orders.filter((o) => {
    if (filter === 'delivered') return o.status === 'تم التوصيل';
    if (filter === 'cancelled') return o.status === 'تم الإلغاء';
    return true;
  });

  const progress = goal > 0 ? (todayEarnings / goal) * 100 : 0;

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* بطاقة الهدف اليومي */}
          <View className="bg-primary rounded-2xl p-4">
            <Text className="text-white text-sm mb-2">هدف اليوم 🎯</Text>
            <Text className="text-white text-2xl font-bold">
              {todayEarnings} / {goal} ريال
            </Text>
            <View className="bg-white/30 rounded-full h-2 mt-3 overflow-hidden">
              <View
                className="bg-white h-full"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </View>
          </View>

          {/* خيارات الفلترة */}
          <View className="flex-row gap-2">
            {(['all', 'delivered', 'cancelled'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                className={`flex-1 py-2 px-3 rounded-lg ${
                  filter === f ? 'bg-primary' : 'bg-surface'
                }`}
              >
                <Text
                  className={`text-center text-sm font-semibold ${
                    filter === f ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {f === 'all'
                    ? 'الكل'
                    : f === 'delivered'
                      ? 'موصلة'
                      : 'ملغاة'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ملخص الأرباح والطلبات */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-lg p-3">
              <Text className="text-muted text-xs">الموصلة</Text>
              <Text className="text-foreground text-lg font-bold">
                {deliveredCount}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-lg p-3">
              <Text className="text-muted text-xs">إجمالي الأرباح</Text>
              <Text className="text-foreground text-lg font-bold">
                {totalEarnings} ريس
              </Text>
            </View>
          </View>

          {/* الأزرار الرئيسية */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleFileUpload}
              disabled={loading}
              className="flex-1 bg-primary rounded-lg py-3 flex-row items-center justify-center gap-2"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text className="text-white text-sm font-semibold">رفع</Text>
                  <Text className="text-white">📸</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={exportToCSV}
              disabled={orders.length === 0}
              className="flex-1 bg-success rounded-lg py-3 flex-row items-center justify-center gap-2"
            >
              <Text className="text-white text-sm font-semibold">تصدير</Text>
              <Text className="text-white">📥</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={clearAllOrders}
              disabled={orders.length === 0}
              className="flex-1 bg-error rounded-lg py-3 flex-row items-center justify-center gap-2"
            >
              <Text className="text-white text-sm font-semibold">مسح</Text>
              <Text className="text-white">🗑️</Text>
            </TouchableOpacity>
          </View>

          {/* قائمة الطلبات */}
          <View>
            <Text className="text-foreground font-semibold mb-2">
              السجل ({displayOrders.length})
            </Text>
            {displayOrders.length === 0 ? (
              <Text className="text-muted text-center py-8">
                لا توجد طلبات في هذه الفئة
              </Text>
            ) : (
              displayOrders.map((order) => (
                <View
                  key={order.id}
                  className="bg-surface rounded-lg p-3 mb-2 flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">
                      {order.id}
                    </Text>
                    <View className="flex-row gap-2 mt-1">
                      <TouchableOpacity
                        onPress={() => toggleOrderStatus(order.id)}
                        className={`px-2 py-1 rounded ${
                          order.status === 'تم التوصيل'
                            ? 'bg-success'
                            : 'bg-error'
                        }`}
                      >
                        <Text className="text-white text-xs font-semibold">
                          {order.status}
                        </Text>
                      </TouchableOpacity>
                      <Text className="text-muted text-xs">
                        {order.amount} ريال
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteOrder(order.id)}
                    className="p-2"
                  >
                    <Text className="text-error text-lg">🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
