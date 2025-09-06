// 1. 引入必要的库 (Import necessary libraries)
const express = require('express');
const axios = require('axios');
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');
// require('dotenv').config(); // 我们不再需要这一行

// 2. 创建 Express 应用 (Create Express app)
const app = express();
const PORT = process.env.PORT || 3000;

// --- 安全密钥配置 (Security Keys Configuration) ---
// 【重要修改】我们在这里直接写入密钥，不再从 .env 文件读取
const API_KEY = 'AIzaSyCcUxkWBvKO7EbMOhq8bc6gCakjBSmhIgs';
const JWT_SECRET = 'a-very-secret-and-long-string-for-jwt';

// 3. 中间件设置 (Middleware Setup)
app.use(cors()); // 允许跨域请求
app.use(express.json({ limit: '10mb' })); // 解析 JSON 请求体，并设置大小限制
app.use(express.static(path.join(__dirname, 'public'))); // 托管 public 文件夹中的静态文件 (如 index.html)

// --- 模拟数据库和验证码存储 ---
const users = {};
const verificationCodes = {};

// 4. API 路由 (API Routes)

// A. 发送手机验证码
app.post('/api/send-code', (req, res) => {
    const { phone } = req.body;
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: '无效的手机号码' });
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = Date.now() + 5 * 60 * 1000;
    verificationCodes[phone] = { code, expires };
    console.log(`发送验证码到 ${phone}: ${code}`);
    res.json({ success: true, message: '验证码已发送' });
});

// B. 验证验证码并登录/注册
app.post('/api/verify-code', (req, res) => {
    const { phone, code } = req.body;
    const storedCode = verificationCodes[phone];
    if (!storedCode || storedCode.code !== code || Date.now() > storedCode.expires) {
        return res.status(400).json({ error: '验证码错误或已过期' });
    }
    delete verificationCodes[phone];
    if (!users[phone]) {
        console.log(`新用户注册: ${phone}`);
        users[phone] = { phone };
    }
    const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
});

// C. JWT 认证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.sendStatus(401);
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// D. AI 功能的 API 代理 (受保护的路由)
app.post('/api/generateContent/:model(*)', authenticateToken, async (req, res) => {
    const { model } = req.params;
    // 【重要修改】这里的 API_KEY 现在是直接从上面读取的，非常可靠
    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    
    try {
        const response = await axios.post(googleApiUrl, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });
        res.json(response.data);
    } catch (error) {
        console.error('API 代理出错:', error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({ 
            error: '代理服务器处理请求失败',
            details: error.response?.data 
        });
    }
});

// 5. 托管前端应用 (Catch-all Route)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 6. 启动服务器 (Start the Server)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务器正在 http://0.0.0.0:${PORT} 上运行`);
});
