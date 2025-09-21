// DOM要素の取得
const initialVelocityInput = document.getElementById('initialVelocity');
const accelerationInput = document.getElementById('acceleration');
const simSpeedInput = document.getElementById('simSpeed');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const objectImageInput = document.getElementById('objectImage');
const revertButton = document.getElementById('revertButton');
const timeDisplay = document.getElementById('timeDisplay');
const velocityDisplay = document.getElementById('velocityDisplay');
const positionDisplay = document.getElementById('positionDisplay');
const objectElement = document.getElementById('object');
const simulationArea = document.querySelector('.simulation-area');
const scaleMarksContainer = document.querySelector('.scale-marks');
const pathPlotsContainer = document.querySelector('.path-plots');
// ★ここから追加★
const dataTableContainer = document.getElementById('data-table-container');
// ★ここまで追加★

// 物理量の初期値と現在の値
let v0 = parseFloat(initialVelocityInput.value);
let a = parseFloat(accelerationInput.value);
let simSpeed = parseFloat(simSpeedInput.value);

let time = 0;
let velocity = v0;
let position = 0;

let lastPlotTime = 0;
const PLOT_TIME_INTERVAL_S = 1;

let animationFrameId = null;
let lastTimestamp = 0;

let isRunning = false;

const SIM_AREA_WIDTH_PX = 1200;
const TOTAL_SIM_DISTANCE_M = 2000;
const SCALE_FACTOR = SIM_AREA_WIDTH_PX / 200;

const GLOBAL_MIN_POSITION_M = -1000;
const GLOBAL_MAX_POSITION_M = 1000;

let currentViewCenterM = 0;

let isDragging = false;
let dragStartX = 0;
let initialViewCenterM = 0;

// --- 関数定義 ---
function meterToPixel(meterPosition) {
    const viewPortLeftM = currentViewCenterM - (SIM_AREA_WIDTH_PX / 2) / SCALE_FACTOR;
    return (meterPosition - viewPortLeftM) * SCALE_FACTOR;
}

function pixelToMeter(pixelPosition) {
    const viewPortLeftM = currentViewCenterM - (SIM_AREA_WIDTH_PX / 2) / SCALE_FACTOR;
    return (pixelPosition / SCALE_FACTOR) + viewPortLeftM;
}

function generateScaleMarks() {
    scaleMarksContainer.innerHTML = '';
    const viewPortLeftM = currentViewCenterM - (SIM_AREA_WIDTH_PX / 2) / SCALE_FACTOR;
    const viewPortRightM = currentViewCenterM + (SIM_AREA_WIDTH_PX / 2) / SCALE_FACTOR;
    const startMarkM = Math.floor(Math.max(GLOBAL_MIN_POSITION_M, viewPortLeftM - 50) / 5) * 5;
    const endMarkM = Math.ceil(Math.min(GLOBAL_MAX_POSITION_M, viewPortRightM + 50) / 5) * 5;
    for (let m = startMarkM; m <= endMarkM; m += 5) {
        const markX = meterToPixel(m);
        if (markX < -100 || markX > SIM_AREA_WIDTH_PX + 100) continue;
        const markLine = document.createElement('div');
        markLine.classList.add('scale-mark');
        markLine.style.left = `${markX}px`;
        if (m % 100 === 0) {
            markLine.style.height = '20px';
            markLine.style.backgroundColor = '#444';
        } else if (m % 50 === 0) {
            markLine.style.height = '15px';
        } else if (m % 10 === 0) {
            markLine.style.height = '12px';
        } else {
            markLine.style.height = '6px';
        }
        scaleMarksContainer.appendChild(markLine);
        if (m % 100 === 0 || m % 50 === 0) {
            const markLabel = document.createElement('span');
            markLabel.classList.add('scale-label');
            markLabel.textContent = `${m}m`;
            markLabel.style.left = `${markX}px`;
            scaleMarksContainer.appendChild(markLabel);
        }
    }
}

function toggleSimulation() {
    if (isRunning) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        isRunning = false;
        startButton.textContent = 'スタート';
    } else {
        isRunning = true;
        startButton.textContent = '一時停止';
        lastTimestamp = performance.now();
        animationFrameId = requestAnimationFrame(animate);
    }
}

