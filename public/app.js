// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

if (location.hostname === "localhost") {
    auth.useEmulator('http://localhost:9099');
}


let scene, camera, renderer, nebula, stars, clock;
let analyser, dataArray;
let recognition;
let synthesis = window.speechSynthesis;
let audioContext;
let isListening = false;
let isSpeaking = false;
let nebulaState = 'idle';
let currentConversation = [];

const simplex = new SimplexNoise();

function refreshToken() {
    if (auth.currentUser) {
        auth.currentUser.getIdToken(true)
            .then((idToken) => {
                // Store the token securely or use it immediately
                console.log('Token refreshed');
            })
            .catch((error) => {
                console.error('Error refreshing token:', error);
            });
    }
}

// Call this function periodically or before making requests
setInterval(refreshToken, 55 * 60 * 1000); 

auth.onAuthStateChanged((user) => {
    if (user) {
        user.getIdToken(true)
            .then((idToken) => {
                // Store the token securely or use it immediately
                initApp();
            })
            .catch((error) => {
                console.error('Error getting initial token:', error);
                window.location.href = 'index.html';
            });
    } else {
        window.location.href = 'index.html';
    }
});

let isAISpeaking = false;

function initApp() {
    setupAudioContext();
    setupSpeechRecognition();
    setupScene();
    animate();
    startConversation();
    setupTapClickListener();
}

function setupAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
        }, 
        video: false 
    })
    .then(function(stream) {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
    })
    .catch(function(err) {
        console.error('Error accessing microphone:', err);
        showErrorMessage('Unable to access the microphone. Please check your browser settings and try again.');
    });
}

function setupSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = function(event) {
        if (isSpeaking) return;

        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join(' ');

        updateTranscript(transcript, 'user');

        if (event.results[0].isFinal) {
            sendMessage(transcript);
        }
    };

    recognition.onstart = function() {
        isListening = true;
        setNebulaState('listening');
    };

    recognition.onend = function() {
        isListening = false;
        if (!isAISpeaking) {
            recognition.start();
        }
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error', event.error);
        showErrorMessage('Speech recognition error: ' + event.error);
    };
}

function setupScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('scene-container').appendChild(renderer.domElement);

    createStars();
    createNebula();

    camera.position.z = 50;
    clock = new THREE.Clock();

    window.addEventListener('resize', onWindowResize, false);
}

function createStars() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i < 10000; i++) {
        vertices.push(
            THREE.MathUtils.randFloatSpread(2000),
            THREE.MathUtils.randFloatSpread(2000),
            THREE.MathUtils.randFloatSpread(2000)
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 0.1,
        transparent: true,
        opacity: 0.8,
    });

    stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

