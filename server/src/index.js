const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const playersRouter = require('./routes/players');
const seasonsRouter = require('./routes/seasons');
const matchesRouter = require('./routes/matches');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 请求限流
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: '请求过于频繁，请稍后再试' },
});
app.use('/api', limiter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!config.pubg.apiKey && config.pubg.apiKey !== 'your_pubg_api_key_here',
    platforms: config.pubg.platforms,
  });
});

// 路由
app.use('/api/players', playersRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/matches', matchesRouter);

// 启动服务器
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`\n🎯 PUBG 战绩查询 API 服务已启动`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   健康检查: http://localhost:${PORT}/api/health\n`);
  if (!config.pubg.apiKey || config.pubg.apiKey === 'your_pubg_api_key_here') {
    console.warn('⚠️  警告: 未设置 PUBG_API_KEY！');
    console.warn(`   请编辑 .env 文件或设置环境变量 PUBG_API_KEY\n`);
  }
});