// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Performance optimization: Use passive event listeners
    const options = { passive: true };

    // Initialize accessibility features first
    initializeAccessibility();

    // ALPHA VERSION: Clear all caches and unregister service workers
    await clearAllCaches();

    // Request both camera and microphone permissions upfront
    await requestMediaPermissions();

    // Initialize session first
    await initializeSession();
    
    // Initialize camera first, then controls
    await initializeCamera();
    initializeControls();
    AudioManager.initialize();
});

// Configuration based on environment
const CONFIG = {
    getBaseUrl() {
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.hostname.startsWith('192.168.') ||
                           window.location.hostname.startsWith('10.') ||
                           window.location.hostname.endsWith('.local');
        
        if (isLocalhost) {
            return 'http://localhost:8000';
        } else {
            return 'https://buddyvision.app';
        }
    },
    
    getWebSocketUrl() {
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.hostname.startsWith('192.168.') ||
                           window.location.hostname.startsWith('10.') ||
                           window.location.hostname.endsWith('.local');
        
        if (isLocalhost) {
            return 'ws://localhost:8000';
        } else {
            return 'wss://buddyvision.app';
        }
    }
};

// PWA Installation handling
let deferredPrompt;

// Performance monitoring
if ('performance' in window && 'memory' in window.performance) {
    setInterval(() => {
        const memory = window.performance.memory;
        console.log('Memory usage:', {
            usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1048576) + 'MB',
            totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1048576) + 'MB'
        });
    }, 10000);
}

// Request camera and microphone permissions upfront
async function requestMediaPermissions() {
    const cameraStatus = document.getElementById('camera-status');
    
    try {
        // Update status for screen readers
        if (cameraStatus) {
            cameraStatus.textContent = 'Solicitando permisos de cámara y micrófono...';
        }
        announceToScreenReader('Solicitando permisos de cámara y micrófono. Por favor, concede acceso cuando se te solicite.');
        
        // Request both camera and microphone permissions at once
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Use back camera
                width: { ideal: window.innerWidth },
                height: { ideal: window.innerHeight }
            },
            audio: {
                sampleRate: 24000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        // Stop the stream immediately since we just needed the permissions
        stream.getTracks().forEach(track => track.stop());
        
        // Update status
        if (cameraStatus) {
            cameraStatus.textContent = 'Permisos concedidos';
        }
        announceToScreenReader('Permisos de cámara y micrófono concedidos correctamente');
        
        console.log('✅ Media permissions granted successfully');
        
    } catch (error) {
        console.error('Error requesting media permissions:', error);
        if (cameraStatus) {
            cameraStatus.textContent = 'Permisos denegados';
        }
        
        let errorMessage = 'Se requiere acceso a la cámara y micrófono para que esta aplicación funcione.';
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permisos denegados. Por favor, concede acceso a la cámara y micrófono en la configuración del navegador.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No se encontró cámara o micrófono en el dispositivo.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Tu navegador no soporta acceso a cámara y micrófono.';
        }
        
        showErrorMessage(errorMessage);
        announceToScreenReader('Error: ' + errorMessage);
        throw error;
    }
}

// Initialize camera view
async function initializeCamera() {
    const videoElement = document.getElementById('camera-feed');
    const cameraStatus = document.getElementById('camera-status');
    
    try {
        // Since permissions are already granted, we can request camera stream directly
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Use back camera
                width: { ideal: window.innerWidth },
                height: { ideal: window.innerHeight }
            },
            audio: false // We don't need audio for the video feed
        });
        
        videoElement.srcObject = stream;

        // Return a promise that resolves when the video is ready to play
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                if (cameraStatus) {
                    cameraStatus.textContent = 'Cámara lista';
                    announceToScreenReader('Cámara inicializada y lista para usar');
                }
                resolve();
            };
        });
    } catch (error) {
        console.error('Error accessing camera:', error);
        if (cameraStatus) {
            cameraStatus.textContent = 'Error al acceder a la cámara';
        }
        showErrorMessage('Error al acceder a la cámara. Por favor, recarga la página.');
        announceToScreenReader('Error: No se pudo acceder a la cámara');
        throw error; // Re-throw to handle it in the calling function
    }
}