function initializeSimulation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    v0 = parseFloat(initialVelocityInput.value);
    a = parseFloat(accelerationInput.value);
    simSpeed = parseFloat(simSpeedInput.value);
    time = 0;
    velocity = v0;
    position = 0;
    lastPlotTime = 0;
    currentViewCenterM = 0;
    objectElement.style.left = `${meterToPixel(0)}px`;
    pathPlotsContainer.innerHTML = '';
    // ★ここから追加★
    dataTableContainer.innerHTML = ''; // テーブルをクリア
    // ★ここまで追加★
    updateDisplay();
    generateScaleMarks();
    isRunning = false;
    startButton.textContent = 'スタート';
}

function animate(timestamp) {
    if (!isRunning) return;
    const deltaTime = (timestamp - lastTimestamp) / 1000 * simSpeed;
    lastTimestamp = timestamp;
    time += deltaTime;
    const newPosition = v0 * time + 0.5 * a * time * time;
    const newVelocity = v0 + a * time;

    if (Math.floor(time / PLOT_TIME_INTERVAL_S) > Math.floor(lastPlotTime / PLOT_TIME_INTERVAL_S)) {
        const currentPlotPointTime = Math.floor(time / PLOT_TIME_INTERVAL_S) * PLOT_TIME_INTERVAL_S;
        if (currentPlotPointTime > lastPlotTime) {
             const plotPositionAtTime = v0 * currentPlotPointTime + 0.5 * a * currentPlotPointTime * currentPlotPointTime;
             const plotVelocityAtTime = v0 + a * currentPlotPointTime;
            if (plotPositionAtTime >= GLOBAL_MIN_POSITION_M && plotPositionAtTime <= GLOBAL_MAX_POSITION_M) {
                addPathPlot(plotPositionAtTime, plotVelocityAtTime, currentPlotPointTime);
                // ★ここから追加★
                addTableRow(currentPlotPointTime, plotVelocityAtTime, plotPositionAtTime);
                // ★ここまで追加★
            }
            lastPlotTime = currentPlotPointTime;
        }
    }

    position = newPosition;
    velocity = newVelocity;
    objectElement.style.left = `${meterToPixel(position)}px`;
    const objectScreenX = meterToPixel(position);
    const centerScreenX = SIM_AREA_WIDTH_PX / 2;
    const scrollThreshold = SIM_AREA_WIDTH_PX * 0.2;

    if (objectScreenX < centerScreenX - scrollThreshold || objectScreenX > centerScreenX + scrollThreshold) {
        currentViewCenterM = position;
        const viewPortWidthM = SIM_AREA_WIDTH_PX / SCALE_FACTOR;
        const halfViewPortWidthM = viewPortWidthM / 2;

        if (currentViewCenterM - halfViewPortWidthM < GLOBAL_MIN_POSITION_M) {
            currentViewCenterM = GLOBAL_MIN_POSITION_M + halfViewPortWidthM;
        }
        if (currentViewCenterM + halfViewPortWidthM > GLOBAL_MAX_POSITION_M) {
            currentViewCenterM = GLOBAL_MAX_POSITION_M - halfViewPortWidthM;
        }
        updateElementsPosition();
    }
    updateDisplay();
    if (position >= GLOBAL_MIN_POSITION_M && position <= GLOBAL_MAX_POSITION_M) {
        animationFrameId = requestAnimationFrame(animate);
    } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        isRunning = false;
        startButton.textContent = 'スタート';
    }
}

function addPathPlot(plotPositionM, plotVelocityM, plotTimeS) {
    const plotDot = document.createElement('div');
    plotDot.classList.add('plot-dot');
    plotDot.setAttribute('data-position', plotPositionM);
    plotDot.style.left = `${meterToPixel(plotPositionM)}px`;
    pathPlotsContainer.appendChild(plotDot);

    if (objectElement.classList.contains('custom-object')) {
        plotDot.classList.add('custom-object');
        plotDot.classList.add('custom-plot-image');
        plotDot.style.backgroundImage = objectElement.style.backgroundImage;
        plotDot.style.backgroundSize = objectElement.style.backgroundSize;
        plotDot.style.backgroundRepeat = objectElement.style.backgroundRepeat;
        plotDot.style.backgroundPosition = objectElement.style.backgroundPosition;
        plotDot.style.backgroundColor = objectElement.style.backgroundColor;
        plotDot.style.borderRadius = objectElement.style.borderRadius;
        plotDot.style.width = objectElement.style.width;
        plotDot.style.height = objectElement.style.height;
        plotDot.style.bottom = objectElement.style.bottom;
    }

    const timeLabel = document.createElement('span');
    timeLabel.classList.add('plot-time-label');
    timeLabel.textContent = `${plotTimeS.toFixed(1)}s`;
    timeLabel.setAttribute('data-position', plotPositionM);
    timeLabel.style.left = `${meterToPixel(plotPositionM)}px`;
    pathPlotsContainer.appendChild(timeLabel);

    const velocityLabel = document.createElement('span');
    velocityLabel.classList.add('plot-velocity-label');
    velocityLabel.textContent = `${plotVelocityM.toFixed(1)}m/s`;
    velocityLabel.setAttribute('data-position', plotPositionM);
    velocityLabel.style.left = `${meterToPixel(plotPositionM)}px`;
    pathPlotsContainer.appendChild(velocityLabel);

    const distanceLabel = document.createElement('span');
    distanceLabel.classList.add('plot-distance-label');
    distanceLabel.textContent = `${plotPositionM.toFixed(1)}m`;
    distanceLabel.setAttribute('data-position', plotPositionM);
    distanceLabel.style.left = `${meterToPixel(plotPositionM)}px`;
    pathPlotsContainer.appendChild(distanceLabel);
}

