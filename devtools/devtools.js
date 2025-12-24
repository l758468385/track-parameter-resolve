// DevTools 扩展
chrome.devtools.panels.create(
  'Base64 Decoder',
  null,
  'devtools/panel.html',
  function() {
    console.log('Base64 Decoder DevTools 面板已创建');
  }
);
