/* setup audio */
// create audio context for all audio things
const audio = new AudioContext()
// create analyzer node to use later
const analyzer = audio.createAnalyser()

const [realNode, imaginaryNode] = createHilbertFilter(audio)
const realAnalyzer = realNode.connect(audio.createAnalyser())
const imaginaryAnalyzer = imaginaryNode.connect(audio.createAnalyser())

// handle how chrome requires a user gesture to get audio running
if (audio.state === "suspended") {
  const enableAudioButton = document.body.appendChild(document.createElement("button"))
  enableAudioButton.textContent = "Enable Audio Input"

  enableAudioButton.onclick = () => {
    enableAudioButton.remove()
    audio.resume()
    setupAudioInput()
  }
} else {
  setupAudioInput()
}

function setupAudioInput() {
  // ask for mic input
  navigator.mediaDevices.getUserMedia({audio:true}).then((stream) => {
    // take mic stream and connect to analyzer
    const streamNode = audio.createMediaStreamSource(stream)
    streamNode.connect(analyzer)

    streamNode.connect(realNode)
    streamNode.connect(imaginaryNode)

    initVisualizer()
  }, (err) => {
    console.error(err)
  })
}

/* rendering */
function initVisualizer() {
  // create canvas
  const canvas = document.body.appendChild(document.createElement("canvas"));

  // set dimensions
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  // get canvas context to draw in
  const ctx = canvas.getContext("2d")

  // set how many samples the analyzer takes
  analyzer.fftSize = 2048

  // get number of samples from analyzer
  const bufferLength = analyzer.frequencyBinCount

  // create buffers to put the samples in
  const waveformData = new Float32Array(bufferLength)
  const spectrumData = new Float32Array(bufferLength)

  realAnalyzer.fftSize = 1024
  imaginaryAnalyzer.fftSize = 1024
  const hilbertBufferLength = realAnalyzer.frequencyBinCount
  const realData = new Float32Array(hilbertBufferLength)
  const imaginaryData = new Float32Array(hilbertBufferLength)

  draw()
  function draw() {
    // draw every 60 frames
    requestAnimationFrame(draw)

    // clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // put analyzer samples into buffers
    analyzer.getFloatTimeDomainData(waveformData)
    analyzer.getFloatFrequencyData(spectrumData)

    realAnalyzer.getFloatTimeDomainData(realData)
    imaginaryAnalyzer.getFloatTimeDomainData(imaginaryData)

    /* starter: draw a line */
    // ctx.beginPath()
    // ctx.moveTo(0, 0)
    // ctx.lineTo(640, 360)
    // ctx.stroke()

    /* naive oscilloscope */
    // ctx.beginPath()
    // for (let i = 0; i < bufferLength; i++) {
    //   // get sample
    //   const v = waveformData[i]
    //   // normalize sample to range of 0 to 1
    //   const vn = v * 0.5 + 0.5

    //   // get x and y position of the sample
    //   // n - 1 because last sample index is n - 1
    //   const x = i / (bufferLength - 1) * canvas.width
    //   // 1 - value because y is down
    //   const y = (1 - vn) * canvas.height

    //   if (i === 0) {
    //     // move to sample
    //     ctx.moveTo(x, y)
    //   } else {
    //     // draw line to sample
    //     ctx.lineTo(x, y)
    //   }
    // }
    // ctx.stroke()

    /* frequency spectrum */
    // set decibel range
    const minDecibels = -130
    const maxDecibels = -30
    // set logarithmic spacing factor
    const logFactor = 20
    ctx.beginPath()
    for (let i = 0; i < bufferLength; i++) {
      // get frequency bin
      const v = spectrumData[i]
      // normalize from 0 to 1 according to decibel range
      const vn = (v - minDecibels) / (maxDecibels - minDecibels)

      // get x position of bin (linear)
      // const x = i / (bufferLength - 1) * canvas.width
      // get logarithmically spaced x position of bin
      const xn = i / (bufferLength - 1)
      const x = Math.log(xn * logFactor + 1) / Math.log(logFactor + 1) * canvas.width

      // get y position
      const y = (1 - vn) * canvas.height

      if (i === 0) {
        // move to sample
        ctx.moveTo(x, y)
      } else {
        // draw line to sample
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    /* synchronized amplitude-adjusted oscilloscope */

    // find max value in range [N/4, N*3/4]
    let syncMaxValue = -Infinity
    let syncIndex = bufferLength / 4
    // iterate through half the buffer length
    for (let i = 0; i < bufferLength / 2; i++) {
      // start 1/4 the way through
      const index = i + bufferLength / 4
      const v = waveformData[index]
      // get max value and index of max value so far
      if (v > syncMaxValue) {
        syncMaxValue = v
        syncIndex = index
      }
    }

    // get peak absolute amplitude
    let ampMin = Math.min(...waveformData)
    let ampMax = Math.max(...waveformData)
    let amp = Math.max(Math.abs(ampMin), Math.abs(ampMax))

    // get amplitude scaling factor to adjust amplitude
    let scaleY = 1 / Math.pow(amp, 0.5)

    // draw sync amp-adjusted scope
    ctx.beginPath()
    // we're only plotting half the samples
    for (let i = 0; i < bufferLength / 2; i++) {
      // start at 1/4 before the sync index
      const index = i + syncIndex - bufferLength / 4

      const v = waveformData[index]

      // no adjustment to amplitude
      // const vn = v * 0.5 + 0.5

      // adjust amplitude by scaling factor
      const vn = v * 0.5 * scaleY + 0.5

      // get x and y position
      const x = i / (bufferLength / 2 - 1) * canvas.width
      const y = (1 - vn) * canvas.height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    /* hilbertscope */
    ctx.beginPath()
    for (let i = 0; i < hilbertBufferLength; i++) {
      const re = realData[i] * 0.5 + 0.5
      const im = imaginaryData[i] * 0.5 + 0.5

      const x = re * canvas.height
      const y = im * canvas.height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }
}

/** @param {AudioContext} context */
function createHilbertFilter (context) {
  let filterLength = 768
  // let filterLength = FFT_SIZE - N
  if (filterLength % 2 === 0) {
    filterLength -= 1
  }
  let impulse = new Float32Array(filterLength)

  let mid = ((filterLength - 1) / 2) | 0

  for (let i = 0; i <= mid; i++) {
    // hamming window
    let k = 0.53836 + 0.46164 * Math.cos(i * Math.PI / (mid + 1))
    if (i % 2 === 1) {
      let im = 2 / Math.PI / i
      impulse[mid + i] = k * im
      impulse[mid - i] = k * -im
    }
  }

  let impulseBuffer = context.createBuffer(2, filterLength, context.sampleRate)
  impulseBuffer.copyToChannel(impulse, 0)
  impulseBuffer.copyToChannel(impulse, 1)
  let hilbert = context.createConvolver()
  hilbert.normalize = false
  hilbert.buffer = impulseBuffer

  let delayTime = mid / context.sampleRate
  let delay = context.createDelay(delayTime)
  delay.delayTime.value = delayTime

  return [delay, hilbert]
}