// ★ここから追加★
/**
 * データテーブルに行を追加する関数。
 * @param {number} timeS - 経過時間 (s)
 * @param {number} velocityMps - 速度 (m/s)
 * @param {number} positionM - 位置 (m)
 */
function addTableRow(timeS, velocityMps, positionM) {
    let table = document.getElementById('data-table');
    if (!table) {
        // テーブルが存在しない場合は新しく作成
        table = document.createElement('table');
        table.id = 'data-table';
        dataTableContainer.appendChild(table);

        const headerRow = table.insertRow();
        const thTime = document.createElement('th');
        thTime.textContent = '時間 (s)';
        headerRow.appendChild(thTime);
        const thVelocity = document.createElement('th');
        thVelocity.textContent = '速度 (m/s)';
        headerRow.appendChild(thVelocity);
        const thPosition = document.createElement('th');
        thPosition.textContent = '位置 (m)';
        headerRow.appendChild(thPosition);
    }

    const newRow = table.insertRow();
    const cellTime = newRow.insertCell();
    cellTime.textContent = timeS.toFixed(2);
    const cellVelocity = newRow.insertCell();
    cellVelocity.textContent = velocityMps.toFixed(2);
    const cellPosition = newRow.insertCell();
    cellPosition.textContent = positionM.toFixed(2);
    
    // スクロールを一番下にする
    dataTableContainer.scrollTop = dataTableContainer.scrollHeight;
}
// ★ここまで追加★

function updateElementsPosition() {
    objectElement.style.left = `${meterToPixel(position)}px`;

    const plotDots = pathPlotsContainer.querySelectorAll('.plot-dot');
    plotDots.forEach(dot => {
        const plotPositionM = parseFloat(dot.getAttribute('data-position'));
        dot.style.left = `${meterToPixel(plotPositionM)}px`;
    });

    const timeLabels = pathPlotsContainer.querySelectorAll('.plot-time-label');
    timeLabels.forEach(label => {
        const plotPositionM = parseFloat(label.getAttribute('data-position'));
        label.style.left = `${meterToPixel(plotPositionM)}px`;
    });

    const velocityLabels = pathPlotsContainer.querySelectorAll('.plot-velocity-label');
    velocityLabels.forEach(label => {
        const plotPositionM = parseFloat(label.getAttribute('data-position'));
        label.style.left = `${meterToPixel(plotPositionM)}px`;
    });

    const distanceLabels = pathPlotsContainer.querySelectorAll('.plot-distance-label');
    distanceLabels.forEach(label => {
        const plotPositionM = parseFloat(label.getAttribute('data-position'));
        label.style.left = `${meterToPixel(plotPositionM)}px`;
    });

    generateScaleMarks();
}

function updateDisplay() {
    timeDisplay.textContent = time.toFixed(2);
    velocityDisplay.textContent = velocity.toFixed(2);
    positionDisplay.textContent = position.toFixed(2);
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageUrl = e.target.result;
        const img = new Image();
        img.onload = function() {
            const maxWidth = 80;
            const maxHeight = 80;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = width * (maxHeight / height);
                    height = maxHeight;
                }
            }

            objectElement.style.backgroundImage = `url(${imageUrl})`;
            objectElement.style.backgroundSize = 'contain';
            objectElement.style.backgroundRepeat = 'no-repeat';
            objectElement.style.backgroundPosition = 'center';
            objectElement.style.backgroundColor = 'transparent';
            objectElement.style.borderRadius = '0';
            objectElement.style.width = `${width}px`;
            objectElement.style.height = `${height}px`;
            objectElement.style.bottom = `${400 - (height / 2)}px`;

            objectElement.classList.add('custom-object');
        };
        img.src = imageUrl;
    };
    reader.readAsDataURL(file);
    initializeSimulation();
}

