let mediaRecorder;
let audioChunks = [];
let audioBlob;
let audio;
let source;
let stream;
let audioContext;
let analyser;
let dataArray;
let canvas, canvasCtx;
let requestId;
let isRecording = false;
let isProcessing = false;
let audioBuffer;



function updateVisualizerDisplay() {
  if (isProcessing === false) {
    document.getElementById("visualizer").style.display = 'block';
  } else {
    document.getElementById("visualizer").style.display = 'none';
  }
}

function removeEventListeners() {
  if (mediaRecorder) {
    mediaRecorder.removeEventListener("dataavailable");
    mediaRecorder.removeEventListener("stop");
  }
}

function processAndPlayAudio(blob) {  
  initAudioContext();
  let formData = new FormData();  
  
  document.getElementById('spinner').style.display = 'block';
  isProcessing = true;
  updateVisualizerDisplay();

  formData.append("file", blob, "recordedAudio.wav");
  formData.append("model_name", "marge");
  formData.append("auto_predict", "false");

  const headers = new Headers();
  headers.append('Authorization', 'Basic b3ZlcnR1bmU6ZjBlNTFlN2YtMGIxMS00YTI1LWE2MzQtZDBiMGQwM2FlN2Rj');

  fetch("https://overtune-service.com/admin/voice-changer/change", {
    method: "POST",
    body: formData,
    headers
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }
      return response.blob();
    })

    .then(processedBlob => {
        audioBlob = processedBlob;
        const audioUrl = URL.createObjectURL(audioBlob);


      fetch(audioUrl)
        .then(response => response.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer))
        .then(decodedAudioBuffer => {
          audioBuffer = decodedAudioBuffer;

          if (audioBuffer) {
            source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            // Create a GainNode
            var gainNode = audioContext.createGain();

            // Connect the source to the gain node.
            source.connect(gainNode);



            // Connect the gain node to the analyser.
            gainNode.connect(analyser);
            source.start(0);
            draw();
          }

          audio = new Audio(audioUrl);
          audio.onended = function() {
            draw(); // Redraw when audio ends.
            removeEventListeners();
          };
          audio.onended = function() {
            const recordButton = document.getElementById('record');
            const recordIcon = recordButton.querySelector('i');

            // Switch to play icon
            recordIcon.classList.remove('fa-pause');
            recordIcon.classList.add('fa-play');

            // Change the button color to default (assuming default color is white)
            recordButton.querySelector('i').style.color = "#FFFFFF";
          };

          document.getElementById('spinner').style.display = 'none';
          isProcessing = false;
          updateVisualizerDisplay();
          //playAudio();
          // Removed the automatic play.
        })
        .catch(error => {
          console.error(error);

        });
    })
    .catch(error => {
      console.error(error);
      document.getElementById("spinner").style.display = "none";

      mediaRecorder = null;
      audioChunks = [];
      audioBlob = null;
      audio = null;
      source = null;
      stream = null;
      if (requestId) {
        cancelAnimationFrame(requestId);
        requestId = null;
      }

      // Reset the visuals of the record button
      const recordButton = document.getElementById('record');
      document.getElementById("reset").style.display = 'none';
      recordButton.querySelector('i').classList = 'fas fa-microphone';
      recordButton.classList.remove('active');
      document.getElementById('message').style.display = "block";
      document.getElementById('message').textContent = 'A problem came up.';
      
    });
}



let resizeObserver = new ResizeObserver(entries => {
  for (let entry of entries) {
    if (entry.target.id == 'container') {
      var container = document.getElementById('container');
      var canvas = document.getElementById('visualizer');
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    }
  }
});

resizeObserver.observe(document.getElementById('container'));

