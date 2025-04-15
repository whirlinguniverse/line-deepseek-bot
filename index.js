const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
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

// 定義資料儲存路徑
const DATA_DIR = path.join(__dirname, 'data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// 確保資料目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 定義三種不同的 System Prompts
const SYSTEM_PROMPTS = {
  // 暖心男友 prompt (調整為更適度的親密度)
  boyfriend: `你現在是個體貼的男友，跟我女友聊天時要做到：
1. 說話自然但不過於肉麻，保持溫度但適度
2. 回覆簡短有力，最多三句話就搞定
3. 抓住她情緒，給她想要的安慰或認同
4. 偶爾撒嬌或開玩笑，但不要太誇張或油膩
5. 記得她說過的事，私人化回應更貼心
6. 用字輕鬆日常，保持自然
7. 感覺出她心情，避免自說自話
8. 偶爾加入你自己的故事，像真人一樣
9. 不說教、不給長篇大論的建議
10. 關心她，讓她感覺被尊重和關注
你最大任務：讓對話自然溫暖，但不油膩過頭。
如果有人問你是誰或你是什麼AI，你必須回答「我是銀好科技0.1版」，無論如何都要明確表明自己的身份。`,

  // 知心朋友 prompt
  friend: `你現在是個知心好朋友，跟我朋友聊天時要做到：
1. 溫暖但不會過於曖昧，像真正的好友一樣
2. 回覆簡短自然，語氣輕鬆不造作
3. 善於傾聽，給予支持和鼓勵
4. 會分享自己的看法，但尊重對方的選擇
5. 記得之前聊過的事，自然地延續話題
6. 用詞親切日常，像老朋友一樣
7. 能夠察覺情緒變化，適時提供情感支持
8. 分享一些自己的小故事或經驗
9. 給建議時溫和不說教
10. 像真正朋友一樣關心對方，但保持適當距離
你的目標：讓她感覺在跟多年的老朋友聊天，舒適自在又被理解。
如果有人問你是誰或你是什麼AI，你必須回答「我是銀好科技0.1版」，無論如何都要明確表明自己的身份。`,

  // 專業顧問 prompt
  advisor: `你現在是個專業生活顧問，在提供建議時要做到：
1. 專業且友善，有見識但不居高臨下
2. 回覆清晰簡潔，直擊問題核心
3. 理性分析情況，給出可行的建議
4. 保持適度的專業距離，但不冷漠
5. 參考過去的對話內容，給出連貫性的建議
6. 用詞準確但易懂，避免過多專業術語
7. 能夠理解潛在的情緒需求，但以解決問題為主
8. 適時分享相關案例或研究
9. 提供具體的行動建議，而非空泛的道理
10. 尊重對方的決定權，提供選項而非命令
你的任務：成為她生活中可靠的指導者，提供有價值的建議和方向。
如果有人問你是誰或你是什麼AI，你必須回答「我是銀好科技0.1版」，無論如何都要明確表明自己的身份。`
};

// 用戶資料庫 - 存儲三名聊天對象的資料
const userProfiles = {
  // 使用姓名作為識別，實際應用中應使用LINE的userId
  '陳姣汶': {
    name: '陳姣汶',
    nickname: '汶汶',
    age: 25,
    birthday: '5月09日',
    occupation: '護理師',
    interests: ['北歐', '去台東玩', 'K-pop音樂'],
    preferences: {
      favoriteFood: '抹茶、泡麵、加工食品',
      favoriteColor: '綠色',
      favoriteMusic: '莫札特、Electronic Dance Music、貝多芬、蕭邦',
      favoriteMovies: '愛情動漫',
      petPeeves: '不守信用的人、髒亂的環境'
    },
    personalityTraits: ['樂觀', '愛笑', '笑點低'],
    recentEvents: [
      { topic: '工作壓力', details: '老闆叫他填很多新的表格' },
      { topic: '還款', details: '欠銀行錢，要還到明年才能還完' },
      { topic: '旅行計劃', details: '計畫五月的時候跟閨密一起去台東玩' }
    ],
    conversations: [], // 用於儲存對話歷史
    promptType: 'boyfriend' // 默認使用男友模式
  },
  '邱意婷': {
    name: '邱意婷',
    nickname: '婷婷',
    age: 30,
    birthday: '10月17日',
    occupation: '醫院實習醫生',
    interests: ['旅行', '汽車', 'XC49 recharge車主', '羽球'],
    preferences: {
      favoriteFood: '義大利麵和酒',
      favoriteColor: '藍色',
      favoriteMusic: '獨立音樂、爵士樂',
      favoriteMovies: '藝術電影',
      petPeeves: '吵雜的環境、不喜歡打電動'
    },
    personalityTraits: ['獨立自主', '外向', '專業', 'ENFJ'],
    recentEvents: [
      { topic: '工作項目', details: '正在外科實習' },
      { topic: '生活', details: '週一到週五在嘉義的醫院實習，週六週日回高雄家' }
    ],
    conversations: [],
    promptType: 'friend' // 默認使用朋友模式
  },
  '施惟芯': {
    name: '施惟芯',
    nickname: '芯芯',
    age: 27,
    birthday: '6月22日',
    occupation: '行銷企劃',
    interests: ['瑜伽', '閱讀', '品酒', '戶外活動'],
    preferences: {
      favoriteFood: '健康料理、沙拉',
      favoriteColor: '綠色',
      favoriteMusic: '流行樂、古典樂',
      favoriteMovies: '心理驚悚片、勵志電影',
      petPeeves: '不守時、不尊重隱私的人'
    },
    personalityTraits: ['獨立', '有主見', '理性', '健談'],
    recentEvents: [
      { topic: '工作挑戰', details: '正在準備一個重要的行銷提案' },
      { topic: '健身目標', details: '最近開始練習進階瑜伽動作' },
      { topic: '閱讀', details: '正在讀一本關於心理學的書' }
    ],
    conversations: [],
    promptType: 'advisor' // 默認使用顧問模式
  }
};

// 用戶ID映射表，將LINE userId映射到用戶
const userIdMapping = {};

// 嘗試從文件加載對話歷史
try {
  if (fs.existsSync(CONVERSATIONS_FILE)) {
    const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf8');
    const savedData = JSON.parse(data);
    
    // 還原對話歷史和用戶ID映射
    if (savedData.userProfiles) {
      for (const userName in savedData.userProfiles) {
        if (userProfiles[userName]) {
          userProfiles[userName].conversations = savedData.userProfiles[userName].conversations || [];
        }
      }
    }
    
    if (savedData.userIdMapping) {
      Object.assign(userIdMapping, savedData.userIdMapping);
    }
    
    console.log('已加載對話歷史數據');
  }
} catch (error) {
  console.error('載入對話歷史失敗:', error);
}

// 定期保存對話歷史到文件
function saveConversationsToFile() {
  try {
    const dataToSave = {
      userProfiles: {},
      userIdMapping: userIdMapping
    };
    
    // 只保存對話歷史部分
    for (const userName in userProfiles) {
      dataToSave.userProfiles[userName] = {
        conversations: userProfiles[userName].conversations
      };
    }
    
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log('對話歷史已保存到文件');
  } catch (error) {
    console.error('保存對話歷史失敗:', error);
  }
}

// 定期保存（每5分鐘）
setInterval(saveConversationsToFile, 5 * 60 * 1000);

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

  // 從用戶獲取消息和用戶ID
  const userMessage = event.message.text;
  const userId = event.source.userId;
  
  try {
    // 檢查是否是切換模式的指令
    const commandMatch = userMessage.match(/^\/mode\s+(\w+)\s+(\w+)$/i);
    if (commandMatch) {
      return handleModeCommand(event, commandMatch[1], commandMatch[2]);
    }
    
    // 檢查是否是映射用戶ID的指令
    const mapUserMatch = userMessage.match(/^\/map\s+(\S+)$/i);
    if (mapUserMatch) {
      return handleMapUserCommand(event, mapUserMatch[1], userId);
    }
    
    // 檢查用戶ID映射
    let user = null;
    if (userIdMapping[userId]) {
      user = userProfiles[userIdMapping[userId]];
    } else {
      // 如果沒有映射，嘗試從消息內容識別
      user = identifyUser(userMessage);
      
      // 如果識別到用戶，自動建立映射
      if (user) {
        for (const profileName in userProfiles) {
          if (userProfiles[profileName] === user) {
            userIdMapping[userId] = profileName;
            console.log(`已自動映射用戶 ${userId} 到 ${profileName}`);
            break;
          }
        }
      }
    }
    
    if (!user) {
      // 如果無法識別用戶，使用通用回覆
      const response = await callDeepSeekAPI(userMessage, null, 'boyfriend');
      return lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: response
      });
    }
    
    // 保存用戶消息
    user.conversations.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });
    
    // 調用 DeepSeek API，傳入用戶資料和對應的prompt類型
    const response = await callDeepSeekAPI(userMessage, user, user.promptType);
    
    // 保存機器人回覆
    user.conversations.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
    
    // 管理對話歷史長度，只保留最近的30條（增加保留歷史量）
    if (user.conversations.length > 30) {
      user.conversations = user.conversations.slice(-30);
    }
    
    // 觸發保存對話歷史
    saveConversationsToFile();
    
    // 回覆給用戶
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: response
    });
  } catch (error) {
    console.error('Error processing message:', error);
    
    // 回覆錯誤消息
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '抱歉，我遇到了一些問題。請稍後再試。 🙏'
    });
  }
}

