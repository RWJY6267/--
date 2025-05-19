// 初始化畫布
const canvas = new fabric.Canvas('canvas', {
    isDrawingMode: true,
    width: window.innerWidth * 0.75,
    height: window.innerHeight - 80
});

// 定義工具按鈕和控制元素
const brushBtn = document.getElementById('brush');
const eraserBtn = document.getElementById('eraser');
const fillBtn = document.getElementById('fill');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const generateBtn = document.getElementById('generateLineArt');
const categorySelect = document.getElementById('categorySelect');
const clearBtn = document.getElementById('clear');
const undoBtn = document.getElementById('undo');
const saveBtn = document.getElementById('save');
const loading = document.getElementById('loading');

// 歷史記錄
let history = [];
let currentState = null;

// 初始化畫布設定
canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
canvas.freeDrawingBrush.color = colorPicker.value;
canvas.freeDrawingBrush.width = parseInt(brushSize.value);

// 從配置檔案取得 API 金鑰
const UNSPLASH_ACCESS_KEY = CONFIG.UNSPLASH_ACCESS_KEY;

// 工具按鈕事件
brushBtn.addEventListener('click', () => {
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = colorPicker.value;
    canvas.freeDrawingBrush.width = parseInt(brushSize.value);
    updateToolButtons(brushBtn);
});

eraserBtn.addEventListener('click', () => {
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
    canvas.freeDrawingBrush.width = parseInt(brushSize.value);
    updateToolButtons(eraserBtn);
});

fillBtn.addEventListener('click', () => {
    canvas.isDrawingMode = false;
    updateToolButtons(fillBtn);
    // 啟用填充模式
    canvas.on('mouse:down', fillArea);
});

// 更新工具按鈕狀態
function updateToolButtons(activeBtn) {
    [brushBtn, eraserBtn, fillBtn].forEach(btn => {
        btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
    
    // 如果不是填充工具，移除填充事件監聽器
    if (activeBtn !== fillBtn) {
        canvas.off('mouse:down', fillArea);
    }
}

// 顏色和筆刷大小變更事件
colorPicker.addEventListener('change', (e) => {
    if (canvas.freeDrawingBrush instanceof fabric.PencilBrush) {
        canvas.freeDrawingBrush.color = e.target.value;
    }
});

brushSize.addEventListener('change', (e) => {
    canvas.freeDrawingBrush.width = parseInt(e.target.value);
});

// 生成線稿
generateBtn.addEventListener('click', async () => {
    try {
        loading.style.display = 'flex';
        const category = categorySelect.value;
        console.log('開始獲取圖片，類別:', category);
        
        const imageUrl = await getRandomImage(category);
        console.log('成功獲取圖片:', imageUrl);
        
        await generateLineArt(imageUrl);
        console.log('線稿生成完成');
        saveToHistory();
    } catch (error) {
        console.error('錯誤詳細資訊:', error);
        alert('生成線稿時發生錯誤：' + error.message);
    } finally {
        loading.style.display = 'none';
    }
});

// 從 Unsplash 獲取隨機圖片
async function getRandomImage(category) {
    if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === '在此輸入您的 Unsplash API 金鑰') {
        throw new Error('請先在 config.js 中設定 Unsplash API 金鑰');
    }
    
    console.log('正在發送 Unsplash API 請求...');
    const url = `https://api.unsplash.com/photos/random?query=${category}&orientation=landscape`;
    console.log('請求 URL:', url);
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Unsplash API 錯誤回應:', errorText);
        throw new Error(`無法獲取圖片 (狀態碼: ${response.status})`);
    }
    
    const data = await response.json();
    return data.urls.regular;
}