// Initialize control buttons
function initializeControls() {
    const captureAndRecordButton = document.getElementById('capture-and-record-button');
    const videoElement = document.getElementById('camera-feed');
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];

    // Combined capture and record button
    captureAndRecordButton.addEventListener('click', async () => {
        if (!isRecording) {
            if (!currentSession) {
                showErrorMessage('No hay sesión activa. Por favor, recarga la página.');
                announceToScreenReader('Error: No hay sesión activa');
                return;
            }

            // Visual feedback
            captureAndRecordButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                captureAndRecordButton.style.transform = 'scale(1)';
            }, 100);

            try {
                // Start audio recording immediately - permissions already granted
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 24000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
                
                mediaRecorder = new MediaRecorder(stream, {
                    mimeType: 'audio/webm',
                    audioBitsPerSecond: 256000
                });

                mediaRecorder.addEventListener('dataavailable', event => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                });

                mediaRecorder.addEventListener('stop', async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    audioChunks = [];
                    
                    // Convert to raw PCM
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioContext = new AudioContext({ sampleRate: 24000 });
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    
                    // Get PCM data
                    const pcmData = audioBuffer.getChannelData(0);
                    const pcmBuffer = new Int16Array(pcmData.length);
                    
                    // Convert Float32 to Int16
                    for (let i = 0; i < pcmData.length; i++) {
                        const s = Math.max(-1, Math.min(1, pcmData[i]));
                        pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    
                    // Send to WebSocket
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(pcmBuffer.buffer);
                    }

                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                });

                mediaRecorder.start();
                isRecording = true;
                captureAndRecordButton.classList.add('recording');
                captureAndRecordButton.querySelector('i').className = 'fas fa-stop';
                captureAndRecordButton.setAttribute('aria-label', 'Detener grabación');
                captureAndRecordButton.setAttribute('aria-pressed', 'true');
                
                // Vibrate for tactile feedback
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }

                announceToScreenReader('Grabación iniciada. Imagen capturada y enviada.');

                // Capture and send image in parallel
                const canvas = document.createElement('canvas');
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                const context = canvas.getContext('2d');
                
                // Draw the current video frame to the canvas
                context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                
                // Convert the canvas to a blob
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', 0.85);
                });

                // Create form data and append the image
                const formData = new FormData();
                formData.append('image', blob, 'capture.jpg');

                const url = `${CONFIG.getBaseUrl()}/api/conversations/image/${currentSession.id}`;
                
                console.log('🔍 Uploading image to:', url);
                
                // Send the image to the server
                fetch(url, {
                    method: 'POST',
                    body: formData
                }).catch(error => {
                    console.error('Error uploading image:', error);
                    showErrorMessage('Error al subir la imagen, pero la grabación continúa.');
                    announceToScreenReader('Error al enviar imagen');
                });

            } catch (error) {
                console.error('Error in capture and record process:', error);
                
                // Provide specific error messages for VoiceOver users
                let errorMessage = 'Error al iniciar la grabación. Por favor, inténtalo de nuevo.';
                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Permisos de micrófono denegados. Por favor, recarga la página y concede permisos.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'No se encontró micrófono en el dispositivo.';
                } else if (error.name === 'NotSupportedError') {
                    errorMessage = 'Tu navegador no soporta grabación de audio.';
                }
                
                showErrorMessage(errorMessage);
                announceToScreenReader('Error al iniciar grabación: ' + errorMessage);
            }
        } else {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            isRecording = false;
            captureAndRecordButton.classList.remove('recording');
            captureAndRecordButton.querySelector('i').className = 'fas fa-camera';
            captureAndRecordButton.setAttribute('aria-label', 'Capturar imagen y comenzar grabación de audio');
            captureAndRecordButton.setAttribute('aria-pressed', 'false');
            
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }

            announceToScreenReader('Grabación detenida. Audio enviado para procesamiento.');
        }
    });

    // Handle keyboard controls
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault(); // Prevent page scroll
            captureAndRecordButton.click();
        }
    });
}

// Screen reader announcement utility
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.setAttribute('class', 'sr-only');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
}

// Error message display
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
}

// Session management
let currentSession = null;
let socket = null;

async function initializeSession() {
    try {
        const url = `${CONFIG.getBaseUrl()}/api/conversations/sessions`;
        
        console.log('🔍 Making session request to:', url);
        console.log('🔍 Current location:', window.location.href);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const sessionData = await response.json();
        currentSession = sessionData;
        console.log('Session initialized:', currentSession);
        
        // Announce successful session initialization
        announceToScreenReader('Sesión inicializada correctamente');
        
        // Initialize WebSocket connection with the session ID
        await initializeWebSocket(currentSession.id);
    } catch (error) {
        console.error('Error initializing session:', error);
        showErrorMessage('Error al inicializar la sesión. Por favor, recarga la página.');
        announceToScreenReader('Error al inicializar sesión');
    }
}

