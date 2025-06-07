// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Performance optimization: Use passive event listeners
    const options = { passive: true };

    // Initialize session first
    initializeSession();
    
    // Initialize components
    initializeNavigation();
    initializeInstallButton();
    initializeContactForm();
    initializeLazyLoading();
    initializeOfflineDetection();
    initializeCamera();
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
    } catch (error) {
        console.error('Error accessing camera:', error);
        // Show error message to user (consider using screen reader friendly notification)
        showErrorMessage('Camera access is required for this application to work.');
    }
}

// Initialize control buttons
function initializeControls() {
    const audioButton = document.getElementById('audio-button');
    const captureButton = document.getElementById('capture-button');
    let isRecording = false;

    // Audio recording button
    audioButton.addEventListener('click', () => {
        isRecording = !isRecording;
        audioButton.classList.toggle('recording', isRecording);
        
        // Update aria-label for screen readers
        audioButton.setAttribute('aria-label', 
            isRecording ? 'Stop audio recording' : 'Start audio recording'
        );
        
        // Vibrate for tactile feedback (if supported)
        if (navigator.vibrate) {
            navigator.vibrate(isRecording ? [100, 50, 100] : 100);
        }

        // Announce state change for screen readers
        announceToScreenReader(isRecording ? 'Recording started' : 'Recording stopped');
    });

    // Capture button
    captureButton.addEventListener('click', () => {
        // Provide tactile feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Visual feedback
        captureButton.style.transform = 'scale(0.95)';
        setTimeout(() => {
            captureButton.style.transform = 'scale(1)';
        }, 100);

        // Announce for screen readers
        announceToScreenReader('Picture taken');
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

            socket.addEventListener('message', (event) => {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);
                // Handle incoming messages here
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