// 生成線稿
async function generateLineArt(imageUrl) {
    return new Promise((resolve, reject) => {
        console.log('開始載入圖片...');
        console.log('圖片 URL:', imageUrl);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            try {
                console.log('圖片載入成功');
                console.log('原始圖片尺寸:', img.width, 'x', img.height);

                // 調整圖片大小以適應畫布
                const scale = Math.min(
                    (canvas.width * 0.8) / img.width,
                    (canvas.height * 0.8) / img.height
                );
                console.log('計算的縮放比例:', scale);

                // 創建臨時畫布進行圖像處理
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = Math.floor(img.width * scale);
                tempCanvas.height = Math.floor(img.height * scale);
                console.log('臨時畫布尺寸:', tempCanvas.width, 'x', tempCanvas.height);

                // 清除主畫布
                canvas.clear();

                // 使用高品質的圖片縮放
                tempCtx.imageSmoothingEnabled = true;
                tempCtx.imageSmoothingQuality = 'high';

                // 繪製並處理圖片
                tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
                console.log('已繪製原始圖片到臨時畫布');

                try {
                    // 轉換為灰度
                    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    console.log('已獲取圖片數據');
                    
                    // 轉換為灰度
                    const grayscaleData = convertToGrayscale(imageData);
                    tempCtx.putImageData(grayscaleData, 0, 0);
                    console.log('已完成灰度轉換');

                    // 增強對比度
                    const contrastData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const enhancedData = adjustContrast(contrastData, 50);
                    tempCtx.putImageData(enhancedData, 0, 0);
                    console.log('已完成對比度增強');

                    // 平滑處理
                    const smoothData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const smoothedData = smoothImage(smoothData);
                    tempCtx.putImageData(smoothedData, 0, 0);
                    console.log('已完成平滑處理');

                    // 應用邊緣檢測
                    console.log('開始邊緣檢測...');
                    const edgeData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const edges = detectEdges(edgeData);
                    tempCtx.putImageData(edges, 0, 0);
                    console.log('已完成邊緣檢測');

                    // 將處理後的圖像添加到主畫布
                    fabric.Image.fromURL(tempCanvas.toDataURL(), function(processedImg) {
                        if (!processedImg) {
                            console.error('無法創建 fabric.Image 物件');
                            reject(new Error('圖片處理失敗'));
                            return;
                        }

                        processedImg.set({
                            left: (canvas.width - tempCanvas.width) / 2,
                            top: (canvas.height - tempCanvas.height) / 2
                        });
                        
                        canvas.add(processedImg);
                        canvas.renderAll();
                        console.log('線稿生成完成');
                        resolve();
                    });
                } catch (err) {
                    console.error('圖片處理過程中發生錯誤:', err);
                    reject(err);
                }
            } catch (err) {
                console.error('onload 處理過程中發生錯誤:', err);
                reject(err);
            }
        };

        img.onerror = function(err) {
            console.error('圖片載入錯誤:', err);
            reject(new Error('圖片載入失敗，請確認圖片網址是否正確且可存取'));
        };

        img.src = imageUrl;
    });
}

// 平滑圖像
function smoothImage(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outputData = output.data;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            // 計算 3x3 區域的平均值
            let sumR = 0, sumG = 0, sumB = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const currentIdx = ((y + dy) * width + (x + dx)) * 4;
                    sumR += data[currentIdx];
                    sumG += data[currentIdx + 1];
                    sumB += data[currentIdx + 2];
                }
            }
            
            // 設置平均值
            outputData[idx] = sumR / 9;
            outputData[idx + 1] = sumG / 9;
            outputData[idx + 2] = sumB / 9;
            outputData[idx + 3] = 255;
        }
    }

    return output;
}

// 轉換為灰度（優化版本）
function convertToGrayscale(imageData) {
    const data = imageData.data;
    const output = new ImageData(imageData.width, imageData.height);
    const outputData = output.data;

    for (let i = 0; i < data.length; i += 4) {
        // 使用更準確的灰度轉換公式 (R * 0.299 + G * 0.587 + B * 0.114)
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        outputData[i] = gray;
        outputData[i + 1] = gray;
        outputData[i + 2] = gray;
        outputData[i + 3] = 255;
    }

    return output;
}

