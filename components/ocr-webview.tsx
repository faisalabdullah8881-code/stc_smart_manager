import React, { useRef, useCallback } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface OCRWebViewProps {
  onOCRComplete: (text: string) => void;
  onOCRError: (error: string) => void;
}

export const OCRWebView = React.forwardRef<WebView, OCRWebViewProps>(
  ({ onOCRComplete, onOCRError }, ref) => {
    const handleMessage = useCallback((event: any) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        
        if (message.type === 'success') {
          onOCRComplete(message.data);
        } else if (message.type === 'error') {
          onOCRError(message.error || 'خطأ في معالجة الصورة');
        } else if (message.type === 'ready') {
          console.log('OCR WebView is ready');
        }
      } catch (err) {
        console.error('Error parsing WebView message:', err);
        onOCRError('خطأ في معالجة النتيجة');
      }
    }, [onOCRComplete, onOCRError]);

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
      <View style={{ width: 0, height: 0, display: 'none' }}>
        <WebView
          ref={ref}
          source={{ html: htmlContent }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          scalesPageToFit={false}
          style={{ width: 0, height: 0 }}
          startInLoadingState={false}
          originWhitelist={['*']}
          mixedContentMode="always"
        />
      </View>
    );
  }
);

OCRWebView.displayName = 'OCRWebView';
