const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
require('dotenv').config();

const app = express();

// LINE 配置
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const lineClient = new line.Client(lineConfig);

// DeepSeek API 配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// 設置路由
app.get('/', (req, res) => {
  res.send('LINE Bot is running!');
});

// 設置 Express 中間件
app.use('/webhook', line.middleware(lineConfig));

// 處理 LINE Webhook 事件
app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;
    
    // 處理每個事件
    await Promise.all(events.map(handleEvent));
    
    res.status(200).end();
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).end();
  }
});

// 處理單個事件
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // 從用戶獲取消息
  const userMessage = event.message.text;
  
  try {
    // 調用 DeepSeek API
    const response = await callDeepSeekAPI(userMessage);
    
    // 回覆給用戶
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: response
    });
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    
    // 回覆錯誤消息
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '抱歉，我遇到了一些問題。請稍後再試。'
    });
  }
}

// 調用 DeepSeek API
async function callDeepSeekAPI(message) {
  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat', // 或其他 DeepSeek 支持的模型
        messages: [
          { role: 'user', content: message }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );

    // 從 DeepSeek 回應中提取文本
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API error:', error.response?.data || error.message);
    throw error;
  }
}

// 啟動服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});