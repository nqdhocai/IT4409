# WebRTC Phase A — Local Setup

Local environment for a 1:1 WebRTC demo using a Socket.IO signaling server and a static frontend.

- Signaling server: http://localhost:3000
- Frontend: http://localhost:8080
- Note: For localhost, most browsers treat it as a secure context so `getUserMedia` works over HTTP.

## Prerequisites

- Node.js 18+ and npm installed
- Windows PowerShell (commands below use PowerShell syntax)

Check versions:

```powershell
node -v
npm -v
```

## Install

From the project root:

```powershell
npm install
```

## Run — Signaling Server (Socket.IO)

Dev mode with auto-restart:

```powershell
npm run dev
```

Prod mode:

```powershell
npm start
```

The server will log:

```
Signaling server on :3000
```

## Run — Frontend (static)

Serve the `public` folder at http://localhost:8080:

```powershell
npm run serve:frontend
```

Then open `http://localhost:8080` in two different tabs or browsers to test 1:1.

## How it works

- Click "Start Camera/Mic" to grant permissions.
- Create a room on one tab (Room ID appears). On the other tab, paste the Room ID and Join.
- The server relays SDP offers/answers and ICE candidates via Socket.IO.
- STUN: `stun:stun.l.google.com:19302`

## HTTPS / WSS

- Production must use HTTPS + WSS (secure websockets).
- Localhost is typically considered a secure context by browsers; HTTP is acceptable for local testing.
- When deploying, put the signaling server behind HTTPS (e.g., reverse proxy) and use `io(new URL('wss://your-domain'), ...)` on the client.

## Troubleshooting

- If camera/mic don’t work: check site permissions in the browser.
- Firewall prompts: allow Node.js and http-server to listen on 3000 and 8080.
- If remote video is black: ensure both peers started media and joined the same Room ID.
- If CORS blocks: signaling server allows origin `http://localhost:8080` by default; adjust in `server.js` if needed.

## Scripts

- `npm run dev` — start signaling server with nodemon on :3000
- `npm start` — start signaling server with node on :3000
- `npm run serve:frontend` — serve `public/` on :8080

## License

MIT