// 調整對比度（優化版本）
function adjustContrast(imageData, contrast) {
    const data = imageData.data;
    const output = new ImageData(imageData.width, imageData.height);
    const outputData = output.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
        outputData[i] = clamp(factor * (data[i] - 128) + 128);
        outputData[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
        outputData[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
        outputData[i + 3] = 255;
    }

    return output;
}

// 限制值在 0-255 範圍內
function clamp(value) {
    return Math.min(255, Math.max(0, value));
}

// Sobel 邊緣檢測（優化版本）
function detectEdges(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const output = new ImageData(width, height);
    const outputData = output.data;

    // 調整參數
    const threshold = 15;    // 進一步降低閾值
    const multiplier = 2.5;  // 增加線條強度

    // Sobel 運算子矩陣
    const sobelX = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ];
    const sobelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
    ];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx = 0;
            let gy = 0;

            // 應用 Sobel 運算子
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const idx = ((y + i) * width + (x + j)) * 4;
                    const val = data[idx];
                    gx += val * sobelX[i + 1][j + 1];
                    gy += val * sobelY[i + 1][j + 1];
                }
            }

            // 計算梯度大小
            const idx = (y * width + x) * 4;
            let magnitude = Math.sqrt(gx * gx + gy * gy) * multiplier;
            
            // 應用閾值和反轉顏色
            const value = magnitude > threshold ? 0 : 255;

            // 設置像素值
            outputData[idx] = value;
            outputData[idx + 1] = value;
            outputData[idx + 2] = value;
            outputData[idx + 3] = 255;
        }
    }

    return output;
}

// 填充區域
function fillArea(event) {
    const pointer = canvas.getPointer(event.e);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const startPos = (Math.floor(pointer.y) * canvas.width + Math.floor(pointer.x)) * 4;

    // 執行填充
    floodFill(imageData, startPos, colorPicker.value);
    ctx.putImageData(imageData, 0, 0);
    
    // 更新畫布
    canvas.renderAll();
    saveToHistory();
}

// 填充演算法
function floodFill(imageData, startPos, fillColor) {
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const stack = [startPos];
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const fillRGB = hexToRgb(fillColor);

    while (stack.length > 0) {
        const pos = stack.pop();
        const x = (pos / 4) % width;
        const y = Math.floor((pos / 4) / width);

        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (!matchesStart(data, pos, startR, startG, startB)) continue;

        data[pos] = fillRGB.r;
        data[pos + 1] = fillRGB.g;
        data[pos + 2] = fillRGB.b;
        data[pos + 3] = 255;

        stack.push(pos + 4);  // right
        stack.push(pos - 4);  // left
        stack.push(pos + width * 4);  // down
        stack.push(pos - width * 4);  // up
    }
}

// 檢查顏色是否匹配
function matchesStart(data, pos, startR, startG, startB) {
    return data[pos] === startR &&
           data[pos + 1] === startG &&
           data[pos + 2] === startB;
}

// 將十六進制顏色轉換為 RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// 儲存歷史記錄
function saveToHistory() {
    const json = JSON.stringify(canvas.toJSON());
    history.push(json);
    if (history.length > 20) history.shift(); // 限制歷史記錄數量
}

// 復原功能
undoBtn.addEventListener('click', () => {
    if (history.length > 0) {
        const previousState = history.pop();
        canvas.loadFromJSON(previousState, () => {
            canvas.renderAll();
        });
    }
});

// 清除畫布
clearBtn.addEventListener('click', () => {
    if (confirm('確定要清除所有塗色嗎？')) {
        canvas.clear();
        saveToHistory();
    }
});

// 儲存作品
saveBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = '我的塗色作品.png';
    link.href = canvas.toDataURL();
    link.click();
});

// 視窗大小改變時調整畫布大小
window.addEventListener('resize', () => {
    canvas.setWidth(window.innerWidth * 0.75);
    canvas.setHeight(window.innerHeight - 80);
    canvas.renderAll();
});