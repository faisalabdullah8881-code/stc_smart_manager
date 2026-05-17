'use client';

import { useState, useEffect, useRef } from 'react';
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
import { WebView } from 'react-native-webview';

import { ScreenContainer } from '@/components/screen-container';

interface Order {
  id: string;
  date: string;
  status: 'تم التوصيل' | 'تم الإلغاء';
  amount: number;
}

type FilterType = 'all' | 'delivered' | 'cancelled';

export default function HomeScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [goal] = useState(500);
  const COMMISSION = 28;
  const webViewRef = useRef<WebView>(null);

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
   * مع فحص ذكي وتكيفي لحالة كل طلب
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
    const lowerFullText = cleanText.toLowerCase();

    // معالجة كل رقم طلب
    return ids.map((id) => {
      // البحث عن السطر الفعلي الذي يحتوي على رقم الطلب
      const relatedLine = lines.find((l) => l.includes(id)) || '';
      const lowerLine = relatedLine.toLowerCase();

      /**
       * فحص ذكي وتكيفي بناءً على الكلمات الدلالية:
       * 1. فحص السطر المتعلق برقم الطلب (relatedLine) أولاً
       * 2. فحص احتياطي في النص الكامل (fullText) إذا كان السطر غامضاً
       * 3. التأكد من عدم وجود كلمات الإلغاء الصريحة
       */
      const hasDeliveryKeywords =
        lowerLine.includes('توصيل') ||
        lowerLine.includes('تم') ||
        lowerLine.includes('مكتمل') ||
        lowerLine.includes('delivered') ||
        lowerLine.includes('completed');

      const hasCancelKeywords =
        lowerLine.includes('ملغي') ||
        lowerLine.includes('إلغاء') ||
        lowerLine.includes('cancelled') ||
        lowerLine.includes('cancel');

      const hasFullTextDeliveryPhrases =
        lowerFullText.includes('تم التوصيل') ||
        lowerFullText.includes('توصيل ناجح');

      // القرار النهائي: إذا كان هناك كلمات توصيل أو عبارات توصيل في النص الكامل
      // وليس هناك كلمات إلغاء صريحة، فهو موصل
      const isDelivered =
        (hasDeliveryKeywords || hasFullTextDeliveryPhrases) && !hasCancelKeywords;

      return {
        id,
        date: today,
        status: isDelivered ? 'تم التوصيل' : 'تم الإلغاء',
        amount: isDelivered ? COMMISSION : 0,
      };
    });
  };

  /**
   * معالجة رسالة من WebView
   */
  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'success') {
        const extractedText = message.data;

        try {
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
      } else if (message.type === 'error') {
        Alert.alert('خطأ', message.error || 'حدث خطأ في معالجة الصورة');
      }

      setLoading(false);
    } catch (err) {
      console.error('Error parsing WebView message:', err);
      Alert.alert('خطأ', 'حدث خطأ في معالجة النتيجة');
      setLoading(false);
    }
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

        // تأخير صغير للسماح لـ WebView بمعالجة الصورة
        setTimeout(() => {
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(
              `window.processImage('data:image/jpeg;base64,${result.assets[0].base64}');`
            );
          }
        }, 500);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('خطأ', 'حدث خطأ في اختيار الصورة');
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

  // حساب الإحصائيات من مصفوفة البيانات الأصلية (ليس من displayOrders)
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

  // HTML content for WebView with Tesseract.js
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.3/dist/tesseract.min.js"></script>
      <style>
        body { margin: 0; padding: 0; background: transparent; }
        html { margin: 0; padding: 0; }
      </style>
    </head>
    <body>
      <script>
        let worker = null;
        let isProcessing = false;

        async function initWorker() {
          if (!worker) {
            try {
              worker = await Tesseract.createWorker(['ara', 'eng']);
              console.log('Worker initialized successfully');
            } catch (error) {
              console.error('Failed to initialize worker:', error);
              throw error;
            }
          }
          return worker;
        }

        window.processImage = async function(base64Data) {
          if (isProcessing) {
            console.warn('Already processing an image');
            return;
          }

          isProcessing = true;
          try {
            console.log('Starting OCR processing...');
            const w = await initWorker();
            
            const result = await w.recognize(base64Data);
            const text = result.data.text;
            
            console.log('OCR completed successfully');
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'success',
              data: text
            }));
          } catch (error) {
            console.error('OCR error:', error);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              error: error.message || 'خطأ في معالجة الصورة'
            }));
          } finally {
            isProcessing = false;
          }
        };

        window.terminateWorker = async function() {
          if (worker) {
            try {
              await worker.terminate();
              worker = null;
              console.log('Worker terminated');
            } catch (error) {
              console.error('Error terminating worker:', error);
            }
          }
        };

        // Signal that the page is ready
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ready'
        }));
      </script>
    </body>
    </html>
  `;

  return (
    <ScreenContainer className="p-4">
      {/* Hidden WebView for OCR processing */}
      {Platform.OS !== 'web' && (
        <View style={{ width: 0, height: 0, display: 'none' }}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            scalesPageToFit={false}
            style={{ width: 0, height: 0 }}
            startInLoadingState={false}
            originWhitelist={['*']}
            mixedContentMode="always"
          />
        </View>
      )}

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* Goal Card */}
          <View className="bg-primary rounded-2xl p-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white text-sm font-semibold">
                هدف اليوم
              </Text>
              <Text className="text-white text-xs">🎯</Text>
            </View>
            <Text className="text-white text-2xl font-bold mb-3">
              {todayEarnings} / {goal} ريال
            </Text>
            <View className="bg-white/20 rounded-full h-2 overflow-hidden">
              <View
                className="bg-white h-full"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </View>
            <Text className="text-white text-xs mt-2">
              {Math.round(progress)}% من الهدف
            </Text>
          </View>

          {/* Filter Tabs */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setFilter('all')}
              className={`flex-1 py-3 px-4 rounded-lg ${
                filter === 'all' ? 'bg-primary' : 'bg-surface border border-border'
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  filter === 'all' ? 'text-white' : 'text-foreground'
                }`}
              >
                الكل
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter('delivered')}
              className={`flex-1 py-3 px-4 rounded-lg ${
                filter === 'delivered'
                  ? 'bg-success'
                  : 'bg-surface border border-border'
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  filter === 'delivered' ? 'text-white' : 'text-foreground'
                }`}
              >
                موصلة
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter('cancelled')}
              className={`flex-1 py-3 px-4 rounded-lg ${
                filter === 'cancelled'
                  ? 'bg-error'
                  : 'bg-surface border border-border'
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  filter === 'cancelled' ? 'text-white' : 'text-foreground'
                }`}
              >
                ملغاة
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-muted text-xs mb-1">إجمالي الأرباح</Text>
              <Text className="text-foreground text-xl font-bold">
                {totalEarnings} ريس
              </Text>
            </View>

            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-muted text-xs mb-1">الموصلة</Text>
              <Text className="text-foreground text-xl font-bold">
                {deliveredCount}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleFileUpload}
              disabled={loading}
              className="flex-1 bg-primary py-3 px-4 rounded-lg flex-row items-center justify-center gap-2"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text className="text-white font-semibold">رفع 📸</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={exportToCSV}
              disabled={orders.length === 0}
              className="flex-1 bg-success py-3 px-4 rounded-lg flex-row items-center justify-center gap-2"
            >
              <Text className="text-white font-semibold">تصدير 📥</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={clearAllOrders}
              disabled={orders.length === 0}
              className="flex-1 bg-error py-3 px-4 rounded-lg flex-row items-center justify-center gap-2"
            >
              <Text className="text-white font-semibold">مسح 🗑️</Text>
            </TouchableOpacity>
          </View>

          {/* Orders List */}
          <View>
            <Text className="text-foreground font-semibold mb-3">
              السجل ({displayOrders.length})
            </Text>

            {displayOrders.length === 0 ? (
              <View className="bg-surface rounded-xl p-8 border border-border items-center">
                <Text className="text-muted text-center">
                  لا توجد طلبات في هذه الفئة
                </Text>
              </View>
            ) : (
              displayOrders.map((order) => (
                <View
                  key={order.id}
                  className="bg-surface rounded-xl p-4 mb-3 border border-border flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <Text className="text-foreground font-bold">
                      {order.id}
                    </Text>
                    <Text className="text-muted text-xs">{order.date}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => toggleOrderStatus(order.id)}
                    className={`px-3 py-1 rounded-full ${
                      order.status === 'تم التوصيل'
                        ? 'bg-success/20'
                        : 'bg-error/20'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        order.status === 'تم التوصيل'
                          ? 'text-success'
                          : 'text-error'
                      }`}
                    >
                      {order.status}
                    </Text>
                  </TouchableOpacity>

                  <Text className="text-foreground font-bold mx-3">
                    {order.amount}
                  </Text>

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
