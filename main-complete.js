/* setup audio */
const audio = new AudioContext()
const analyzer = audio.createAnalyser()

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
  navigator.getUserMedia({audio:true}, (stream) => {
    const streamNode = audio.createMediaStreamSource(stream)
    streamNode.connect(analyzer)

    initVisualizer()
  }, (err) => {
    console.error(err)
  })
}

/* rendering */
function initVisualizer() {
  analyzer.fftSize = 2048
  const bufferLength = analyzer.frequencyBinCount
  const waveformData = new Float32Array(bufferLength)
  const spectrumData = new Float32Array(bufferLength)

  const canvas = document.body.appendChild(document.createElement("canvas"));

  canvas.width = 640
  canvas.height = 360

  const ctx = canvas.getContext("2d")

  draw()
  function draw() {
    requestAnimationFrame(draw)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    analyzer.getFloatTimeDomainData(waveformData)
    analyzer.getFloatFrequencyData(spectrumData)

    /* starter */
    // ctx.beginPath()
    // ctx.moveTo(0, 0)
    // ctx.lineTo(640, 360)
    // ctx.stroke()

    /* naive oscilloscope */
    // ctx.beginPath()
    // for (let i = 0; i < bufferLength; i++) {
    //   const v = waveformData[i]
    //   const vn = v * 0.5 + 0.5 // normalize to range of 0 to 1

    //   const x = i / (bufferLength - 1) * canvas.width
    //   const y = (1 - vn) * canvas.height

    //   if (i === 0) {
    //     ctx.moveTo(x, y)
    //   } else {
    //     ctx.lineTo(x, y)
    //   }
    // }
    // ctx.stroke()

    /* frequency spectrum */
    const minDecibels = -130
    const maxDecibels = -30
    const logFactor = 20
    ctx.beginPath()
    for (let i = 0; i < bufferLength; i++) {
      const v = spectrumData[i]
      const vn = (v - minDecibels) / (maxDecibels - minDecibels)

      // naive linear
      // const x = i / (bufferLength - 1) * canvas.width
      // logarithmic
      const xn = i / (bufferLength - 1)
      const x = Math.log(xn * logFactor + 1) / Math.log(logFactor + 1) * canvas.width
      const y = (1 - vn) * canvas.height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    /* sync oscilloscope */
    // find max in middle
    let syncMaxValue = -Infinity
    let syncMaxIndex = bufferLength / 4
    for (let i = 0; i < bufferLength / 2; i++) {
      const index = i + bufferLength / 4
      const v = waveformData[index]
      if (v > syncMaxValue) {
        syncMaxValue = v
        syncMaxIndex = index
      }
    }

    /* normalize wave */
    let ampMin = Math.min(...waveformData)
    let ampMax = Math.max(...waveformData)
    let amp = Math.max(Math.abs(ampMin), Math.abs(ampMax))
    let scaleY = 1 / Math.pow(amp, 0.5)

    ctx.beginPath()
    for (let i = 0; i < bufferLength / 2; i++) {
      const index = i + syncMaxIndex - bufferLength / 4
      const v = waveformData[index]
      const vn = v * 0.5 * scaleY + 0.5

      const x = i / (bufferLength / 2 - 1) * canvas.width
      // const y = (1 - vn) * canvas.height
      const y = (1 - vn) * canvas.height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }
}
