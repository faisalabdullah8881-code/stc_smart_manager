import React, { useRef, useCallback } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface OCRWebViewProps {
  onTextExtracted: (text: string) => void;
  onError: (error: string) => void;
}

export const OCRWebView = React.forwardRef<WebView, OCRWebViewProps>(
  ({ onTextExtracted, onError }, ref) => {
    const webViewRef = useRef<WebView>(null);

    const handleMessage = useCallback((event: any) => {
      try {
        const { type, data, error } = JSON.parse(event.nativeEvent.data);
        
        if (type === 'success') {
          onTextExtracted(data);
        } else if (type === 'error') {
          onError(error || 'حدث خطأ في معالجة الصورة');
        }
      } catch (err) {
        onError('خطأ في معالجة الرد من WebView');
      }
    }, [onTextExtracted, onError]);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.3/dist/tesseract.min.js"></script>
        <style>
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <script>
          let worker = null;

          async function initWorker() {
            if (!worker) {
              worker = await Tesseract.createWorker(['ara', 'eng']);
            }
            return worker;
          }

          window.processImage = async function(base64Data) {
            try {
              const w = await initWorker();
              const result = await w.recognize(base64Data);
              const text = result.data.text;
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'success',
                data: text
              }));
            } catch (error) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                error: error.message || 'خطأ في معالجة الصورة'
              }));
            }
          };

          window.terminateWorker = async function() {
            if (worker) {
              await worker.terminate();
              worker = null;
            }
          };
        </script>
      </body>
      </html>
    `;

    return (
      <View style={{ width: 0, height: 0, display: 'none' }}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          onMessage={handleMessage}
          style={{ width: 0, height: 0 }}
          javaScriptEnabled={true}
          scalesPageToFit={false}
        />
      </View>
    );
  }
);

OCRWebView.displayName = 'OCRWebView';
