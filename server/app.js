const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Import routes
const apiRoutes = require('./routes/api');
const chatRoutes = require('./routes/chat');

// Import middleware
const authMiddleware = require('./middleware/auth');
const rateLimitMiddleware = require('./middleware/rateLimit');

// Import controllers
const ChatController = require('./controllers/chatController');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Rate limiting
app.use('/api', rateLimitMiddleware);

// Routes
app.use('/api', apiRoutes);
app.use('/chat', chatRoutes);

// Socket.IO cho real-time chat
const chatController = new ChatController();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('send-message', async (data) => {
    try {
      const response = await chatController.processMessage(data);
      
      // Gửi typing indicator
      socket.to(data.roomId).emit('typing-start');
      
      // Simulate AI thinking time
      setTimeout(() => {
        socket.to(data.roomId).emit('typing-stop');
        socket.to(data.roomId).emit('receive-message', response);
      }, 1000 + Math.random() * 2000);

    } catch (error) {
      socket.emit('error', { message: 'Có lỗi xảy ra khi xử lý tin nhắn' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} to view`);
});

module.exports = app;