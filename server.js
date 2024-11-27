const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// 启用CORS
app.use(cors());

// 静态文件服务
app.use(express.static('./'));

// 代理配置
app.use('/proxy', createProxyMiddleware({
    router: (req) => {
        // 从请求头中获取目标地址
        const target = req.headers['x-target-url'];
        if (!target) {
            throw new Error('Missing target URL');
        }
        return target;
    },
    changeOrigin: true,
    pathRewrite: {
        '^/proxy': ''
    },
    onError: (err, req, res) => {
        res.status(500).json({ error: 'Proxy Error', message: err.message });
    }
}));

const port = 3000;
app.listen(port, () => {
    console.log(`代理服务器运行在 http://localhost:${port}`);
}); 