// Audio playback manager
const AudioManager = {
    context: null,
    playbackQueue: [],
    isPlaying: false,
    sampleRate: 24000,

    initialize() {
        if (!this.context) {
            this.context = new AudioContext({ sampleRate: this.sampleRate });
        }
    },

    async playPcmChunk(arrayBuffer) {
        // Add to queue and process
        this.playbackQueue.push(arrayBuffer);
        if (!this.isPlaying) {
            this.processQueue();
        }
    },

    async processQueue() {
        if (this.playbackQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const arrayBuffer = this.playbackQueue.shift();
        
        try {
            // Convert Int16 PCM to Float32
            const pcmData = new Int16Array(arrayBuffer);
            const audioBuffer = this.context.createBuffer(1, pcmData.length, this.sampleRate);
            const channelData = audioBuffer.getChannelData(0);
            
            // Convert samples
            for (let i = 0; i < pcmData.length; i++) {
                channelData[i] = pcmData[i] / (pcmData[i] < 0 ? 0x8000 : 0x7FFF);
            }
            
            // Create and configure source
            const source = this.context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.context.destination);
            
            // When this chunk ends, process the next one
            source.onended = () => {
                this.processQueue();
            };
            
            // Play the audio
            source.start();
            console.log('Playing audio chunk, remaining in queue:', this.playbackQueue.length);
        } catch (error) {
            console.error('Error playing audio chunk:', error);
            // Continue with queue even if there's an error
            this.processQueue();
        }
    }
};

function initializeWebSocket(sessionId) {
    return new Promise((resolve, reject) => {
        try {
            // Close existing socket if any
            if (socket) {
                socket.close();
            }

            // Create WebSocket URL
            const wsUrl = `${CONFIG.getWebSocketUrl()}/api/conversations/realtime/${sessionId}`;

            console.log('🔍 WebSocket connecting to:', wsUrl);

            // Create new WebSocket connection
            socket = new WebSocket(wsUrl);

            socket.addEventListener('open', () => {
                console.log('WebSocket connection established');
                announceToScreenReader('Conexión establecida. Listo para recibir respuestas de audio.');
                resolve();
            });

            socket.addEventListener('message', async (event) => {
                try {
                    // Try to parse as JSON first
                    const data = JSON.parse(event.data);
                    console.log('Received JSON message:', data);
                } catch (e) {
                    // If not JSON, treat as audio bytes
                    const arrayBuffer = await event.data.arrayBuffer();
                    // Use AudioManager to handle the PCM data
                    await AudioManager.playPcmChunk(arrayBuffer);
                }
            });

            socket.addEventListener('error', (error) => {
                console.error('WebSocket error:', error);
                announceToScreenReader('Error en la conexión de audio');
                reject(error);
            });

            socket.addEventListener('close', () => {
                console.log('WebSocket connection closed');
                announceToScreenReader('Conexión de audio cerrada');
                // Implement reconnection logic if needed
                socket = null;
            });
        } catch (error) {
            console.error('Error initializing WebSocket:', error);
            announceToScreenReader('Error al inicializar conexión de audio');
            reject(error);
        }
    });
}

// Add cache clearing function
async function clearAllCaches() {
    try {
        // Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
                console.log('🗑️ Unregistered service worker');
            }
        }
        
        // Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => {
                    console.log('🗑️ Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }
        
        console.log('✅ All caches cleared and service workers unregistered');
    } catch (error) {
        console.error('Error clearing caches:', error);
    }
}

// Add to window for manual debugging
window.clearAllCaches = clearAllCaches;
window.debugUrls = () => {
    console.log('🔍 Current location:', window.location.href);
    console.log('🔍 Base URL:', CONFIG.getBaseUrl());
    console.log('🔍 WebSocket URL:', CONFIG.getWebSocketUrl());
    console.log('🔍 Is localhost:', window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
};

// Initialize accessibility features for Spanish-speaking VoiceOver users
function initializeAccessibility() {
    // Set up live regions for dynamic announcements
    const announcementsRegion = document.getElementById('announcements');
    const statusRegion = document.getElementById('status-updates');
    
    if (!announcementsRegion) {
        const announcements = document.createElement('div');
        announcements.id = 'announcements';
        announcements.className = 'sr-only';
        announcements.setAttribute('aria-live', 'assertive');
        announcements.setAttribute('aria-atomic', 'true');
        document.body.appendChild(announcements);
    }
    
    if (!statusRegion) {
        const status = document.createElement('div');
        status.id = 'status-updates';
        status.className = 'sr-only';
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');
        document.body.appendChild(status);
    }
    
    // Announce app initialization with permission information
    announceToScreenReader('Asistente Visual iniciado. La aplicación solicitará permisos de cámara y micrófono al inicio. Esto facilita el uso con VoiceOver ya que no tendrás que conceder permisos durante la grabación.');
    
    // Set up keyboard navigation hints
    const captureButton = document.getElementById('capture-and-record-button');
    if (captureButton) {
        captureButton.setAttribute('tabindex', '0');
        captureButton.setAttribute('aria-describedby', 'capture-record-description');
    }
    
    const startCameraButton = document.getElementById('start-camera');
    if (startCameraButton) {
        startCameraButton.setAttribute('tabindex', '0');
        startCameraButton.setAttribute('aria-describedby', 'start-camera-description');
    }
} 