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
  const canvas = document.body.appendChild(document.createElement("canvas"));

  canvas.width = 640
  canvas.height = 360

  const ctx = canvas.getContext("2d")

  draw()
  function draw() {
    requestAnimationFrame(draw)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    /* starter */
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(canvas.width, canvas.height)
    ctx.stroke()
  }
}
