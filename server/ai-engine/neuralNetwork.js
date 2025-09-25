const brain = require('brain.js');
const natural = require('natural');
const fs = require('fs').promises;
const path = require('path');

class AIEngine {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [10, 8, 6],
      activation: 'sigmoid'
    });
    
    this.tokenizer = natural.WordTokenizer;
    this.stemmer = natural.PorterStemmer;
    this.classifier = new natural.BayesClassifier();
    
    this.vocabulary = new Set();
    this.intents = {};
    this.responses = {};
    this.isTrained = false;
  }

  // Preprocessing text
  preprocessText(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(' ')
      .map(word => this.stemmer.stem(word))
      .filter(word => word.length > 2);
  }

  // Chuyển text thành vector
  textToVector(text) {
    const words = this.preprocessText(text);
    const vector = new Array(100).fill(0);
    
    words.forEach((word, index) => {
      if (index < 100) {
        vector[index] = Array.from(word).reduce((sum, char) => 
          sum + char.charCodeAt(0), 0) / 1000;
      }
    });
    
    return vector;
  }

  // Load training data
  async loadTrainingData() {
    try {
      const dataPath = path.join(__dirname, '../../data');
      
      // Load intents
      const intentsData = await fs.readFile(
        path.join(dataPath, 'intents.json'), 'utf8'
      );
      const intents = JSON.parse(intentsData);

      // Load knowledge base
      const knowledgeData = await fs.readFile(
        path.join(dataPath, 'knowledge-base.json'), 'utf8'
      );
      const knowledge = JSON.parse(knowledgeData);

      return { intents, knowledge };
    } catch (error) {
      console.error('Error loading training data:', error);
      return { intents: { intents: [] }, knowledge: { qa_pairs: [] } };
    }
  }

  // Train AI model
  async train() {
    console.log('🧠 Starting AI training...');
    
    const { intents, knowledge } = await this.loadTrainingData();
    const trainingData = [];

    // Process intents
    intents.intents.forEach(intent => {
      intent.patterns.forEach(pattern => {
        const input = this.textToVector(pattern);
        const output = {};
        output[intent.tag] = 1;
        
        trainingData.push({ input, output });
        
        // Store responses
        if (!this.responses[intent.tag]) {
          this.responses[intent.tag] = intent.responses;
        }
        
        // Train classifier
        this.classifier.addDocument(pattern, intent.tag);
      });
    });

    // Process Q&A pairs
    knowledge.qa_pairs.forEach(pair => {
      const input = this.textToVector(pair.question);
      const output = { 'qa_response': 1 };
      
      trainingData.push({ input, output });
      
      if (!this.responses['qa_response']) {
        this.responses['qa_response'] = [];
      }
      this.responses['qa_response'].push(pair.answer);
    });

    // Train neural network
    console.log('Training neural network...');
    this.network.train(trainingData, {
      iterations: 2000,
      errorThresh: 0.005,
      log: true,
      logPeriod: 100,
      learningRate: 0.3
    });

    // Train classifier
    console.log('Training classifier...');
    this.classifier.train();

    this.isTrained = true;
    console.log('✅ AI training completed!');
    
    // Save trained model
    await this.saveModel();
  }

  // Save model
  async saveModel() {
    try {
      const modelData = {
        network: this.network.toJSON(),
        responses: this.responses,
        vocabulary: Array.from(this.vocabulary)
      };
      
      await fs.writeFile(
        path.join(__dirname, '../../data/trained-model.json'),
        JSON.stringify(modelData, null, 2)
      );
      
      console.log('💾 Model saved successfully');
    } catch (error) {
      console.error('Error saving model:', error);
    }
  }

  // Load trained model
  async loadModel() {
    try {
      const modelData = await fs.readFile(
        path.join(__dirname, '../../data/trained-model.json'), 'utf8'
      );
      const model = JSON.parse(modelData);
      
      this.network.fromJSON(model.network);
      this.responses = model.responses;
      this.vocabulary = new Set(model.vocabulary);
      this.isTrained = true;
      
      console.log('✅ Model loaded successfully');
    } catch (error) {
      console.log('No saved model found, need to train first');
      await this.train();
    }
  }

  // Generate response
  async generateResponse(input) {
    if (!this.isTrained) {
      await this.loadModel();
    }

    const inputVector = this.textToVector(input);
    const output = this.network.run(inputVector);
    
    // Find best intent
    let bestIntent = '';
    let bestScore = 0;
    
    Object.keys(output).forEach(intent => {
      if (output[intent] > bestScore) {
        bestScore = output[intent];
        bestIntent = intent;
      }
    });

    // Use classifier as backup
    if (bestScore < 0.7) {
      bestIntent = this.classifier.classify(input);
      bestScore = this.classifier.getClassifications(input)[0].value;
    }

    // Generate response
    if (bestScore > 0.5 && this.responses[bestIntent]) {
      const responses = this.responses[bestIntent];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      return {
        text: randomResponse,
        confidence: bestScore,
        intent: bestIntent
      };
    }

    return {
      text: "Xin lỗi, tôi không hiểu câu hỏi của bạn. Bạn có thể diễn đạt lại không?",
      confidence: 0,
      intent: 'unknown'
    };
  }

  // Advanced NLP processing
  async processAdvanced(input) {
    const compromise = require('compromise');
    const doc = compromise(input);
    
    // Extract entities
    const people = doc.people().out('array');
    const places = doc.places().out('array');
    const organizations = doc.organizations().out('array');
    const dates = doc.dates().out('array');
    
    // Sentiment analysis (simple)
    const positiveWords = ['good', 'great', 'awesome', 'love', 'like', 'happy'];
    const negativeWords = ['bad', 'hate', 'sad', 'angry', 'terrible', 'awful'];
    
    const words = input.toLowerCase().split(' ');
    let sentiment = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) sentiment += 1;
      if (negativeWords.includes(word)) sentiment -= 1;
    });
    
    return {
      entities: { people, places, organizations, dates },
      sentiment: sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral',
      sentimentScore: sentiment
    };
  }
}

module.exports = AIEngine;