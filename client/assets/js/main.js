class AIAssistant {
  constructor() {
    this.currentRoomId = 'default-room';
    this.userId = this.generateUserId();
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];

    // Settings
    this.settings = {
      theme: localStorage.getItem('theme') || 'light',
      fontSize: localStorage.getItem('fontSize') || 'medium',
      soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
      responseSpeed: localStorage.getItem('responseSpeed') || 'normal',
      typingIndicator: localStorage.getItem('typingIndicator') !== 'false'
    };

    this.init();
  }

  init() {
    this.initializeSocket();
    this.bindEvents();
    this.applySettings();
    this.loadConversationHistory();
  }

  generateUserId() {
    return 'user_' + Math.random().toString(36).substring(2, 15);
  }

  // REST API initialization (no socket)
  initializeSocket() {
    this.updateConnectionStatus(true);
  }

  bindEvents() {
    // Menu navigation
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.switchView(e.currentTarget.dataset.view);
      });
    });

    // Send message
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    sendBtn.addEventListener('click', () => this.sendMessage());
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    messageInput.addEventListener('input', (e) => {
      this.autoResizeTextarea(e.target);
      this.updateCharCount(e.target.value.length);
    });

    // Quick buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const message = e.currentTarget.dataset.message;
        messageInput.value = message;
        this.sendMessage();
      });
    });

    // File upload
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    // Voice recording
    const voiceBtn = document.getElementById('voiceBtn');
    voiceBtn.addEventListener('click', () => this.toggleVoiceRecording());

    // Settings
    this.bindSettingsEvents();

    // Chat controls
    document.getElementById('clearChat').addEventListener('click', () => {
      this.clearChat();
    });
    document.getElementById('exportChat').addEventListener('click', () => {
      this.exportChat();
    });

    // Modal
    const modal = document.getElementById('fileModal');
    const modalClose = modal.querySelector('.modal-close');
    modalClose.addEventListener('click', () => {
      modal.classList.remove('show');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });

    // Typing indicator
    document.getElementById('typingIndicator').addEventListener('change', (e) => {
      this.changeSetting('typingIndicator', e.target.checked);
    });

    // Clear all data
    document.getElementById('clearAllData').addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu? Hành động này không thể hoàn tác.')) {
        this.clearAllData();
      }
    });

    // Export data
    document.getElementById('exportData').addEventListener('click', () => {
      this.exportAllData();
    });
  }

  // -------- Message Handling --------
  async sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (!message) return;

    const messageData = {
      message,
      userId: this.userId,
      roomId: this.currentRoomId,
      timestamp: Date.now()
    };

    // Display user message immediately
    this.displayMessage({
      role: 'user',
      message,
      timestamp: Date.now()
    });

    // Send to backend
    try {
      const res = await fetch('/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });
      const data = await res.json();
      if (data && data.reply) {
        this.displayMessage({
          role: 'ai',
          message: data.reply,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      this.displayErrorMessage('Lỗi gửi tin nhắn: ' + err.message);
    }

    // Clear input
    messageInput.value = '';
    this.autoResizeTextarea(messageInput);
    this.updateCharCount(0);

    // Save to history
    this.saveMessageToHistory(messageData);
  }

  displayMessage(data) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.role}-message`;
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    messageDiv.innerHTML = `
      <div class="message-content">
        <p>${this.formatMessage(data.message)}</p>
      </div>
      <div class="message-meta">
        <span class="timestamp">${timestamp}</span>
      </div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  formatMessage(message) {
    message = message.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank">$1</a>'
    );
    message = message.replace(
      /```([\s\S]*?)```/g,
      '<pre><code>$1</code></pre>'
    );
    return message;
  }

  // -------- File Upload --------
  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      this.displayErrorMessage('Unsupported file type');
      return;
    }
    if (file.size > maxSize) {
      this.displayErrorMessage('File size exceeds 5MB limit');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', this.userId);
    formData.append('roomId', this.currentRoomId);

    fetch('/upload', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          this.displayMessage({
            role: 'user',
            message: `Uploaded file: ${file.name}`,
            timestamp: Date.now()
          });
        } else {
          this.displayErrorMessage('File upload failed');
        }
      })
      .catch(() => this.displayErrorMessage('File upload failed'));
  }

  // -------- Voice Recording --------
  async toggleVoiceRecording() {
    if (!this.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.recordedChunks = [];

        this.mediaRecorder.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0) this.recordedChunks.push(e.data);
        });

        this.mediaRecorder.addEventListener('stop', () => {
          const audioBlob = new Blob(this.recordedChunks);
          this.sendVoiceMessage(audioBlob);
        });

        this.mediaRecorder.start();
        this.isRecording = true;
        document.getElementById('voiceBtn').classList.add('recording');
      } catch (error) {
        this.displayErrorMessage('Could not access microphone');
      }
    } else {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;
      document.getElementById('voiceBtn').classList.remove('recording');
    }
  }

  sendVoiceMessage(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('userId', this.userId);
    formData.append('roomId', this.currentRoomId);

    fetch('/upload-voice', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          this.displayMessage({
            role: 'user',
            message: 'Voice message sent',
            timestamp: Date.now()
          });
        } else {
          this.displayErrorMessage('Voice message failed to send');
        }
      })
      .catch(() => this.displayErrorMessage('Voice message failed to send'));
  }
}