function createNebula() {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(100000 * 3);
    const colors = new Float32Array(100000 * 3);

    const colorPalette = [
        new THREE.Color(0x9B58A5), // Lavender
        new THREE.Color(0x5373CE), // Royal Blue
        new THREE.Color(0xE0C3FC), // Light Lavender
        new THREE.Color(0xFDA8BC), // Pink
        new THREE.Color(0xFFDFBA)  // Peach
    ];

    for (let i = 0; i < vertices.length; i += 3) {
        const r = 20 + Math.random() * 20;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        vertices[i] = r * Math.sin(phi) * Math.cos(theta);
        vertices[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        vertices[i + 2] = r * Math.cos(phi);

        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const sizes = new Float32Array(100000);
    for (let i = 0; i < 100000; i++) {
        sizes[i] = Math.random() * 0.5 + 0.1;
    }
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    nebula = new THREE.Points(geometry, material);
    scene.add(nebula);
}

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    analyser.getByteFrequencyData(dataArray);
    const averageFrequency = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedFrequency = averageFrequency / 255;

    animateNebula(time, normalizedFrequency);
    animateStars(time);

    renderer.render(scene, camera);
}

function animateNebula(time, normalizedFrequency) {
    const positions = nebula.geometry.attributes.position.array;
    const colors = nebula.geometry.attributes.color.array;

    for (let i = 0; i < positions.length; i += 3) {
        const ix = i, iy = i + 1, iz = i + 2;
        
        const noise = simplex.noise4D(
            positions[ix] * 0.01 + time * 0.1,
            positions[iy] * 0.01 + time * 0.1,
            positions[iz] * 0.01,
            time * 0.2
        ) * normalizedFrequency * 2;

        positions[ix] += noise;
        positions[iy] += noise;
        positions[iz] += noise;

        const r = Math.sin(time * 0.1 + ix * 0.001) * 0.5 + 0.5;
        const g = Math.sin(time * 0.1 + iy * 0.001 + 2) * 0.5 + 0.5;
        const b = Math.sin(time * 0.1 + iz * 0.001 + 4) * 0.5 + 0.5;

        colors[ix] = r;
        colors[iy] = g;
        colors[iz] = b;
    }

    nebula.geometry.attributes.position.needsUpdate = true;
    nebula.geometry.attributes.color.needsUpdate = true;

    switch (nebulaState) {
        case 'listening':
            nebula.rotation.y += 0.002 * normalizedFrequency;
            nebula.material.opacity = 0.8 + normalizedFrequency * 0.2;
            nebula.scale.setScalar(1 + normalizedFrequency * 0.1);
            break;
        case 'speaking':
            nebula.rotation.x += 0.003 * normalizedFrequency;
            nebula.rotation.z += 0.001 * normalizedFrequency;
            nebula.material.opacity = 0.9 + normalizedFrequency * 0.1;
            nebula.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
            break;
        case 'processing':
            nebula.rotation.y += 0.005;
            nebula.material.opacity = 0.7 + Math.sin(time * 5) * 0.3;
            nebula.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
            break;
        default:
            nebula.rotation.y += 0.001;
            break;
    }

    // Add subtle pulsing effect
    const pulseScale = 1 + Math.sin(time * 0.5) * 0.02;
    nebula.scale.multiplyScalar(pulseScale);
}

function animateStars(time) {
    stars.rotation.y = time * 0.05;
}

function startConversation() {
    isListening = true;
    recognition.start();
    setNebulaState('listening');
    speakWelcomeMessage();
}

function setNebulaState(state) {
    nebulaState = state;
}

function updateTranscript(text, speaker) {
    const transcriptElement = speaker === 'user' ? document.getElementById('user-transcript') : document.getElementById('ai-transcript');
    if (transcriptElement) {
        const words = text.split(' ');
        let currentIndex = 0;
        
        function displayNextWord() {
            if (currentIndex < words.length) {
                const displayedWords = words.slice(Math.max(0, currentIndex - 6), currentIndex + 1);
                transcriptElement.textContent = displayedWords.join(' ');
                transcriptElement.style.opacity = '1';
                currentIndex++;
                setTimeout(displayNextWord, 200); // Adjust timing as needed
            } else {
                setTimeout(() => {
                    transcriptElement.style.opacity = '0';
                }, 5000);
            }
        }
        
        displayNextWord();
    }
}

function setupTapClickListener() {
    document.addEventListener('click', handleTapClick);
    document.addEventListener('touchstart', handleTapClick);
}

function handleTapClick(event) {
    event.preventDefault();
    if (isAISpeaking) {
        stopAISpeech();
        startListening();
    }
}

function stopAISpeech() {
    if (synthesis.speaking) {
        synthesis.cancel();
    }
    isAISpeaking = false;
    setNebulaState('listening');
}

function startListening() {
    if (!isListening) {
        recognition.start();
    }
}


function sendMessage(userInput) {
    if (isAISpeaking) {
        stopAISpeech();
    }

    setNebulaState('processing');
    isSpeaking = true;

    if (!auth.currentUser) {
        console.error('User not authenticated');
        showErrorMessage('Authentication error. Please log in again.');
        isSpeaking = false;
        setNebulaState('listening');
        return;
    }

    auth.currentUser.getIdToken(true)  // Force token refresh
        .then((idToken) => {
            return fetch('/debate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + idToken  // Prefix token with 'Bearer '
                },
                body: JSON.stringify({ 
                    input: userInput,
                    conversation: currentConversation
                }),
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            currentConversation.push({ role: 'user', content: userInput });
            currentConversation.push({ role: 'assistant', content: data.response });
            speakResponse(data.response);
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorMessage('Error in processing your request. Please try again.');
            isSpeaking = false;
            setNebulaState('listening');
        });
}

function speakResponse(text) {
    setNebulaState('speaking');
    isAISpeaking = true;
    const utterance = new SpeechSynthesisUtterance(text);
    
    let voices = synthesis.getVoices();
    let preferredVoice = voices.find(voice => voice.name.includes('Google') && voice.lang.startsWith('en'));
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    utterance.rate = 1.1;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
        updateTranscript(text, 'ai');
    };
    
    utterance.onend = () => {
        isAISpeaking = false;
        setNebulaState('listening');
        startListening();
    };
    
    synthesis.speak(utterance);
}

function speakWelcomeMessage() {
    const welcomeMessage = "Welcome. Let's begin. Provide an argument.";
    speakResponse(welcomeMessage);
}

function showErrorMessage(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
});