async function getStream() {
  if (stream) {
    return stream;
  } else {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  }
}
function draw() {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  let dpi = window.devicePixelRatio;
  let styleHeight = +getComputedStyle(canvas).getPropertyValue("height").slice(0, -2);
  let styleWidth = +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2);
  canvas.setAttribute('height', styleHeight * dpi);
  canvas.setAttribute('width', styleWidth * dpi);

  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  if (isRecording || (audio && !audio.paused && !audio.ended)) {
    analyser.getByteFrequencyData(dataArray);
  } else {
    dataArray.fill(0); // When audio is not playing, fill dataArray with zeros.
  }

  var numberOfBars = 20; // adjust this value to control the number of bars
  var barWidth = 17; // adjust this value to control the width of the bars
  var radius = barWidth / 2; 
  var spaceBetweenBars = (canvas.width - (numberOfBars * barWidth)) / (numberOfBars - 1); // Recalculate spaceBetweenBars based on canvas width, number of bars, and bar width.

  // New lines of code start here
  var minFreq = 80; // Hz
  var maxFreq = 1100; // Hz
  var sampleRate = audioContext.sampleRate; // assuming audioContext is your AudioContext instance
  var fftSize = analyser.fftSize;

  var minIndex = Math.floor(minFreq / (sampleRate / fftSize));
  var maxIndex = Math.floor(maxFreq / (sampleRate / fftSize));

  var freqBinsPerBar = Math.floor((maxIndex - minIndex) / numberOfBars);
  // New lines of code end here

  var barHeight;
  var x = 0;

  for(var i = 0; i < numberOfBars; i++) {
    var average = 0;
    // Modification of the existing loop starts here
    var barIndexStart = minIndex + i * freqBinsPerBar;
    var barIndexEnd = barIndexStart + freqBinsPerBar;

    for(var j = barIndexStart; j < barIndexEnd; j++) {
      average += dataArray[j];
    }
    average = average / freqBinsPerBar;
    // Modification of the existing loop ends here

    barHeight = average;
    barHeight = barHeight * canvas.height / 512;
    var yMiddle = canvas.height / 2;
    
    canvasCtx.fillStyle = 'rgb(255, 255, 255)';

    if (barHeight === 0) {
          // Draw a full circle when the audio level is at 0
          canvasCtx.beginPath();
          canvasCtx.arc(x + radius, yMiddle, radius, 0, 2 * Math.PI, false);
          canvasCtx.fill();
        } else {
          // Draw rounded rectangle when the audio level is greater than 0
          // Top semi-circle
          canvasCtx.beginPath();
          canvasCtx.arc(x + radius, yMiddle - barHeight / 2, radius, Math.PI, 0, false);
          canvasCtx.fill();

          // Middle rectangle
          canvasCtx.fillRect(x, yMiddle - barHeight / 2, barWidth, barHeight);

          // Bottom semi-circle
          canvasCtx.beginPath();
          canvasCtx.arc(x + radius, yMiddle + barHeight / 2, radius, 0, Math.PI, false);
          canvasCtx.fill();
        }

        x += barWidth + spaceBetweenBars; // Updated to use barWidth and recalculated spaceBetweenBars.
      }

      requestId = requestAnimationFrame(draw);
    }








function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}


function initAudioContext() {
      if(audioContext) audioContext.close();
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      dataArray = new Uint8Array(analyser.fftSize);
      canvas = document.getElementById("visualizer");
      canvasCtx = canvas.getContext("2d");
}

function startRecording() {
  getStream().then(stream => {
    initAudioContext();

    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.addEventListener("dataavailable", event => {
      audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", () => {
      stream.getTracks().forEach(track => track.stop());
      audioBlob = new Blob(audioChunks, { type: "audio/ogg; codecs=opus" });
      audioChunks = [];
      isProcessing = false;
      updateVisualizerDisplay();

      document.getElementById("reset").style.display = "block";

      processAndPlayAudio(audioBlob);
    });

    mediaRecorder.start();
    isProcessing = false;
    updateVisualizerDisplay();
    isRecording = true;
    document.getElementById('message').style.display = 'none';
    const recordButton = document.getElementById('record');
    recordButton.querySelector('i').classList.remove("fa-microphone");
    recordButton.querySelector('i').classList.add("fa-stop");
    recordButton.querySelector('i').style.color = "#FC0C84";
    document.getElementById('reset').style.display = 'none';
    draw();

    recordButton.classList.add("active");
  });
}

function playAudio() {
  if (audio.paused) {
    // Resume audio
    audio.play();

    if (audioBuffer) {
      source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      source.start(0);
      draw();
    }

    // Switch to pause icon
    const recordIcon = document.getElementById('record').querySelector('i');
    recordIcon.classList.remove('fa-play');
    recordIcon.classList.add('fa-pause');


    // Change the button color to default (assuming default color is white)
    recordIcon.style.color = "#FFFFFF";
  } else {
    // Pause audio
    audio.pause();

    if (source) {
      source.disconnect();
    }

    // Switch to play icon
    const recordIcon = document.getElementById('record').querySelector('i');
    recordIcon.classList.remove('fa-pause');
    recordIcon.classList.add('fa-play');

    // Change the button color to default (assuming default color is white)
    recordIcon.style.color = "#FFFFFF";
  }
}


document.getElementById("record").addEventListener("click", function () {
  // If the audioContext is in a suspended state, resume it
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  const recordButton = document.getElementById('record');
  const recordIcon = recordButton.querySelector('i');

  if (!mediaRecorder || isRecording) {
    if (!mediaRecorder) {
      // Start recording
      startRecording();
      isRecording = true;

      // Change the button color to recording color
      recordButton.querySelector('i').style.color = "#FC0C84";
    } else {
      // Stop recording
      mediaRecorder.stop();
      isRecording = false;
      
      // Switch to play icon
      recordIcon.classList.remove('fa-stop');
      recordIcon.classList.add('fa-play');

      // Change the button color to default (assuming default color is white)
      recordButton.querySelector('i').style.color = "#FFFFFF";
    }
  } else if (audio) {
    playAudio();
  }
});



document.getElementById('reset').addEventListener('click', function () {
  // Reset the state of the application to be ready for a new recording
  mediaRecorder = null;
  audioChunks = [];
  audioBlob = null;
  audio = null;
  source = null;
  stream = null;
  if (requestId) {
    cancelAnimationFrame(requestId);
    requestId = null;
  }

  // Reset the visuals of the record button
  const recordButton = document.getElementById('record');
  document.getElementById("reset").style.display = 'none';
  recordButton.querySelector('i').classList = 'fas fa-microphone';
  recordButton.classList.remove('active');

  // Now, trigger the start recording logic

  //startRecording();
});
