(function () {
  const $ = (sel) => document.querySelector(sel);
  const logEl = $('#logs');
  const log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    console.log(...args);
    logEl.textContent += `\n${new Date().toLocaleTimeString()} ${msg}`;
    logEl.scrollTop = logEl.scrollHeight;
  };

  const btnStart = $('#btnStart');
  const btnStop = $('#btnStop');
  const btnCreate = $('#btnCreate');
  const btnJoin = $('#btnJoin');
  const btnLeave = $('#btnLeave');
  const roomInput = $('#roomId');
  const localVideo = $('#localVideo');
  const remoteVideo = $('#remoteVideo');

  let socket = null;
  let pc = null;
  let localStream = null;
  let roomId = null;
  let isCreator = false;

  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

  function enable(el, on) { el.disabled = !on; }

  function createPeerConnection() {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (e) => {
      if (e.candidate && roomId) {
        socket.emit('ice-candidate', { roomId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      log('Remote track');
      remoteVideo.srcObject = e.streams[0];
    };

    pc.onconnectionstatechange = () => {
      log('PC state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // optional: cleanup
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    }

    return pc;
  }

  async function startMedia() {
    if (localStream) return;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localVideo.srcObject = localStream;
      enable(btnCreate, true);
      enable(btnJoin, true);
      enable(btnStart, false);
      enable(btnStop, true);
      log('Media started');
    } catch (err) {
      log('getUserMedia error:', err.message || err);
      alert('Permission or device error. Please allow camera/mic.');
    }
  }

  function stopMedia() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
      localVideo.srcObject = null;
    }
    if (pc) {
      pc.close();
      pc = null;
    }
    enable(btnCreate, false);
    enable(btnJoin, false);
    enable(btnStart, true);
    enable(btnStop, false);
  }

  function connectSocket() {
    if (socket) return;
    const host = location.hostname || '127.0.0.1';
    const url = `http://${host}:3000`;
    socket = io(url, { transports: ['websocket'] });

    socket.on('connect', () => log('Socket connected', socket.id));
    socket.on('disconnect', () => {
      log('Socket disconnected');
      // Reset UI states if disconnected unexpectedly
      enable(btnLeave, false);
      roomId = null;
      isCreator = false;
      if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(t => t.stop());
        remoteVideo.srcObject = null;
      }
      if (pc) {
        pc.close();
        pc = null;
      }
    });

    socket.on('user-joined', async ({ socketId }) => {
      log('Peer joined:', socketId);
      if (isCreator && roomId) {
        await makeOffer();
      }
    });

    socket.on('offer', async ({ sdp }) => {
      log('Offer received');
      const peer = createPeerConnection();
      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', { roomId, sdp: peer.localDescription });
      log('Answer sent');
    });

    socket.on('answer', async ({ sdp }) => {
      log('Answer received');
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      try {
        if (candidate) {
          await pc?.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        log('ICE add error:', err.message || err);
      }
    });

    socket.on('user-left', ({ socketId }) => {
      log('Peer left:', socketId);
      if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(t => t.stop());
        remoteVideo.srcObject = null;
      }
      if (pc) {
        pc.close();
        pc = null;
      }
    });
  }

  async function makeOffer() {
    const peer = createPeerConnection();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit('offer', { roomId, sdp: peer.localDescription });
    log('Offer sent');
  }

  // UI Handlers
  btnStart.addEventListener('click', startMedia);
  btnStop.addEventListener('click', stopMedia);

  btnCreate.addEventListener('click', () => {
    connectSocket();
    isCreator = true;
    socket.emit('create-room', (resp) => {
      if (resp?.roomId) {
        roomId = resp.roomId;
        roomInput.value = roomId;
        enable(btnLeave, true);
        log('Room created:', roomId);
        createPeerConnection();
      }
    });
  });

  btnJoin.addEventListener('click', () => {
    connectSocket();
    const r = roomInput.value.trim();
    if (!r) return alert('Enter Room ID to join');
    isCreator = false;
    socket.emit('join-room', { roomId: r }, (resp) => {
      if (resp?.ok) {
        roomId = r;
        enable(btnLeave, true);
        createPeerConnection();
        log('Joined room:', roomId);
      } else {
        const err = resp?.error || 'unknown';
        log('Join error:', err);
        const messages = {
          'invalid-room-id': 'Mã phòng không hợp lệ (yêu cầu 6 ký tự a-z0-9).',
          'room-not-found': 'Không tìm thấy phòng. Hãy kiểm tra lại mã phòng.',
          'room-full': 'Phòng đã đủ 2 người.',
          'join-failed': 'Tham gia phòng thất bại do lỗi hệ thống.'
        };
        alert('Join failed: ' + (messages[err] || err));
      }
    });
  });

  btnLeave.addEventListener('click', () => {
    if (!roomId) return;
    socket?.emit('leave-room', { roomId });
    roomId = null;
    isCreator = false;
    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(t => t.stop());
      remoteVideo.srcObject = null;
    }
    if (pc) {
      pc.close();
      pc = null;
    }
    enable(btnLeave, false);
    log('Left room');
  });

  // Autoconnect socket only when needed; user must start media first to enable buttons
})();
