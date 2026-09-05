import { BrowserWindow } from 'electron'
import { pathToFileURL } from 'url'

const SPLASH_MS = 700

export function showSplash(iconPath: string): {
  window: BrowserWindow
  finished: Promise<void>
} {
  const logoUrl = pathToFileURL(iconPath).href
  const win = new BrowserWindow({
    width: 460,
    height: 420,
    frame: false,
    resizable: false,
    movable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#12243f',
    icon: iconPath,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  })

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      height: 100%;
      overflow: hidden;
      background: #12243f;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: #f4f1ea;
    }
    .stage {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .ring {
      width: 132px;
      height: 132px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 50% 40%, #234775, #12243f 72%);
      box-shadow: 0 0 0 2px #c9a227, 0 16px 40px rgba(0,0,0,.35);
      animation: pop 700ms cubic-bezier(.2,1.1,.3,1) both, glow 1.6s ease-in-out 500ms infinite alternate;
    }
    img {
      width: 86px;
      height: 86px;
      border-radius: 50%;
      object-fit: cover;
      animation: roll 500ms linear infinite;
    }
    h1 {
      margin: 22px 0 0;
      font-size: 22px;
      letter-spacing: .08em;
      animation: rise 700ms ease 280ms both;
    }
    p {
      margin: 8px 0 0;
      color: #c9a227;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: .18em;
      text-transform: uppercase;
      animation: rise 700ms ease 420ms both;
    }
    @keyframes roll {
      to { transform: rotate(360deg); }
    }
    @keyframes pop {
      from { transform: scale(.55); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes glow {
      from { box-shadow: 0 0 0 2px #c9a227, 0 16px 40px rgba(0,0,0,.35); }
      to { box-shadow: 0 0 0 6px rgba(201,162,39,.35), 0 16px 48px rgba(201,162,39,.2); }
    }
    @keyframes rise {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="stage">
    <div class="ring"><img src="${logoUrl}" alt="Topline Stores" /></div>
    <h1>TOPLINE STORES</h1>
    <p>Receipt System</p>
  </div>
</body>
</html>`

  const finished = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, SPLASH_MS)
    win.on('closed', () => {
      clearTimeout(timer)
      resolve()
    })
  })

  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  win.once('ready-to-show', () => {
    win.show()
  })

  return { window: win, finished }
}

export function closeSplash(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return
  win.close()
}
