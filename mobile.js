// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Performance optimization: Use passive event listeners
    const options = { passive: true };

    // Initialize session first
    await initializeSession();
    
    // Initialize components
    initializeNavigation();
    initializeInstallButton();
    initializeContactForm();
    initializeLazyLoading();
    initializeOfflineDetection();
    
    // Initialize camera first, then controls
    await initializeCamera();
    initializeControls();
});

// Navigation handling
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                // Smooth scroll to section
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// PWA Installation handling
let deferredPrompt;
function initializeInstallButton() {
    const installButton = document.querySelector('.action-button');
    
    // Exit early if install button is not found
    if (!installButton) {
        console.warn('Install button not found in the DOM');
        return;
    }
    
    // Hide install button if PWA is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        installButton.style.display = 'none';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        // Show the install button
        installButton.style.display = 'block';
    });

    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) {
            return;
        }
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // Clear the saved prompt since it can't be used again
        deferredPrompt = null;
        // Hide the install button
        installButton.style.display = 'none';
    });
}

// Contact form handling
function initializeContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(contactForm);
            const formObject = Object.fromEntries(formData);
            
            try {
                // Simulate form submission (replace with actual API endpoint)
                await submitForm(formObject);
                alert('Message sent successfully!');
                contactForm.reset();
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('Failed to send message. Please try again.');
            }
        });
    }
}

// Simulated form submission function
async function submitForm(data) {
    // Check if online before attempting submission
    if (!navigator.onLine) {
        throw new Error('No internet connection');
    }
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Form data:', data);
    // Add actual form submission logic here
}

// Lazy loading implementation
function initializeLazyLoading() {
    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        });

        // Observe all images with data-src attribute
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// Offline detection
function initializeOfflineDetection() {
    const updateOnlineStatus = () => {
        const status = navigator.onLine ? 'online' : 'offline';
        console.log(`App is ${status}`);
        document.body.dataset.connectionStatus = status;
        
        if (!navigator.onLine) {
            showOfflineNotification();
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function showOfflineNotification() {
    const notification = document.createElement('div');
    notification.className = 'offline-notification';
    notification.innerHTML = `
        <div class="offline-notification-content">
            You are currently offline. Some features may be limited.
            <button onclick="this.parentElement.parentElement.remove()">Dismiss</button>
        </div>
    `;
    document.body.appendChild(notification);
}

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

// Initialize camera view
async function initializeCamera() {
    const videoElement = document.getElementById('camera-feed');
    const cameraStatus = document.getElementById('camera-status');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Use back camera
                width: { ideal: window.innerWidth },
                height: { ideal: window.innerHeight }
            },
            audio: false
        });
        
        videoElement.srcObject = stream;

        // Return a promise that resolves when the video is ready to play
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                if (cameraStatus) {
                    cameraStatus.textContent = 'Camera ready';
                }
                resolve();
            };
        });
    } catch (error) {
        console.error('Error accessing camera:', error);
        if (cameraStatus) {
            cameraStatus.textContent = 'Camera access denied';
        }
        showErrorMessage('Camera access is required for this application to work.');
        throw error; // Re-throw to handle it in the calling function
    }
}

// Initialize control buttons
function initializeControls() {
    const audioButton = document.getElementById('audio-button');
    const captureButton = document.getElementById('capture-button');
    const videoElement = document.getElementById('camera-feed');
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];

    // Audio recording button
    audioButton.addEventListener('click', async () => {
        if (!isRecording) {
            try {
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
                audioButton.classList.add('recording');
                audioButton.querySelector('i').className = 'fas fa-stop';
                
                // Update aria-label for screen readers
                audioButton.setAttribute('aria-label', 'Stop audio recording');
                
                // Vibrate for tactile feedback
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }

                announceToScreenReader('Recording started');
            } catch (error) {
                console.error('Error starting recording:', error);
                showErrorMessage('Failed to start recording. Please check microphone permissions.');
            }
        } else {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            isRecording = false;
            audioButton.classList.remove('recording');
            audioButton.querySelector('i').className = 'fas fa-microphone';
            audioButton.setAttribute('aria-label', 'Start audio recording');
            
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }

            announceToScreenReader('Recording stopped');
        }
    });

    // Capture button
    captureButton.addEventListener('click', async () => {
        if (!currentSession) {
            showErrorMessage('No active session. Please refresh the page.');
            return;
        }

        try {
            // Create a canvas element to capture the image
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

            // Send the image to the server
            const response = await fetch(`http://localhost/conversations/image/${currentSession.id}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Provide feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            // Visual feedback
            captureButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                captureButton.style.transform = 'scale(1)';
            }, 100);

            // Announce for screen readers
            announceToScreenReader('Picture taken and sent successfully');
            
            console.log('Image sent successfully');
        } catch (error) {
            console.error('Error capturing and sending image:', error);
            showErrorMessage('Failed to capture and send image. Please try again.');
        }
    });

    // Handle keyboard controls
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            captureButton.click();
        } else if (e.code === 'KeyR') {
            audioButton.click();
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

// Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(error => {
                console.error('ServiceWorker registration failed:', error);
            });
    });
}

// Session management
let currentSession = null;
let socket = null;

async function initializeSession() {
    try {
        const response = await fetch('http://localhost/conversations/sessions', {
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
        
        // Initialize WebSocket connection with the session ID
        await initializeWebSocket(currentSession.id);
    } catch (error) {
        console.error('Error initializing session:', error);
        showErrorMessage('Failed to initialize session. Please try refreshing the page.');
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

// Initialize AudioManager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    AudioManager.initialize();
});

function initializeWebSocket(sessionId) {
    return new Promise((resolve, reject) => {
        try {
            // Close existing socket if any
            if (socket) {
                socket.close();
            }

            // Create new WebSocket connection
            socket = new WebSocket(`ws://localhost/conversations/realtime/${sessionId}`);

            socket.addEventListener('open', () => {
                console.log('WebSocket connection established');
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
                reject(error);
            });

            socket.addEventListener('close', () => {
                console.log('WebSocket connection closed');
                // Implement reconnection logic if needed
                socket = null;
            });
        } catch (error) {
            console.error('Error initializing WebSocket:', error);
            reject(error);
        }
    });
} 