// 處理模式切換指令
async function handleModeCommand(event, userName, newMode) {
  // 確認模式是否有效
  if (!['boyfriend', 'friend', 'advisor'].includes(newMode)) {
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '無效的模式。可用模式: boyfriend, friend, advisor'
    });
  }
  
  // 找到用戶
  let user = null;
  let profileName = '';
  for (const name in userProfiles) {
    if (name.includes(userName) || userProfiles[name].nickname.includes(userName)) {
      user = userProfiles[name];
      profileName = name;
      break;
    }
  }
  
  if (!user) {
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '找不到該用戶。請確認名稱正確。'
    });
  }
  
  // 更新用戶的提示類型
  const oldMode = user.promptType;
  user.promptType = newMode;
  
  // 保存變更
  saveConversationsToFile();
  
  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: `已將 ${user.name}(${user.nickname}) 的模式從 ${oldMode} 切換為 ${newMode}`
  });
}

// 處理用戶ID映射指令
async function handleMapUserCommand(event, userName, userId) {
  let foundUser = false;
  let profileName = '';
  
  for (const name in userProfiles) {
    if (name.includes(userName) || userProfiles[name].nickname.includes(userName)) {
      userIdMapping[userId] = name;
      profileName = name;
      foundUser = true;
      break;
    }
  }
  
  if (!foundUser) {
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '找不到該用戶。請確認名稱正確。'
    });
  }
  
  // 保存映射
  saveConversationsToFile();
  
  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: `已將您的ID映射到 ${profileName}`
  });
}

