const AIEngine = require('../ai-engine/neuralNetwork');
const Conversation = require('../models/Conversation');

class ChatController {
  constructor() {
    this.aiEngine = new AIEngine();
    this.conversationHistory = new Map();
    this.init();
  }

  async init() {
    await this.aiEngine.loadModel();
  }

  async processMessage(data) {
    const { message, userId, roomId, timestamp } = data;
    
    try {
      // Get conversation history
      if (!this.conversationHistory.has(roomId)) {
        this.conversationHistory.set(roomId, []);
      }
      
      const history = this.conversationHistory.get(roomId);
      
      // Add user message to history
      history.push({
        role: 'user',
        message: message,
        timestamp: timestamp || Date.now()
      });

      // Process with AI
      const aiResponse = await this.aiEngine.generateResponse(message);
      const advancedAnalysis = await this.aiEngine.processAdvanced(message);
      
      // Generate contextual response
      let responseText = aiResponse.text;
      
      // Add context based on sentiment
      if (advancedAnalysis.sentiment === 'negative') {
        responseText = this.addEmpathy(responseText);
      }
      
      // Add AI response to history
      const aiMessage = {
        role: 'assistant',
        message: responseText,
        timestamp: Date.now(),
        confidence: aiResponse.confidence,
        intent: aiResponse.intent,
        analysis: advancedAnalysis
      };
      
      history.push(aiMessage);
      
      // Keep only last 20 messages
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      
      // Save to database (optional)
      await this.saveConversation(roomId, aiMessage);
      
      return {
        ...aiMessage,
        roomId,
        userId
      };
      
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        role: 'assistant',
        message: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.',
        timestamp: Date.now(),
        error: true
      };
    }
  }

  addEmpathy(response) {
    const empathyPrefixes = [
      "Tôi hiểu cảm xúc của bạn. ",
      "Tôi thấy bạn có vẻ không vui. ",
      "Xin lỗi vì điều đó. "
    ];
    
    const randomPrefix = empathyPrefixes[Math.floor(Math.random() * empathyPrefixes.length)];
    return randomPrefix + response;
  }

  async saveConversation(roomId, message) {
    try {
      // Implement database save logic here
      console.log(`Saving conversation for room ${roomId}:`, message);
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  getConversationHistory(roomId) {
    return this.conversationHistory.get(roomId) || [];
  }

  clearConversationHistory(roomId) {
    this.conversationHistory.delete(roomId);
  }
}

module.exports = ChatController;