module.exports = function (kibana) {
  return new kibana.Plugin({
    name: 'kibi_timeline',
    require: ['kibana', 'elasticsearch', 'migrations'],
    uiExports: {
      visTypes: [
        'plugins/kibi_timeline_vis/kibi_timeline_vis'
      ]
    }
  });
};

