const http = require('http');

http.get('http://127.0.0.1:3000/api/players/account.82bad0072f31455d8d9f8d834da2f2f3?platform=steam', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const ids = (parsed.matchIds || []).slice(0, 3);
    
    http.get(`http://127.0.0.1:3000/api/matches/batch/list?platform=steam&ids=${ids.join(',')}`, (res2) => {
      let data2 = '';
      res2.on('data', d => data2 += d);
      res2.on('end', () => {
        const parsed2 = JSON.parse(data2);
        const match = parsed2.matches?.[0];
        if (match) {
          const p = match.participants?.[0];
          console.log('Participant fields:', Object.keys(p || {}));
        }
        console.log('heals test:', JSON.stringify(parsed2.matches?.[0]?.participants?.slice(0, 2)));
      });
    });
  });
});