function revertToDefault() {
    objectElement.style.backgroundImage = '';
    objectElement.style.backgroundSize = '';
    objectElement.style.backgroundRepeat = '';
    objectElement.style.backgroundPosition = '';
    objectElement.style.backgroundColor = '#007bff';
    objectElement.style.borderRadius = '5px 5px 0 0';
    objectElement.style.width = '60px';
    objectElement.style.height = '30px';
    objectElement.style.bottom = '390px';
    objectElement.classList.remove('custom-object');

    const plotDots = pathPlotsContainer.querySelectorAll('.plot-dot');
    plotDots.forEach(dot => {
        dot.style.backgroundImage = '';
        dot.style.backgroundSize = '';
        dot.style.backgroundRepeat = '';
        dot.style.backgroundPosition = '';
        dot.style.backgroundColor = 'rgba(0, 123, 255, 0.3)';
        dot.style.borderRadius = '5px 5px 0 0';
        dot.style.width = '60px';
        dot.style.height = '30px';
        dot.style.bottom = '390px';
        dot.classList.remove('custom-object');
    });

    objectImageInput.value = '';
    initializeSimulation();
}

// --- イベントリスナー ---
initialVelocityInput.addEventListener('change', initializeSimulation);
accelerationInput.addEventListener('change', initializeSimulation);
simSpeedInput.addEventListener('change', initializeSimulation);
startButton.addEventListener('click', toggleSimulation);
resetButton.addEventListener('click', initializeSimulation);
objectImageInput.addEventListener('change', handleImageUpload);
revertButton.addEventListener('click', revertToDefault);

simulationArea.addEventListener('mousedown', (e) => {
    if (isRunning) return;
    isDragging = true;
    dragStartX = e.clientX;
    initialViewCenterM = currentViewCenterM;
    simulationArea.style.cursor = 'grabbing';
});

simulationArea.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dragDeltaPx = e.clientX - dragStartX;
    const dragDeltaM = dragDeltaPx / SCALE_FACTOR;
    let newViewCenterM = initialViewCenterM - dragDeltaM;
    const viewPortWidthM = SIM_AREA_WIDTH_PX / SCALE_FACTOR;
    const halfViewPortWidthM = viewPortWidthM / 2;
    if (newViewCenterM - halfViewPortWidthM < GLOBAL_MIN_POSITION_M) {
        newViewCenterM = GLOBAL_MIN_POSITION_M + halfViewPortWidthM;
    }
    if (newViewCenterM + halfViewPortWidthM > GLOBAL_MAX_POSITION_M) {
        newViewCenterM = GLOBAL_MAX_POSITION_M - halfViewPortWidthM;
    }
    currentViewCenterM = newViewCenterM;
    updateElementsPosition();
});

simulationArea.addEventListener('mouseup', () => {
    isDragging = false;
    simulationArea.style.cursor = 'grab';
});

simulationArea.addEventListener('mouseleave', () => {
    isDragging = false;
    simulationArea.style.cursor = 'grab';
});

simulationArea.addEventListener('touchstart', (e) => {
    if (isRunning) return;
    e.preventDefault();
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    initialViewCenterM = currentViewCenterM;
    simulationArea.style.cursor = 'grabbing';
}, { passive: false });

simulationArea.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const currentTouchX = e.touches[0].clientX;
    const dragDeltaPx = currentTouchX - dragStartX;
    const dragDeltaM = dragDeltaPx / SCALE_FACTOR;
    let newViewCenterM = initialViewCenterM - dragDeltaM;
    const viewPortWidthM = SIM_AREA_WIDTH_PX / SCALE_FACTOR;
    const halfViewPortWidthM = viewPortWidthM / 2;
    if (newViewCenterM - halfViewPortWidthM < GLOBAL_MIN_POSITION_M) {
        newViewCenterM = GLOBAL_MIN_POSITION_M + halfViewPortWidthM;
    }
    if (newViewCenterM + halfViewPortWidthM > GLOBAL_MAX_POSITION_M) {
        newViewCenterM = GLOBAL_MAX_POSITION_M - halfViewPortWidthM;
    }
    currentViewCenterM = newViewCenterM;
    updateElementsPosition();
}, { passive: false });

simulationArea.addEventListener('touchend', () => {
    isDragging = false;
    simulationArea.style.cursor = 'grab';
});

simulationArea.addEventListener('touchcancel', () => {
    isDragging = false;
    simulationArea.style.cursor = 'grab';
});

initializeSimulation();