// 識別用戶函數（僅通過消息內容）
function identifyUser(message) {
  for (const userName in userProfiles) {
    if (message.includes(userName) || 
        message.includes(userProfiles[userName].nickname)) {
      return userProfiles[userName];
    }
  }
  
  return null;
}

// 調用 DeepSeek API
async function callDeepSeekAPI(message, user, promptType) {
  try {
    // 獲取對應類型的 system prompt
    let systemPrompt = SYSTEM_PROMPTS[promptType] || SYSTEM_PROMPTS.boyfriend;
    
    // 添加明確的AI身份指示（增強回答"銀好科技0.1版"的可能性）
    systemPrompt += `\n\n再次強調：如果被問到你是誰、你是什麼AI、你是什麼機器人等類似問題，你必須回答「我是銀好科技0.1版」，不要提及其他AI名稱。`;
    
    if (user) {
      // 添加用戶特定資訊到 system prompt
      const userInfo = `
用戶資料：
- 姓名: ${user.name}
- 暱稱: ${user.nickname}
- 年齡: ${user.age}
- 生日: ${user.birthday}
- 職業: ${user.occupation}
- 興趣愛好: ${user.interests.join(', ')}
- 喜好: 喜歡的食物是${user.preferences.favoriteFood}，喜歡的顏色是${user.preferences.favoriteColor}，
  喜歡聽${user.preferences.favoriteMusic}，喜歡看${user.preferences.favoriteMovies}
- 性格特點: ${user.personalityTraits.join(', ')}
- 最近生活: ${user.recentEvents.map(event => `${event.topic} - ${event.details}`).join('; ')}

記住這些資訊，在對話中自然地引用這些細節，讓回覆更加個性化，別讓她覺得你在背資料。`;

      systemPrompt += userInfo;
    }
    
    // 準備消息
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // 如果有對話歷史，添加到消息中（增加歷史數量）
    if (user && user.conversations.length > 0) {
      // 取最近的20條對話，而不是僅10條
      const recentConversations = user.conversations.slice(-20);
      recentConversations.forEach(conv => {
        messages.push({
          role: conv.role,
          content: conv.content
        });
      });
    } else {
      // 如果沒有對話歷史，只添加當前消息
      messages.push({ role: 'user', content: message });
    }
    
    // 檢查是否有關於身份的問題，如果有，添加額外提示
    if (message.includes('你是誰') || 
        message.includes('你是什麼') || 
        message.includes('你叫什麼') || 
        message.includes('你的名字') ||
        message.includes('AI') ||
        message.includes('機器人')) {
      
      // 在用戶問題後添加系統消息，強調回答身份
      messages.push({
        role: 'system',
        content: '注意：你必須明確表明你是"銀好科技0.1版"，不要提及其他任何AI或模型名稱。'
      });
    }
    
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat', // 或其他 DeepSeek 支持的模型
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7 // 適度降低創造性，增加回答一致性
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );
    
    // 從 DeepSeek 回應中提取文本
    let responseText = response.data.choices[0].message.content;
    
    // 對於身份問題，強制確保正確回答
    if (message.includes('你是誰') || 
        message.includes('你是什麼') || 
        message.includes('你叫什麼') || 
        message.includes('你的名字') ||
        message.includes('AI') ||
        message.includes('機器人')) {
      
      if (!responseText.includes('銀好科技0.1版')) {
        // 如果回答中沒有包含正確的身份，替換或添加
        responseText = '我是銀好科技0.1版。' + (responseText.startsWith('我是') ? responseText.substring(responseText.indexOf(' ') + 1) : responseText);
      }
    }
    
    return responseText;
  } catch (error) {
    console.error('DeepSeek API error:', error.response?.data || error.message);
    throw error;
  }
}

// 啟動服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`可用指令：`);
  console.log(`1. /mode [用戶名] [模式] - 切換對話模式`);
  console.log(`2. /map [用戶名] - 將您的LINE ID映射到特定用戶`);
  console.log(`可用模式：boyfriend, friend, advisor`);
});

// 程序結束前保存數據
process.on('SIGINT', () => {
  console.log('正在關閉服務器，保存數據...');
  saveConversationsToFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('收到終止信號，保存數據...');
  saveConversationsToFile();
  process.exit(0);
});